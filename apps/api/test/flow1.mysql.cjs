// Creates and drops ONLY a randomly named wdp_flow1_test_* database.
// Never runs migrations or mutations against DB_NAME from .env.
require('reflect-metadata');
require('ts-node').register({project:require('path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
const mysql=require('mysql2/promise');const {DataSource}=require('typeorm');
const {OrdersService}=require('../src/features/orders/orders.service');
const {OrderDrafts1800000001000}=require('../src/database/migrations/1800000001000-OrderDrafts');
const name='wdp_flow1_test_'+require('crypto').randomBytes(8).toString('hex');
const options=require('./mysql-options.cjs');
let admin,db,created=false;let passed=0;
async function check(label,fn){await fn();passed++;console.log('PASS '+label);}
async function main(){
 admin=await mysql.createConnection(options);
 assert.match(name,/^wdp_flow1_test_[0-9a-f]{16}$/);
 await admin.query('CREATE DATABASE `'+name+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');created=true;
 db=new DataSource({type:'mysql',host:options.host,port:options.port,username:options.user,password:options.password,ssl:options.ssl,database:name,timezone:'Z',supportBigNumbers:true,bigNumberStrings:true,extra:{multipleStatements:true}});await db.initialize();
 await require('./load-schema.cjs')(db);
 const runner=db.createQueryRunner();await runner.connect();
 try{await new OrderDrafts1800000001000().up(runner);await new OrderDrafts1800000001000().up(runner);}finally{await runner.release();}
 await db.query("INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES (1,'one@example.com','!','Khách 1','CUSTOMER','ACTIVE'),(2,'two@example.com','!','Khách 2','CUSTOMER','ACTIVE'),(3,'manager@example.com','!','Quản lý','MANAGER','ACTIVE'),(4,'coordinator@example.com','!','Điều phối','COORDINATOR','ACTIVE')");
 await db.query("INSERT INTO authorities(id,name,authority_type,country) VALUES (1,'Test authority','QUARANTINE','SG')");
 await db.query("INSERT INTO document_types(id,name,has_expiry) VALUES (1,'Passport',0),(2,'Health',1)");
 await db.query("INSERT INTO quarantine_rules(id,origin_country,destination_country,authority_id,updated_by,updated_at) VALUES (1,'VN','SG',1,3,UTC_TIMESTAMP()),(2,'VN','SG',1,3,UTC_TIMESTAMP()),(3,'VN','TH',1,3,UTC_TIMESTAMP())");
 await db.query('INSERT INTO quarantine_rule_doctypes(rule_id,document_type_id) VALUES (1,1),(1,2)');
 const service=new OrdersService(db);const customer={id:'1',role:'CUSTOMER'},other={id:'2',role:'CUSTOMER'},manager={id:'3',role:'MANAGER'};
 const requestId=require('crypto').randomUUID();let id;
 await check('save empty draft and idempotent retry',async()=>{id=(await service.save(customer,{requestId,horses:[]})).id;assert.equal((await service.save(customer,{requestId,horses:[]})).id,id);const [n]=await db.query('SELECT COUNT(*) n FROM orders');assert.equal(Number(n.n),1);});
 await check('submit incomplete draft returns keyed field errors without changing status',async()=>{await assert.rejects(()=>service.submit(customer,id),e=>Boolean(e.getStatus()===400&&e.getResponse().fields.originAddress&&e.getResponse().fields.horses));assert.equal((await service.detail(customer,id)).status,'DRAFT');});
 await check('customer ownership enforced for read edit submit',async()=>{for(const fn of [()=>service.detail(other,id),()=>service.save(other,{horses:[]},id),()=>service.submit(other,id)])await assert.rejects(fn,e=>e.getStatus()===404);});
 await check('draft is absent from Manager and other Customer lists and cannot be opened by Manager',async()=>{
  for(const user of [manager,other])assert.equal((await service.list(user,{page:1,limit:10})).total,0);
  assert.equal((await service.list(customer,{page:1,limit:10})).total,1);
  assert.equal((await service.list(manager,{page:1,limit:10,status:'DRAFT'})).total,0);
  await assert.rejects(()=>service.detail(manager,id),e=>e.getStatus()===404);
  await assert.rejects(()=>service.reviewOptions(manager,id),e=>e.getStatus()===404);
 });
 const future=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 let payload={originAddress:'Trại ngựa',originCountry:'VN',destinationAddress:'Singapore',destinationCountry:'SG',desiredDepartureDate:future,specialRequirements:'Chăm sóc riêng',horses:[{name:'Ngựa Một',passportNo:'TEST-ONE',breed:'Arabian',birthDate:'2020-01-01'}]};
 await service.save(customer,payload,id);
 await check('concurrent submit commits once and notifies once',async()=>{const results=await Promise.allSettled([service.submit(customer,id),service.submit(customer,id)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const [n]=await db.query("SELECT COUNT(*) n FROM notifications WHERE event_type='ORDER_SUBMITTED'");assert.equal(Number(n.n),1);});
 const horseId=(await service.detail(customer,id)).horses[0].id;
 await check('Manager requires reason for NEED_INFO',async()=>{await assert.rejects(()=>service.review(manager,id,{decision:'NEED_INFO',reason:' '}),e=>e.getStatus()===400);});
 await service.review(manager,id,{decision:'NEED_INFO',reason:'Bổ sung giống ngựa'});
 payload.horses[0].id=String(horseId);payload.horses[0].breed='Thoroughbred';
 await service.save(customer,payload,id);await service.submit(customer,id);
 await check('resubmission retains horse ID and review history',async()=>{const result=await service.detail(customer,id);assert.equal(String(result.horses[0].id),String(horseId));assert.ok(result.history.some(h=>h.action==='REVIEW'));assert.equal(result.horses[0].breed,'Thoroughbred');});
 await check('invalid coordinator and foreign route rules are rejected',async()=>{await assert.rejects(()=>service.review(manager,id,{decision:'APPROVED',coordinatorId:'2',ruleIds:['1','2']}),e=>e.getStatus()===400);await assert.rejects(()=>service.review(manager,id,{decision:'APPROVED',coordinatorId:'4',ruleIds:['3']}),e=>e.getStatus()===400);});
 await check('approval failure rolls back previously created checklist and dossiers',async()=>{await assert.rejects(()=>service.review(manager,id,{decision:'APPROVED',coordinatorId:'4',ruleIds:['1','2']}),e=>e.getStatus()===409);for(const table of ['documents','dossiers','trips']){const [n]=await db.query('SELECT COUNT(*) n FROM '+table);assert.equal(Number(n.n),0);}assert.equal((await service.detail(customer,id)).status,'PENDING');});
 await db.query('INSERT INTO quarantine_rule_doctypes(rule_id,document_type_id) VALUES (2,1)');
 await check('approval creates distinct checklist, dossiers and one draft trip',async()=>{await service.review(manager,id,{decision:'APPROVED',coordinatorId:'4',ruleIds:['1','2']});for(const [table,count]of [['documents',2],['dossiers',1],['trips',1]]){const [n]=await db.query('SELECT COUNT(*) n FROM '+table);assert.equal(Number(n.n),count);}assert.equal((await service.detail(customer,id)).status,'APPROVED');});
 await check('approved order cannot be edited or reviewed again',async()=>{await assert.rejects(()=>service.save(customer,payload,id),e=>e.getStatus()===409);await assert.rejects(()=>service.review(manager,id,{decision:'APPROVED',coordinatorId:'4',ruleIds:['1','2']}),e=>e.getStatus()===409);});
 const otherId=(await service.save(other,{...payload,horses:[{name:'Ngựa Hai',passportNo:'TEST-TWO'}]})).id;await service.submit(other,otherId);
 await check('rejection records reason and creates no trip',async()=>{await service.review(manager,otherId,{decision:'REJECTED',reason:'Không phục vụ tuyến này'});const detail=await service.detail(other,otherId);assert.equal(detail.status,'REJECTED');assert.equal(detail.manager_note,'Không phục vụ tuyến này');const [n]=await db.query('SELECT COUNT(*) n FROM trips WHERE order_id=?',[otherId]);assert.equal(Number(n.n),0);});
 await check('list is scoped and filterable',async()=>{const list=await service.list(customer,{page:1,limit:10,status:'APPROVED'});assert.equal(list.total,1);assert.equal(String(list.items[0].id),id);assert.equal((await service.list(other,{page:1,limit:10,status:'APPROVED'})).total,0);});
 const collision=(await service.save(other,payload)).id;
 await check('duplicate passport returns field error and preserves saved draft',async()=>{await assert.rejects(()=>service.submit(other,collision),e=>e.getStatus()===400);assert.equal((await service.detail(other,collision)).status,'DRAFT');});
 console.log('Integration checks passed: '+passed);
 await check('delete own draft removes row, preserves audit and rejects sent orders',async()=>{
  await assert.rejects(()=>service.deleteDraft(customer,collision),e=>e.getStatus()===404);
  await assert.rejects(()=>service.deleteDraft(manager,collision),e=>e.getStatus()===403);
  await assert.rejects(()=>service.deleteDraft(customer,id),e=>e.getStatus()===409);
  await service.deleteDraft(other,collision);
  await assert.rejects(()=>service.detail(other,collision),e=>e.getStatus()===404);
  const [audit]=await db.query("SELECT COUNT(*) n FROM audit_logs WHERE entity_type='ORDER' AND entity_id=? AND action='DELETE_DRAFT'",[collision]);assert.equal(Number(audit.n),1);
 });
 await check('Manager groups and stable newest-first pagination within status priority',async()=>{
  const list=await service.list(manager,{page:1,limit:10});
  assert.deepEqual(list.items.map(o=>String(o.id)),[String(otherId),String(id)]);
  assert.equal(String((await service.list(manager,{page:1,limit:1})).items[0].id),String(otherId));
  assert.equal(String((await service.list(manager,{page:2,limit:1})).items[0].id),String(id));
  assert.equal((await service.list(manager,{page:1,limit:10,group:'approved'})).total,1);
  assert.equal((await service.list(manager,{page:1,limit:10,group:'documents'})).total,1);
  assert.equal((await service.list(manager,{page:1,limit:10,group:'pending'})).total,0);
  await db.query("UPDATE documents SET status='SUBMITTED'");
  assert.equal((await service.list(manager,{page:1,limit:10,group:'documents'})).total,0);
 });
}
main().catch(e=>{console.error('Integration failed:',e.code||e.name,e instanceof assert.AssertionError?e.message:(typeof e.getResponse==='function'?JSON.stringify(e.getResponse()):e.sqlMessage||'Check local MySQL availability and test setup.'));process.exitCode=1;}).finally(async()=>{if(db?.isInitialized)await db.destroy();if(admin){if(created&&/^wdp_flow1_test_[0-9a-f]{16}$/.test(name))await admin.query('DROP DATABASE `'+name+'`');await admin.end();}});
