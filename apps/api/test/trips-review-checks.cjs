const assert = require('node:assert/strict');
// Duyệt kế hoạch theo mô hình đội xe: chặng chỉ có lộ trình và giờ; xe gán cho cả chuyến (trip_vehicles) kèm tổ lái.
// Một xe chỉ thuộc một chuyến đang hoạt động (đơn chưa giao/hủy), bất kể giờ chạy.
module.exports = async function reviewChecks({ db, base, tokens, read, check }) {
  const a='9007199254740993', b='9007199254740994', v='2000', w='2001';
  await db.query("INSERT INTO vehicles(id,vehicle_type,capacity_stalls,license_plate,status) VALUES (2000,'MEDIUM',4,'REVIEW-A','AVAILABLE'),(2001,'MEDIUM',4,'REVIEW-B','AVAILABLE')");
  let next=2000;
  const leg=(from=a,to=b,start='01',end='03')=>({fromLocationId:from,toLocationId:to,plannedDepartureAt:`2030-01-01T${start}:00:00.000Z`,plannedArrivalAt:`2030-01-01T${end}:00:00.000Z`});
  // vehicles: [[vehicleId, horseCount], ...]; mặc định mỗi chuyến có một xe riêng chở hết số ngựa. Mỗi xe có tổ lái riêng.
  async function fixture({planStatus='PENDING_APPROVAL',orderStatus='PREPARING',legs=[leg()],horses=1,vehicles}={}) {
    const id=String(next++);
    await db.query('INSERT INTO orders(id,order_code,customer_id,status) VALUES (?,?,1,?)',[id,'REVIEW-'+id,orderStatus]);
    await db.query('INSERT INTO trips(id,order_id,planned_by,plan_status,planned_departure_at,planned_arrival_at) VALUES (?,?,3,?,?,?)',
      [id,id,planStatus,legs.length?new Date(legs[0].plannedDepartureAt):null,legs.length?new Date(legs.at(-1).plannedArrivalAt):null]);
    for(let i=0;i<legs.length;i++) {
      const l=legs[i];await db.query('INSERT INTO legs(trip_id,seq_no,from_location_id,to_location_id,planned_departure_at,planned_arrival_at) VALUES (?,?,?,?,?,?)',
        [id,i+1,l.fromLocationId,l.toLocationId,new Date(l.plannedDepartureAt),new Date(l.plannedArrivalAt)]);
    }
    for(let n=0;n<horses;n++)await db.query('INSERT INTO horses(order_id,owner_id,name,passport_no) VALUES (?,1,?,?)',[id,'Horse '+n,`REVIEW-${id}-${n}`]);
    if(!vehicles) {
      const own=String(7000+Number(id));
      await db.query("INSERT INTO vehicles(id,vehicle_type,capacity_stalls,license_plate,status) VALUES (?,'MEDIUM',4,?,'AVAILABLE')",[own,'REV-'+id]);
      vehicles=[[own,horses]];
    }
    for(const [index,[vehicleId,horseCount]] of vehicles.entries()) {
      const tv=(await db.query('INSERT INTO trip_vehicles(trip_id,vehicle_id,horse_count) VALUES (?,?,?)',[id,vehicleId,horseCount])).insertId;
      const driver=String(80000+Number(id)*10+index*2),escort=String(80001+Number(id)*10+index*2);
      await db.query("INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES (?,?,'!','Driver','DRIVER_ESCORT','ACTIVE'),(?,?,'!','Escort','DRIVER_ESCORT','ACTIVE')",[driver,`d${driver}@review.test`,escort,`e${escort}@review.test`]);
      await db.query("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (?,'DRIVER','RESERVED'),(?,'ESCORT','RESERVED')",[driver,escort]);
      await db.query("INSERT INTO trip_assignments(trip_id,user_id,role,assigned_by,assigned_at,trip_vehicle_id) VALUES (?,?,'DRIVER',3,UTC_TIMESTAMP(),?),(?,?,'ESCORT',3,UTC_TIMESTAMP(),?)",[id,driver,tv,id,escort,tv]);
    }
    return id;
  }
  const request=(id,body,user='2',action='review-plan',method='POST')=>fetch(`${base}/${id}/${action}`,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+tokens.sign({sub:user,email:'review@test.local',role:'MANAGER'})}:{})},body:JSON.stringify(body)});
  async function review(id,body={decision:'APPROVED'},user='2') {
    const res=await request(id,body,user),data=await res.json();assert.equal(res.status,200,JSON.stringify(data));return data;
  }
  async function snapshot(id) {
    const [row]=await db.query('SELECT t.plan_status,CAST(t.approved_by AS CHAR) approved_by,t.approved_at,t.return_reason,o.status FROM trips t JOIN orders o ON o.id=t.order_id WHERE t.id=?',[id]);
    const [audit]=await db.query("SELECT COUNT(*) n FROM audit_logs WHERE entity_type='TRIP' AND entity_id=?",[id]);
    const [notes]=await db.query("SELECT COUNT(*) n FROM notifications WHERE related_type='TRIP' AND related_id=?",[id]);
    return {row,audit:Number(audit.n),notes:Number(notes.n)};
  }
  async function unchanged(id,status,body={decision:'APPROVED'},user='2') {
    const before=await snapshot(id),res=await request(id,body,user);assert.equal(res.status,status,await res.text());assert.deepEqual(await snapshot(id),before);
  }
  const run=(label,fn)=>check(label,async()=>{
    // Release prior test reservations, retaining rows/audit for isolation and inspection.
    await db.query("UPDATE orders SET status='CANCELLED' WHERE order_code LIKE 'REVIEW-%'");
    await db.query("UPDATE vehicles SET status='AVAILABLE',capacity_stalls=4 WHERE id IN (2000,2001)");
    await fn();
  });
  await run('Review HTTP permissions, strict decision/reason and requestId',async()=>{
    const id=await fixture();await unchanged(id,401,{decision:'APPROVED'},null);
    for(const user of ['1','3','4','5','6','7','8'])await unchanged(id,403,{decision:'APPROVED'},user);
    for(const body of [{},{decision:'RETURNED'},{decision:'RETURNED',reason:' '},{decision:'RETURNED',reason:'x'.repeat(256)},{decision:'DRAFT'},{decision:'APPROVED',approved_by:'3'}])await unchanged(id,400,body);
    assert.equal((await request('missing',{decision:'APPROVED'})).status,400);
    assert.equal((await request('999999999',{decision:'APPROVED'})).status,404);
    const res=await request(id,{decision:'RETURNED'});assert.equal((await res.json()).requestId,res.headers.get('X-Request-ID'));
  });
  await run('Return keeps legs, stores trimmed reason, clears approval and exposes metadata to Coordinator',async()=>{
    const id=await fixture(),before=await read('/'+id);
    await db.query("UPDATE trips SET approved_by=9,approved_at=UTC_TIMESTAMP() WHERE id=?",[id]);
    const data=await review(id,{decision:'RETURNED',reason:'  Đổi xe cho chặng thứ nhất.  '});
    assert.equal(data.planStatus,'DRAFT');assert.equal(data.orderStatus,'PREPARING');assert.equal(data.approvedBy,null);assert.equal(data.approvedAt,null);assert.equal(data.returnReason,'Đổi xe cho chặng thứ nhất.');
    assert.deepEqual(data.legs,before.legs);assert.deepEqual(await read('/'+id),data);
    const [audit]=await db.query("SELECT CAST(actor_id AS CHAR) actor,action,old_value,new_value,reason FROM audit_logs WHERE entity_type='TRIP' AND entity_id=?",[id]);
    assert.equal(audit.actor,'2');assert.equal(audit.action,'REVIEW_PLAN');assert.equal(JSON.parse(audit.old_value).planStatus,'PENDING_APPROVAL');assert.equal(JSON.parse(audit.new_value).planStatus,'DRAFT');assert.equal(audit.reason,data.returnReason);
    const [note]=await db.query("SELECT CAST(recipient_id AS CHAR) recipient,event_type,content,channel FROM notifications WHERE related_type='TRIP' AND related_id=?",[id]);
    assert.equal(note.recipient,'3');assert.equal(note.event_type,'TRIP_PLAN_REVIEWED');assert.equal(note.channel,'IN_APP');assert.ok(note.content.includes(data.returnReason));
  });
  await run('Full return-edit-resubmit-approve cycle preserves leg IDs and review history',async()=>{
    const id=await fixture(),original=await read('/'+id);
    await review(id,{decision:'RETURNED',reason:'Điều chỉnh giờ.'});
    const body={legs:original.legs.map(l=>({id:l.id,fromLocationId:l.fromLocationId,toLocationId:l.toLocationId,plannedDepartureAt:l.plannedDepartureAt,plannedArrivalAt:'2030-01-01T04:00:00.000Z'}))};
    const saved=await request(id,body,'3','plan','PUT');assert.equal(saved.status,200,await saved.text());
    const submitted=await request(id,{},'3','submit-plan');assert.equal(submitted.status,200,await submitted.text());
    const data=await review(id,{decision:'APPROVED'},'9');
    assert.equal(data.planStatus,'APPROVED');assert.equal(data.orderStatus,'PREPARING');assert.equal(data.approvedBy,'9');assert.match(data.approvedAt,/Z$/);assert.equal(data.returnReason,null);
    assert.deepEqual(data.legs.map(l=>l.id),original.legs.map(l=>l.id));assert.equal(data.legs[0].plannedArrivalAt,'2030-01-01T04:00:00.000Z');
    const audits=await db.query("SELECT action FROM audit_logs WHERE entity_type='TRIP' AND entity_id=? ORDER BY id",[id]);
    assert.deepEqual(audits.map(a=>a.action),['REVIEW_PLAN','SAVE_PLAN','SUBMIT_PLAN','REVIEW_PLAN']);
    await unchanged(id,409);assert.equal((await request(id,body,'3','plan','PUT')).status,409);
  });
  await run('Approval keeps the Order PREPARING; start-transport marks it READY, audits and notifies customer, coordinator and crew',async()=>{
    const id=await fixture();
    const data=await review(id);assert.equal(data.planStatus,'APPROVED');assert.equal(data.orderStatus,'PREPARING');
    const started=await request(id,{},'2','start-transport'),startedBody=await started.json();
    assert.equal(started.status,200,JSON.stringify(startedBody));assert.equal(startedBody.orderStatus,'READY');
    const [audit]=await db.query("SELECT CAST(actor_id AS CHAR) actor FROM audit_logs WHERE entity_type='ORDER' AND entity_id=? AND action='MARK_READY'",[id]);assert.equal(audit.actor,'2');
    const [notes]=await db.query("SELECT COUNT(*) n FROM notifications WHERE related_type='ORDER' AND related_id=? AND event_type='ORDER_READY'",[id]);assert.equal(Number(notes.n),4);
    assert.equal((await request(id,{},'2','start-transport')).status,409,'a trip is handed to the crew only once');
  });
  await run('Review requires PENDING_APPROVAL and a plannable Order',async()=>{
    for(const planStatus of ['DRAFT','APPROVED']) {const id=await fixture({planStatus});await unchanged(id,409);await unchanged(id,409,{decision:'RETURNED',reason:'No'});}
    for(const orderStatus of ['DRAFT','PENDING','NEED_INFO','REJECTED','READY','IN_TRANSIT','DELIVERED','CANCELLED']) {
      const id=await fixture({orderStatus});await unchanged(id,409);await unchanged(id,409,{decision:'RETURNED',reason:'No'});
    }
    await db.query("UPDATE orders SET status='CANCELLED' WHERE order_code LIKE 'REVIEW-%'");
    const id=await fixture({orderStatus:'APPROVED'});const data=await review(id);assert.equal(data.orderStatus,'APPROVED');
  });
  await run('Approval rejects empty, disconnected, zero-duration or inconsistent plans; return remains possible',async()=>{
    for(const legs of [[],[leg(a,a)],[leg(),leg(a,b,'04','05')],[leg(a,b,'01','01')]]) {
      const id=await fixture({legs});await unchanged(id,409);assert.equal((await review(id,{decision:'RETURNED',reason:'Sửa kế hoạch.'})).planStatus,'DRAFT');
    }
    const id=await fixture();await db.query("UPDATE trips SET planned_arrival_at='2030-01-01 05:00:00' WHERE id=?",[id]);await unchanged(id,409);
  });
  await run('Approval rechecks the fleet: busy vehicle, current horse count, capacity and missing crew',async()=>{
    const busy=await fixture();await db.query("UPDATE vehicles SET status='IN_TRANSIT' WHERE id=?",[String(7000+Number(busy))]);await unchanged(busy,409);
    await unchanged(await fixture({horses:5}),409);
    const removed=await fixture({horses:2,vehicles:[[w,2]]});await db.query("UPDATE horses SET order_status='REMOVED' WHERE order_id=? ORDER BY id DESC LIMIT 1",[removed]);await unchanged(removed,409);
    const noCrew=await fixture();await db.query('DELETE FROM trip_assignments WHERE trip_id=?',[noCrew]);await unchanged(noCrew,409);
    const exact=await fixture({horses:5,vehicles:[[v,4]]});await db.query("UPDATE horses SET order_status='REMOVED' WHERE order_id=? ORDER BY id DESC LIMIT 1",[exact]);
    assert.equal((await review(exact)).planStatus,'APPROVED');
  });
  await run('Operational history blocks both review decisions without deleting records',async()=>{
    const id=await fixture();await db.query("INSERT INTO incidents(trip_id,incident_type,description,reported_by,reported_at) VALUES (?,'VEHICLE_BREAKDOWN','review history',3,UTC_TIMESTAMP())",[id]);
    await unchanged(id,409);await unchanged(id,409,{decision:'RETURNED',reason:'Không được sửa lịch sử'});
    assert.equal(Number((await db.query('SELECT COUNT(*) n FROM incidents WHERE trip_id=?',[id]))[0].n),1);
  });
  await run('A vehicle serves one active trip at a time, whatever the hours; another vehicle is fine',async()=>{
    const reserved=await fixture({legs:[leg(a,b,'02','05')],vehicles:[[v,1]]});await review(reserved);
    for(const [start,end] of [['01','06'],['03','04'],['05','06'],['10','11']])await unchanged(await fixture({legs:[leg(a,b,start,end)],vehicles:[[v,1]]}),409);
    assert.equal((await review(await fixture({legs:[leg(a,b,'02','05')],vehicles:[[w,1]]}))).planStatus,'APPROVED');
    // Giao xong thì luồng giao ngựa nhả xe (syncTripResources); ở đây làm cùng việc đó bằng SQL.
    await db.query("UPDATE orders SET status='DELIVERED' WHERE id=?",[reserved]);await db.query("UPDATE vehicles SET status='AVAILABLE' WHERE id=?",[v]);
    // Các kế hoạch thử bị từ chối ở trên vẫn giữ xe v cho tới khi đơn của chúng kết thúc.
    await db.query("UPDATE orders SET status='CANCELLED' WHERE order_code LIKE 'REVIEW-%' AND status<>'DELIVERED'");
    assert.equal((await review(await fixture({legs:[leg(a,b,'10','11')],vehicles:[[v,1]]}))).planStatus,'APPROVED','free again once the first order is delivered');
  });
  await run('Vehicle still operating is not declared free from expired planned arrival',async()=>{
    const old=await fixture({planStatus:'APPROVED',orderStatus:'IN_TRANSIT',legs:[leg(a,b,'00','01')],vehicles:[[v,1]]});
    await db.query("UPDATE legs SET status='MOVING',actual_departure_at='2029-12-31 23:00:00' WHERE trip_id=?",[old]);
    await unchanged(await fixture({legs:[leg(a,b,'10','11')],vehicles:[[v,1]]}),409);
  });
  await run('Two simultaneous decisions on the same Trip cause exactly one review/notification',async()=>{
    const id=await fixture();const responses=await Promise.all([request(id,{decision:'APPROVED'}),request(id,{decision:'RETURNED',reason:'Concurrent'},'9')]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);const state=await snapshot(id);assert.equal(state.audit,1);assert.equal(state.notes,1);
  });
  await run('Two pending plans holding one vehicle are never both approved, even concurrently',async()=>{
    const first=await fixture({vehicles:[[v,1]]}),second=await fixture({vehicles:[[v,1]]});
    const responses=await Promise.all([request(first,{decision:'APPROVED'}),request(second,{decision:'APPROVED'},'9')]);
    assert.ok(responses.every(r=>r.status===409),JSON.stringify(responses.map(r=>r.status)));
    assert.equal((await Promise.all([snapshot(first),snapshot(second)])).filter(s=>s.row.plan_status==='APPROVED').length,0);
  });
  await run('Two-vehicle plans listed in opposite order lock resources consistently without deadlock',async()=>{
    const first=await fixture({horses:2,vehicles:[[v,1],[w,1]]}),second=await fixture({horses:2,vehicles:[[w,1],[v,1]]});
    const responses=await Promise.all([request(first,{decision:'APPROVED'}),request(second,{decision:'APPROVED'},'9')]);
    assert.deepEqual(responses.map(r=>r.status),[409,409],'both plans share both vehicles; neither may win, and no request deadlocks or fails with 500');
    await db.query("UPDATE orders SET status='CANCELLED' WHERE id=?",[second]);
    assert.equal((await review(first)).planStatus,'APPROVED');
  });
  await run('Audit and notification failures roll back approve/return and preserve metadata',async()=>{
    for(const table of ['audit_logs','notifications'])for(const decision of ['APPROVED','RETURNED']) {
      const id=await fixture();await db.query("UPDATE trips SET return_reason='Previous reason' WHERE id=?",[id]);
      await db.query(`CREATE TRIGGER fail_review BEFORE INSERT ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='review rollback test'`);
      try{await unchanged(id,500,decision==='APPROVED'?{decision}:{decision,reason:'new reason'});}finally{await db.query('DROP TRIGGER fail_review');}
    }
  });
};
