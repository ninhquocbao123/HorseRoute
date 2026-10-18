const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { randomUUID } = require('node:crypto');
module.exports = async function readinessChecks({ db, base, tokens, check }) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'horseroute-readiness-'));
  const oldDirectory = process.env.DOCUMENT_STORAGE_DIR;
  process.env.DOCUMENT_STORAGE_DIR = directory;
  let next = 6000;
  const request = (id,{post=false,user='2',body={}}={}) => fetch(post ? base.replace(/trips$/,`orders/${id}/mark-ready`) : `${base}/${id}/readiness`, {
    method:post?'POST':'GET', headers:{...(user?{Authorization:'Bearer '+tokens.sign({sub:user,email:'test@test.local',role:'ADMIN'})}:{}),...(post?{'Content-Type':'application/json'}:{})},...(post?{body:JSON.stringify(body)}:{}) });
  const json = async (res,status=200) => {res=await res;const body=await res.json();assert.equal(res.status,status,JSON.stringify(body));return body;};
  async function fixture(){
    const id=String(next++), key=randomUUID();
    await fs.writeFile(path.join(directory,key),'%PDF-test');
    const snapshot={version:1,ruleIds:['1'],horses:[{horseId:id,documents:[{documentTypeId:'6000',hasExpiry:true}],authorityIds:['6000']}]};
    await db.query("INSERT INTO orders(id,order_code,customer_id,status,requirements_snapshot) VALUES (?,?,1,'PREPARING',?)",[id,'READY-'+id,JSON.stringify(snapshot)]);
    await db.query("INSERT INTO trips(id,order_id,planned_by,plan_status,approved_by,approved_at,planned_departure_at,planned_arrival_at) VALUES (?,?,3,'APPROVED',2,UTC_TIMESTAMP(),'2090-01-01 01:00:00','2090-01-01 03:00:00')",[id,id]);
    await db.query("INSERT INTO horses(id,order_id,owner_id,name,passport_no) VALUES (?,?,1,'Ready horse',?)",[id,id,'READY-H-'+id]);
    await db.query("INSERT INTO vehicles(id,vehicle_type,capacity_stalls,plate_or_code) VALUES (?,'TRUCK',2,?)",[id,'READY-V-'+id]);
    await db.query("INSERT INTO legs(id,trip_id,seq_no,from_location_id,to_location_id,vehicle_id,planned_departure_at,planned_arrival_at) VALUES (?,?,1,9007199254740993,9007199254740994,?,'2090-01-01 01:00:00','2090-01-01 03:00:00')",[id,id,id]);
    await db.query("INSERT INTO trip_assignments(trip_id,user_id,role,assigned_by,assigned_at) VALUES (?,3000,'DRIVER',3,UTC_TIMESTAMP()),(?,3001,'ESCORT',3,UTC_TIMESTAMP())",[id,id]);
    await db.query("INSERT INTO attachments(id,original_name,file_type,size_bytes,storage_path,uploaded_by) VALUES (?,'ready.pdf','PDF',9,?,1)",[id,key]);
    await db.query("INSERT INTO documents(id,horse_id,document_type_id,status,expiry_date,reviewed_by,reviewed_at) VALUES (?,?,6000,'VALID','2091-01-01',2,UTC_TIMESTAMP())",[id,id]);
    await db.query('INSERT INTO document_versions(document_id,version_no,attachment_id,uploaded_by,uploaded_at) VALUES (?,1,?,1,UTC_TIMESTAMP())',[id,id]);
    await db.query("INSERT INTO dossiers(id,horse_id,authority_id,status,permit_attachment_id) VALUES (?,?,6000,'APPROVED',?)",[id,id,id]);
    return {id,key,snapshot};
  }
  const codes = result => result.blockers.map(b=>b.code);
  async function blocked(id,code){
    const data=await json(request(id));assert.equal(data.eligibleForReady,false);assert.ok(codes(data).includes(code),JSON.stringify(data));
    const conflict=await json(request(id,{post:true}),409);assert.ok(codes(conflict).includes(code));assert.ok(conflict.requestId);
    assert.equal((await db.query('SELECT status FROM orders WHERE id=?',[id]))[0].status,'PREPARING');
    assert.equal(Number((await db.query("SELECT COUNT(*) n FROM audit_logs WHERE entity_type='ORDER' AND entity_id=? AND action='MARK_READY'",[id]))[0].n),0);
  }
  try {
    await db.query("INSERT INTO authorities(id,name,authority_type,country) VALUES (6000,'Readiness authority','QUARANTINE','VN')");
    await db.query("INSERT INTO document_types(id,name,has_expiry) VALUES (6000,'Readiness health',1)");
    await db.query("UPDATE users SET account_status='ACTIVE',role='DRIVER_ESCORT' WHERE id IN (3000,3001)");
    await check('Readiness authorization, ownership, strict input and ID validation',async()=>{
      const {id}=await fixture();
      for(const post of [false,true]){
        await json(request(id,{post,user:null}),401);
        for(const user of ['1','5','6','7'])await json(request(id,{post,user}),403);
        await json(request('invalid',{post}),400);
        await json(request('999999',{post}),404);
      }
      await json(request(id,{user:'3'}));await json(request(id,{user:'4'}),404);
      await json(request(id,{post:true,user:'3'}),403);
      await json(request(id,{post:true,body:{status:'READY'}}),400);
    });
    await check('GET is read-only, recognizes real files and exact string IDs; old snapshots block',async()=>{
      const {id}=await fixture();
      const dump=async()=>JSON.stringify(await db.query(`SELECT (SELECT COUNT(*) FROM audit_logs) audits,(SELECT COUNT(*) FROM notifications) notes,status,requirements_snapshot FROM orders WHERE id=?`,[id]));
      const before=await dump();const result=await json(request(id));assert.equal(result.eligibleForReady,true,JSON.stringify(result));assert.deepEqual(result.blockers,[]);assert.equal(result.tripId,id);assert.equal(before,await dump());
      await db.query('UPDATE orders SET requirements_snapshot=NULL WHERE id=?',[id]);await blocked(id,'REQUIREMENTS_UNVERIFIED');
    });
    await check('Each required document, dossier, crew and vehicle independently blocks READY',async()=>{
      for(const [sql,code] of [
        ["UPDATE documents SET status='INVALID' WHERE id=?",'DOCUMENT_NOT_VALID'],
        ["UPDATE dossiers SET status='REVIEWING' WHERE id=?",'DOSSIER_NOT_APPROVED'],
        ["DELETE FROM trip_assignments WHERE trip_id=? AND role='ESCORT'",'MISSING_ESCORT'],
        ["UPDATE vehicles SET is_active=0 WHERE id=?",'VEHICLE_INACTIVE'],
        ["UPDATE vehicles SET capacity_stalls=1 WHERE id=?",'VEHICLE_CAPACITY'],
        ["UPDATE horses SET order_status='FLAGGED' WHERE id=?",'HORSE_FLAGGED'],
        ["UPDATE horses SET order_status='REMOVED' WHERE id=?",'NO_TRANSPORT_HORSES'],
        ["UPDATE trips SET approved_by=NULL WHERE id=?",'PLAN_NOT_APPROVED'],
        ["UPDATE legs SET actual_departure_at=UTC_TIMESTAMP() WHERE id=?",'OPERATION_STARTED'],
        ["UPDATE trips SET planned_arrival_at='2090-01-01 04:00:00' WHERE id=?",'PLAN_TIME_MISMATCH'],
        ["UPDATE legs SET planned_arrival_at=planned_departure_at WHERE id=?",'INVALID_LEG'],
      ]){const {id}=await fixture();await db.query(sql,[id]);if(code==='VEHICLE_CAPACITY')await db.query("INSERT INTO horses(id,order_id,owner_id,name,passport_no) VALUES (?,?,1,'Extra',?)",[String(Number(id)+100000),id,'EXTRA-'+id]);await blocked(id,code);}
      const {id}=await fixture();await db.query('DELETE FROM legs WHERE trip_id=?',[id]);await blocked(id,'NO_LEGS');
    });
    await check('Readiness enforces Order/Trip state matrix and approval metadata',async()=>{
      for(const status of ['DRAFT','PENDING','NEED_INFO','REJECTED','READY','IN_TRANSIT','DELIVERED','CANCELLED']) {
        const {id}=await fixture();await db.query('UPDATE orders SET status=? WHERE id=?',[status,id]);
        const result=await json(request(id));assert.ok(codes(result).includes('ORDER_NOT_PREPARING'));
        await json(request(id,{post:true}),409);
        assert.equal((await db.query('SELECT status FROM orders WHERE id=?',[id]))[0].status,status);
      }
      for(const status of ['DRAFT','PENDING_APPROVAL']) {
        const {id}=await fixture();await db.query('UPDATE trips SET plan_status=? WHERE id=?',[status,id]);await blocked(id,'PLAN_NOT_APPROVED');
      }
      const {id}=await fixture();await db.query("UPDATE orders SET status='APPROVED' WHERE id=?",[id]);
      assert.equal((await json(request(id))).eligibleForReady,true);
      await json(request(id,{post:true}));
    });
    await check('VALID expiry checked directly against today and arrival, including missing expiry',async()=>{
      for(const [value,code] of [['2000-01-01','DOCUMENT_EXPIRED'],['2089-12-31','DOCUMENT_EXPIRED'],[null,'DOCUMENT_EXPIRY_MISSING']]){
        const {id}=await fixture();await db.query('UPDATE documents SET expiry_date=? WHERE id=?',[value,id]);await blocked(id,code);
        assert.equal((await db.query('SELECT status FROM documents WHERE id=?',[id]))[0].status,'VALID');
      }
    });
    await check('Missing, invalid, wrong-size and unavailable real files fail closed; latest version required',async()=>{
      for(const change of ['missing','legacy','size','provider']){
        const {id,key}=await fixture();
        if(change==='missing')await fs.unlink(path.join(directory,key));
        if(change==='legacy')await db.query("UPDATE attachments SET storage_path='seed/missing.pdf' WHERE id=?",[id]);
        if(change==='size')await db.query('UPDATE attachments SET size_bytes=99 WHERE id=?',[id]);
        if(change==='provider')await db.query('UPDATE attachments SET storage_path=? WHERE id=?',[`supabase:unavailable/${key}`,id]);
        await blocked(id,'PERMIT_FILE_UNVERIFIED');
      }
      const {id}=await fixture();await db.query('DELETE FROM document_versions WHERE document_id=?',[id]);await blocked(id,'DOCUMENT_FILE_UNVERIFIED');
      const stale=await fixture();await db.query("UPDATE documents SET reviewed_at='2000-01-01 00:00:00' WHERE id=?",[stale.id]);await blocked(stale.id,'DOCUMENT_NOT_VALID');
      const second=await fixture();await db.query('UPDATE dossiers SET permit_attachment_id=NULL WHERE id=?',[second.id]);await blocked(second.id,'PERMIT_FILE_UNVERIFIED');
    });
    await check('Deleting every checklist and dossier does not pass an empty array',async()=>{
      const {id}=await fixture();await db.query('DELETE FROM document_versions WHERE document_id=?',[id]);await db.query('DELETE FROM documents WHERE horse_id=?',[id]);await db.query('DELETE FROM dossiers WHERE horse_id=?',[id]);
      await blocked(id,'DOCUMENT_MISSING');assert.ok(codes(await json(request(id))).includes('DOSSIER_MISSING'));
    });
    await check('Stale GET cannot authorize POST after crew, vehicle or documents change',async()=>{
      for(const [sql,code] of [["UPDATE users SET account_status='LOCKED' WHERE id=3001",'INELIGIBLE_CREW'],["UPDATE vehicles SET is_active=0 WHERE id=?",'VEHICLE_INACTIVE'],["UPDATE documents SET status='EXPIRED' WHERE id=?",'DOCUMENT_NOT_VALID']]){
        const {id}=await fixture();assert.equal((await json(request(id))).eligibleForReady,true);await db.query(sql,sql.includes('?')?[id]:[]);await blocked(id,code);
        await db.query("UPDATE users SET account_status='ACTIVE' WHERE id=3001");
      }
    });
    await check('Existing approved vehicle overlap blocks readiness',async()=>{
      const a=await fixture(),b=await fixture();await db.query('UPDATE legs SET vehicle_id=? WHERE id=?',[a.id,b.id]);await blocked(a.id,'VEHICLE_CONFLICT');
    });
    await check('Two concurrent mark-ready requests commit exactly one transition, audit and notification set',async()=>{
      const {id}=await fixture();const results=await Promise.all([request(id,{post:true}),request(id,{post:true})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
      const success=await results.find(r=>r.status===200).json();assert.deepEqual(success,{orderId:id,tripId:id,orderStatus:'READY',planStatus:'APPROVED'});
      assert.equal((await db.query('SELECT status FROM orders WHERE id=?',[id]))[0].status,'READY');
      assert.equal(Number((await db.query("SELECT COUNT(*) n FROM audit_logs WHERE entity_type='ORDER' AND entity_id=? AND action='MARK_READY' AND actor_id=2",[id]))[0].n),1);
      assert.equal(Number((await db.query("SELECT COUNT(*) n FROM notifications WHERE related_type='ORDER' AND related_id=? AND event_type='ORDER_READY'",[id]))[0].n),4);
      await json(request(id,{post:true}),409);
    });
    await check('Audit and notification failures rollback READY and all related writes',async()=>{
      for(const table of ['audit_logs','notifications']){
        const {id}=await fixture();const condition=table==='audit_logs'?"NEW.action='MARK_READY'":"NEW.event_type='ORDER_READY'";
        await db.query(`CREATE TRIGGER fail_ready BEFORE INSERT ON ${table} FOR EACH ROW BEGIN IF ${condition} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test rollback'; END IF; END`);
        try{await json(request(id,{post:true}),500);}finally{await db.query('DROP TRIGGER fail_ready');}
        assert.equal((await db.query('SELECT status FROM orders WHERE id=?',[id]))[0].status,'PREPARING');
        assert.equal(Number((await db.query("SELECT COUNT(*) n FROM audit_logs WHERE entity_type='ORDER' AND entity_id=? AND action='MARK_READY'",[id]))[0].n),0);
        assert.equal(Number((await db.query("SELECT COUNT(*) n FROM notifications WHERE related_type='ORDER' AND related_id=?",[id]))[0].n),0);
      }
    });
    await check('After READY, GET still reports invalid conditions without mutating Order or expiring documents',async()=>{
      const {id}=await fixture();await json(request(id,{post:true}));
      await db.query("UPDATE documents SET expiry_date='2000-01-01' WHERE id=?",[id]);
      const before=(await db.query('SELECT COUNT(*) n FROM audit_logs'))[0].n;
      const result=await json(request(id));assert.ok(codes(result).includes('DOCUMENT_EXPIRED'));
      assert.ok(codes(result).includes('ORDER_NOT_PREPARING'));
      assert.equal((await db.query('SELECT status FROM orders WHERE id=?',[id]))[0].status,'READY');
      assert.equal((await db.query('SELECT status FROM documents WHERE id=?',[id]))[0].status,'VALID');
      assert.equal((await db.query('SELECT COUNT(*) n FROM audit_logs'))[0].n,before);
    });
    await check('File evidence cannot be reused after metadata changes between preflight and locked recheck',async()=>{
      const {ReadinessService}=require('../src/features/readiness/readiness.service');
      const {id}=await fixture();let called=false;
      const service=new ReadinessService(db,async()=>{
        if(!called){called=true;await db.query('UPDATE attachments SET storage_path=? WHERE id=?',[randomUUID(),id]);}return true;
      });
      await assert.rejects(service.markReady({id:'2',role:'MANAGER'},id,{}),e=>e.getStatus()===409 && e.getResponse().blockers.some(b=>b.code==='PERMIT_FILE_UNVERIFIED'));
    });
  } finally {
    if(oldDirectory===undefined)delete process.env.DOCUMENT_STORAGE_DIR;else process.env.DOCUMENT_STORAGE_DIR=oldDirectory;
    await fs.rm(directory,{recursive:true,force:true});
  }
};
