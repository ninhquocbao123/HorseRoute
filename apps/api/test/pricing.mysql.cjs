// Creates and removes only an isolated wdp_pricing_test_* schema. Never mutates application DB_NAME.
require('reflect-metadata');require('ts-node').register({project:require('path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const assert=require('node:assert/strict'),mysql=require('mysql2/promise'),{DataSource}=require('typeorm');
const options=require('./mysql-options.cjs');
const {PricingVersions1800000007000}=require('../src/database/migrations/1800000007000-PricingVersions');
const {PricingService}=require('../src/features/pricing/pricing.service');
const {initialPricingConfig}=require('../src/features/pricing/pricing.seed');
const name='wdp_pricing_test_'+require('crypto').randomBytes(8).toString('hex');
(async()=>{let admin,db,created=false;try{
 admin=await mysql.createConnection(options);assert.match(name,/^wdp_pricing_test_[0-9a-f]{16}$/);await admin.query('CREATE DATABASE `'+name+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');created=true;
 db=new DataSource({type:'mysql',host:options.host,port:options.port,username:options.user,password:options.password,ssl:options.ssl,database:name,timezone:'Z',supportBigNumbers:true,bigNumberStrings:true});await db.initialize();
 await db.query('CREATE TABLE users(id BIGINT UNSIGNED PRIMARY KEY,full_name VARCHAR(100))');
 await db.query("INSERT INTO users VALUES(1,'Manager'),(2,'Customer'),(3,'Other Manager')");
 await db.query('CREATE TABLE audit_logs(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,actor_id BIGINT UNSIGNED,entity_type VARCHAR(30),entity_id BIGINT UNSIGNED,action VARCHAR(50),old_value TEXT,new_value TEXT,reason VARCHAR(255))');
 const q=db.createQueryRunner();await q.connect();try{await new PricingVersions1800000007000().up(q);await new PricingVersions1800000007000().up(q);}finally{await q.release();}
 const s=new PricingService(db),manager={id:'1',role:'MANAGER'},customer={id:'2',role:'CUSTOMER'};
 const original=await s.current();assert.equal(original.config.distanceRates[0].light,4515000);assert.equal((await s.list(manager)).length,1);
 for(const role of ['CUSTOMER','COORDINATOR','ADMIN','SPECIALIST','DRIVER_ESCORT'])await assert.rejects(()=>s.create({...customer,role},{title:'Không được',note:'',config:initialPricingConfig}),e=>e.getStatus()===403);
 const draft=await s.create(manager,{title:'Bảng giá thử nghiệm',note:'Kiểm tra phiên bản',config:initialPricingConfig});
 const modified=structuredClone(initialPricingConfig);modified.fees.crewPerDay=2000000;
 const updates=await Promise.allSettled([s.update(manager,draft.id,{title:'Điều chỉnh A',note:'A',config:modified,revision:1}),s.update({id:'3',role:'MANAGER'},draft.id,{title:'Điều chỉnh B',note:'B',config:modified,revision:1})]);
 assert.equal(updates.filter(x=>x.status==='fulfilled').length,1);assert.equal(updates.find(x=>x.status==='rejected').reason.getStatus(),409);
 assert.equal((await s.current()).id,original.id);
 await s.publish(manager,draft.id,{revision:2});assert.equal((await s.current()).id,draft.id);
 assert.equal((await s.current()).config.fees.crewPerDay,2000000);
 await assert.rejects(()=>s.update(manager,draft.id,{title:'Sửa giá cũ',note:'Không được',config:initialPricingConfig,revision:3}),e=>e.getStatus()===409);
 const future=await s.create(manager,{title:'Bảng giá tương lai',note:'Ngày mai',config:initialPricingConfig});await s.publish(manager,future.id,{revision:1,effectiveFrom:new Date(Date.now()+86400000).toISOString()});assert.equal((await s.current()).id,draft.id);
 const past=await s.create(manager,{title:'Ngày không hợp lệ',note:'',config:initialPricingConfig});await assert.rejects(()=>s.publish(manager,past.id,{revision:1,effectiveFrom:'2020-01-01T00:00:00Z'}),e=>e.getStatus()===400);
 assert.deepEqual((await s.list(manager)).find(v=>v.id===original.id).config,original.config);
 const estimate=await s.estimate({distanceKm:50,vehicleClass:'LIGHT',horseCount:1,durationDays:1,insurance:'NONE',feed:'STANDARD',extraStall:false,international:false,water:'EVERY_2_HOURS',waterRounds:4});assert.equal(estimate.versionId,draft.id);assert.equal(estimate.total,4515000+2000000+496000+200000);
 const [audit]=await db.query('SELECT COUNT(*) count FROM audit_logs');assert.ok(Number(audit.count)>=6);
 console.log('PASS migration idempotency, all role restrictions, optimistic concurrency, immutable publication, scheduled activation, original version retention, server estimates and audit.');
 }finally{if(db?.isInitialized)await db.destroy();if(admin){if(created)await admin.query('DROP DATABASE `'+name+'`');await admin.end();}}})().catch(e=>{console.error(e.message);process.exitCode=1;});
