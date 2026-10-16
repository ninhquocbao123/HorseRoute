const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
require('ts-node').register({project:require('node:path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {authenticate,authorize}=require('../src/shared/middlewares/auth.middleware');
const {OrdersService}=require('../src/features/orders/orders.service');
const {NotificationsService}=require('../src/features/notifications/notifications.service');
const {NotificationsRepository}=require('../src/features/notifications/notifications.repository');
const {orderSchema}=require('../src/features/orders/orders.validation');
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

