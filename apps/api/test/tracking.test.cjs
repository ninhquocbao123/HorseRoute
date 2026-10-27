require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MilestoneType, LegStatus, OrderStatus, PlanStatus, Role } = require('@my-project/shared');
const {
  legIdSchema,
  createMilestoneSchema,
  buildMilestoneSchema,
  completeLegSchema,
  correctLegSchema,
} = require('../src/features/tracking/tracking.validation');
const { TrackingService } = require('../src/features/tracking/tracking.service');

test('Leg ID validation preserves large IDs and rejects unsafe inputs', () => {
  assert.equal(legIdSchema.parse('18446744073709551615'), '18446744073709551615');
  for (const bad of ['18446744073709551616', '0', '-5', 'abc', '1.2']) {
    assert.equal(legIdSchema.safeParse(bad).success, false);
  }
});

test('Milestone schema validates enum, UTC ISO timestamp, rejects future and old retroactive times', () => {
  const now = new Date();
  const validRecent = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  // Valid
  assert.ok(createMilestoneSchema.safeParse({ milestoneType: MilestoneType.DEPARTED, occurredAt: validRecent }).success);
  assert.ok(createMilestoneSchema.safeParse({ milestoneType: MilestoneType.ARRIVED_AT_STOP, occurredAt: validRecent }).success);
  assert.ok(createMilestoneSchema.safeParse({ milestoneType: MilestoneType.CUSTOMS_CLEARED, occurredAt: validRecent }).success);
  assert.ok(createMilestoneSchema.safeParse({ milestoneType: MilestoneType.DELIVERED, occurredAt: validRecent }).success);

  // Invalid milestone type
  assert.equal(createMilestoneSchema.safeParse({ milestoneType: 'UNKNOWN', occurredAt: validRecent }).success, false);

  // Future timestamp (more than 60s ahead)
  const futureTime = new Date(now.getTime() + 120 * 1000).toISOString();
  assert.equal(createMilestoneSchema.safeParse({ milestoneType: MilestoneType.DEPARTED, occurredAt: futureTime }).success, false);

  // Retroactive exceeding 120 minutes (T = 120)
  const tooOldTime = new Date(now.getTime() - 150 * 60 * 1000).toISOString();
  assert.equal(createMilestoneSchema.safeParse({ milestoneType: MilestoneType.DEPARTED, occurredAt: tooOldTime }).success, false);

  // Invalid datetime format (missing Z, local time)
  assert.equal(createMilestoneSchema.safeParse({ milestoneType: MilestoneType.DEPARTED, occurredAt: '2026-10-18 10:00:00' }).success, false);
});

test('Correct leg schema requires valid status and non-empty trimmed reason (1-255 chars)', () => {
  assert.deepEqual(correctLegSchema.parse({ status: LegStatus.MOVING, reason: '  Đường thông thoáng  ' }), {
    status: LegStatus.MOVING,
    reason: 'Đường thông thoáng',
  });

  // Empty or whitespace-only reason rejected
  for (const bad of [
    { status: LegStatus.MOVING, reason: '' },
    { status: LegStatus.MOVING, reason: '   ' },
    { status: LegStatus.MOVING, reason: 'a'.repeat(256) },
    { status: 'INVALID', reason: 'valid reason' },
  ]) {
    assert.equal(correctLegSchema.safeParse(bad).success, false);
  }
});

test('TrackingService enforces role authorization boundaries', async () => {
  const service = new TrackingService({});

  // Only DRIVER_ESCORT can get driver trips
  for (const role of [Role.CUSTOMER, Role.MANAGER, Role.COORDINATOR, Role.SPECIALIST, Role.ADMIN]) {
    await assert.rejects(
      () => service.getDriverTrips({ id: '1', role }),
      e => e.getStatus() === 403
    );
  }

  // Only DRIVER_ESCORT can record milestones
  for (const role of [Role.CUSTOMER, Role.MANAGER, Role.COORDINATOR, Role.SPECIALIST, Role.ADMIN]) {
    await assert.rejects(
      () => service.recordMilestone({ id: '1', role }, '100', { milestoneType: 'DEPARTED', occurredAt: new Date().toISOString() }),
      e => e.getStatus() === 403
    );
  }

  // Only COORDINATOR or MANAGER can correct leg status
  for (const role of [Role.CUSTOMER, Role.DRIVER_ESCORT, Role.SPECIALIST, Role.ADMIN]) {
    await assert.rejects(
      () => service.correctLeg({ id: '1', role }, '100', { status: 'MOVING', reason: 'Sửa lỗi' }),
      e => e.getStatus() === 403
    );
  }
});

test('Milestone recording enforces sequential leg transitions and Order state changes', async () => {
  let auditedLeg = false;
  let auditedOrder = false;
  let updatedOrder = null;
  let updatedLeg = null;
  let blockers = [{ code: 'MISSING_ESCORT', message: 'Chưa có người hộ tống hợp lệ.' }];

  const mockRepo = {
    transaction: work => work(mockRepo),
    lockLegForUpdate: async () => ({
      id: '10',
      tripId: '100',
      seqNo: 1,
      status: LegStatus.NOT_STARTED,
      fromLocationId: '1',
      toLocationId: '2',
      toLocationType: 'REST_STOP',
      orderId: '50',
      orderCode: 'WDP-TEST-01',
      orderStatus: OrderStatus.READY,
      planStatus: PlanStatus.APPROVED,
      plannedBy: '3',
      customerId: '2',
    }),
    getMaxRetroactiveMinutes: async () => 120,
    getDriverAssignment: async () => ({ role: 'DRIVER' }),
    hasMilestone: async () => false,
    lockAllTripLegs: async () => [
      { id: '10', seqNo: 1, status: LegStatus.NOT_STARTED, toLocationType: 'REST_STOP' },
      { id: '11', seqNo: 2, status: LegStatus.NOT_STARTED, toLocationType: 'REST_STOP' },
    ],
    updateOrderStatus: async (id, status) => { updatedOrder = status; },
    getDepartureBlockers: async () => (blockers),
    updateLegDeparture: async (id, time, actor) => { updatedLeg = 'MOVING'; },
    insertMilestone: async () => '1',
    audit: async (actor, entityType) => {
      if (entityType === 'ORDER') auditedOrder = true;
      if (entityType === 'LEG') auditedLeg = true;
    },
    notify: async () => {},
  };

  const service = new TrackingService(mockRepo);
  const now = new Date().toISOString();

  // 0. Điều kiện Flow 3 (nhân sự/xe/ngựa) bị hỏng sau khi READY: không cho xuất phát, không ghi gì
  await assert.rejects(
    () => service.recordMilestone({ id: '5', role: Role.DRIVER_ESCORT }, '10', { milestoneType: MilestoneType.DEPARTED, occurredAt: now }),
    e => e.getStatus() === 409 && /hộ tống/.test(JSON.stringify(e.getResponse()))
  );
  assert.equal(updatedOrder, null);
  blockers = [];

  // 1. Depart on first leg: should move Order to IN_TRANSIT
  const result = await service.recordMilestone(
    { id: '5', role: Role.DRIVER_ESCORT },
    '10',
    { milestoneType: MilestoneType.DEPARTED, occurredAt: now }
  );

  assert.equal(result.legStatus, LegStatus.MOVING);
  assert.equal(result.orderStatus, OrderStatus.IN_TRANSIT);
  assert.equal(updatedOrder, OrderStatus.IN_TRANSIT);
  assert.equal(updatedLeg, LegStatus.MOVING);
  assert.ok(auditedOrder);
  assert.ok(auditedLeg);

  // 2. Cannot record DELIVERED on non-last leg
  await assert.rejects(
    () => service.recordMilestone(
      { id: '5', role: Role.DRIVER_ESCORT },
      '10',
      { milestoneType: MilestoneType.DELIVERED, occurredAt: now }
    ),
    e => e.getStatus() === 400
  );

  // 3. Cannot record CUSTOMS_CLEARED on non-border location
  await assert.rejects(
    () => service.recordMilestone(
      { id: '5', role: Role.DRIVER_ESCORT },
      '10',
      { milestoneType: MilestoneType.CUSTOMS_CLEARED, occurredAt: now }
    ),
    e => e.getStatus() === 409 // Leg is NOT_STARTED in mock, so 409
  );
});

test('Milestone retroactive window T is configurable', () => {
  const t90 = new Date(Date.now() - 90 * 60 * 1000).toISOString();
  assert.ok(buildMilestoneSchema(120).safeParse({ milestoneType: MilestoneType.DEPARTED, occurredAt: t90 }).success);
  assert.equal(buildMilestoneSchema(60).safeParse({ milestoneType: MilestoneType.DEPARTED, occurredAt: t90 }).success, false);
  assert.equal(completeLegSchema.safeParse({}).success, false);
  assert.ok(completeLegSchema.safeParse({ occurredAt: new Date().toISOString() }).success);
});

function legRow(overrides = {}) {
  return {
    id: '10', tripId: '100', seqNo: 1, status: LegStatus.NOT_STARTED, toLocationType: 'REST_STOP',
    actualDepartureAt: null, actualArrivalAt: null,
    orderId: '50', orderCode: 'WDP-1', orderStatus: OrderStatus.READY, planStatus: PlanStatus.APPROVED,
    plannedBy: '3', customerId: '2', ...overrides,
  };
}

test('Milestone requires an APPROVED plan and a time not before the previous milestone', async () => {
  const driver = { id: '5', role: Role.DRIVER_ESCORT };
  const repoFor = leg => {
    const repo = {
      transaction: work => work(repo),
      getMaxRetroactiveMinutes: async () => 120,
      lockLegForUpdate: async () => leg,
      getDriverAssignment: async () => ({ role: 'DRIVER' }),
      hasMilestone: async () => false,
      lockAllTripLegs: async () => [{ id: '10', seqNo: 1 }, { id: '11', seqNo: 2 }],
      getDepartureBlockers: async () => [], updateOrderStatus: async () => {}, updateLegDeparture: async () => {}, updateLegArrival: async () => {},
      insertMilestone: async () => '1', audit: async () => {}, notify: async () => {},
    };
    return repo;
  };
  const now = new Date().toISOString();

  await assert.rejects(
    () => new TrackingService(repoFor(legRow({ planStatus: PlanStatus.PENDING_APPROVAL }))).recordMilestone(driver, '10', { milestoneType: MilestoneType.DEPARTED, occurredAt: now }),
    e => e.getStatus() === 409
  );

  const departed = new Date(Date.now() - 10 * 60 * 1000);
  const before = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  await assert.rejects(
    () => new TrackingService(repoFor(legRow({ status: LegStatus.MOVING, actualDepartureAt: departed }))).recordMilestone(driver, '10', { milestoneType: MilestoneType.ARRIVED_AT_STOP, occurredAt: before }),
    e => e.getStatus() === 400
  );
});

test('Intermediate completion rejects the last leg and non-AT_STOP legs, and notifies the customer', async () => {
  const driver = { id: '5', role: Role.DRIVER_ESCORT };
  const notified = [];
  const make = (leg, total) => {
    const repo = {
      transaction: work => work(repo),
      getMaxRetroactiveMinutes: async () => 120,
      lockLegForUpdate: async () => leg,
      getDriverAssignment: async () => ({ role: 'DRIVER' }),
      lockAllTripLegs: async () => Array.from({ length: total }, (_, i) => ({ id: String(10 + i), seqNo: i + 1 })),
      hasMilestone: async () => true,
      updateLegStatus: async () => {}, audit: async () => {},
      notify: async (recipient, type) => { notified.push([recipient, type]); },
    };
    return new TrackingService(repo);
  };
  const body = { occurredAt: new Date().toISOString() };

  await assert.rejects(() => make(legRow({ seqNo: 2, status: LegStatus.AT_STOP }), 2).completeIntermediateLeg(driver, '11', body), e => e.getStatus() === 400);
  await assert.rejects(() => make(legRow({ status: LegStatus.MOVING }), 2).completeIntermediateLeg(driver, '10', body), e => e.getStatus() === 409);
  await assert.rejects(() => make(legRow({ status: LegStatus.AT_STOP }), 2).completeIntermediateLeg(driver, '10', {}), e => e.getStatus() === 400);

  const result = await make(legRow({ status: LegStatus.AT_STOP }), 2).completeIntermediateLeg(driver, '10', body);
  assert.equal(result.status, LegStatus.COMPLETED);
  assert.deepEqual(notified.map(n => n[0]).sort(), ['2', '3']);
});

function correctionRepo({ leg, legs, milestones = [], calls = {} }) {
  const repo = {
    transaction: work => work(repo),
    lockLegForUpdate: async () => leg,
    lockAllTripLegs: async () => legs,
    getLegMilestoneRecords: async () => milestones,
    deleteMilestones: async ids => { calls.deleted = ids; },
    insertMilestone: async (legId, type) => { (calls.inserted ||= []).push(type); return '1'; },
    updateLegCorrection: async (id, status, dep, arr) => { calls.leg = { status, dep, arr }; },
    updateOrderStatus: async (id, status) => { calls.order = status; },
    getDepartureBlockers: async () => [],
    audit: async (actor, entity, id, action, oldV, newV) => { (calls.audits ||= []).push({ entity, action, oldV, newV }); },
    notifyStakeholders: async () => { calls.notified = true; },
  };
  return repo;
}

