require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tripIdSchema, tripQuerySchema } = require('../src/features/trips/trips.validation');
const { TripsService } = require('../src/features/trips/trips.service');
test('Trip validation preserves large IDs and rejects unsafe bounds or client ownership filters', () => {
  assert.equal(tripIdSchema.parse('18446744073709551615'), '18446744073709551615');
  for (const id of ['18446744073709551616', '0', '-1', '1.5', '1e3', '01']) assert.equal(tripIdSchema.safeParse(id).success, false);
  assert.deepEqual(tripQuerySchema.parse({}), { page: 1, limit: 20 });
  for (const query of [{ page: 0 }, { limit: 101 }, { plannedBy: '2' }, { page: '9007199254740992' }, { page: '9007199254740991', limit: 100 }]) assert.equal(tripQuerySchema.safeParse(query).success, false);
});
test('Trip service denies forbidden roles and checks ownership before reading legs or lookup data', async () => {
  const calls = [];
  const service = new TripsService({ find: async (scope, id) => { calls.push({ scope, id }); }, legs: () => assert.fail('legs leaked'), locations: () => assert.fail('locations leaked'), vehicles: () => assert.fail('vehicles leaked') });
  for (const role of ['CUSTOMER', 'ADMIN', 'SPECIALIST', 'DRIVER_ESCORT']) {
    const account = { id: '1', role };
    for (const action of [() => service.list(account, { page: 1, limit: 20 }), () => service.detail(account, '9'), () => service.planOptions(account, '9')]) await assert.rejects(action, e => e.getStatus() === 403);
  }
  assert.equal(calls.length, 0);
  for (const action of ['detail', 'planOptions']) await assert.rejects(() => service[action]({ id: '4', role: 'COORDINATOR' }, '9'), e => e.getStatus() === 404);
  assert.deepEqual(calls, [{ scope: { coordinatorId: '4' }, id: '9' }, { scope: { coordinatorId: '4' }, id: '9' }]);
});
const { tripPlanSchema } = require('../src/features/trips/trips.validation');
const planLeg = { fromLocationId: '1', toLocationId: '2', vehicleId: '3', plannedDepartureAt: '2026-10-20T01:00:00Z', plannedArrivalAt: '2026-10-20T03:00:00.000Z' };
test('Plan validates actual UTC dates, DATETIME precision and server-owned fields', () => {
  assert.ok(tripPlanSchema.safeParse({ legs: [planLeg] }).success);
  for (const value of ['2026-02-30T01:00:00Z', '2026-10-20T24:00:00Z', '2026-10-20T01:00:00+07:00', '2026-10-20T01:00:00.123Z', '0999-10-20T01:00:00Z']) {
    assert.equal(tripPlanSchema.safeParse({ legs: [{ ...planLeg, plannedDepartureAt: value }] }).success, false, value);
  }
  for (const field of ['status','actualDepartureAt','seqNo','carrierId']) assert.equal(tripPlanSchema.safeParse({ legs: [{ ...planLeg, [field]: 'bad' }] }).success, false);
  assert.equal(tripPlanSchema.safeParse({ legs: [planLeg], planStatus: 'APPROVED' }).success, false);
  assert.equal(tripPlanSchema.safeParse({ legs: [] }).success, false);
  assert.equal(tripPlanSchema.safeParse({ legs: Array(51).fill(planLeg) }).success, false);
});
test('New route plan schedule accepts only total window bound to a route revision',()=>{
 const valid={plannedDepartureAt:'2026-10-30T00:00:00Z',plannedArrivalAt:'2026-11-08T06:00:00Z',routePlanRevision:3};
 assert.ok(tripPlanSchema.safeParse(valid).success);
 for(const body of [{...valid,plannedArrivalAt:valid.plannedDepartureAt},{...valid,plannedArrivalAt:'2026-10-30T12:00:00Z'},{...valid,routePlanRevision:-1},{...valid,extra:true}]) {
  assert.equal(tripPlanSchema.safeParse(body).success,false);
 }
});
test('Plan rejects disconnected, backward-time and duplicate-ID legs', () => {
  const second = { ...planLeg, fromLocationId: '2', toLocationId: '1', plannedDepartureAt: '2026-10-20T03:00:00Z', plannedArrivalAt: '2026-10-20T04:00:00Z' };
  assert.ok(tripPlanSchema.safeParse({ legs: [planLeg, second] }).success);
  for (const legs of [[{ ...planLeg, toLocationId: '1' }], [{ ...planLeg, plannedArrivalAt: '2026-10-20T00:00:00Z' }], [planLeg, { ...second, fromLocationId: '4' }], [planLeg, { ...second, plannedDepartureAt: '2026-10-20T02:00:00Z' }], [{ ...planLeg, id: '9' }, { ...second, id: '9' }]]) assert.equal(tripPlanSchema.safeParse({ legs }).success, false);
});
test('Saving requires DRAFT Trip and APPROVED or PREPARING Order', async () => {
  for (const planStatus of ['DRAFT','PENDING_APPROVAL','APPROVED']) {
    for (const orderStatus of ['APPROVED','DRAFT','PENDING','PREPARING','READY','IN_TRANSIT','DELIVERED','CANCELLED','REJECTED','NEED_INFO']) {
      let writes = 0;
      const row = { id:'9',orderId:'8',orderCode:'TEST',plannedBy:'4',planStatus,plannedDepartureAt:null,plannedArrivalAt:null };
      const repo = { transaction: work=>work(repo), orderId:async()=> '8',lockOrder:async()=>({status:orderStatus}),lockTrip:async()=>row,
        lockLegs:async()=>[],hasHistory:async()=>false,lockLocation:async()=>true,lockAvailableVehicle:async()=>true,vehicleOverlaps:async()=>false,assignments:async()=>[],
        fleet:async()=>[],find:async()=>row,legs:async()=>[],writeLeg:async()=>{writes++;},updatePlanTimes:async()=>{},audit:async()=>{} };
      const promise = new TripsService(repo).savePlan({id:'4',role:'COORDINATOR'},'9',{legs:[{...planLeg,vehicleId:undefined}]});
      if(planStatus==='DRAFT' && ['APPROVED','PREPARING'].includes(orderStatus)) { assert.equal((await promise).planStatus,planStatus);assert.equal(writes,1); }
      else { await assert.rejects(promise,e=>e.getStatus()===409);assert.equal(writes,0); }
    }
  }
});

