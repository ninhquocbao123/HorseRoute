// Read-only HTTP verification against the configured database. No real quotes or receipts are created.
require('reflect-metadata');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
require('ts-node').register({project:path.resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {createDatabase}=require('../src/shared/config/db'),{createServices}=require('../src/shared/config/services'),{TokenService}=require('../src/shared/utils/jwt.util'),{createApp}=require('../src/app');
const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../../../.env')));
(async()=>{const db=createDatabase(env);let server;try{
 await db.initialize();const tokens=new TokenService(env.JWT_SECRET),services=createServices(db,tokens);
 const [manager]=await db.query("SELECT id,email,role FROM users WHERE role='MANAGER' AND account_status='ACTIVE' LIMIT 1");assert.ok(manager);
 const auth={Authorization:'Bearer '+tokens.sign({sub:String(manager.id),email:manager.email,role:manager.role})};
 server=createApp({services,tokens,corsOrigin:'http://localhost:5173'}).listen(0,'127.0.0.1');await require('node:events').once(server,'listening');const base='http://127.0.0.1:'+server.address().port+'/api/v1';
 const counts={};for(const p of ['/manager/overview','/manager/quote-orders','/manager/revenue?year='+new Date().getUTCFullYear(),'/manager/orders/1/quotes']){const r=await fetch(base+p,{headers:auth});const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));counts[p]=Array.isArray(body)?body.length:p.includes('revenue')?body.count:'ok';}
 assert.equal((await fetch(base+'/manager/overview')).status,401);
 console.log(JSON.stringify({verified:'Live MySQL + authenticated Manager HTTP',results:counts,anonymousAccess:'401 denied',databaseWrites:false}));
 }finally{if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});if(db.isInitialized)await db.destroy();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
