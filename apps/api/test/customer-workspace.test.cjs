const {test}=require('node:test'),assert=require('node:assert/strict');
require('reflect-metadata');require('ts-node').register({project:require('node:path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {OrdersService}=require('../src/features/orders/orders.service');
test('customer workspace scopes every query to the signed-in customer and forbids staff',async()=>{
 const queries=[];const service=new OrdersService({query:async(sql,args)=>{queries.push({sql,args});return [];}});
 for(const role of ['MANAGER','COORDINATOR','SPECIALIST'])await assert.rejects(()=>service.customerWorkspace({id:'12',role}),e=>e.getStatus()===403);
 assert.equal(queries.length,0);assert.deepEqual(await service.customerWorkspace({id:'12',role:'CUSTOMER'}),{orders:[],horses:[],receipts:[]});
 assert.deepEqual(queries[0].args,['12']);assert.match(queries[0].sql,/WHERE o.customer_id=\?/);assert.match(queries[0].sql,/q.status='APPROVED'/);
 assert.deepEqual(queries[1].args,['12','12']);assert.match(queries[1].sql,/h.owner_id=\? AND o.customer_id=\?/);
 assert.deepEqual(queries[2].args,['12']);assert.match(queries[2].sql,/WHERE o.customer_id=\?/);
});
