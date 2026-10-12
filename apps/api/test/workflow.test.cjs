const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
require('ts-node').register({project:require('node:path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {RolesGuard}=require('../src/common/guards/roles.guard');
const {OrdersService}=require('../src/modules/orders/orders.service');
const {AuthService}=require('../src/modules/auth/auth.service');
const {NotificationsController}=require('../src/modules/orders/notifications.controller');
const {plainToInstance}=require('class-transformer');
const {validate}=require('class-validator');
const {OrderDto}=require('../src/modules/orders/orders.dto');
function context(req){return {getHandler:()=>()=>{},getClass:()=>class{},switchToHttp:()=>({getRequest:()=>req})};}
test('JWT ADMIN claim cannot grant Manager authority',async()=>{
 const guard=new RolesGuard({getAllAndOverride:()=>['MANAGER']},{getById:async()=>({role:'CUSTOMER',accountStatus:'ACTIVE'})});
 await assert.rejects(()=>guard.canActivate(context({user:{sub:'1',role:'ADMIN'}})),e=>e.getStatus()===403);
});
test('locked account is denied even with correct role',async()=>{
 const guard=new RolesGuard({getAllAndOverride:()=>['MANAGER']},{getById:async()=>({role:'MANAGER',accountStatus:'LOCKED'})});
 await assert.rejects(()=>guard.canActivate(context({user:{sub:'1'}})),e=>e.getStatus()===403);
});
test('valid role installs server account on request',async()=>{
 const account={id:'22',role:'CUSTOMER',accountStatus:'ACTIVE'};const req={user:{sub:'1'}};
 const guard=new RolesGuard({getAllAndOverride:()=>['CUSTOMER']},{getById:async()=>account});
 assert.equal(await guard.canActivate(context(req)),true);assert.equal(req.account,account);
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
test('invalid dates and nested horses fail DTO validation',async()=>{
 const value=plainToInstance(OrderDto,{originAddress:'A',destinationAddress:'B',originCountry:'VN',destinationCountry:'SG',desiredDepartureDate:'2026-02-30',horses:[{name:'',passportNo:''}]});
 const errors=await validate(value);assert.ok(errors.some(e=>e.property==='desiredDepartureDate'));assert.ok(errors.some(e=>e.property==='horses'));
});
test('mark-read always scopes update to recipient',async()=>{
 let params;const c=new NotificationsController({query:async(sql,p)=>{params=p;return {affectedRows:0};}});
 await assert.rejects(()=>c.read({account:{id:'2'}},'1'),e=>e.getStatus()===404);assert.deepEqual(params,['1','2']);
});