test('Coordinator leg correction enforces ownership, order state and leg sequence', async () => {
  const coord = { id: '3', role: Role.COORDINATOR };
  const body = { status: LegStatus.AT_STOP, reason: 'Xe đã tới nơi' };
  const departed = new Date('2026-10-18T01:00:00Z');
  const twoLegs = [{ id: '10', seqNo: 1, status: LegStatus.MOVING }, { id: '11', seqNo: 2, status: LegStatus.NOT_STARTED }];
  const moving = legRow({ status: LegStatus.MOVING, orderStatus: OrderStatus.IN_TRANSIT, actualDepartureAt: departed });

  // Not the trip owner
  await assert.rejects(() => new TrackingService(correctionRepo({ leg: moving, legs: twoLegs })).correctLeg({ id: '99', role: Role.COORDINATOR }, '10', body), e => e.getStatus() === 403);
  // Same status
  await assert.rejects(() => new TrackingService(correctionRepo({ leg: moving, legs: twoLegs })).correctLeg(coord, '10', { ...body, status: LegStatus.MOVING }), e => e.getStatus() === 400);
  // Cancelled order cannot be corrected
  await assert.rejects(() => new TrackingService(correctionRepo({ leg: { ...moving, orderStatus: OrderStatus.CANCELLED }, legs: twoLegs })).correctLeg(coord, '10', body), e => e.getStatus() === 409);
  // Cannot start leg 2 while leg 1 is not COMPLETED
  await assert.rejects(
    () => new TrackingService(correctionRepo({ leg: legRow({ id: '11', seqNo: 2 }), legs: twoLegs })).correctLeg(coord, '11', { ...body, status: LegStatus.MOVING }),
    e => e.getStatus() === 409
  );

  // Valid: MOVING -> AT_STOP adds the ARRIVED milestone and keeps order IN_TRANSIT
  const calls = {};
  const res = await new TrackingService(correctionRepo({ leg: moving, legs: twoLegs, milestones: [{ id: '1', milestoneType: MilestoneType.DEPARTED, occurredAt: departed }], calls })).correctLeg(coord, '10', body);
  assert.equal(res.status, LegStatus.AT_STOP);
  assert.equal(res.orderStatus, OrderStatus.IN_TRANSIT);
  assert.deepEqual(calls.inserted, [MilestoneType.ARRIVED_AT_STOP]);
  assert.equal(calls.order, undefined);
  assert.ok(calls.audits.some(a => a.entity === 'LEG' && a.action === 'CORRECT_LEG_STATUS'));
  assert.ok(calls.notified);
});

test('Correcting a leg back to NOT_STARTED removes later milestones and returns the order to READY', async () => {
  const calls = {};
  const leg = legRow({ status: LegStatus.MOVING, orderStatus: OrderStatus.IN_TRANSIT, actualDepartureAt: new Date() });
  const repo = correctionRepo({ leg, legs: [{ id: '10', seqNo: 1, status: LegStatus.MOVING }, { id: '11', seqNo: 2, status: LegStatus.NOT_STARTED }], milestones: [{ id: '7', milestoneType: MilestoneType.DEPARTED, occurredAt: new Date() }], calls });
  const res = await new TrackingService(repo).correctLeg({ id: '2', role: Role.MANAGER }, '10', { status: LegStatus.NOT_STARTED, reason: 'Báo nhầm xuất phát' });
  assert.equal(res.orderStatus, OrderStatus.READY);
  assert.deepEqual(calls.deleted, ['7']);
  assert.deepEqual(calls.leg, { status: LegStatus.NOT_STARTED, dep: null, arr: null });
  assert.equal(calls.order, OrderStatus.READY);
});

test('Correcting the last leg to COMPLETED adds DELIVERED and moves the order to DELIVERED', async () => {
  const calls = {};
  const leg = legRow({ id: '11', seqNo: 2, status: LegStatus.AT_STOP, orderStatus: OrderStatus.IN_TRANSIT, actualDepartureAt: new Date(Date.now() - 3600000), actualArrivalAt: new Date(Date.now() - 1800000) });
  const repo = correctionRepo({
    leg,
    legs: [{ id: '10', seqNo: 1, status: LegStatus.COMPLETED }, { id: '11', seqNo: 2, status: LegStatus.AT_STOP }],
    milestones: [{ id: '1', milestoneType: MilestoneType.DEPARTED }, { id: '2', milestoneType: MilestoneType.ARRIVED_AT_STOP }],
    calls,
  });
  const res = await new TrackingService(repo).correctLeg({ id: '3', role: Role.COORDINATOR }, '11', { status: LegStatus.COMPLETED, reason: 'Đã giao thực tế' });
  assert.equal(res.orderStatus, OrderStatus.DELIVERED);
  assert.deepEqual(calls.inserted, [MilestoneType.DELIVERED]);
});

test('Trip detail is not available to customers', async () => {
  await assert.rejects(() => new TrackingService({}).getTripDetail({ id: '2', role: Role.CUSTOMER }, '100'), e => e.getStatus() === 403);
});

function tripDetailRepo(overrides = {}) {
  return {
    findTrip: async () => ({ id: '100', orderId: '50', orderCode: 'WDP-1', orderStatus: OrderStatus.READY, planStatus: PlanStatus.APPROVED, plannedDepartureAt: null, plannedArrivalAt: null, plannedBy: '3', customerId: '1' }),
    getDriverAssignment: async () => ({ role: 'DRIVER' }),
    getTripLegs: async () => [],
    getTripHorses: async () => [],
    getLegMilestones: async () => [],
    getTripCrew: async () => [
      { userId: '6', name: 'Tài Xế', phone: '0901', role: 'DRIVER' },
      { userId: '10', name: 'Hộ Tống', phone: null, role: 'ESCORT' },
    ],
    getTripContacts: async () => ({ customerName: 'Khách Một', recipientName: 'Người Nhận', recipientPhone: '+65 1234', coordinatorName: 'Điều Phối A', coordinatorPhone: '0903' }),
    getTripVehicles: async () => [{ id: '5', code: 'XE-01', type: 'TRUCK', capacityStalls: '4' }],
    getEmergencyHotline: async () => '1900 1080',
    ...overrides,
  };
}

test('Trip detail returns crew, customer, recipient, coordinator and vehicles', async () => {
  const detail = await new TrackingService(tripDetailRepo()).getTripDetail({ id: '6', role: Role.DRIVER_ESCORT }, '100');
  assert.equal(detail.crewRole, 'DRIVER');
  assert.deepEqual(detail.crew, [
    { userId: '6', name: 'Tài Xế', phone: '0901', role: 'DRIVER' },
    { userId: '10', name: 'Hộ Tống', phone: null, role: 'ESCORT' },
  ]);
  assert.deepEqual(detail.customer, { name: 'Khách Một' });
  assert.deepEqual(detail.recipient, { name: 'Người Nhận', phone: '+65 1234' });
  assert.deepEqual(detail.coordinator, { name: 'Điều Phối A', phone: '0903' });
  assert.deepEqual(detail.vehicles, [{ id: '5', code: 'XE-01', type: 'TRUCK', capacityStalls: 4 }]);
  assert.equal(detail.emergencyHotline, '1900 1080');
});

test('Trip detail returns recipient null when the order has no recipient name or phone', async () => {
  const repo = tripDetailRepo({
    getTripContacts: async () => ({ customerName: 'Khách Một', recipientName: null, recipientPhone: null, coordinatorName: 'Điều Phối A', coordinatorPhone: '0903' }),
    getEmergencyHotline: async () => null,
  });
  const detail = await new TrackingService(repo).getTripDetail({ id: '2', role: Role.MANAGER }, '100');
  assert.equal(detail.recipient, null);
  assert.equal(detail.emergencyHotline, null, 'no HOTLINE row → null, not an error');
  assert.equal(detail.crewRole, undefined);
  assert.equal(detail.coordinator.phone, '0903');
});

test('Trip detail hides crew and coordinator phones from specialists', async () => {
  const detail = await new TrackingService(tripDetailRepo()).getTripDetail({ id: '7', role: Role.SPECIALIST }, '100');
  assert.ok(detail.crew.every(c => c.phone === null));
  assert.deepEqual(detail.coordinator, { name: 'Điều Phối A', phone: null });
  assert.deepEqual(detail.recipient, { name: 'Người Nhận', phone: null });
  assert.equal(detail.crew.length, 2);
});

// ─── Giai đoạn 2 ──────────────────────────────────────────────────────────────
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(32, 1)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(32, 1)]);
const photo = (buffer = PNG, name = 'ngua.png') => ({ buffer, originalname: name, size: buffer.length });
const driver = { id: '5', role: Role.DRIVER_ESCORT };
const escort = { id: '6', role: Role.DRIVER_ESCORT };
const coordinator = { id: '3', role: Role.COORDINATOR };
const now = () => new Date().toISOString();

function stage2Repo(overrides = {}, calls = {}) {
  const repo = {
    transaction: work => work(repo),
    lockLegForUpdate: async () => legRow({ status: LegStatus.MOVING, orderStatus: OrderStatus.IN_TRANSIT }),
    getDriverAssignment: async (_trip, userId) => ({ role: userId === '6' ? 'ESCORT' : 'DRIVER' }),
    findTrip: async () => ({ id: '100', orderId: '50', orderCode: 'WDP-1', orderStatus: OrderStatus.IN_TRANSIT, plannedBy: '3', customerId: '2' }),
    checkHorseBelongsToOrder: async () => true,
    getFirstLegId: async () => '10',
    findHorseLog: async () => ({ id: '9', horseId: '21', legId: '10', tripId: '100' }),
    legBelongsToTrip: async () => true,
    insertHorseLog: async (...args) => { calls.horseLog = args; return '601'; },
    insertAttachmentRecord: async (...args) => { (calls.attachments ||= []).push(args); return '501'; },
    getTripHorseLogs: async () => [{ id: '601', horseId: '21', horseName: 'Ngựa', legId: '10', conditionStatus: 'STABLE', note: null, loggedAt: new Date(), createdBy: '5', createdByName: 'Tài xế', correctsLogId: null }],
    getHorseLogAttachments: async () => [],
    insertIncident: async input => { calls.incident = input; return '701'; },
    getTripIncidents: async () => [{ id: '701', tripId: '100', legId: null, horseId: '21', horseName: 'Ngựa', incidentType: 'HORSE_MEDICAL', description: 'Đau bụng', urgency: 'HIGH', status: calls.incidentStatus || 'NEW', reportedBy: '5', reportedByName: 'Tài xế', reportedAt: new Date(), receivedBy: null, handlingNote: null, closedAt: null }],
    getIncidentAttachments: async () => [],
    findIncident: async () => ({ id: '701', tripId: '100', status: calls.incidentStatus || 'NEW', reportedBy: '5', plannedBy: '3', customerId: '2' }),
    updateIncidentStatus: async (...args) => { calls.incidentUpdate = args; },
    insertAlert: async (...args) => { calls.alert = args; return '801'; },
    getTripAlerts: async () => [{ id: '801', tripId: '100', alertType: 'WEATHER', content: 'Mưa lớn', sentBy: '3', sentByName: 'Điều phối', sentAt: new Date() }],
    notifyManagersAndCoordinators: async (...args) => { calls.notifiedIncident = args; },
    notifyCrewAndManagers: async (...args) => { calls.notifiedAlert = args; },
    notify: async (...args) => { (calls.notified ||= []).push(args); },
    audit: async (...args) => { (calls.audits ||= []).push(args); },
    findAttachment: async () => ({ id: '501', originalName: 'a.png', fileType: 'PNG', storagePath: 'x', tripId: '100', horseLogId: null, incidentId: '701' }),
    ...overrides,
  };
  return repo;
}

