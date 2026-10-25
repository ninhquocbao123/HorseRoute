require('reflect-metadata');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
require('ts-node').register({project:path.resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {createDatabase}=require('../src/shared/config/db'),{createServices}=require('../src/shared/config/services'),{TokenService}=require('../src/shared/utils/jwt.util'),{createApp}=require('../src/app');
const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../../../.env')));
(async()=>{const db=createDatabase(env);let server;try{
 await db.initialize();const tokens=new TokenService(env.JWT_SECRET),services=createServices(db,tokens);
 server=createApp({services,tokens,corsOrigin:'http://localhost:5173'}).listen(0,'127.0.0.1');await require('node:events').once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port+'/api/v1';
 const current=await fetch(base+'/pricing/current');assert.equal(current.status,200);const version=await current.json();
 assert.ok(version.id);assert.equal(version.config.distanceRates.length,6);assert.equal('createdByName' in version,false);
 const response=await fetch(base+'/pricing/estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({distanceKm:50,vehicleClass:'LIGHT',horseCount:2,durationDays:1,insurance:'NONE',feed:'STANDARD',extraStall:true,international:false,water:'EVERY_2_HOURS',waterRounds:4})});
 const estimate=await response.json();assert.equal(response.status,200);assert.equal(estimate.total,10301000);assert.equal(estimate.versionId,version.id);
 assert.equal((await fetch(base+'/manager/pricing')).status,401);
 console.log(JSON.stringify({verified:'Live MySQL + HTTP API',versionId:version.id,distanceBands:version.config.distanceRates.length,sampleEstimate:estimate.total,anonymousManagerAccess:'401 denied',databaseWrites:false}));
 }finally{if(server){await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}if(db.isInitialized)await db.destroy();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
