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
const coordinator = { id: '3', role: Role.COORDINATOR };
const now = () => new Date().toISOString();

function stage2Repo(overrides = {}, calls = {}) {
  const repo = {
    transaction: work => work(repo),
    lockLegForUpdate: async () => legRow({ status: LegStatus.MOVING, orderStatus: OrderStatus.IN_TRANSIT }),
    getDriverAssignment: async () => ({ role: 'DRIVER' }),
    findTrip: async () => ({ id: '100', orderId: '50', orderCode: 'WDP-1', orderStatus: OrderStatus.IN_TRANSIT, plannedBy: '3', customerId: '2' }),
    checkHorseBelongsToOrder: async () => true,
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
  await assert.rejects(() => new TrackingService(stage2Repo()).createHorseLog(driver, '10', { ...body, conditionStatus: 'SICK' }), e => e.getStatus() === 400);
  await assert.rejects(() => new TrackingService(stage2Repo()).createHorseLog(driver, '10', { ...body, loggedAt: new Date(Date.now() + 3600000).toISOString() }), e => e.getStatus() === 400);
  await assert.rejects(() => new TrackingService(stage2Repo({ lockLegForUpdate: async () => legRow({ status: LegStatus.NOT_STARTED, orderStatus: OrderStatus.READY }) })).createHorseLog(driver, '10', body), e => e.getStatus() === 409);
  await assert.rejects(() => new TrackingService(stage2Repo({ checkHorseBelongsToOrder: async () => false })).createHorseLog(driver, '10', body), e => e.getStatus() === 400);
  await assert.rejects(() => new TrackingService(stage2Repo({ getDriverAssignment: async () => undefined })).createHorseLog(driver, '10', body), e => e.getStatus() === 403);
  await assert.rejects(() => new TrackingService(stage2Repo({ findHorseLog: async () => ({ id: '9', horseId: '22', legId: '10', tripId: '100' }) })).createHorseLog(driver, '10', { ...body, correctsLogId: '9' }), e => e.getStatus() === 400);

  const calls = {};
  const log = await new TrackingService(stage2Repo({}, calls)).createHorseLog(driver, '10', { ...body, note: '', correctsLogId: '9' });
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
    await assert.rejects(() => new TrackingService(stage2Repo()).createHorseLog(driver, '10', body, [photo(PDF, 'a.pdf')]), e => e.getStatus() === 400);
    assert.equal(fs.readdirSync(dir).length, 0);

    const calls = {};
    await new TrackingService(stage2Repo({}, calls)).createHorseLog(driver, '10', body, [photo(), photo()]);
    assert.equal(calls.attachments.length, 2);
    assert.equal(calls.attachments[0][1], 'PNG');
    assert.equal(calls.attachments[0][5], '601');
    assert.equal(fs.readdirSync(dir).length, 2);

    await assert.rejects(
      () => new TrackingService(stage2Repo({ insertHorseLog: async () => { throw new Error('db down'); } })).createHorseLog(driver, '10', body, [photo()]),
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