test('Horse log: only driver, valid references, order in transit, and correction must match horse and trip', async () => {
  const body = { horseId: '21', conditionStatus: 'OFF_FEED', note: 'Bỏ ăn', loggedAt: now() };
  await assert.rejects(() => new TrackingService(stage2Repo()).createHorseLog(coordinator, '10', body), e => e.getStatus() === 403);
  await assert.rejects(() => new TrackingService(stage2Repo()).createHorseLog(escort, '10', { ...body, conditionStatus: 'SICK' }), e => e.getStatus() === 400);
  await assert.rejects(() => new TrackingService(stage2Repo()).createHorseLog(escort, '10', { ...body, loggedAt: new Date(Date.now() + 3600000).toISOString() }), e => e.getStatus() === 400);
  // Quyết định 6.2: READY được ghi vào chặng đầu; chặng khác của đơn READY, đơn DELIVERED hoặc chặng IN_TRANSIT chưa xuất phát thì 409
  await assert.rejects(() => new TrackingService(stage2Repo({ getFirstLegId: async () => '11', lockLegForUpdate: async () => legRow({ status: LegStatus.NOT_STARTED, orderStatus: OrderStatus.READY }) })).createHorseLog(escort, '10', body), e => e.getStatus() === 409);
  await assert.rejects(() => new TrackingService(stage2Repo({ lockLegForUpdate: async () => legRow({ status: LegStatus.COMPLETED, orderStatus: OrderStatus.DELIVERED }) })).createHorseLog(escort, '10', body), e => e.getStatus() === 409);
  await assert.rejects(() => new TrackingService(stage2Repo({ lockLegForUpdate: async () => legRow({ status: LegStatus.NOT_STARTED, orderStatus: OrderStatus.IN_TRANSIT }) })).createHorseLog(escort, '10', body), e => e.getStatus() === 409);
  await assert.rejects(() => new TrackingService(stage2Repo({ checkHorseBelongsToOrder: async () => false })).createHorseLog(escort, '10', body), e => e.getStatus() === 400);
  await assert.rejects(() => new TrackingService(stage2Repo({ getDriverAssignment: async () => undefined })).createHorseLog(escort, '10', body), e => e.getStatus() === 403);
  await assert.rejects(() => new TrackingService(stage2Repo({ findHorseLog: async () => ({ id: '9', horseId: '22', legId: '10', tripId: '100' }) })).createHorseLog(escort, '10', { ...body, correctsLogId: '9' }), e => e.getStatus() === 400);

  const calls = {};
  const log = await new TrackingService(stage2Repo({}, calls)).createHorseLog(escort, '10', { ...body, note: '', correctsLogId: '9' });
  assert.equal(log.id, '601');
  assert.equal(calls.horseLog[3], null, 'empty multipart note becomes null');
  assert.equal(calls.horseLog[6], '9');
  assert.ok(calls.audits.some(a => a[1] === 'HORSE_LOG'));
});

test('Horse log photos: PDF rejected, files stored with the log and removed again when the transaction fails', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-track-'));
  process.env.DOCUMENT_STORAGE_DIR = dir;
  process.env.DOCUMENT_STORAGE_PROVIDER = 'local';
  const body = { horseId: '21', conditionStatus: 'STABLE', loggedAt: now() };
  try {
    await assert.rejects(() => new TrackingService(stage2Repo()).createHorseLog(escort, '10', body, [photo(PDF, 'a.pdf')]), e => e.getStatus() === 400);
    assert.equal(fs.readdirSync(dir).length, 0);

    const calls = {};
    await new TrackingService(stage2Repo({}, calls)).createHorseLog(escort, '10', body, [photo(), photo()]);
    assert.equal(calls.attachments.length, 2);
    assert.equal(calls.attachments[0][1], 'PNG');
    assert.equal(calls.attachments[0][5], '601');
    assert.equal(fs.readdirSync(dir).length, 2);

    await assert.rejects(
      () => new TrackingService(stage2Repo({ insertHorseLog: async () => { throw new Error('db down'); } })).createHorseLog(escort, '10', body, [photo()]),
      /db down/
    );
    assert.equal(fs.readdirSync(dir).length, 2, 'failed request leaves no orphan file');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Incident: HORSE_MEDICAL needs a horse and is HIGH urgency; managers and coordinator are notified', async () => {
  const base = { incidentType: 'VEHICLE_BREAKDOWN', description: 'Hỏng bánh xe', severity: 'ORANGE', damageTarget: 'VEHICLE' };
  await assert.rejects(() => new TrackingService(stage2Repo()).createIncident(coordinator, '100', base), e => e.getStatus() === 403);
  await assert.rejects(() => new TrackingService(stage2Repo()).createIncident(driver, '100', { incidentType: 'HORSE_MEDICAL', description: 'Đau bụng', severity: 'YELLOW', damageTarget: 'HORSE' }), e => e.getStatus() === 400);
  await assert.rejects(() => new TrackingService(stage2Repo({ getDriverAssignment: async () => undefined })).createIncident(driver, '100', base), e => e.getStatus() === 404);
  await assert.rejects(() => new TrackingService(stage2Repo({ findTrip: async () => ({ id: '100', orderId: '50', orderCode: 'W', orderStatus: OrderStatus.DELIVERED, plannedBy: '3' }) })).createIncident(driver, '100', base), e => e.getStatus() === 409);
  await assert.rejects(() => new TrackingService(stage2Repo({ legBelongsToTrip: async () => false })).createIncident(driver, '100', { ...base, legId: '999' }), e => e.getStatus() === 400);

  // 5.4: chuyến READY (chưa xuất phát) vẫn được báo sự cố.
  const readyCalls = {};
  const readyRepo = stage2Repo({ findTrip: async () => ({ id: '100', orderId: '50', orderCode: 'W', orderStatus: OrderStatus.READY, plannedBy: '3', customerId: '2' }) }, readyCalls);
  const readyIncident = await new TrackingService(readyRepo).createIncident(driver, '100', base);
  assert.equal(readyIncident.id, '701');
  assert.equal(readyCalls.incident.urgency, 'NORMAL');
  assert.ok(readyCalls.notifiedIncident, 'coordinator and managers are notified for a READY trip too');

  const calls = {};
  const medical = await new TrackingService(stage2Repo({}, calls)).createIncident(driver, '100', { incidentType: 'HORSE_MEDICAL', description: 'Đau bụng', horseId: '21', legId: '', severity: 'YELLOW', damageTarget: 'HORSE' });
  assert.equal(medical.urgency, 'HIGH');
  assert.equal(calls.incident.urgency, 'HIGH', 'HORSE_MEDICAL is HIGH even when severity is YELLOW');
  assert.equal(calls.incident.legId, null, 'blank legId is ignored');
  assert.match(calls.notifiedIncident[2], /KHẨN/);

  const normalCalls = {};
  await new TrackingService(stage2Repo({}, normalCalls)).createIncident(driver, '100', base);
  assert.equal(normalCalls.incident.urgency, 'NORMAL', 'ORANGE + VEHICLE is NORMAL');
  assert.equal(normalCalls.incident.severity, 'ORANGE');
  assert.equal(normalCalls.incident.damageTarget, 'VEHICLE');
});

