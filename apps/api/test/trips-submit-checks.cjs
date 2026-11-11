const assert = require('node:assert/strict');
module.exports = async function submitChecks({ db, base, tokens, read, check }) {
  const a='9007199254740993', b='9007199254740994';
  let next=100;
  // Mỗi chuyến thử có xe riêng (sức chứa 4) và tổ lái riêng, gán qua trip_vehicles như API assignments.
  async function fixture({empty=false,owner='3',orderStatus='APPROVED',planStatus='DRAFT',horses=1,fleet=true,vehicle}={}) {
    const id=String(next++);
    await db.query('INSERT INTO orders(id,order_code,customer_id,status) VALUES (?,?,1,?)',[id,'SUBMIT-'+id,orderStatus]);
    await db.query('INSERT INTO trips(id,order_id,planned_by,plan_status) VALUES (?,?,?,?)',[id,id,owner,planStatus]);
    if(!empty) {
      await db.query(`INSERT INTO legs(trip_id,seq_no,from_location_id,to_location_id,planned_departure_at,planned_arrival_at)
        VALUES (?,1,?,?,'2027-01-01 01:00:00','2027-01-01 02:00:00')`,[id,a,b]);
      await db.query("UPDATE trips SET planned_departure_at='2027-01-01 01:00:00',planned_arrival_at='2027-01-01 02:00:00' WHERE id=?",[id]);
    }
    for(let n=0;n<horses;n++)await db.query('INSERT INTO horses(order_id,owner_id,name,passport_no) VALUES (?,1,?,?)',[id,'Horse '+n,`SUBMIT-${id}-${n}`]);
    if(fleet) {
      const vehicleId=vehicle??String(5000+Number(id));
      if(!vehicle)await db.query("INSERT INTO vehicles(id,vehicle_type,capacity_stalls,license_plate,status) VALUES (?,'MEDIUM',4,?,'AVAILABLE')",[vehicleId,'SUB-'+id]);
      const tv=(await db.query('INSERT INTO trip_vehicles(trip_id,vehicle_id,horse_count) VALUES (?,?,?)',[id,vehicleId,horses])).insertId;
      const driver=String(6000+2*Number(id)),escort=String(6001+2*Number(id));
      await db.query("INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES (?,?,'!','Driver','DRIVER_ESCORT','ACTIVE'),(?,?,'!','Escort','DRIVER_ESCORT','ACTIVE')",[driver,`d${id}@submit.test`,escort,`e${id}@submit.test`]);
      await db.query("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (?,'DRIVER','RESERVED'),(?,'ESCORT','RESERVED')",[driver,escort]);
      await db.query("INSERT INTO trip_assignments(trip_id,user_id,role,assigned_by,assigned_at,trip_vehicle_id) VALUES (?,?,'DRIVER',3,UTC_TIMESTAMP(),?),(?,?,'ESCORT',3,UTC_TIMESTAMP(),?)",[id,driver,tv,id,escort,tv]);
    }
    return id;
  }
  const post=(id,body={},user='3')=>fetch(`${base}/${id}/submit-plan`,{method:'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+tokens.sign({sub:user,email:'t@test.local',role:'ADMIN'})}:{})},body:JSON.stringify(body)});
  async function state(id) {
    const [row]=await db.query(`SELECT t.plan_status,t.approved_by,t.approved_at,t.return_reason,o.status FROM trips t JOIN orders o ON o.id=t.order_id WHERE t.id=?`,[id]);
    const [audit]=await db.query("SELECT COUNT(*) n FROM audit_logs WHERE entity_id=? AND entity_type IN ('TRIP','ORDER')",[id]);
    const [notes]=await db.query("SELECT COUNT(*) n FROM notifications WHERE related_type='TRIP' AND related_id=?",[id]);
    return {row,audit:Number(audit.n),notes:Number(notes.n)};
  }
  async function unchanged(id,expected,body={},user='3') {
    const before=await state(id),res=await post(id,body,user);assert.equal(res.status,expected,await res.text());assert.deepEqual(await state(id),before);
  }
  await check('Submit requires coordinator ownership, valid ID and strict empty body',async()=>{
    const id=await fixture();
    await unchanged(id,401,{},null);
    for(const user of ['1','2','5','6','7'])await unchanged(id,403,{},user);
    await unchanged(id,404,{},'4');
    for(const body of [{legs:[]},{planStatus:'APPROVED'},null,[]])await unchanged(id,400,body);
    assert.equal((await post('abc')).status,400);assert.equal((await post('999999')).status,404);
  });
  await check('Empty/invalid stored plan and stale Trip times cannot be submitted',async()=>{
    await unchanged(await fixture({empty:true}),409);
    for(const sql of [
      'DELETE FROM trip_assignments WHERE trip_id=?',
      'UPDATE legs SET to_location_id=from_location_id WHERE trip_id=?',
      "UPDATE trips SET planned_arrival_at='2027-01-01 03:00:00' WHERE id=?",
      "UPDATE legs SET status='MOVING' WHERE trip_id=?",
    ]) {const id=await fixture();await db.query(sql,[id]);await unchanged(id,409);}
    await unchanged(await fixture({fleet:false}),409);
    const id=await fixture();
    await db.query("INSERT INTO incidents(trip_id,incident_type,description,reported_by,reported_at) VALUES (?,'VEHICLE_BREAKDOWN','submit test',3,UTC_TIMESTAMP())",[id]);
    await unchanged(id,409);
  });
  await check('Submit rejects disallowed Order/Trip statuses and missing transport horses',async()=>{
    for(const orderStatus of ['DRAFT','PENDING','NEED_INFO','REJECTED','READY','IN_TRANSIT','DELIVERED','CANCELLED'])await unchanged(await fixture({orderStatus}),409);
    for(const planStatus of ['PENDING_APPROVAL','APPROVED'])await unchanged(await fixture({planStatus}),409);
    // These two approved fixtures must not participate in subsequent scheduling tests.
    await db.query("UPDATE orders SET status='CANCELLED' WHERE order_code LIKE 'SUBMIT-%' AND id IN (SELECT order_id FROM trips WHERE plan_status='APPROVED')");
    await unchanged(await fixture({horses:0}),409);
  });
  await check('Submission rechecks the assigned vehicle: availability, capacity and use by another approved trip',async()=>{
    const id=await fixture();const vehicle=String(5000+Number(id));
    await db.query("UPDATE vehicles SET status='IN_TRANSIT' WHERE id=?",[vehicle]);await unchanged(id,409);
    await db.query("UPDATE vehicles SET status='AVAILABLE' WHERE id=?",[vehicle]);
    await unchanged(await fixture({horses:5}),409);
    const conflict=await fixture({planStatus:'APPROVED',vehicle});await unchanged(id,409);
    await db.query("UPDATE orders SET status='CANCELLED' WHERE id=?",[conflict]);
    assert.equal((await post(id)).status,200);
  });
  await check('Success clears previous review fields, audits real actor and notifies only ACTIVE Managers',async()=>{
    await db.query("INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES (8,'locked-manager@test.local','!','Locked','MANAGER','LOCKED'),(9,'manager2@test.local','!','Second','MANAGER','ACTIVE')");
    const id=await fixture();
    await db.query("UPDATE trips SET approved_by=2,approved_at=UTC_TIMESTAMP(),return_reason='previous return' WHERE id=?",[id]);
    const res=await post(id);assert.equal(res.status,200);const detail=await res.json();assert.equal(detail.planStatus,'PENDING_APPROVAL');assert.deepEqual(await read('/'+id),detail);
    const after=await state(id);assert.equal(after.row.status,'PREPARING');assert.equal(after.row.approved_by,null);assert.equal(after.row.approved_at,null);assert.equal(after.row.return_reason,null);assert.equal(after.audit,2);assert.equal(after.notes,2);
    const [audit]=await db.query("SELECT CAST(actor_id AS CHAR) actor,old_value,new_value FROM audit_logs WHERE entity_type='TRIP' AND entity_id=? AND action='SUBMIT_PLAN'",[id]);
    assert.equal(audit.actor,'3');assert.equal(JSON.parse(audit.old_value).planStatus,'DRAFT');assert.equal(JSON.parse(audit.new_value).planStatus,'PENDING_APPROVAL');
    const notes=await db.query("SELECT CAST(recipient_id AS CHAR) recipient,event_type,channel FROM notifications WHERE related_type='TRIP' AND related_id=? ORDER BY recipient_id",[id]);
    assert.deepEqual(notes.map(n=>n.recipient),['2','9']);assert.ok(notes.every(n=>n.channel==='IN_APP'&&n.event_type==='TRIP_PLAN_SUBMITTED'));
    await unchanged(id,409);
    const put=await fetch(`${base}/${id}/plan`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens.sign({sub:'3',email:'t@test.local',role:'COORDINATOR'})},body:JSON.stringify({legs:detail.legs.map(l=>({id:l.id,fromLocationId:l.fromLocationId,toLocationId:l.toLocationId,plannedDepartureAt:l.plannedDepartureAt,plannedArrivalAt:l.plannedArrivalAt}))})});
    assert.equal(put.status,409);
  });
  await check('Resubmission from DRAFT preserves PREPARING Order and creates one Trip audit',async()=>{
    const id=await fixture({orderStatus:'PREPARING'});assert.equal((await post(id)).status,200);
    const after=await state(id);assert.equal(after.row.status,'PREPARING');assert.equal(after.audit,1);
  });
  await check('Concurrent submissions transition once and never duplicate notifications/audits',async()=>{
    const id=await fixture();const responses=await Promise.all([post(id),post(id)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
    const after=await state(id);assert.equal(after.audit,2);assert.equal(after.notes,2);
  });
  await check('Audit and notification failures rollback both states, review fields and all side effects',async()=>{
    for(const table of ['audit_logs','notifications']) {
      const id=await fixture();await db.query("UPDATE trips SET return_reason='keep on rollback' WHERE id=?",[id]);
      await db.query(`CREATE TRIGGER fail_submit BEFORE INSERT ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='submit rollback test'`);
      try{await unchanged(id,500);}finally{await db.query('DROP TRIGGER fail_submit');}
    }
  });
};