const { reviewTripPlanSchema } = require('../src/features/trips/trips.validation');
test('Review accepts only APPROVED or RETURNED with strict trimmed reason', () => {
  assert.deepEqual(reviewTripPlanSchema.parse({decision:'APPROVED'}),{decision:'APPROVED'});
  assert.deepEqual(reviewTripPlanSchema.parse({decision:'RETURNED',reason:'  sửa xe  '}),{decision:'RETURNED',reason:'sửa xe'});
  assert.ok(reviewTripPlanSchema.safeParse({decision:'RETURNED',reason:'a'.repeat(255)}).success);
  for(const body of [{},{decision:'DRAFT'},{decision:'RETURNED'},{decision:'RETURNED',reason:' '},{decision:'RETURNED',reason:'a'.repeat(256)},{decision:'APPROVED',reason:'extra'},{decision:'APPROVED',approved_by:'2'}]) {
    assert.equal(reviewTripPlanSchema.safeParse(body).success,false);
  }
});

const { tripAssignmentsSchema } = require('../src/features/trips/trips.validation');
const { checkCrewReadiness } = require('../src/features/trips/trips.crew');
test('Crew input uses per-vehicle groups and rejects the legacy flat payload',()=>{
 assert.equal(tripAssignmentsSchema.safeParse({assignments:[{userId:'7',role:'DRIVER'},{userId:'8',role:'ESCORT'}]}).success,false);
 assert.ok(tripAssignmentsSchema.safeParse({vehicles:[{vehicleId:'3',horseCount:2,crew:[{userId:'7',role:'DRIVER'},{userId:'8',role:'ESCORT'}]}]}).success);
});
test('Crew readiness reports missing and invalid crew, without claiming full READY',()=>{
 assert.deepEqual(checkCrewReadiness([]).blockers.map(b=>b.code),['MISSING_DRIVER','MISSING_ESCORT']);
 const driver={userId:'7',role:'DRIVER',accountRole:'DRIVER_ESCORT',accountStatus:'ACTIVE',crewType:'DRIVER',workStatus:'AVAILABLE'};
 const escort={...driver,userId:'8',role:'ESCORT',crewType:'ESCORT'};
 assert.equal(checkCrewReadiness([driver,escort]).complete,true);
 assert.deepEqual(checkCrewReadiness([driver,{...escort,accountStatus:'LOCKED'}]).blockers.map(b=>b.code),['INELIGIBLE_CREW','MISSING_ESCORT']);
 assert.deepEqual(checkCrewReadiness([{...driver,accountRole:'CUSTOMER'},escort]).blockers.map(b=>b.code),['INELIGIBLE_CREW','MISSING_DRIVER']);
});

test('Order-backed trip list preserves trip navigation, ownership and requested order fields', async () => {
  const service = new TripsService({ list: async (scope, limit, offset) => {
    assert.deepEqual(scope, { coordinatorId: '7' });
    assert.equal(limit, 20); assert.equal(offset, 20);
    return { total: 21, rows: [{ id: '29', orderId: '100', orderCode: 'VCN-100',
      planStatus: 'DRAFT', plannedBy: '7', plannedDepartureAt: null, plannedArrivalAt: null,
      orderStatus: 'PREPARING', desiredDepartureDate: '2026-11-15', requestedPickupTime: ' 05:30 ', horseCount: '3' }] };
  } });
  const result = await service.list({ id: '7', role: 'COORDINATOR' }, { page: 2, limit: 20 });
  assert.equal(result.items[0].id, '29');
  assert.equal(result.items[0].tripId, '29');
  assert.equal(result.items[0].orderId, '100');
  assert.equal(result.items[0].desiredDepartureDate, '2026-11-15');
  assert.equal(result.items[0].requestedPickupTime, '05:30');
  assert.equal(result.items[0].horseCount, 3);
  assert.equal(result.items[0].orderStatus, 'PREPARING');
  assert.equal(result.total, 21);
});
