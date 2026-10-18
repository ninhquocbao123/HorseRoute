const assert = require('node:assert/strict');
module.exports = async function crewChecks({ db, base, tokens, check }) {
  const driver='3000',escort='3001',replacement='3002';
  await db.query(`INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES
    (3000,'crew-a@test.local','!','Crew-A','DRIVER_ESCORT','ACTIVE'),
    (3001,'crew-b@test.local','!','Crew-B','DRIVER_ESCORT','ACTIVE'),
    (3002,'crew-c@test.local','!','Crew-C','DRIVER_ESCORT','ACTIVE'),
    (3003,'crew-locked@test.local','!','Crew-Locked','DRIVER_ESCORT','LOCKED')`);
  await db.query('ALTER TABLE trip_assignments AUTO_INCREMENT=9007199254740993');
  let next=4000;
  const body={assignments:[{userId:driver,role:'DRIVER'},{userId:escort,role:'ESCORT'}]};
  const changed={assignments:[{userId:driver,role:'ESCORT'},{userId:replacement,role:'DRIVER'}]};
  async function fixture({orderStatus='APPROVED',planStatus='DRAFT'}={}) {
    const id=String(next++);
    await db.query('INSERT INTO orders(id,order_code,customer_id,status) VALUES (?,?,1,?)',[id,'CREW-'+id,orderStatus]);
    await db.query('INSERT INTO trips(id,order_id,planned_by,plan_status) VALUES (?,?,3,?)',[id,id,planStatus]);
    return id;
  }
  const request=(id,{method='GET',suffix='assignments',user='3',body:payload}={})=>fetch(`${base}/${id}/${suffix}`,{method,
    headers:{...(user?{Authorization:'Bearer '+tokens.sign({sub:user,email:'crew@test.local',role:'ADMIN'})}:{}),...(payload!==undefined?{'Content-Type':'application/json'}:{})},...(payload!==undefined?{body:JSON.stringify(payload)}:{})});
  const put=(id,payload=body,user='3')=>request(id,{method:'PUT',body:payload,user});
  async function json(response,status=200){const r=await response,data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
  async function counts(id) {
    const [audit]=await db.query("SELECT COUNT(*) n FROM audit_logs WHERE entity_type='TRIP' AND entity_id=?",[id]);
    const [notes]=await db.query("SELECT COUNT(*) n FROM notifications WHERE related_type='TRIP' AND related_id=?",[id]);
    return [Number(audit.n),Number(notes.n)];
  }
  await check('Assignment options come from eligible database users and are scoped before lookup',async()=>{
    const id=await fixture();
    for(const user of ['3','2']) {
      const data=await json(request(id,{suffix:'assignment-options',user}));
      assert.deepEqual(data.items.filter(i=>[driver,escort,replacement].includes(i.id)).map(i=>i.id),[driver,escort,replacement]);
      assert.ok(!data.items.some(i=>['1','2','3003'].includes(i.id)));
      assert.ok(data.items.every(i=>JSON.stringify(Object.keys(i).sort())===JSON.stringify(['fullName','id'])));
    }
    for(const suffix of ['assignment-options','assignments']) {
      assert.equal((await request(id,{suffix,user:'4'})).status,404);
      assert.equal((await request(id,{suffix,user:null})).status,401);
      for(const user of ['1','5','6','7'])assert.equal((await request(id,{suffix,user})).status,403);
    }
    assert.equal((await put(id,body,null)).status,401);
    for(const user of ['1','2','5','6','7'])assert.equal((await put(id,body,user)).status,403);
    assert.equal((await put(id,body,'4')).status,404);
    assert.equal((await put('999999',body)).status,404);
    assert.equal((await request('invalid')).status,400);
  });
  await check('Empty crew reports missing roles, valid save returns exact IDs and UTC metadata',async()=>{
    const id=await fixture();const empty=await json(request(id));assert.deepEqual(empty.items,[]);
    assert.deepEqual(empty.crewReadiness.blockers.map(b=>b.code),['MISSING_DRIVER','MISSING_ESCORT']);
    const saved=await json(put(id));assert.equal(saved.tripId,id);assert.equal(saved.crewReadiness.complete,true);
    assert.deepEqual(saved.items.map(a=>a.userId),[driver,escort]);
    assert.ok(saved.items.every(a=>BigInt(a.id)>BigInt(Number.MAX_SAFE_INTEGER)&&a.assignedBy==='3'&&a.assignedAt.endsWith('Z')));
    assert.deepEqual(await json(request(id,{user:'2'})),saved);
    const [audit]=await db.query("SELECT CAST(actor_id AS CHAR) actor,action,old_value,new_value FROM audit_logs WHERE entity_id=? AND entity_type='TRIP'",[id]);
    assert.equal(audit.actor,'3');assert.equal(audit.action,'ASSIGN_CREW');assert.deepEqual(JSON.parse(audit.old_value),[]);assert.equal(JSON.parse(audit.new_value)[0].id,saved.items[0].id);
    assert.deepEqual(await counts(id),[1,2]);
  });
  await check('Assignment input rejects invalid users, duplicates, missing role and forged metadata without writes',async()=>{
    const id=await fixture();await json(put(id));const before=await json(request(id)),count=await counts(id);
    for(const payload of [
      {assignments:[]},{assignments:[body.assignments[0]]},
      {assignments:[body.assignments[0],{userId:driver,role:'ESCORT'}]},
      {assignments:[body.assignments[0],{userId:escort,role:'DRIVER'}]},
      {assignments:body.assignments,assignedBy:'2'},
      {assignments:[{...body.assignments[0],assignedAt:'2030-01-01T00:00:00Z'},body.assignments[1]]},
      ...['1','3003','999999'].map(userId=>({assignments:[{userId,role:'DRIVER'},body.assignments[1]]})),
    ]) {const res=await put(id,payload);assert.equal(res.status,400);assert.ok((await res.json()).fields);}
    assert.deepEqual(await json(request(id)),before);assert.deepEqual(await counts(id),count);
  });
  await check('No-op is idempotent; role update preserves ID, replacement removes only assignment',async()=>{
    const id=await fixture(),first=await json(put(id));
    const repeat=await json(put(id,{assignments:[...body.assignments].reverse()}));assert.deepEqual(repeat,first);assert.deepEqual(await counts(id),[1,2]);
    await db.query('UPDATE trip_assignments SET assigned_by=2 WHERE trip_id=?',[id]);
    const second=await json(put(id,changed));
    assert.equal(second.items[0].id,first.items[0].id);assert.equal(second.items[0].role,'ESCORT');assert.equal(second.items[0].assignedBy,'3');
    assert.equal(second.items[1].userId,replacement);assert.notEqual(second.items[1].id,first.items[1].id);
    assert.deepEqual(await counts(id),[2,5]);
    const [trip]=await db.query('SELECT plan_status FROM trips WHERE id=?',[id]);const [order]=await db.query('SELECT status FROM orders WHERE id=?',[id]);
    assert.equal(trip.plan_status,'DRAFT');assert.equal(order.status,'APPROVED');
  });
  await check('Crew can be assigned for every Trip plan status, only on APPROVED/PREPARING Orders',async()=>{
    for(const planStatus of ['DRAFT','PENDING_APPROVAL','APPROVED'])for(const orderStatus of ['APPROVED','PREPARING'])await json(put(await fixture({planStatus,orderStatus})));
    for(const orderStatus of ['DRAFT','PENDING','NEED_INFO','REJECTED','READY','IN_TRANSIT','DELIVERED','CANCELLED']) {
      const id=await fixture();await json(put(id));const before=await json(request(id)),count=await counts(id);
      await db.query('UPDATE orders SET status=? WHERE id=?',[orderStatus,id]);assert.equal((await put(id,changed)).status,409);
      assert.deepEqual(await json(request(id)),before);assert.deepEqual(await counts(id),count);
    }
  });
  await check('Operational state and histories block replacement without touching legs/history',async()=>{
    const id=await fixture();await json(put(id));
    await db.query("INSERT INTO legs(trip_id,seq_no,from_location_id,to_location_id,vehicle_id,planned_departure_at,planned_arrival_at,status) VALUES (?,1,9007199254740993,9007199254740994,9007199254740993,'2030-01-01 01:00:00','2030-01-01 02:00:00','MOVING')",[id]);
    const before=await json(request(id));assert.equal((await put(id,changed)).status,409);
    await db.query("UPDATE legs SET status='NOT_STARTED' WHERE trip_id=?",[id]);
    await db.query("INSERT INTO incidents(trip_id,incident_type,description,reported_by,reported_at) VALUES (?,'VEHICLE_BREAKDOWN','Crew test',3,UTC_TIMESTAMP())",[id]);
    assert.equal((await put(id,changed)).status,409);assert.deepEqual(await json(request(id)),before);
    assert.equal(Number((await db.query('SELECT COUNT(*) n FROM legs WHERE trip_id=?',[id]))[0].n),1);
    assert.equal(Number((await db.query('SELECT COUNT(*) n FROM incidents WHERE trip_id=?',[id]))[0].n),1);
  });
  await check('Locked existing crew remains visible with blockers, can be replaced by eligible user',async()=>{
    const id=await fixture();await json(put(id));await db.query("UPDATE users SET account_status='LOCKED' WHERE id=?",[escort]);
    try {
      const data=await json(request(id));assert.equal(data.items.length,2);assert.equal(data.crewReadiness.complete,false);
      assert.deepEqual(data.crewReadiness.blockers.map(b=>b.code),['INELIGIBLE_CREW','MISSING_ESCORT']);
      assert.equal((await put(id)).status,400);
      const fixed=await json(put(id,{assignments:[body.assignments[0],{userId:replacement,role:'ESCORT'}]}));assert.equal(fixed.crewReadiness.complete,true);
    }finally{await db.query("UPDATE users SET account_status='ACTIVE' WHERE id=?",[escort]);}
  });
  await check('Concurrent identical roster saves create one set of records, audit and notifications',async()=>{
    const id=await fixture();const res=await Promise.all([put(id),put(id)]);assert.deepEqual(res.map(r=>r.status),[200,200]);
    const results=await Promise.all(res.map(r=>r.json()));assert.deepEqual(results[0],results[1]);assert.deepEqual(await counts(id),[1,2]);
  });
  await check('Audit and notification failures rollback additions, removals and role updates',async()=>{
    for(const table of ['audit_logs','notifications']) {
      const id=await fixture();await json(put(id));const before=await json(request(id)),count=await counts(id);
      await db.query(`CREATE TRIGGER fail_crew BEFORE INSERT ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='crew rollback test'`);
      try{assert.equal((await put(id,changed)).status,500);}finally{await db.query('DROP TRIGGER fail_crew');}
      assert.deepEqual(await json(request(id)),before);assert.deepEqual(await counts(id),count);
    }
  });
};
