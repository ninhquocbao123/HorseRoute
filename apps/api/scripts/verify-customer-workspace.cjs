// Read-only verification against configured MySQL. Never prints customer records or credentials.
require('reflect-metadata');require('ts-node').register({project:require('path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const mysql=require('mysql2/promise'),options=require('../test/mysql-options.cjs'),assert=require('node:assert/strict');
const {OrdersService}=require('../src/features/orders/orders.service');
const {CustomerService}=require('../src/features/customer/customer.service');
const env=require('dotenv').parse(require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../../../.env')));
(async()=>{const db=await mysql.createConnection({...options,database:env.DB_NAME});try{
 const [users]=await db.query("SELECT id FROM users WHERE role='CUSTOMER' ORDER BY id LIMIT 1");
 assert.ok(users.length,'No customer available for read-only verification');
 const service=new OrdersService({query:async(sql,args)=>(await db.query(sql,args))[0]});
 const data=await service.customerWorkspace({id:String(users[0].id),role:'CUSTOMER'});
 assert.ok(Array.isArray(data.orders)&&Array.isArray(data.horses));
 const profiles=await new CustomerService({query:async(sql,args)=>(await db.query(sql,args))[0]}).list({id:String(users[0].id),role:'CUSTOMER'});
 assert.ok(Array.isArray(profiles));
 const token=require('jsonwebtoken').sign({sub:String(users[0].id),role:'CUSTOMER'},env.JWT_SECRET,{algorithm:'HS256',expiresIn:60});
 for(const endpoint of ['/customer/profiles','/customer/document-types','/orders/customer-workspace']){
   const response=await fetch('http://localhost:3000/api/v1'+endpoint,{headers:{Authorization:'Bearer '+token}});
   assert.equal(response.status,200,endpoint+' HTTP '+response.status);await response.json();
 }
 console.log('PASS read-only MySQL queries and running HTTP API: profiles, document types and customer workspace all return 200.');
 }finally{await db.end();}})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
