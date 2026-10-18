const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
require('ts-node').register({project:require('node:path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {authenticate,authorize}=require('../src/shared/middlewares/auth.middleware');
const {OrdersService}=require('../src/features/orders/orders.service');
const {NotificationsService}=require('../src/features/notifications/notifications.service');
const {NotificationsRepository}=require('../src/features/notifications/notifications.repository');
const {orderSchema}=require('../src/features/orders/orders.validation');

test('delete draft checks role, owner, locked status before deleting',async()=>{
 let row={id:'1',customer_id:'2',status:'DRAFT'},deleted=0;
 const m={query:async(sql)=>{if(sql.startsWith('SELECT')){assert.match(sql,/FOR UPDATE/);return [row];}if(sql.startsWith('DELETE'))deleted++;return {};}};
 const service=new OrdersService({transaction:fn=>fn(m)});
 await assert.rejects(()=>service.deleteDraft({id:'2',role:'MANAGER'},'1'),e=>e.getStatus()===403);
 await assert.rejects(()=>service.deleteDraft({id:'3',role:'CUSTOMER'},'1'),e=>e.getStatus()===404);
 for(const status of ['PENDING','NEED_INFO','APPROVED','REJECTED']){row.status=status;await assert.rejects(()=>service.deleteDraft({id:'2',role:'CUSTOMER'},'1'),e=>e.getStatus()===409);}
 assert.equal(deleted,0);row.status='DRAFT';assert.equal((await service.deleteDraft({id:'2',role:'CUSTOMER'},'1')).deleted,true);assert.equal(deleted,1);
});

test('draft detail and review options remain private to the owning customer',async()=>{
 const db={query:async()=>[{id:'1',customer_id:'2',status:'DRAFT'}]};
 const service=new OrdersService({manager:db});
 assert.equal((await service.owned(db,{id:'2',role:'CUSTOMER'},'1')).id,'1');
 for(const user of [{id:'3',role:'CUSTOMER'},{id:'2',role:'MANAGER'},{id:'4',role:'SPECIALIST'}]){
  await assert.rejects(()=>service.owned(db,user,'1'),e=>e.getStatus()===404);
  await assert.rejects(()=>service.reviewOptions(user,'1'),e=>e.getStatus()===404);
 }
});

test('list restrictions and document groups apply before pagination and counts',async()=>{
 const calls=[];const db={query:async(sql,args)=>{calls.push({sql,args});return sql.includes('COUNT(*)')?[{total:0}]:[];}};
 const service=new OrdersService(db);
 await service.list({id:'22',role:'CUSTOMER'},{page:2,limit:10});
 for(const call of calls){assert.match(call.sql,/o.customer_id=\?/);assert.equal(call.args[0],'22');}
 assert.match(calls[0].sql,/ORDER BY o.created_at ASC,o.id ASC/);
 calls.length=0;
 await service.list({id:'3',role:'MANAGER'},{page:1,limit:10,status:'DRAFT',group:'documents'});
 for(const call of calls){assert.match(call.sql,/o.status <> 'DRAFT'/);assert.match(call.sql,/EXISTS/);assert.match(call.sql,/NOT_SUBMITTED/);assert.match(call.sql,/UTC_DATE/);}
});
test('JWT ADMIN claim cannot grant Manager authority',async()=>{
 const req={headers:{authorization:'Bearer test'}};
 await authenticate({getById:async()=>({role:'CUSTOMER',accountStatus:'ACTIVE'})},{verify:()=>({sub:'1',role:'ADMIN'})})(req,{},()=>{});
 assert.throws(()=>authorize('MANAGER')(req,{},()=>{}),e=>e.getStatus()===403);
});
test('locked account is denied even with correct role',async()=>{
 await assert.rejects(()=>authenticate({getById:async()=>({role:'MANAGER',accountStatus:'LOCKED'})},{verify:()=>({sub:'1'})})({headers:{authorization:'Bearer test'}},{},()=>{}),e=>e.getStatus()===403);
});
test('valid role installs server account on request',async()=>{
 const account={id:'22',role:'CUSTOMER',accountStatus:'ACTIVE'},req={headers:{authorization:'Bearer test'}};let next=false;
 await authenticate({getById:async()=>account},{verify:()=>({sub:'22'})})(req,{},()=>{next=true;});
 assert.equal(next,true);assert.equal(req.account,account);
});
test('customer cannot inspect another customer order',async()=>{
 const s=new OrdersService({});await assert.rejects(()=>s.owned({query:async()=>[{id:'1',customer_id:'2'}]},{id:'3',role:'CUSTOMER'},'1'),e=>e.getStatus()===404);
});
test('duplicate submission rejected before writes',async()=>{
 let writes=0;const m={query:async(sql)=>{if(sql.startsWith('SELECT'))return [{id:'1',customer_id:'2',status:'PENDING'}];writes++;return [];}};
 const s=new OrdersService({transaction:fn=>fn(m)});await assert.rejects(()=>s.submit({id:'2',role:'CUSTOMER'},'1'),e=>e.getStatus()===409);assert.equal(writes,0);
});
test('rejection requires meaningful reason',async()=>{
 const s=new OrdersService({});await assert.rejects(()=>s.review({role:'MANAGER'},'1',{decision:'REJECTED',reason:'  '}),e=>e.getStatus()===400);
});
test('invalid dates and nested horses fail validation',()=>{
 const result=orderSchema.safeParse({originAddress:'A',destinationAddress:'B',originCountry:'VN',destinationCountry:'SG',desiredDepartureDate:'2026-02-30',horses:[{name:'',passportNo:''}]});
 assert.equal(result.success,false);assert.ok(result.error.issues.some(e=>e.path[0]==='desiredDepartureDate'));assert.ok(result.error.issues.some(e=>e.path[0]==='horses'));
});
test('mark-read always scopes update to recipient',async()=>{
 let params;const c=new NotificationsService(new NotificationsRepository({query:async(sql,p)=>{params=p;return {affectedRows:0};}}));
 await assert.rejects(()=>c.read('2','1'),e=>e.getStatus()===404);assert.deepEqual(params,['1','2']);
});

