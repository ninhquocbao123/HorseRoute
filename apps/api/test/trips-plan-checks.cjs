const assert = require('node:assert/strict');
module.exports = async function planChecks({ db, base, tokens, read, check }) {
  const id = '9007199254740995', vehicle = '9007199254740993', a = '9007199254740993', b = '9007199254740994';
  await db.query('UPDATE vehicles SET is_active=1 WHERE id=?', [vehicle]);
  const leg = (from, to, departure, arrival) => ({ fromLocationId: from, toLocationId: to, vehicleId: vehicle, plannedDepartureAt: `2026-10-20T${departure}:00:00Z`, plannedArrivalAt: `2026-10-20T${arrival}:00:00Z` });
  const initial = { legs: [leg(a,b,'01','03'), leg(b,a,'04','05')] };
  const put = (body, user = '3', tripId = id) => fetch(`${base}/${tripId}/plan`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: 'Bearer ' + tokens.sign({ sub: user, email: 'test@test.local', role: 'ADMIN' }) } : {}) }, body: JSON.stringify(body) });
  const save = async body => { const res = await put(body); const data = await res.json(); assert.equal(res.status, 200, JSON.stringify(data)); return data; };
  const input = detail => ({ legs: detail.legs.map(l => ({ id: l.id, fromLocationId: l.fromLocationId, toLocationId: l.toLocationId, vehicleId: l.vehicleId, plannedDepartureAt: l.plannedDepartureAt, plannedArrivalAt: l.plannedArrivalAt })) });
  const auditCount = async () => Number((await db.query("SELECT COUNT(*) n FROM audit_logs WHERE entity_type='TRIP' AND entity_id=?", [id]))[0].n);
  let detail;
  await check('PUT enforces authentication and ownership, including Manager denied', async () => {
    assert.equal((await put(initial, null)).status, 401);
    for (const user of ['1','2','5','6','7']) assert.equal((await put(initial, user)).status, 403);
    assert.equal((await put(initial, '4')).status, 404);
    assert.equal((await put(initial, '3', '999')).status, 404);
  });
  await check('Save two legs atomically, return exact generated IDs and matching GET', async () => {
    detail = await save(initial); assert.equal(detail.legs.length, 2); assert.deepEqual(detail.legs.map(l => l.seqNo), [1,2]);
    assert.ok(detail.legs.every(l => typeof l.id === 'string' && BigInt(l.id) > BigInt(Number.MAX_SAFE_INTEGER) && l.status === 'NOT_STARTED'));
    assert.equal(detail.planStatus, 'DRAFT'); assert.equal(detail.plannedDepartureAt, '2026-10-20T01:00:00.000Z'); assert.equal(detail.plannedArrivalAt, '2026-10-20T05:00:00.000Z');
    assert.deepEqual(await read('/' + id), detail);
    const [audit] = await db.query("SELECT CAST(actor_id AS CHAR) actor,action,old_value,new_value FROM audit_logs WHERE entity_id=? AND entity_type='TRIP'", [id]);
    assert.equal(audit.actor, '3'); assert.equal(audit.action, 'SAVE_PLAN'); assert.deepEqual(JSON.parse(audit.old_value).legs, []); assert.equal(JSON.parse(audit.new_value).legs[0].id, detail.legs[0].id);
    assert.equal((await db.query('SELECT status FROM orders WHERE id=?', [id]))[0].status, 'APPROVED');
  });
  await check('Edit preserves leg IDs, sequence and carrier; append preserves Trip', async () => {
    await db.query("INSERT INTO carriers(id,name) VALUES (1,'Test carrier')");
    await db.query('UPDATE legs SET carrier_id=1 WHERE id=?', [detail.legs[0].id]);
    const oldIds = detail.legs.map(l => l.id), body = input(detail);
    body.legs[0].plannedArrivalAt = '2026-10-20T02:00:00Z';
    detail = await save(body); assert.deepEqual(detail.legs.map(l => l.id), oldIds);
    assert.equal(String((await db.query('SELECT carrier_id FROM legs WHERE id=?',[oldIds[0]]))[0].carrier_id), '1');
    const appended = input(detail); appended.legs.push(leg(a,b,'06','07')); detail = await save(appended);
    assert.deepEqual(detail.legs.slice(0,2).map(l => l.id), oldIds); assert.equal(detail.legs[2].seqNo, 3);
    assert.equal(Number((await db.query('SELECT COUNT(*) n FROM trips'))[0].n), 3);
  });
  await check('Invalid payloads return 400 with fields and do not change plan/audit', async () => {
    const good = input(detail), count = await auditCount();
    const mutations = [
      body => { body.planStatus = 'APPROVED'; }, body => { body.legs[0].actualDepartureAt = '2026-10-20T01:00:00Z'; },
      body => { body.legs.pop(); }, body => { body.legs.reverse(); }, body => { body.legs[0].id = '9007199254740993'; },
      body => { body.legs[1].id = body.legs[0].id; }, body => { delete body.legs[0].id; },
      body => { body.legs[0].fromLocationId = '999'; }, body => { body.legs[0].vehicleId = '999'; },
      body => { body.legs[0].vehicleId = '9007199254740994'; }, body => { body.legs[0].toLocationId = a; },
      body => { body.legs[1].plannedDepartureAt = '2026-10-20T00:00:00Z'; },
      body => { body.legs[1].fromLocationId = a; }, body => { body.legs[0].plannedDepartureAt = '2026-02-30T01:00:00Z'; },
    ];
    for (const mutate of mutations) { const body = structuredClone(good); mutate(body); const res = await put(body); assert.equal(res.status, 400); assert.ok((await res.json()).fields); }
    assert.deepEqual(await read('/' + id), detail); assert.equal(await auditCount(), count);
  });
  await check('Only DRAFT Trips with APPROVED or PREPARING Orders allow editing', async () => {
    const count = await auditCount();
    for (const status of ['PENDING_APPROVAL','APPROVED']) {
      await db.query('UPDATE trips SET plan_status=? WHERE id=?',[status,id]);
      assert.equal((await put(input(detail))).status,409);
    }
    await db.query("UPDATE trips SET plan_status='DRAFT' WHERE id=?",[id]);
    for (const status of ['DRAFT','PENDING','NEED_INFO','REJECTED','READY','IN_TRANSIT','DELIVERED','CANCELLED']) {
      await db.query('UPDATE orders SET status=? WHERE id=?',[status,id]); assert.equal((await put(input(detail))).status,409);
    }
    assert.equal(await auditCount(), count);
    for (const status of ['APPROVED','PREPARING']) {
      await db.query('UPDATE orders SET status=? WHERE id=?',[status,id]);
      detail = await save(input(detail)); assert.equal(detail.planStatus,'DRAFT');
    }
  });
  await check('Operational state, actual times and all history types block changes without deleting history', async () => {
    const legId = detail.legs[0].id, count = await auditCount();
    for (const status of ['MOVING','AT_STOP','COMPLETED']) { await db.query('UPDATE legs SET status=? WHERE id=?',[status,legId]); assert.equal((await put(input(detail))).status,409); }
    await db.query("UPDATE legs SET status='NOT_STARTED',actual_departure_at='2026-10-20 01:00:00' WHERE id=?",[legId]); assert.equal((await put(input(detail))).status,409);
    await db.query('UPDATE legs SET actual_departure_at=NULL WHERE id=?',[legId]);
    await db.query("INSERT INTO horses(id,order_id,owner_id,name,passport_no) VALUES (1,?,1,'Test horse','PLAN-TEST')",[id]);
    for (const [table,sql,values] of [
      ['leg_milestones',"INSERT INTO leg_milestones(leg_id,milestone_type,occurred_at,recorded_by) VALUES (?,'DEPARTED',UTC_TIMESTAMP(),3)",[legId]],
      ['horse_logs',"INSERT INTO horse_logs(horse_id,leg_id,condition_status,logged_at,created_by) VALUES (1,?,'STABLE',UTC_TIMESTAMP(),3)",[legId]],
      ['incidents',"INSERT INTO incidents(trip_id,leg_id,incident_type,description,reported_by,reported_at) VALUES (?,?,'VEHICLE_BREAKDOWN','test',3,UTC_TIMESTAMP())",[id,legId]],
      ['incidents',"INSERT INTO incidents(trip_id,incident_type,description,reported_by,reported_at) VALUES (?,'VEHICLE_BREAKDOWN','trip only',3,UTC_TIMESTAMP())",[id]],
    ]) {
      await db.query(sql, values); assert.equal((await put(input(detail))).status,409);
      assert.equal(Number((await db.query('SELECT COUNT(*) n FROM '+table))[0].n),1);
      await db.query('DELETE FROM '+table); // Test fixture cleanup only.
    }
    assert.equal(await auditCount(),count); assert.deepEqual(await read('/'+id),detail);
  });
  await check('Failure during audit rolls back leg updates, inserts and Trip timestamps', async () => {
    const count = await auditCount(), body = input(detail); body.legs[0].plannedArrivalAt='2026-10-20T03:00:00Z'; body.legs.push(leg(b,a,'08','09'));
    await db.query("CREATE TRIGGER fail_plan_audit BEFORE INSERT ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test rollback'");
    try { assert.equal((await put(body)).status,500); } finally { await db.query('DROP TRIGGER fail_plan_audit'); }
    assert.deepEqual(await read('/'+id),detail); assert.equal(await auditCount(),count);
  });
  await check('Concurrent append serializes; stale request cannot duplicate new legs', async () => {
    const body = input(detail); body.legs.push(leg(b,a,'08','09')); const count = await auditCount();
    const results = await Promise.all([put(body),put(body)]); assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
    detail = await read('/'+id); assert.equal(detail.legs.length,4); assert.equal(await auditCount(),count+1);
  });
  await check('Ownership is rechecked after waiting on Order lock', async () => {
    const { TripsRepository } = require('../src/features/trips/trips.repository');
    const { TripsService } = require('../src/features/trips/trips.service');
    const locker = db.createQueryRunner(); await locker.connect(); await locker.startTransaction();
    const repo = new TripsRepository(db), original = repo.transaction.bind(repo);
    let reached; const waiting = new Promise(resolve => { reached=resolve; });
    repo.transaction = work => original(tx => { const lock=tx.lockOrder.bind(tx); tx.lockOrder=key=>{reached();return lock(key);};return work(tx); });
    let pending;
    try {
      await locker.query('SELECT id FROM orders WHERE id=? FOR UPDATE',[id]);
      await locker.query('UPDATE trips SET planned_by=4 WHERE id=?',[id]);
      pending = new TripsService(repo).savePlan({id:'3',role:'COORDINATOR'},id,input(detail));
      const rejection = assert.rejects(pending,e=>e.getStatus()===404);
      await waiting; await locker.commitTransaction(); await rejection;
    } finally { if(locker.isTransactionActive) await locker.rollbackTransaction(); await locker.release(); }
    await db.query('UPDATE trips SET planned_by=3 WHERE id=?',[id]);
  });
};
