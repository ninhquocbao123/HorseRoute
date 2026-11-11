const assert = require('node:assert/strict');
// Phân công theo mô hình đội xe: PUT /trips/:id/assignments nhận { vehicles: [{ vehicleId, horseCount, crew: [...] }] }.
// Chỉ kế hoạch DRAFT của đơn APPROVED/PREPARING được phân công. Một xe, một người chỉ thuộc một chuyến đang hoạt động.
module.exports = async function crewChecks({ db, base, tokens, check }) {
  await db.query("INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES (3003,'crew-locked@test.local','!','Crew-Locked','DRIVER_ESCORT','LOCKED')");
  await db.query('ALTER TABLE trip_assignments AUTO_INCREMENT=9007199254740993');
  let next=4000;
  // Mỗi chuyến thử có một ngựa, một xe riêng và bốn người riêng: tài xế, hộ tống và hai người thay thế.
  async function fixture({orderStatus='APPROVED',planStatus='DRAFT'}={}) {
    const id=String(next++),n=Number(id);
    await db.query('INSERT INTO orders(id,order_code,customer_id,status) VALUES (?,?,1,?)',[id,'CREW-'+id,orderStatus]);
    await db.query('INSERT INTO trips(id,order_id,planned_by,plan_status) VALUES (?,?,3,?)',[id,id,planStatus]);
    await db.query("INSERT INTO horses(order_id,owner_id,name,passport_no) VALUES (?,1,'Crew horse',?)",[id,'CREW-'+id]);
    const vehicle=String(9000+n);
    await db.query("INSERT INTO vehicles(id,vehicle_type,capacity_stalls,license_plate,status) VALUES (?,'MEDIUM',4,?,'AVAILABLE')",[vehicle,'CREW-'+id]);
    const [driver,escort,driver2,escort2]=[0,1,2,3].map(k=>String(30000+n*4+k));
    for(const [userId,type,label] of [[driver,'DRIVER','Driver'],[escort,'ESCORT','Escort'],[driver2,'DRIVER','Driver 2'],[escort2,'ESCORT','Escort 2']]) {
      await db.query("INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES (?,?,'!',?,'DRIVER_ESCORT','ACTIVE')",[userId,`${userId}@crew.test`,`${label} ${id}`]);
      await db.query("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (?,?,'AVAILABLE')",[userId,type]);
    }
    return {id,vehicle,driver,escort,driver2,escort2};
  }
  const fleet=(f,crew=[{userId:f.driver,role:'DRIVER'},{userId:f.escort,role:'ESCORT'}],horseCount=1)=>({vehicles:[{vehicleId:f.vehicle,horseCount,crew}]});
  const request=(id,{method='GET',suffix='assignments',user='3',body:payload}={})=>fetch(`${base}/${id}/${suffix}`,{method,
    headers:{...(user?{Authorization:'Bearer '+tokens.sign({sub:user,email:'crew@test.local',role:'ADMIN'})}:{}),...(payload!==undefined?{'Content-Type':'application/json'}:{})},...(payload!==undefined?{body:JSON.stringify(payload)}:{})});
  const put=(id,payload,user='3')=>request(id,{method:'PUT',body:payload,user});
  async function json(response,status=200){const r=await response,data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
  async function counts(id) {
    const [audit]=await db.query("SELECT COUNT(*) n FROM audit_logs WHERE entity_type='TRIP' AND entity_id=?",[id]);
    const [notes]=await db.query("SELECT COUNT(*) n FROM notifications WHERE related_type='TRIP' AND related_id=?",[id]);
    return [Number(audit.n),Number(notes.n)];
  }
  const status=async(table,id)=>(await db.query(table==='vehicle'?'SELECT status s FROM vehicles WHERE id=?':'SELECT work_status s FROM crew_profiles WHERE user_id=?',[id]))[0].s;
  await check('Assignment options list eligible crew with profile and status, scoped before lookup',async()=>{
    const f=await fixture();
    for(const user of ['3','2']) {
      const data=await json(request(f.id,{suffix:'assignment-options',user}));
      const mine=data.items.filter(i=>[f.driver,f.escort,f.driver2,f.escort2].includes(i.id));
      assert.deepEqual(mine.map(i=>i.id).sort(),[f.driver,f.driver2,f.escort,f.escort2].sort());
      assert.ok(mine.every(i=>i.selectable===true&&i.workStatus==='AVAILABLE'));
      assert.ok(!data.items.some(i=>['1','2','3003'].includes(i.id)),'customers, managers and locked accounts are not offered');
      assert.ok(data.items.every(i=>JSON.stringify(Object.keys(i).sort())===JSON.stringify(['crewType','fullName','id','selectable','workStatus'])));
    }
    for(const suffix of ['assignment-options','assignments']) {
      assert.equal((await request(f.id,{suffix,user:'4'})).status,404);
      assert.equal((await request(f.id,{suffix,user:null})).status,401);
      for(const user of ['1','5','6','7'])assert.equal((await request(f.id,{suffix,user})).status,403);
    }
    assert.equal((await put(f.id,fleet(f),null)).status,401);
    for(const user of ['1','2','5','6','7'])assert.equal((await put(f.id,fleet(f),user)).status,403);
    assert.equal((await put(f.id,fleet(f),'4')).status,404);
    assert.equal((await put('999999',fleet(f))).status,404);
    assert.equal((await request('invalid')).status,400);
  });
  await check('Empty crew reports missing roles; a valid save reserves vehicle and crew and returns exact IDs and UTC metadata',async()=>{
    const f=await fixture();const empty=await json(request(f.id));assert.deepEqual(empty.items,[]);
    assert.deepEqual(empty.crewReadiness.blockers.map(b=>b.code),['MISSING_DRIVER','MISSING_ESCORT','INELIGIBLE_CREW'],'no vehicle yet is also a blocker');
    const saved=await json(put(f.id,fleet(f)));assert.equal(saved.tripId,f.id);assert.equal(saved.crewReadiness.complete,true);
    assert.deepEqual(saved.items.map(a=>a.userId).sort(),[f.driver,f.escort].sort());
    assert.deepEqual(saved.vehicles.map(v=>[v.vehicleId,v.horseCount,v.crew.length]),[[f.vehicle,1,2]]);
    assert.ok(saved.items.every(a=>BigInt(a.id)>BigInt(Number.MAX_SAFE_INTEGER)&&a.assignedBy==='3'&&a.assignedAt.endsWith('Z')));
    assert.deepEqual(await json(request(f.id,{user:'2'})),saved);
    const [audit]=await db.query("SELECT CAST(actor_id AS CHAR) actor,action,old_value,new_value FROM audit_logs WHERE entity_id=? AND entity_type='TRIP'",[f.id]);
    assert.equal(audit.actor,'3');assert.equal(audit.action,'ASSIGN_CREW');assert.deepEqual(JSON.parse(audit.old_value),[]);assert.equal(JSON.parse(audit.new_value)[0].vehicleId,f.vehicle);
    assert.deepEqual(await counts(f.id),[1,2]);
    assert.equal(await status('vehicle',f.vehicle),'RESERVED');assert.equal(await status('crew',f.driver),'RESERVED');
  });
  await check('Saving crew never advances the Order; only a DRAFT plan can be changed',async()=>{
    const f=await fixture({orderStatus:'PREPARING'});await json(put(f.id,fleet(f)));
    assert.equal((await db.query('SELECT status FROM orders WHERE id=?',[f.id]))[0].status,'PREPARING','handover to the crew happens through start-transport');
    for(const planStatus of ['PENDING_APPROVAL','APPROVED']) {const g=await fixture({planStatus});assert.equal((await put(g.id,fleet(g))).status,409);}
  });
  await check('Assignment input rejects invalid rosters, wrong roles, unknown users and forged metadata without writes',async()=>{
    const f=await fixture();await json(put(f.id,fleet(f)));const before=await json(request(f.id)),count=await counts(f.id);
    const d={userId:f.driver,role:'DRIVER'},e={userId:f.escort,role:'ESCORT'};
    for(const payload of [
      {vehicles:[]},fleet(f,[d]),fleet(f,[d,{userId:f.driver,role:'ESCORT'}]),fleet(f,[{userId:f.driver,role:'ESCORT'},{userId:f.escort,role:'DRIVER'}]),
      {...fleet(f),assignedBy:'2'},fleet(f,[{...d,assignedAt:'2030-01-01T00:00:00Z'},e]),fleet(f,[d,e],2),
      {assignments:[d,e]},
      ...['1','3003','999999'].map(userId=>fleet(f,[{userId,role:'DRIVER'},e])),
    ]) {const res=await put(f.id,payload);assert.equal(res.status,400,JSON.stringify(payload));}
    assert.deepEqual(await json(request(f.id)),before);assert.deepEqual(await counts(f.id),count);
  });
  await check('Saving the same roster again writes nothing; replacing a person releases them and notifies both sides',async()=>{
    const f=await fixture(),first=await json(put(f.id,fleet(f)));
    const repeat=await json(put(f.id,fleet(f,[{userId:f.escort,role:'ESCORT'},{userId:f.driver,role:'DRIVER'}])));
    assert.deepEqual(repeat,first);assert.deepEqual(await counts(f.id),[1,2],'no audit and no repeated notification');
    const second=await json(put(f.id,fleet(f,[{userId:f.driver2,role:'DRIVER'},{userId:f.escort,role:'ESCORT'}])));
    assert.deepEqual(second.items.map(a=>a.userId).sort(),[f.driver2,f.escort].sort());
    assert.deepEqual(await counts(f.id),[2,5],'one more audit; the removed driver and both current members are notified');
    assert.equal(await status('crew',f.driver),'AVAILABLE');assert.equal(await status('crew',f.driver2),'RESERVED');
    const [trip]=await db.query('SELECT plan_status FROM trips WHERE id=?',[f.id]);const [order]=await db.query('SELECT status FROM orders WHERE id=?',[f.id]);
    assert.equal(trip.plan_status,'DRAFT');assert.equal(order.status,'APPROVED');
  });
  await check('A vehicle or person already working on another active trip cannot be assigned',async()=>{
    const f=await fixture(),g=await fixture();await json(put(f.id,fleet(f)));
    assert.equal((await put(g.id,{vehicles:[{vehicleId:f.vehicle,horseCount:1,crew:[{userId:g.driver,role:'DRIVER'},{userId:g.escort,role:'ESCORT'}]}]})).status,409);
    assert.equal((await put(g.id,fleet(g,[{userId:f.driver,role:'DRIVER'},{userId:g.escort,role:'ESCORT'}]))).status,400);
    assert.deepEqual((await json(request(g.id))).items,[]);
  });
  await check('Crew cannot change once the Order leaves APPROVED/PREPARING',async()=>{
    for(const orderStatus of ['DRAFT','PENDING','NEED_INFO','REJECTED','READY','IN_TRANSIT','DELIVERED','CANCELLED']) {
      const f=await fixture();await json(put(f.id,fleet(f)));const count=await counts(f.id);
      // Mức sẵn sàng được tính lại theo trạng thái đơn, nên chỉ so dữ liệu phân công đã lưu.
      const roster=async()=>{const {items,vehicles}=await json(request(f.id));return {items,vehicles};};const before=await roster();
      await db.query('UPDATE orders SET status=? WHERE id=?',[orderStatus,f.id]);
      assert.equal((await put(f.id,fleet(f,[{userId:f.driver2,role:'DRIVER'},{userId:f.escort,role:'ESCORT'}]))).status,409);
      assert.deepEqual(await roster(),before);assert.deepEqual(await counts(f.id),count);
    }
  });
  await check('Operational state and histories block replacement without touching legs/history',async()=>{
    const f=await fixture();await json(put(f.id,fleet(f)));const changed=fleet(f,[{userId:f.driver2,role:'DRIVER'},{userId:f.escort,role:'ESCORT'}]);
    await db.query("INSERT INTO legs(trip_id,seq_no,from_location_id,to_location_id,planned_departure_at,planned_arrival_at,status) VALUES (?,1,9007199254740993,9007199254740994,'2030-01-01 01:00:00','2030-01-01 02:00:00','MOVING')",[f.id]);
    const before=await json(request(f.id));assert.equal((await put(f.id,changed)).status,409);
    await db.query("UPDATE legs SET status='NOT_STARTED' WHERE trip_id=?",[f.id]);
    await db.query("INSERT INTO incidents(trip_id,incident_type,description,reported_by,reported_at) VALUES (?,'VEHICLE_BREAKDOWN','Crew test',3,UTC_TIMESTAMP())",[f.id]);
    assert.equal((await put(f.id,changed)).status,409);assert.deepEqual(await json(request(f.id)),before);
    assert.equal(Number((await db.query('SELECT COUNT(*) n FROM legs WHERE trip_id=?',[f.id]))[0].n),1);
    assert.equal(Number((await db.query('SELECT COUNT(*) n FROM incidents WHERE trip_id=?',[f.id]))[0].n),1);
  });
  await check('Locked existing crew remains visible with blockers and can be replaced by an eligible person',async()=>{
    const f=await fixture();await json(put(f.id,fleet(f)));await db.query("UPDATE users SET account_status='LOCKED' WHERE id=?",[f.escort]);
    const data=await json(request(f.id));assert.equal(data.items.length,2);assert.equal(data.crewReadiness.complete,false);
    assert.deepEqual(data.crewReadiness.blockers.map(b=>b.code),['INELIGIBLE_CREW','MISSING_ESCORT']);
    assert.equal((await put(f.id,fleet(f,[{userId:f.driver,role:'DRIVER'},{userId:f.escort,role:'ESCORT'}]))).status,200,'an unchanged roster is a no-op even with a locked member');
    assert.equal((await put(f.id,fleet(f,[{userId:f.driver2,role:'DRIVER'},{userId:f.escort,role:'ESCORT'}]))).status,400,'a changed roster is fully rechecked');
    const fixed=await json(put(f.id,fleet(f,[{userId:f.driver,role:'DRIVER'},{userId:f.escort2,role:'ESCORT'}])));assert.equal(fixed.crewReadiness.complete,true);
  });
  await check('Concurrent identical roster saves create one set of records, audit and notifications',async()=>{
    const f=await fixture();const res=await Promise.all([put(f.id,fleet(f)),put(f.id,fleet(f))]);assert.deepEqual(res.map(r=>r.status),[200,200]);
    const results=await Promise.all(res.map(r=>r.json()));assert.deepEqual(results[0],results[1]);assert.deepEqual(await counts(f.id),[1,2]);
  });
  await check('Audit and notification failures roll back additions, removals and role changes',async()=>{
    for(const table of ['audit_logs','notifications']) {
      const f=await fixture();await json(put(f.id,fleet(f)));const before=await json(request(f.id)),count=await counts(f.id);
      await db.query(`CREATE TRIGGER fail_crew BEFORE INSERT ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='crew rollback test'`);
      try{assert.equal((await put(f.id,fleet(f,[{userId:f.driver2,role:'DRIVER'},{userId:f.escort,role:'ESCORT'}]))).status,500);}finally{await db.query('DROP TRIGGER fail_crew');}
      assert.deepEqual(await json(request(f.id)),before);assert.deepEqual(await counts(f.id),count);
      assert.equal(await status('crew',f.driver),'RESERVED');assert.equal(await status('crew',f.driver2),'AVAILABLE');
    }
  });
};