test('Incident D2 fields: severity and damage target required, sub-type must match the type, RED is HIGH, captions saved per photo', async () => {
  const base = { incidentType: 'VEHICLE_BREAKDOWN', description: 'Nổ lốp sau', severity: 'RED', damageTarget: 'VEHICLE' };
  const rejects = (body, files = [], message) => assert.rejects(() => new TrackingService(stage2Repo()).createIncident(driver, '100', body, files), e => e.getStatus() === 400, message);
  await rejects({ ...base, severity: undefined }, [], 'severity is required');
  await rejects({ ...base, severity: 'PURPLE' }, [], 'unknown severity');
  await rejects({ ...base, damageTarget: undefined }, [], 'damageTarget is required');
  await rejects({ ...base, subType: 'COLIC' }, [], 'COLIC belongs to HORSE_MEDICAL, not VEHICLE_BREAKDOWN');
  await rejects({ ...base, latitude: '10.5' }, [], 'latitude without longitude');
  await rejects({ ...base, latitude: '95', longitude: '106' }, [], 'latitude out of range');
  await rejects({ ...base, locationText: 'x'.repeat(256) }, [], 'locationText too long');
  await rejects({ ...base, captions: ['a'.repeat(101)] }, [photo()], 'caption too long');
  await rejects({ ...base, captions: ['Lốp sau', 'Toàn xe'] }, [photo()], 'more captions than photos');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-incident-'));
  process.env.DOCUMENT_STORAGE_DIR = dir;
  process.env.DOCUMENT_STORAGE_PROVIDER = 'local';
  try {
    const calls = {};
    // Multipart: trường số đến dưới dạng chuỗi; một nhãn ảnh là chuỗi, nhiều nhãn là mảng.
    await new TrackingService(stage2Repo({}, calls)).createIncident(driver, '100', {
      ...base, subType: 'TIRE_BURST', latitude: '18.342100', longitude: '105.905700', locationText: '', captions: ['Lốp sau', 'Toàn xe'],
    }, [photo(), photo(PNG, 'xe.png')]);
    assert.equal(calls.incident.urgency, 'HIGH', 'RED is HIGH');
    assert.equal(calls.incident.subType, 'TIRE_BURST');
    assert.equal(calls.incident.latitude, 18.3421);
    assert.equal(calls.incident.longitude, 105.9057);
    assert.equal(calls.incident.locationText, null, 'blank locationText is ignored');
    assert.deepEqual(calls.attachments.map(args => args[7]), ['Lốp sau', 'Toàn xe'], 'caption stored with its photo');

    const one = {};
    await new TrackingService(stage2Repo({}, one)).createIncident(driver, '100', { ...base, severity: 'YELLOW', locationText: 'Km 742 QL1A', captions: 'Toàn xe' }, [photo(), photo()]);
    assert.equal(one.incident.urgency, 'NORMAL');
    assert.equal(one.incident.locationText, 'Km 742 QL1A');
    assert.deepEqual(one.attachments.map(args => args[7]), ['Toàn xe', null], 'photo without caption stores null');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Incident reads: specialist cannot see incidents, specialist can read horse logs and alerts', async () => {
  const specialist = { id: '8', role: Role.SPECIALIST };
  const service = new TrackingService(stage2Repo());
  await assert.rejects(() => service.getTripIncidents(specialist, '100'), e => e.getStatus() === 403);
  await assert.rejects(() => service.getTripIncidents({ id: '99', role: Role.COORDINATOR }, '100'), e => e.getStatus() === 404);
  assert.equal((await service.getTripIncidents({ id: '2', role: Role.MANAGER }, '100')).length, 1);
  assert.equal((await service.getTripHorseLogs(specialist, '100')).length, 1);
  assert.equal((await service.getTripAlerts(driver, '100')).length, 1);
  // Cảnh báo kèm thông báo của chính người xem: repo nhận mã người xem; không ghép được thì null
  const seen = {};
  const withNotice = new TrackingService(stage2Repo({ getTripAlerts: async (tripId, recipient) => { seen.recipient = recipient; return [
    { id: '801', tripId, alertType: 'WEATHER', content: 'Mưa lớn', sentBy: '3', sentByName: 'Điều phối', sentAt: new Date(), notificationId: '51', notificationRead: 1 },
    { id: '802', tripId, alertType: 'TRAFFIC', content: 'Kẹt xe', sentBy: '3', sentByName: 'Điều phối', sentAt: new Date(), notificationId: null, notificationRead: null },
  ]; } }));
  const linked = await withNotice.getTripAlerts(driver, '100');
  assert.equal(seen.recipient, '5');
  assert.deepEqual(linked.map(a => [a.notificationId, a.notificationRead]), [['51', true], [null, null]]);
});

test('Incident handling: coordinator only, close needs a note, one-way status flow', async () => {
  const ack = { status: 'ACKNOWLEDGED' };
  const close = { status: 'CLOSED', handlingNote: 'Đã thay bánh xe' };
  await assert.rejects(() => new TrackingService(stage2Repo()).updateIncident(driver, '701', ack), e => e.getStatus() === 403);
  await assert.rejects(() => new TrackingService(stage2Repo()).updateIncident({ id: '2', role: Role.MANAGER }, '701', ack), e => e.getStatus() === 403);
  await assert.rejects(() => new TrackingService(stage2Repo()).updateIncident(coordinator, '701', { status: 'CLOSED' }), e => e.getStatus() === 400);
  await assert.rejects(() => new TrackingService(stage2Repo()).updateIncident(coordinator, '701', { status: 'CLOSED', handlingNote: '   ' }), e => e.getStatus() === 400);
  await assert.rejects(() => new TrackingService(stage2Repo()).updateIncident({ id: '99', role: Role.COORDINATOR }, '701', ack), e => e.getStatus() === 404);
  await assert.rejects(() => new TrackingService(stage2Repo({}, { incidentStatus: 'CLOSED' })).updateIncident(coordinator, '701', close), e => e.getStatus() === 409);
  await assert.rejects(() => new TrackingService(stage2Repo({}, { incidentStatus: 'ACKNOWLEDGED' })).updateIncident(coordinator, '701', ack), e => e.getStatus() === 409);

  const calls = {};
  await new TrackingService(stage2Repo({}, calls)).updateIncident(coordinator, '701', ack);
  assert.deepEqual(calls.incidentUpdate, ['701', 'ACKNOWLEDGED', '3', null]);
  assert.equal(calls.notified[0][0], '5', 'reporter is notified');

  const closeCalls = { incidentStatus: 'ACKNOWLEDGED' };
  await new TrackingService(stage2Repo({}, closeCalls)).updateIncident(coordinator, '701', close);
  assert.deepEqual(closeCalls.incidentUpdate, ['701', 'CLOSED', '3', 'Đã thay bánh xe']);
  assert.match(closeCalls.notified[0][2], /Đã thay bánh xe/);
});

test('Alert: coordinator who owns the trip only, order must be READY or IN_TRANSIT', async () => {
  const body = { alertType: 'WEATHER', content: 'Mưa lớn trên tuyến' };
  await assert.rejects(() => new TrackingService(stage2Repo()).createAlert(driver, '100', body), e => e.getStatus() === 403);
  await assert.rejects(() => new TrackingService(stage2Repo()).createAlert({ id: '99', role: Role.COORDINATOR }, '100', body), e => e.getStatus() === 404);
  await assert.rejects(() => new TrackingService(stage2Repo()).createAlert(coordinator, '100', { alertType: 'FIRE', content: 'Mưa lớn trên tuyến' }), e => e.getStatus() === 400);
  await assert.rejects(() => new TrackingService(stage2Repo()).createAlert(coordinator, '100', { alertType: 'WEATHER', content: 'ab' }), e => e.getStatus() === 400);
  await assert.rejects(() => new TrackingService(stage2Repo({ findTrip: async () => ({ id: '100', orderId: '50', orderCode: 'W', orderStatus: OrderStatus.DELIVERED, plannedBy: '3' }) })).createAlert(coordinator, '100', body), e => e.getStatus() === 409);

  const calls = {};
  const alert = await new TrackingService(stage2Repo({}, calls)).createAlert(coordinator, '100', body);
  assert.equal(alert.id, '801');
  assert.equal(calls.alert[3], '3');
  assert.match(calls.notifiedAlert[2], /thời tiết/);
});

test('Attachments are served only inside the trip scope; specialists cannot open incident photos', async () => {
  const specialist = { id: '8', role: Role.SPECIALIST };
  await assert.rejects(() => new TrackingService(stage2Repo()).getAttachmentFile(specialist, '501'), e => e.getStatus() === 404);
  await assert.rejects(() => new TrackingService(stage2Repo({ getDriverAssignment: async () => undefined })).getAttachmentFile(driver, '501'), e => e.getStatus() === 404);
  await assert.rejects(() => new TrackingService(stage2Repo({ findAttachment: async () => undefined })).getAttachmentFile(driver, '501'), e => e.getStatus() === 404);
  await assert.rejects(() => new TrackingService(stage2Repo()).getAttachmentFile({ id: '2', role: Role.CUSTOMER }, '501'), e => e.getStatus() === 404);
});

// ─── Giai đoạn 3 ──────────────────────────────────────────────────────────────
const customer = { id: '2', role: Role.CUSTOMER };
const manager = { id: '1', role: Role.MANAGER };
const BASE = Date.now() - 48 * 3600 * 1000; // mọi mốc mẫu nằm trong quá khứ
const T = h => new Date(BASE + h * 3600 * 1000);

function timelineLeg(overrides = {}) {
  return {
    id: '10', tripId: '100', seqNo: 1, fromLocationName: 'A', toLocationName: 'B', toLocationType: 'REST_STOP',
    plannedDepartureAt: T(1), plannedArrivalAt: T(3), status: LegStatus.MOVING,
    actualDepartureAt: T(1), actualArrivalAt: null, updatedAt: T(1), updatedByName: 'Tài xế', ...overrides,
  };
}

function timelineRepo(overrides = {}) {
  return stage2Repo({
    findOrderForTimeline: async () => ({ orderId: '50', orderCode: 'WDP-1', orderStatus: OrderStatus.IN_TRANSIT, customerId: '2', tripId: '100', planStatus: PlanStatus.APPROVED, plannedDepartureAt: T(1), plannedArrivalAt: T(9) }),
    getTripLegs: async () => [timelineLeg()],
    getLegMilestones: async () => [{ id: '1', legId: '10', milestoneType: MilestoneType.DEPARTED, occurredAt: T(1), recordedBy: '5', recordedByName: 'Tài xế' }],
    findTrip: async () => ({ id: '100', orderId: '50', orderCode: 'WDP-1', orderStatus: OrderStatus.IN_TRANSIT, planStatus: PlanStatus.APPROVED, plannedDepartureAt: T(1), plannedArrivalAt: T(9), plannedBy: '3', customerId: '2' }),
    ...overrides,
  });
}

test('Order timeline: only the owning customer, 404 for other people orders, hidden until approved', async () => {
  await assert.rejects(() => new TrackingService(timelineRepo()).getOrderTimeline(manager, '50'), e => e.getStatus() === 403);
  await assert.rejects(() => new TrackingService(timelineRepo()).getOrderTimeline(driver, '50'), e => e.getStatus() === 403);
  await assert.rejects(() => new TrackingService(timelineRepo()).getOrderTimeline({ id: '99', role: Role.CUSTOMER }, '50'), e => e.getStatus() === 404);
  await assert.rejects(() => new TrackingService(timelineRepo({ findOrderForTimeline: async () => undefined })).getOrderTimeline(customer, '50'), e => e.getStatus() === 404);
  await assert.rejects(() => new TrackingService(timelineRepo()).getOrderTimeline(customer, 'abc'), e => e.getStatus() === 400);

  const timeline = await new TrackingService(timelineRepo()).getOrderTimeline(customer, '50');
  assert.equal(timeline.orderCode, 'WDP-1');
  assert.equal(timeline.legs.length, 1);
  assert.equal(timeline.legs[0].latestMilestone, MilestoneType.DEPARTED);
  assert.equal(timeline.legs[0].milestones[0].recordedByName, 'Tài xế');
  assert.equal(timeline.lastUpdatedByName, 'Tài xế');
  assert.equal(timeline.lastUpdatedAt, T(1).toISOString());
  assert.equal(timeline.legs[0].isOverdue, true, 'planned arrival is in the past and the leg is not completed');
  assert.ok(!('vehicleCode' in timeline.legs[0]) && !('id' in timeline.legs[0]), 'customer view carries no internal fields');

  const draft = await new TrackingService(timelineRepo({
    findOrderForTimeline: async () => ({ orderId: '50', orderCode: 'WDP-1', orderStatus: OrderStatus.PREPARING, customerId: '2', tripId: '100', planStatus: PlanStatus.PENDING_APPROVAL, plannedDepartureAt: T(1), plannedArrivalAt: T(9) }),
  })).getOrderTimeline(customer, '50');
  assert.deepEqual(draft.legs, []);
  assert.equal(draft.plannedDepartureAt, null);
  assert.equal(draft.lastUpdatedAt, null);

  const noTrip = await new TrackingService(timelineRepo({
    findOrderForTimeline: async () => ({ orderId: '50', orderCode: 'WDP-1', orderStatus: OrderStatus.APPROVED, customerId: '2', tripId: null, planStatus: null, plannedDepartureAt: null, plannedArrivalAt: null }),
  })).getOrderTimeline(customer, '50');
  assert.deepEqual(noTrip.legs, []);
});

test('Trip timeline: scoped by role, specialists never receive incidents', async () => {
  const specialist = { id: '8', role: Role.SPECIALIST };
  await assert.rejects(() => new TrackingService(timelineRepo()).getTripTimeline(customer, '100'), e => e.getStatus() === 403);
  await assert.rejects(() => new TrackingService(timelineRepo()).getTripTimeline({ id: '99', role: Role.COORDINATOR }, '100'), e => e.getStatus() === 404);
  await assert.rejects(() => new TrackingService(timelineRepo({ getDriverAssignment: async () => undefined })).getTripTimeline(driver, '100'), e => e.getStatus() === 404);

  const full = await new TrackingService(timelineRepo()).getTripTimeline(manager, '100');
  assert.equal(full.tripId, '100');
  assert.equal(full.legs[0].milestones.length, 1);
  assert.equal(full.legs[0].actualDepartureAt, T(1).toISOString());
  assert.equal(full.horseLogs.length, 1);
  assert.equal(full.incidents.length, 1);
  assert.equal(full.alerts.length, 1);
  assert.equal(full.lastUpdatedByName, 'Tài xế');

  const readOnly = await new TrackingService(timelineRepo()).getTripTimeline(specialist, '100');
  assert.deepEqual(readOnly.incidents, []);
  assert.equal(readOnly.horseLogs.length, 1);
});

test('Active trips dashboard: scoped to coordinator, counts open incidents, flags overdue and sorts urgent first', async () => {
  let plannerFilter;
  const trips = [
    { tripId: '200', orderId: '51', orderCode: 'WDP-2', orderStatus: OrderStatus.IN_TRANSIT, customerName: 'Khách A', plannedDepartureAt: T(1), plannedArrivalAt: T(3) },
    { tripId: '201', orderId: '52', orderCode: 'WDP-3', orderStatus: OrderStatus.IN_TRANSIT, customerName: 'Khách B', plannedDepartureAt: T(1), plannedArrivalAt: T(3) },
    { tripId: '202', orderId: '53', orderCode: 'WDP-4', orderStatus: OrderStatus.DELIVERED, customerName: 'Khách C', plannedDepartureAt: T(1), plannedArrivalAt: T(3) },
  ];
  const farFuture = new Date(Date.now() + 86400000);
  const legs = [
    timelineLeg({ tripId: '200', id: '20', plannedArrivalAt: farFuture }),
    timelineLeg({ tripId: '201', id: '21', status: LegStatus.AT_STOP }), // overdue (arrival in the past)
    timelineLeg({ tripId: '201', id: '22', seqNo: 2, status: LegStatus.NOT_STARTED, plannedArrivalAt: farFuture }),
    timelineLeg({ tripId: '202', id: '23', status: LegStatus.COMPLETED, updatedAt: T(5), updatedByName: 'Người cuối' }),
  ];
  const repo = timelineRepo({
    getActiveTrips: async planner => { plannerFilter = planner; return trips; },
    getLegsForTrips: async () => legs,
    getOpenIncidentCounts: async () => [{ tripId: '202', open: 2, high: 1 }, { tripId: '200', open: 1, high: 0 }],
  });
  const service = new TrackingService(repo);

  await assert.rejects(() => service.getActiveTrips(driver), e => e.getStatus() === 403);
  await assert.rejects(() => service.getActiveTrips(customer), e => e.getStatus() === 403);
  await assert.rejects(() => service.getActiveTrips({ id: '9', role: Role.ADMIN }), e => e.getStatus() === 403);

  const forManager = await service.getActiveTrips(manager);
  assert.equal(plannerFilter, null);
  assert.deepEqual(forManager.items.map(i => i.tripId), ['202', '201', '200'], 'urgent incident first, then overdue, then newest');
  assert.deepEqual(forManager.summary, { inTransit: 2, openIncidents: 3, overdueTrips: 1 });

  const byId = Object.fromEntries(forManager.items.map(i => [i.tripId, i]));
  assert.equal(byId['201'].isOverdue, true);
  assert.equal(byId['200'].isOverdue, false);
  assert.equal(byId['202'].isOverdue, false, 'delivered trips are never overdue');
  assert.equal(byId['201'].legCount, 2);
  assert.equal(byId['201'].currentLeg.seqNo, 1);
  assert.equal(byId['201'].currentLeg.status, LegStatus.AT_STOP);
  assert.equal(byId['202'].currentLeg, null);
  assert.equal(byId['202'].completedLegs, 1);
  assert.equal(byId['202'].highUrgencyOpenIncidents, 1);
  assert.equal(byId['202'].lastUpdatedByName, 'Người cuối');

  await service.getActiveTrips(coordinator);
  assert.equal(plannerFilter, '3');
  await service.getActiveTrips({ id: '8', role: Role.SPECIALIST });
  assert.equal(plannerFilter, null, 'specialist reads every trip');
});

test('Customs clearance touches the leg so last-update time and author stay accurate', async () => {
  let touched = null;
  const leg = legRow({ status: LegStatus.AT_STOP, toLocationType: 'BORDER', actualDepartureAt: T(1), actualArrivalAt: T(2) });
  const repo = {
    transaction: work => work(repo),
    getMaxRetroactiveMinutes: async () => 120,
    lockLegForUpdate: async () => leg,
    getDriverAssignment: async () => ({ role: 'DRIVER' }),
    hasMilestone: async () => false,
    lockAllTripLegs: async () => [{ id: '10', seqNo: 1 }, { id: '11', seqNo: 2 }],
    touchLeg: async (legId, actor) => { touched = [legId, actor]; },
    insertMilestone: async () => '1', audit: async () => {}, notify: async () => {},
  };
  const result = await new TrackingService(repo).recordMilestone(driver, '10', { milestoneType: MilestoneType.CUSTOMS_CLEARED, occurredAt: new Date().toISOString() });
  assert.deepEqual(touched, ['10', '5']);
  assert.equal(result.legStatus, LegStatus.AT_STOP);
});

// ─── Realtime tới phòng user:{id} (UI-2) ──────────────────────────────────────
function realtimeRepo(calls, overrides = {}) {
  return stage2Repo({
    getTripCrewIds: async () => ['5', '6'],
    findLatestTripNotifications: async (ids, eventType) => ids.map(id => ({ recipientId: id, id: 'n' + id, content: `nội dung ${eventType}`, createdAt: new Date('2026-10-26T10:00:00Z') })),
    ...overrides,
  }, calls);
}
const fakeRealtime = () => { const emitted = []; return { emitted, emitToUsers: (users, event, payload) => emitted.push({ users, event, payload }) }; };

test('Realtime: alert → tracking:alert + notification:new tới từng crew, sau khi commit', async () => {
  const realtime = fakeRealtime();
  const order = [];
  const repo = realtimeRepo({}, {
    transaction: async work => { const result = await work(repo); order.push('commit'); return result; },
  });
  realtime.emitToUsers = (...args) => { order.push('emit'); realtime.emitted.push({ users: args[0], event: args[1], payload: args[2] }); };
  const alert = await new TrackingService(repo, undefined, realtime).createAlert(coordinator, '100', { alertType: 'WEATHER', content: 'Mưa lớn' });
  assert.equal(alert.id, '801');
  assert.equal(order[0], 'commit', 'emit sau commit');
  const first = realtime.emitted[0];
  assert.deepEqual(first.users, ['5', '6']);
  assert.equal(first.event, 'tracking:alert');
  assert.deepEqual(first.payload, { alertId: '801', tripId: '100', alertType: 'WEATHER', content: 'Mưa lớn', sentByName: 'Điều phối', sentAt: first.payload.sentAt });
  assert.deepEqual(realtime.emitted.slice(1).map(e => [e.users, e.event, e.payload.id]), [[['5'], 'notification:new', 'n5'], [['6'], 'notification:new', 'n6']]);
});

test('Realtime: incident ack/close → tracking:incident_updated chỉ tới người báo', async () => {
  const realtime = fakeRealtime();
  await new TrackingService(realtimeRepo({}), undefined, realtime).updateIncident(coordinator, '701', { status: 'CLOSED', handlingNote: 'Đã thay bánh xe' });
  assert.equal(realtime.emitted[0].event, 'tracking:incident_updated');
  assert.deepEqual(realtime.emitted[0].users, ['5']);
  assert.deepEqual(realtime.emitted[0].payload, { incidentId: '701', tripId: '100', status: 'NEW', handlingNote: null });
  assert.equal(realtime.emitted[1].event, 'notification:new');
  assert.deepEqual(realtime.emitted[1].users, ['5']);
});

test('Realtime: transaction lỗi → không emit; socket/DB lỗi sau commit → request vẫn thành công', async () => {
  const realtime = fakeRealtime();
  const failing = realtimeRepo({}, { transaction: async work => { await work(failing); throw new Error('commit failed'); } });
  await assert.rejects(() => new TrackingService(failing, undefined, realtime).createAlert(coordinator, '100', { alertType: 'WEATHER', content: 'Mưa lớn' }), /commit failed/);
  await assert.rejects(() => new TrackingService(failing, undefined, realtime).updateIncident(coordinator, '701', { status: 'ACKNOWLEDGED' }), /commit failed/);
  assert.equal(realtime.emitted.length, 0);

  const broken = { emitToUsers: () => { throw new Error('socket down'); } };
  assert.equal((await new TrackingService(realtimeRepo({}), undefined, broken).createAlert(coordinator, '100', { alertType: 'WEATHER', content: 'Mưa lớn' })).id, '801');
  const noRows = realtimeRepo({}, { getTripCrewIds: async () => { throw new Error('db down'); } });
  assert.equal((await new TrackingService(noRows, undefined, realtime).createAlert(coordinator, '100', { alertType: 'WEATHER', content: 'Mưa lớn' })).id, '801');
});

// ─── Chia quyền Tài xế / Hộ tống theo trip_assignments.role ───────────────────
test('Role split: only the trip DRIVER records milestones / completes legs / sends GPS; only the ESCORT writes horse logs', async () => {
  const stranger = { id: '9', role: Role.DRIVER_ESCORT };
  const by = (userId) => async (_trip, id) => (id === userId ? { role: userId === '6' ? 'ESCORT' : 'DRIVER' } : undefined);
  const repo = (overrides = {}) => {
    const r = stage2Repo({
      getDriverAssignment: async (_trip, id) => (id === '5' ? { role: 'DRIVER' } : id === '6' ? { role: 'ESCORT' } : undefined),
      lockLegForUpdate: async () => legRow({ status: LegStatus.MOVING, orderStatus: OrderStatus.IN_TRANSIT }),
      getMaxRetroactiveMinutes: async () => 120,
      ...overrides,
    });
    return r;
  };
  const when = new Date().toISOString();
  const milestone = account => new TrackingService(repo()).recordMilestone(account, '10', { milestoneType: MilestoneType.ARRIVED_AT_STOP, occurredAt: when });
  const complete = account => new TrackingService(repo()).completeIntermediateLeg(account, '10', { occurredAt: when });
  const positions = account => new TrackingService(repo({ getTripMapLegs: async () => [] })).recordPositions(account, '100', { points: [{ latitude: 11, longitude: 106, recordedAt: when }] });
  const log = account => new TrackingService(repo()).createHorseLog(account, '10', { horseId: '21', conditionStatus: 'STABLE', note: 'ổn', loggedAt: when });
  const status = promise => promise.then(() => 200, e => e.getStatus());

  // ESCORT bị chặn ở mọi thao tác của tài xế (403, đúng thông điệp); người không phân công 403/404 như cũ
  for (const action of [milestone, complete]) {
    assert.equal(await status(action(escort)), 403);
    assert.equal(await status(action(stranger)), 403);
  }
  assert.equal(await status(positions(escort)), 403);
  assert.equal(await status(positions(stranger)), 404);
  await assert.rejects(() => milestone(escort), e => /Chỉ tài xế của chuyến mới được ghi mốc\/gửi vị trí/.test(e.message));
  await assert.rejects(() => positions(escort), e => /Chỉ tài xế của chuyến mới được ghi mốc\/gửi vị trí/.test(e.message));
  // DRIVER không qua được kiểm tra vai trò (kết quả khác 403 vai trò): mốc/hoàn thành/GPS tới các kiểm tra nghiệp vụ sau đó
  for (const action of [milestone, complete, positions]) {
    await action(driver).catch(e => assert.notEqual(e.message, 'Chỉ tài xế của chuyến mới được ghi mốc/gửi vị trí.'));
  }
  // Nhật ký ngựa: chỉ ESCORT; DRIVER 403 "Nhật ký ngựa do hộ tống ghi"; người không phân công 403
  assert.equal((await log(escort)).id, '601');
  await assert.rejects(() => log(driver), e => e.getStatus() === 403 && /Nhật ký ngựa do hộ tống ghi/.test(e.message));
  assert.equal(await status(log(stranger)), 403);
  // Báo sự cố và đọc nhật ký: cả hai như cũ
  const incident = { severity: 'RED', incidentType: 'HORSE_MEDICAL', subType: 'COLIC', damageTarget: 'HORSE', description: 'Ngựa đau bụng', horseId: '21' };
  for (const account of [driver, escort]) {
    assert.equal((await new TrackingService(repo()).createIncident(account, '100', incident)).id, '701');
    assert.equal((await new TrackingService(repo()).getTripHorseLogs(account, '100')).length, 1);
  }
  void by;
});

test('Horse log list carries createdByCrewRole (DRIVER / ESCORT / null)', async () => {
  const rows = [
    { id: '1', horseId: '21', horseName: 'A', legId: '10', conditionStatus: 'STABLE', note: null, loggedAt: new Date(), createdBy: '6', createdByName: 'Hộ tống', createdByCrewRole: 'ESCORT', correctsLogId: null },
    { id: '2', horseId: '21', horseName: 'A', legId: '10', conditionStatus: 'STABLE', note: null, loggedAt: new Date(), createdBy: '5', createdByName: 'Tài xế', createdByCrewRole: 'DRIVER', correctsLogId: null },
    { id: '3', horseId: '21', horseName: 'A', legId: '10', conditionStatus: 'STABLE', note: null, loggedAt: new Date(), createdBy: '9', createdByName: 'Cũ', createdByCrewRole: null, correctsLogId: null },
  ];
  const logs = await new TrackingService(stage2Repo({ getTripHorseLogs: async () => rows })).getTripHorseLogs(coordinator, '100');
  assert.deepEqual(logs.map(item => item.createdByCrewRole), ['ESCORT', 'DRIVER', null]);
});

// ─── Hoạt động chăm sóc (gap-analysis-escort.md Bước 2) ───────────────────────
function careRepo(overrides = {}, calls = {}) {
  const rows = [];
  const repo = stage2Repo({
    getMaxRetroactiveMinutes: async () => 120,
    getCurrentLegId: async () => '10',
    insertCareActivity: async input => { calls.inserted = input; const id = String(800 + rows.length); rows.push({ ...input, id }); return id; },
    findCareActivity: async id => calls.original && calls.original.id === id ? calls.original : undefined,
    getCareActivities: async (tripId, range, onlyId) => {
      calls.query = { tripId, range, onlyId };
      if (onlyId) return calls.rowFor ? [calls.rowFor(onlyId)] : [];
      return calls.list ?? [];
    },
    getLastFeedByHorse: async tripId => { calls.lastFeedTrip = tripId; return calls.lastFeeds ?? []; },
    ...overrides,
  }, calls);
  return repo;
}
const careBody = (overrides = {}) => ({ activityType: 'FEED', horseId: '21', feedDescription: 'Cỏ khô 3 kg', performedAt: new Date().toISOString(), ...overrides });
const careRow = (overrides = {}) => ({
  id: '800', tripId: '100', legId: '10', horseId: '21', horseName: 'Bạch Mã', activityType: 'FEED', feedDescription: 'Cỏ khô 3 kg', amountLiters: null,
  durationMinutes: null, note: null, performedAt: new Date('2026-10-26T05:00:00Z'), createdBy: '6', createdByName: 'Hộ tống', createdAt: new Date('2026-10-26T05:01:00Z'), correctsActivityId: null, ...overrides,
});

test('Care activity POST: only the ESCORT of the trip; DRIVER 403, stranger 404, other roles 403', async () => {
  const create = (account, repo = careRepo()) => new TrackingService(repo).createCareActivity(account, '100', careBody());
  const calls = {};
  calls.rowFor = id => careRow({ id });
  const ok = await new TrackingService(careRepo({}, calls)).createCareActivity(escort, '100', careBody());
  assert.equal(ok.activityType, 'FEED');
  assert.equal(calls.inserted.createdBy, '6');
  assert.equal(calls.inserted.legId, '10', 'legId từ chặng đang chạy');
  assert.ok(calls.audits.some(a => a[1] === 'CARE_ACTIVITY' && a[3] === 'CREATE_CARE_ACTIVITY'), 'audit');
  await assert.rejects(() => create(driver), e => e.getStatus() === 403 && /hộ tống/.test(e.message));
  await assert.rejects(() => create({ id: '9', role: Role.DRIVER_ESCORT }, careRepo({ getDriverAssignment: async (_t, id) => (id === '6' ? { role: 'ESCORT' } : undefined) })), e => e.getStatus() === 404);
  for (const account of [coordinator, { id: '2', role: Role.MANAGER }, { id: '8', role: Role.SPECIALIST }, { id: '1', role: Role.CUSTOMER }]) {
    await assert.rejects(() => create(account), e => e.getStatus() === 403);
  }
});

test('Care activity POST: order status rules (READY and IN_TRANSIT allowed, DELIVERED / others 409) and leg inference', async () => {
  const withStatus = (status, extra = {}) => careRepo({ findTrip: async () => ({ id: '100', orderId: '50', orderCode: 'WDP-1', orderStatus: status, plannedBy: '3', customerId: '2' }), ...extra }, { rowFor: id => careRow({ id }) });
  for (const status of [OrderStatus.READY, OrderStatus.IN_TRANSIT]) {
    assert.ok((await new TrackingService(withStatus(status)).createCareActivity(escort, '100', careBody())).id, status);
  }
  for (const status of [OrderStatus.DELIVERED, OrderStatus.PREPARING, OrderStatus.CANCELLED]) {
    await assert.rejects(() => new TrackingService(withStatus(status)).createCareActivity(escort, '100', careBody()), e => e.getStatus() === 409, status);
  }
  const calls = { rowFor: id => careRow({ id }) };
  await new TrackingService(careRepo({ getCurrentLegId: async () => null }, calls)).createCareActivity(escort, '100', careBody());
  assert.equal(calls.inserted.legId, null, 'chưa xuất phát: legId null');
});

test('Care activity POST: fields must match the type; empty means null; ranges and one decimal for liters', async () => {
  const service = () => new TrackingService(careRepo({}, { rowFor: id => careRow({ id }) }));
  const bad = body => assert.rejects(() => service().createCareActivity(escort, '100', body), e => e.getStatus() === 400, JSON.stringify(body));
  const when = new Date().toISOString();
  // FEED
  await bad(careBody({ horseId: null }));
  await bad(careBody({ feedDescription: undefined }));
  await bad(careBody({ feedDescription: '   ' }));
  await bad(careBody({ amountLiters: 5 }));
  await bad(careBody({ durationMinutes: 10 }));
  // WATER
  await bad({ activityType: 'WATER', horseId: '21', performedAt: when });
  await bad({ activityType: 'WATER', horseId: '21', amountLiters: 0.05, performedAt: when });
  await bad({ activityType: 'WATER', horseId: '21', amountLiters: 201, performedAt: when });
  await bad({ activityType: 'WATER', horseId: '21', amountLiters: 5.55, performedAt: when });
  await bad({ activityType: 'WATER', horseId: '21', amountLiters: 5, feedDescription: 'x', performedAt: when });
  await bad({ activityType: 'WATER', horseId: null, amountLiters: 5, performedAt: when });
  // REST
  await bad({ activityType: 'REST', performedAt: when });
  await bad({ activityType: 'REST', durationMinutes: 0, performedAt: when });
  await bad({ activityType: 'REST', durationMinutes: 721, performedAt: when });
  await bad({ activityType: 'REST', durationMinutes: 1.5, performedAt: when });
  await bad({ activityType: 'REST', durationMinutes: 20, amountLiters: 3, performedAt: when });
  // chung
  await bad(careBody({ activityType: 'SLEEP' }));
  await bad(careBody({ note: 'x'.repeat(256) }));
  await bad(careBody({ extra: 1 }));
  await bad(careBody({ performedAt: new Date(Date.now() + 10 * 60_000).toISOString() })); // tương lai
  await bad(careBody({ performedAt: new Date(Date.now() - 3 * 3600_000).toISOString() })); // quá cửa sổ nhập bù (120 phút)
  await bad(careBody({ performedAt: '2026-10-26 10:00:00' }));
  // hợp lệ
  assert.ok((await service().createCareActivity(escort, '100', { activityType: 'WATER', horseId: '21', amountLiters: 10.5, performedAt: when })).id);
  assert.ok((await service().createCareActivity(escort, '100', { activityType: 'REST', horseId: null, durationMinutes: 20, note: 'Nghỉ trước cửa khẩu', performedAt: when })).id);
});

test('Care activity POST: horse must belong to the order; corrections need same trip, horse and type and an uncorrected original', async () => {
  const calls = { rowFor: id => careRow({ id }) };
  await assert.rejects(() => new TrackingService(careRepo({ checkHorseBelongsToOrder: async () => false }, calls)).createCareActivity(escort, '100', careBody()), e => e.getStatus() === 400);
  const original = { id: '700', tripId: '100', horseId: '21', activityType: 'FEED', corrected: false };
  const correct = (patch, bodyPatch = {}) => new TrackingService(careRepo({}, { ...calls, original: { ...original, ...patch } })).createCareActivity(escort, '100', careBody({ correctsActivityId: '700', ...bodyPatch }));
  assert.ok((await correct({})).id);
  await assert.rejects(() => correct({ horseId: '22' }), e => e.getStatus() === 400, 'sai ngựa');
  await assert.rejects(() => correct({ activityType: 'WATER' }), e => e.getStatus() === 400, 'sai loại');
  await assert.rejects(() => correct({ tripId: '101' }), e => e.getStatus() === 400, 'sai chuyến');
  await assert.rejects(() => new TrackingService(careRepo({}, calls)).createCareActivity(escort, '100', careBody({ correctsActivityId: '999' })), e => e.getStatus() === 400, 'không tồn tại');
  await assert.rejects(() => correct({ corrected: true }), e => e.getStatus() === 409, 'đã bị đính chính');
  // REST cả đoàn đính chính REST cả đoàn
  assert.ok((await new TrackingService(careRepo({}, { ...calls, original: { id: '701', tripId: '100', horseId: null, activityType: 'REST', corrected: false } }))
    .createCareActivity(escort, '100', { activityType: 'REST', horseId: null, durationMinutes: 25, correctsActivityId: '701', performedAt: new Date().toISOString() })).id);
});

test('Care activity POST: a failing insert or audit rejects the whole request', async () => {
  const failing = careRepo({ insertCareActivity: async () => { throw new Error('db down'); } }, { rowFor: id => careRow({ id }) });
  await assert.rejects(() => new TrackingService(failing).createCareActivity(escort, '100', careBody()), /db down/);
  const noAudit = careRepo({ audit: async () => { throw new Error('audit down'); } }, { rowFor: id => careRow({ id }) });
  await assert.rejects(() => new TrackingService(noAudit).createCareActivity(escort, '100', careBody()), /audit down/);
});

test('Care activities GET: roles, scope, range rules, summary and hidden corrected rows', async () => {
  const at = iso => new Date(iso);
  const list = [
    careRow({ id: '806', activityType: 'REST', horseId: null, horseName: null, feedDescription: null, durationMinutes: 20, performedAt: at('2026-10-26T07:00:00Z') }),
    careRow({ id: '805', activityType: 'WATER', horseId: '22', horseName: 'Hắc Mã', feedDescription: null, amountLiters: '8.5', performedAt: at('2026-10-26T06:30:00Z') }),
    careRow({ id: '804', activityType: 'FEED', horseId: '21', performedAt: at('2026-10-26T06:00:00Z') }),
    careRow({ id: '803', activityType: 'FEED', horseId: '21', performedAt: at('2026-10-26T05:00:00Z'), correctsActivityId: '802' }),
    careRow({ id: '801', activityType: 'FEED', horseId: '22', horseName: 'Hắc Mã', performedAt: at('2026-10-26T04:00:00Z') }),
    careRow({ id: '800', activityType: 'REST', horseId: null, feedDescription: null, durationMinutes: 15, performedAt: at('2026-10-26T03:00:00Z') }),
    careRow({ id: '799', activityType: 'WATER', horseId: '21', feedDescription: null, amountLiters: 10, performedAt: at('2026-10-26T02:00:00Z') }),
  ];
  // Lần cho ăn gần nhất lấy riêng trên toàn chuyến (kể cả hôm trước, ngoài from/to)
  const calls = { list, lastFeeds: [{ horseId: '21', performedAt: at('2026-10-26T06:00:00Z') }, { horseId: '22', performedAt: at('2026-10-25T22:00:00Z') }] };
  const read = (account, query = {}) => new TrackingService(careRepo({}, calls)).getCareActivities(account, '100', query);
  const result = await read(escort, { from: '2026-10-26T00:00:00.000Z', to: '2026-10-27T00:00:00.000Z' });
  assert.equal(result.activities.length, 7);
  assert.equal(result.activities[0].id, '806');
  assert.equal(result.activities[1].amountLiters, 8.5, 'DECIMAL → number');
  assert.equal(result.activities[3].correctsActivityId, '802', 'bản đính chính mang correctsActivityId');
  assert.deepEqual(result.summary, {
    waterLiters: 18.5, meals: 3, rests: 2, restMinutes: 35,
    lastFeedAtByHorse: { 21: '2026-10-26T06:00:00.000Z', 22: '2026-10-25T22:00:00.000Z' },
  });
  assert.equal(calls.lastFeedTrip, '100', 'truy vấn theo cả chuyến, không truyền from/to');
  assert.equal(calls.query.range.from.toISOString(), '2026-10-26T00:00:00.000Z');
  // không có from/to: toàn bộ danh sách, không lọc khoảng
  await read(escort);
  assert.equal(calls.query.range, undefined);
  // vai trò: Driver (crew), Coordinator của chuyến, Manager, Specialist đọc được; Customer 403
  for (const account of [driver, escort, coordinator, { id: '2', role: Role.MANAGER }, { id: '8', role: Role.SPECIALIST }]) assert.equal((await read(account)).activities.length, 7);
  await assert.rejects(() => read({ id: '1', role: Role.CUSTOMER }), e => e.getStatus() === 403);
  await assert.rejects(() => read({ id: '99', role: Role.COORDINATOR }), e => e.getStatus() === 404);
  await assert.rejects(() => new TrackingService(careRepo({ getDriverAssignment: async () => undefined }, calls)).getCareActivities(driver, '100', {}), e => e.getStatus() === 404);
  // khoảng thời gian
  const badRange = query => assert.rejects(() => read(escort, query), e => e.getStatus() === 400, JSON.stringify(query));
  await badRange({ from: '2026-10-26T00:00:00.000Z' });
  await badRange({ to: '2026-10-27T00:00:00.000Z' });
  await badRange({ from: '2026-10-27T00:00:00.000Z', to: '2026-10-26T00:00:00.000Z' });
  await badRange({ from: '2026-10-26T00:00:00.000Z', to: '2026-10-26T00:00:00.000Z' });
  await badRange({ from: '2026-10-01T00:00:00.000Z', to: '2026-10-09T00:00:00.000Z' }); // 8 ngày
  await badRange({ from: 'hôm nay', to: 'mai' });
  assert.ok((await read(escort, { from: '2026-10-19T00:00:00.000Z', to: '2026-10-26T00:00:00.000Z' })).activities, 'đúng 7 ngày thì được');
  assert.deepEqual((await new TrackingService(careRepo({}, { list: [] })).getCareActivities(escort, '100', {})).summary, { waterLiters: 0, meals: 0, rests: 0, restMinutes: 0, lastFeedAtByHorse: {} });
});


// ─── Báo cáo sức khỏe ngựa (Bước 3): nháp → gửi, khách xem, thông báo / socket ───────
const withStorage = async run => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-report-'));
  process.env.DOCUMENT_STORAGE_DIR = dir;
  process.env.DOCUMENT_STORAGE_PROVIDER = 'local';
  try { return await run(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const reportCtx = (overrides = {}) => ({
  id: '601', horseId: '21', horseName: 'Bạch Mã', legId: '10', tripId: '100', orderId: '50', orderCode: 'WDP-1', orderStatus: OrderStatus.IN_TRANSIT,
  customerId: '2', plannedBy: '3', createdBy: '6', conditionStatus: 'OFF_FEED', customerNote: 'Ăn ít khẩu phần trưa', reportStatus: 'DRAFT',
  sendToCustomer: true, corrected: false, ...overrides,
});
function reportRepo(overrides = {}, calls = {}) {
  calls.ctx ||= reportCtx();
  calls.refs ||= [];
  calls.notified ||= [];
  const repo = stage2Repo({
    getFirstLegId: async () => '10',
    findHorseLog: async (_id, lock) => { calls.locked = lock; return calls.ctx; },
    getLogAttachmentRefs: async () => calls.refs,
    updateHorseReport: async (_id, fields) => { calls.updated = fields; return 1; },
    deleteAttachments: async ids => { calls.deletedAttachments = ids; },
    deleteHorseReport: async () => { calls.deleted = true; return 1; },
    markHorseReportSent: async (_id, send) => { calls.sentFlag = send; return 1; },
    notify: async (...args) => { calls.notified.push(args); return String(900 + calls.notified.length); },
    getTripHorseLogs: async (_trip, viewer) => {
      calls.viewer = viewer;
      const inserted = calls.horseLog; // báo cáo vừa tạo trong request này
      const reportStatus = inserted ? inserted[7]?.reportStatus ?? null : (calls.sentFlag !== undefined ? 'SENT' : calls.ctx.reportStatus);
      const sendToCustomer = inserted ? Boolean(inserted[7]?.sendToCustomer) : (calls.sentFlag ?? calls.ctx.sendToCustomer);
      return [{ id: '601', horseId: '21', horseName: 'Bạch Mã', legId: '10', conditionStatus: inserted ? inserted[2] : calls.ctx.conditionStatus, note: null, loggedAt: new Date(),
        createdBy: '6', createdByName: 'Hộ Tống', correctsLogId: null, reportStatus, sendToCustomer: sendToCustomer ? 1 : 0, customerNote: calls.ctx.customerNote,
        sentAt: reportStatus === 'SENT' ? new Date('2026-10-26T05:25:00Z') : null }];
    },
    ...overrides,
  }, calls);
  return repo;
}
const reportBody = (overrides = {}) => ({ horseId: '21', conditionStatus: 'OFF_FEED', loggedAt: now(), reportStatus: 'DRAFT', customerNote: 'Ăn ít khẩu phần trưa', sendToCustomer: true, ...overrides });
const status = code => e => e.getStatus() === code;

test('Horse report create: legacy log vs draft vs sent, validation, role and order-status rules', async () => {
  const create = (body, overrides, files = [], account = escort, calls = {}) => new TrackingService(reportRepo(overrides, calls), undefined, fakeRealtime()).createHorseLog(account, '10', body, files);
  await withStorage(async () => {
    // Nhật ký cũ: không reportStatus, không cột báo cáo; trường báo cáo mà thiếu reportStatus bị từ chối
    const legacy = {};
    await create({ horseId: '21', conditionStatus: 'STABLE', loggedAt: now() }, {}, [], escort, legacy);
    assert.equal(legacy.horseLog[7], undefined, 'nhật ký cũ không truyền cột báo cáo');
    for (const extra of [{ customerNote: 'x' }, { bodyTempC: 38 }, { heartRateBpm: 40 }, { appetite: 'NORMAL' }, { sendToCustomer: true }]) {
      await assert.rejects(() => create({ horseId: '21', conditionStatus: 'STABLE', loggedAt: now(), ...extra }, {}), status(400), JSON.stringify(extra));
    }
    // Vai trò / trạng thái đơn / chặng
    await assert.rejects(() => create(reportBody(), {}, [], driver), status(403));
    await assert.rejects(() => create(reportBody(), { getDriverAssignment: async () => ({ role: 'DRIVER' }) }, [], escort), status(403));
    await assert.rejects(() => create(reportBody(), { getFirstLegId: async () => '11', lockLegForUpdate: async () => legRow({ orderStatus: OrderStatus.READY }) }), status(409));
    await assert.rejects(() => create(reportBody(), { lockLegForUpdate: async () => legRow({ orderStatus: OrderStatus.DELIVERED, status: LegStatus.COMPLETED }) }), status(409));
    await assert.rejects(() => create(reportBody(), { lockLegForUpdate: async () => legRow({ orderStatus: OrderStatus.IN_TRANSIT, status: LegStatus.NOT_STARTED }) }), status(409));
    await create(reportBody(), { lockLegForUpdate: async () => legRow({ orderStatus: OrderStatus.READY }) }); // READY + chặng đầu: được
    // Số đo ngoài khoảng / sai kiểu
    for (const bad of [{ bodyTempC: 29.9 }, { bodyTempC: 45.1 }, { bodyTempC: 37.85 }, { bodyTempC: 'nóng' }, { heartRateBpm: 9 }, { heartRateBpm: 201 }, { heartRateBpm: 40.5 }, { appetite: 'LẠ' }, { reportStatus: 'DONE' }, { captions: ['a', 'b', 'c', 'd'] }]) {
      await assert.rejects(() => create(reportBody(bad), {}), status(400), JSON.stringify(bad));
    }
    await create(reportBody({ bodyTempC: '37.8', heartRateBpm: '38', appetite: 'REDUCED', sendToCustomer: 'false' }), {}); // multipart: chuỗi
    await assert.rejects(() => create(reportBody({ captions: ['Toàn thân'] }), {}, []), status(400), 'nhãn nhiều hơn ảnh');
    // Nháp: thiếu ảnh / thiếu customerNote vẫn được, không thông báo, không phát socket
    const draft = {}; const rt = fakeRealtime();
    const saved = await new TrackingService(reportRepo({}, draft), undefined, rt).createHorseLog(escort, '10', reportBody({ customerNote: undefined }), []);
    assert.equal(saved.id, '601');
    assert.deepEqual(draft.horseLog[7], { reportStatus: 'DRAFT', bodyTempC: null, heartRateBpm: null, appetite: null, customerNote: null, sendToCustomer: true });
    assert.equal(draft.notified.length, 0);
    assert.equal(rt.emitted.length, 0);
    assert.equal(draft.viewer, '6', 'trả về nháp cho người tạo');
    // Gửi ngay: bất thường cần ≥ 1 ảnh, STABLE thì không; gửi khách cần customerNote
    await assert.rejects(() => create(reportBody({ reportStatus: 'SENT' }), {}), status(400));
    await assert.rejects(() => create(reportBody({ reportStatus: 'SENT', conditionStatus: 'STABLE', customerNote: undefined }), {}), status(400));
    await create(reportBody({ reportStatus: 'SENT', conditionStatus: 'STABLE', customerNote: undefined, sendToCustomer: false }), {});
    await create(reportBody({ reportStatus: 'SENT', captions: ['Toàn thân'] }), {}, [photo()]);
    const cap = {};
    await create(reportBody({ reportStatus: 'SENT', captions: ['Toàn thân', 'Chân'] }), {}, [photo(), photo()], escort, cap);
    assert.deepEqual(cap.attachments.map(a => a[7]), ['Toàn thân', 'Chân'], 'nhãn ảnh lưu theo thứ tự ảnh');
  });
});

test('Horse report create: correction rules (matching horse, no drafts, one correction per report)', async () => {
  const body = reportBody({ conditionStatus: 'STABLE', customerNote: undefined, sendToCustomer: false, reportStatus: 'SENT', correctsLogId: '9' });
  const create = overrides => new TrackingService(reportRepo(overrides), undefined, fakeRealtime()).createHorseLog(escort, '10', body);
  const original = (extra = {}) => ({ id: '9', horseId: '21', tripId: '100', reportStatus: 'SENT', corrected: false, ...extra });
  await create({ findHorseLog: async () => original() });
  await assert.rejects(() => create({ findHorseLog: async () => original({ horseId: '22' }) }), status(400));
  await assert.rejects(() => create({ findHorseLog: async () => original({ tripId: '999' }) }), status(400));
  await assert.rejects(() => create({ findHorseLog: async () => original({ reportStatus: 'DRAFT' }) }), status(400));
  await assert.rejects(() => create({ findHorseLog: async () => original({ corrected: true }) }), status(409));
  await create({ findHorseLog: async () => original({ reportStatus: null, corrected: true }) }); // nhật ký cũ giữ luật cũ
});

test('Horse report SENT: customer + coordinator notified in the transaction, realtime only after commit and to the right rooms', async () => {
  await withStorage(async () => {
    const order = [];
    const calls = {};
    const realtime = fakeRealtime();
    realtime.emitToUsers = (users, event, payload) => { order.push('emit'); realtime.emitted.push({ users, event, payload }); };
    const repo = reportRepo({ transaction: async work => { const result = await work(repo); order.push('commit'); return result; } }, calls);
    const log = await new TrackingService(repo, undefined, realtime).createHorseLog(escort, '10', reportBody({ reportStatus: 'SENT', captions: ['Toàn thân'] }), [photo()]);
    assert.equal(log.reportStatus, 'SENT');
    assert.deepEqual(calls.notified.map(n => [n[0], n[1], n[3], n[4]]), [['2', 'HORSE_REPORT', 'ORDER', '50'], ['3', 'HORSE_REPORT_ALERT', 'TRIP', '100']]);
    assert.match(calls.notified[0][2], /Bạch Mã.*WDP-1.*Bỏ ăn/);
    assert.equal(order[0], 'commit', 'emit sau commit');
    assert.deepEqual(realtime.emitted.map(e => [e.users, e.event]), [[['2'], 'tracking:horse_report'], [['2'], 'notification:new'], [['3'], 'notification:new']]);
    assert.deepEqual(realtime.emitted[0].payload, { reportId: '601', orderId: '50', horseId: '21', horseName: 'Bạch Mã', conditionStatus: 'OFF_FEED', sentAt: '2026-10-26T05:25:00.000Z' });
    assert.equal(realtime.emitted[1].payload.eventType, 'HORSE_REPORT');
    assert.equal(realtime.emitted[1].payload.id, '901');
    assert.equal(realtime.emitted[2].payload.eventType, 'HORSE_REPORT_ALERT');
    assert.equal(realtime.emitted[2].payload.id, '902');

    // STABLE gửi khách: chỉ thông báo khách, không báo điều phối
    const stable = {};
    const rt = fakeRealtime();
    await new TrackingService(reportRepo({}, stable), undefined, rt).createHorseLog(escort, '10', reportBody({ reportStatus: 'SENT', conditionStatus: 'STABLE' }));
    assert.deepEqual(stable.notified.map(n => n[1]), ['HORSE_REPORT']);
    // Bất thường nhưng không gửi khách: chỉ báo điều phối
    const internalOnly = {};
    await new TrackingService(reportRepo({}, internalOnly), undefined, fakeRealtime()).createHorseLog(escort, '10', reportBody({ reportStatus: 'SENT', sendToCustomer: false, captions: ['a'] }), [photo()]);
    assert.deepEqual(internalOnly.notified.map(n => [n[0], n[1]]), [['3', 'HORSE_REPORT_ALERT']]);
    // Socket hỏng không làm hỏng request; DB hỏng khi thông báo thì rollback và không phát gì
    const broken = { emitToUsers: () => { throw new Error('socket down'); } };
    assert.equal((await new TrackingService(reportRepo({}), undefined, broken).createHorseLog(escort, '10', reportBody({ reportStatus: 'SENT', captions: ['a'] }), [photo()])).id, '601');
    const failing = fakeRealtime();
    await assert.rejects(() => new TrackingService(reportRepo({ notify: async () => { throw new Error('notify down'); } }), undefined, failing).createHorseLog(escort, '10', reportBody({ reportStatus: 'SENT', captions: ['a'] }), [photo()]), /notify down/);
    assert.equal(failing.emitted.length, 0);
  });
});

test('Horse report draft: only the creating ESCORT edits / deletes / sends; sent and legacy logs are immutable', async () => {
  const edit = { conditionStatus: 'CLIMATE_CHANGE', loggedAt: now(), customerNote: 'Nóng', bodyTempC: 38.2 };
  const svc = (overrides = {}, calls = {}) => new TrackingService(reportRepo(overrides, calls), undefined, fakeRealtime());
  await withStorage(async dir => {
    // Quyền
    for (const call of [
      s => s.updateHorseReport(driver, '601', edit), s => s.deleteHorseReport(driver, '601'), s => s.sendHorseReport(driver, '601', {}),
      s => s.updateHorseReport(coordinator, '601', edit), s => s.sendHorseReport({ id: '1', role: Role.CUSTOMER }, '601', {}),
    ]) await assert.rejects(() => call(svc()), status(403));
    const calls = {};
    const other = { id: '16', role: Role.DRIVER_ESCORT };
    const otherRepo = { getDriverAssignment: async () => ({ role: 'ESCORT' }) };
    for (const call of [s => s.updateHorseReport(other, '601', edit), s => s.deleteHorseReport(other, '601'), s => s.sendHorseReport(other, '601', {})]) {
      await assert.rejects(() => call(svc(otherRepo)), status(403), 'escort khác không phải người tạo');
    }
    await assert.rejects(() => svc({ getDriverAssignment: async () => undefined }).updateHorseReport(escort, '601', edit), status(404));
    await assert.rejects(() => svc({ findHorseLog: async () => undefined }).sendHorseReport(escort, '601', {}), status(404));
    await assert.rejects(() => svc({ getDriverAssignment: async () => ({ role: 'DRIVER' }) }).sendHorseReport(escort, '601', {}), status(403));
    // Đã gửi / nhật ký cũ: bất biến
    for (const ctx of [reportCtx({ reportStatus: 'SENT' }), reportCtx({ reportStatus: null })]) {
      const repo = { findHorseLog: async () => ctx };
      await assert.rejects(() => svc(repo).updateHorseReport(escort, '601', edit), status(409));
      await assert.rejects(() => svc(repo).deleteHorseReport(escort, '601'), status(409));
      await assert.rejects(() => svc(repo).sendHorseReport(escort, '601', {}), status(409));
    }
    // Sửa nháp: thay toàn bộ nội dung; vắng = xóa
    await svc({}, calls).updateHorseReport(escort, '601', edit);
    assert.equal(calls.locked, true, 'khóa dòng khi sửa');
    assert.deepEqual(calls.updated, { conditionStatus: 'CLIMATE_CHANGE', note: null, loggedAt: edit.loggedAt, customerNote: 'Nóng', bodyTempC: 38.2, heartRateBpm: null, appetite: null, sendToCustomer: false });
    await assert.rejects(() => svc().updateHorseReport(escort, '601', { ...edit, loggedAt: new Date(Date.now() + 3600000).toISOString() }), status(400));
    // Ảnh: xóa ảnh không thuộc báo cáo 400; vượt 3 ảnh 400; thêm / bớt ảnh đúng và dọn tệp bị xóa
    const stored = path.join(dir, '0c9f1a52-3a11-4d0b-9a55-6b0a1f7a1111');
    fs.writeFileSync(stored, PNG);
    const withRefs = { refs: [{ id: '501', storagePath: '0c9f1a52-3a11-4d0b-9a55-6b0a1f7a1111' }, { id: '502', storagePath: '0c9f1a52-3a11-4d0b-9a55-6b0a1f7a2222' }] };
    await assert.rejects(() => svc({}, { ...withRefs }).updateHorseReport(escort, '601', { ...edit, removeAttachmentIds: ['999'] }), status(400));
    await assert.rejects(() => svc({}, { ...withRefs }).updateHorseReport(escort, '601', edit, [photo(), photo()]), status(400));
    const photoCalls = { ...withRefs };
    await svc({}, photoCalls).updateHorseReport(escort, '601', { ...edit, removeAttachmentIds: ['501'], captions: ['Chân'] }, [photo()]);
    assert.deepEqual(photoCalls.deletedAttachments, ['501']);
    assert.equal(photoCalls.attachments[0][7], 'Chân');
    assert.equal(fs.existsSync(stored), false, 'tệp ảnh bị xóa được dọn sau commit');
    // Sửa lỗi DB: tệp mới không mồ côi
    const before = fs.readdirSync(dir).length;
    await assert.rejects(() => svc({ updateHorseReport: async () => { throw new Error('db down'); } }).updateHorseReport(escort, '601', edit, [photo()]), /db down/);
    assert.equal(fs.readdirSync(dir).length, before);
    // Xóa nháp: xóa ảnh và dòng, dọn tệp
    fs.writeFileSync(stored, PNG);
    const del = { refs: [{ id: '501', storagePath: '0c9f1a52-3a11-4d0b-9a55-6b0a1f7a1111' }] };
    await svc({}, del).deleteHorseReport(escort, '601');
    assert.deepEqual(del.deletedAttachments, ['501']);
    assert.equal(del.deleted, true);
    assert.equal(fs.existsSync(stored), false);
    assert.ok(del.audits.some(a => a[3] === 'DELETE_HORSE_REPORT_DRAFT'));
  });
});

test('Horse report send: photo rule, customerNote rule, DELIVERED blocked, notifications once, double send 409', async () => {
  const send = (overrides, body = {}, calls = {}, realtime = fakeRealtime()) => new TrackingService(reportRepo(overrides, calls), undefined, realtime).sendHorseReport(escort, '601', body);
  await assert.rejects(() => send({}), status(400)); // OFF_FEED chưa có ảnh
  await assert.rejects(() => send({}, {}, { refs: [{ id: '1', storagePath: 'a' }], ctx: reportCtx({ customerNote: null }) }), status(400), 'gửi khách thiếu customerNote');
  await assert.rejects(() => send({ findHorseLog: async () => reportCtx({ orderStatus: OrderStatus.DELIVERED }) }, {}, { refs: [{ id: '1', storagePath: 'a' }] }), status(409));
  await assert.rejects(() => send({ markHorseReportSent: async () => 0 }, {}, { refs: [{ id: '1', storagePath: 'a' }] }), status(409), 'đã bị gửi bởi request khác');
  const calls = { refs: [{ id: '1', storagePath: 'a' }] };
  const rt = fakeRealtime();
  const sent = await send({}, {}, calls, rt);
  assert.equal(sent.reportStatus, 'SENT');
  assert.equal(calls.locked, true);
  assert.equal(calls.sentFlag, true);
  assert.deepEqual(calls.notified.map(n => n[1]), ['HORSE_REPORT', 'HORSE_REPORT_ALERT']);
  assert.ok(calls.audits.some(a => a[3] === 'SEND_HORSE_REPORT'));
  assert.deepEqual(rt.emitted.map(e => e.event), ['tracking:horse_report', 'notification:new', 'notification:new']);
  // Ghi đè sendToCustomer lúc gửi; STABLE không cần ảnh
  const noCustomer = { refs: [], ctx: reportCtx({ conditionStatus: 'STABLE', customerNote: null }) };
  await send({}, { sendToCustomer: false }, noCustomer);
  assert.equal(noCustomer.sentFlag, false);
  assert.equal(noCustomer.notified.length, 0, 'STABLE và không gửi khách: không thông báo');
  await assert.rejects(() => send({}, { thua: 1 }), status(400));
});

test('Horse report customer API: own order only, newest per correction chain, view is idempotent and notifies the escort once', async () => {
  const customer = { id: '2', role: Role.CUSTOMER };
  const row = (overrides = {}) => ({
    id: '601', horseId: '21', horseName: 'Bạch Mã', conditionStatus: 'OFF_FEED', bodyTempC: '37.8', heartRateBpm: 38, appetite: 'REDUCED', customerNote: 'Ăn ít',
    loggedAt: new Date('2026-10-26T05:20:00Z'), sentAt: new Date('2026-10-26T05:25:00Z'), viewedAt: null, escortName: 'Hộ Tống', createdBy: '6', ...overrides,
  });
  const repo = (overrides = {}, calls = {}) => stage2Repo({
    findOrderForTimeline: async id => (id === '50' ? { orderId: '50', customerId: '2' } : undefined),
    getCustomerHorseReports: async orderId => { calls.order = orderId; return [row()]; },
    getHorseLogAttachments: async () => [{ id: '801', originalName: 'a.jpg', fileType: 'JPG', sizeBytes: 5, uploadedAt: new Date(), caption: 'Toàn thân', horseLogId: '601', incidentId: null }],
    markHorseReportViewed: async () => { calls.marked = (calls.marked ?? 0) + 1; return calls.firstView === false ? 0 : 1; },
    getHorseReportViewedAt: async () => new Date('2026-10-26T06:00:00Z'),
    ...overrides,
  }, calls);
  const calls = {};
  const list = await new TrackingService(repo({}, calls), undefined, fakeRealtime()).getCustomerHorseReports(customer, '50');
  assert.equal(calls.order, '50');
  assert.deepEqual(list, [{
    id: '601', horseId: '21', horseName: 'Bạch Mã', conditionStatus: 'OFF_FEED', bodyTempC: 37.8, heartRateBpm: 38, appetite: 'REDUCED', customerNote: 'Ăn ít',
    photos: [{ id: '801', caption: 'Toàn thân', fileType: 'JPG' }], loggedAt: '2026-10-26T05:20:00.000Z', sentAt: '2026-10-26T05:25:00.000Z', viewedAt: null, escortName: 'Hộ Tống',
  }]);
  assert.equal(JSON.stringify(list).includes('createdBy'), false, 'không lộ mã hộ tống cho khách');
  await assert.rejects(() => new TrackingService(repo()).getCustomerHorseReports(customer, '51'), status(404), 'đơn của người khác / không tồn tại');
  await assert.rejects(() => new TrackingService(repo()).getCustomerHorseReports({ id: '9', role: Role.CUSTOMER }, '50'), status(404));
  for (const account of [driver, coordinator, { id: '4', role: Role.MANAGER }]) {
    await assert.rejects(() => new TrackingService(repo()).getCustomerHorseReports(account, '50'), status(403));
    await assert.rejects(() => new TrackingService(repo()).viewHorseReport(account, '50', '601'), status(403));
  }
  // Đánh dấu đã xem: lần đầu phát socket tới hộ tống tạo báo cáo; lần sau giữ nguyên, không phát
  const rt = fakeRealtime();
  assert.deepEqual(await new TrackingService(repo({}, {}), undefined, rt).viewHorseReport(customer, '50', '601'), { viewedAt: '2026-10-26T06:00:00.000Z' });
  assert.deepEqual(rt.emitted, [{ users: ['6'], event: 'tracking:horse_report_viewed', payload: { reportId: '601', viewedAt: '2026-10-26T06:00:00.000Z' } }]);
  const again = fakeRealtime();
  const second = { firstView: false };
  assert.deepEqual(await new TrackingService(repo({}, second), undefined, again).viewHorseReport(customer, '50', '601'), { viewedAt: '2026-10-26T06:00:00.000Z' });
  assert.equal(again.emitted.length, 0);
  await assert.rejects(() => new TrackingService(repo()).viewHorseReport(customer, '50', '999'), status(404), 'báo cáo không thuộc danh sách khách xem được');
  await assert.rejects(() => new TrackingService(repo()).viewHorseReport(customer, '51', '601'), status(404));
});

test('Horse report visibility: trip reads pass the viewer; attachments of drafts and customers follow the report rules', async () => {
  const calls = {};
  const reads = new TrackingService(reportRepo({}, calls));
  await reads.getTripHorseLogs(driver, '100');
  assert.equal(calls.viewer, '5', 'tài xế đọc với mã của mình: SQL chỉ trả nháp do chính người đó tạo');
  await reads.getTripHorseLogs(escort, '100');
  assert.equal(calls.viewer, '6');
  const photoRow = (extra = {}) => ({ id: '501', originalName: 'a.png', fileType: 'PNG', storagePath: '0c9f1a52-3a11-4d0b-9a55-6b0a1f7a2222', tripId: '100', horseLogId: '601', incidentId: null, reportStatus: 'SENT', logCreatedBy: '6', ...extra });
  const fetchAs = (account, attachment, extra = {}) => new TrackingService(stage2Repo({ findAttachment: async () => attachment, isReportPhotoVisibleToCustomer: async () => extra.visible ?? false })).getAttachmentFile(account, '501');
  await withStorage(async dir => {
    fs.writeFileSync(path.join(dir, '0c9f1a52-3a11-4d0b-9a55-6b0a1f7a2222'), PNG);
    // Ảnh nháp: chỉ người tạo
    await assert.rejects(() => fetchAs(driver, photoRow({ reportStatus: 'DRAFT' })), status(404));
    await assert.rejects(() => fetchAs(coordinator, photoRow({ reportStatus: 'DRAFT' })), status(404));
    assert.equal((await fetchAs(escort, photoRow({ reportStatus: 'DRAFT' }))).fileType, 'PNG');
    assert.equal((await fetchAs(driver, photoRow())).fileType, 'PNG', 'ảnh báo cáo đã gửi: crew đọc như trước');
    // Khách: chỉ ảnh báo cáo gửi cho đơn của mình
    const customer = { id: '2', role: Role.CUSTOMER };
    assert.equal((await fetchAs(customer, photoRow(), { visible: true })).fileType, 'PNG');
    await assert.rejects(() => fetchAs(customer, photoRow(), { visible: false }), status(404));
    await assert.rejects(() => fetchAs(customer, photoRow({ horseLogId: null, incidentId: '701' }), { visible: true }), status(404), 'ảnh sự cố không bao giờ mở cho khách');
  });
});

test('Horse report correction: customer chain stays one version (audience rule) and a second draft cannot correct the same original', async () => {
  const original = (extra = {}) => ({ id: '9', horseId: '21', tripId: '100', reportStatus: 'SENT', sendToCustomer: true, corrected: false, ...extra });
  const create = (body, orig) => new TrackingService(reportRepo({ findHorseLog: async () => orig }), undefined, fakeRealtime())
    .createHorseLog(escort, '10', reportBody({ conditionStatus: 'STABLE', correctsLogId: '9', ...body }));
  // Gửi ngay: gốc gửi khách mà bản sửa không gửi khách → 400 tiếng Việt; gửi khách thì được; nháp vẫn lưu được
  await assert.rejects(() => create({ reportStatus: 'SENT', sendToCustomer: false }, original()), e => e.getStatus() === 400 && /phải gửi cho khách hàng/.test(e.message));
  await create({ reportStatus: 'SENT', sendToCustomer: true }, original());
  await create({ reportStatus: 'DRAFT', sendToCustomer: false }, original());
  await create({ reportStatus: 'SENT', sendToCustomer: false }, original({ sendToCustomer: false })); // gốc nội bộ: không ràng buộc
  await create({ reportStatus: 'SENT', sendToCustomer: false }, original({ reportStatus: null, sendToCustomer: false })); // nhật ký cũ: không ràng buộc

  // Gửi nháp: khóa gốc, kiểm lại audience và việc gốc đã có bản đính chính khác
  const sendDraft = (orig, body = {}, calls = {}) => new TrackingService(reportRepo({
    findHorseLog: async (id, lock) => { (calls.lockedIds ||= []).push([id, lock]); return id === '9' ? orig : calls.ctx; },
  }, calls), undefined, fakeRealtime()).sendHorseReport(escort, '601', body);
  const draftCalls = () => ({ ctx: reportCtx({ conditionStatus: 'STABLE', correctsLogId: '9', sendToCustomer: true }) });
  const calls = draftCalls();
  await sendDraft(original(), {}, calls);
  assert.deepEqual(calls.lockedIds, [['601', true], ['9', true]], 'khóa nháp rồi khóa bản gốc');
  await assert.rejects(() => sendDraft(original({ corrected: true }), {}, draftCalls()), e => e.getStatus() === 409 && /đã được đính chính/.test(e.message));
  await assert.rejects(() => sendDraft(original(), { sendToCustomer: false }, draftCalls()), e => e.getStatus() === 400 && /phải gửi cho khách hàng/.test(e.message));
  const internalDraft = { ctx: reportCtx({ conditionStatus: 'STABLE', correctsLogId: '9', sendToCustomer: false }) };
  await assert.rejects(() => sendDraft(original(), {}, internalDraft), e => e.getStatus() === 400);
  const noNotice = { ...draftCalls(), notified: [] };
  await assert.rejects(() => sendDraft(original({ corrected: true }), {}, noNotice), status(409));
  assert.equal(noNotice.notified.length, 0, 'bị chặn thì không thông báo');
  await sendDraft(original({ reportStatus: null, corrected: true }), {}, draftCalls()); // gốc là nhật ký cũ: giữ luật cũ
});
