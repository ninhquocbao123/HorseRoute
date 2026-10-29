// Uses a disposable random test schema, never application DB_NAME.
require('reflect-metadata');require('ts-node').register({project:require('path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const assert=require('node:assert/strict'),mysql=require('mysql2/promise'),{DataSource}=require('typeorm'),options=require('./mysql-options.cjs');
const {PricingVersions1800000007000}=require('../src/database/migrations/1800000007000-PricingVersions');
const {ManagerQuotes1800000008000}=require('../src/database/migrations/1800000008000-ManagerQuotes');
const {ManagerService,quoteAmounts}=require('../src/features/manager/manager.service'),{OrdersService}=require('../src/features/orders/orders.service');
const name='wdp_flow1_test_'+require('crypto').randomBytes(8).toString('hex');
(async()=>{let admin,db,created=false;try{
 admin=await mysql.createConnection(options);assert.match(name,/^wdp_flow1_test_[0-9a-f]{16}$/);await admin.query('CREATE DATABASE `'+name+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');created=true;
 db=new DataSource({type:'mysql',host:options.host,port:options.port,username:options.user,password:options.password,ssl:options.ssl,database:name,timezone:'Z',supportBigNumbers:true,bigNumberStrings:true});await db.initialize();await require('./load-schema.cjs')(db);
 await db.query("INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES(1,'m@test.local','!','Manager','MANAGER','ACTIVE'),(2,'c@test.local','!','Customer','CUSTOMER','ACTIVE'),(3,'c2@test.local','!','Other Customer','CUSTOMER','ACTIVE')");
 await db.query("INSERT INTO orders(id,order_code,customer_id,status,origin_country,destination_country,origin_address,destination_address,reviewed_at) VALUES(1,'TEST-1',2,'APPROVED','VN','VN','TP.HCM','Hà Nội',UTC_TIMESTAMP()),(2,'TEST-2',2,'PENDING','VN','VN','A','B',NULL)");
 await db.query("INSERT INTO horses(id,order_id,owner_id,name,passport_no) VALUES(1,1,2,'Thunder','T-1')");
 const q=db.createQueryRunner();await q.connect();try{await new PricingVersions1800000007000().up(q);await new ManagerQuotes1800000008000().up(q);await new ManagerQuotes1800000008000().up(q);}finally{await q.release();}

 const runner=db.createQueryRunner();await runner.connect();try{await new (require('../src/database/migrations/1800000012000-PaymentSimulation').PaymentSimulation1800000012000)().up(runner);}finally{await runner.release();}
 const customer={id:'2',role:'CUSTOMER'},other={id:'3',role:'CUSTOMER'},manager={id:'1',role:'MANAGER'};
 const ms=new ManagerService(db),ps=new (require('../src/features/payments/payments.service').PaymentsService)(db);
 const input={distanceKm:50,vehicleClass:'LIGHT',horseCount:1,durationDays:1,insurance:'NONE',feed:'STANDARD',extraStall:false,international:false,water:'EVERY_2_HOURS',waterRounds:0};
 const q1=await ms.create(manager,'1',{input,adjustment:0,reason:'',vatPercent:8});await ms.review(manager,q1.id,{revision:1,decision:'APPROVED',note:''});
 const dto={orderId:'1',paymentType:'DEPOSIT',paymentMethod:'CARD'};
 for(const u of [other,manager,{id:'1',role:'SPECIALIST'}])await assert.rejects(()=>ps.createSession(u,dto),e=>e.getStatus()===403);
 const a=await ps.createSession(customer,dto),b=await ps.createSession(customer,dto);
 await assert.rejects(()=>ps.completeSession(other,a.sessionCode,{result:'SUCCESS'}),e=>e.getStatus()===403);
 const socket=require('../src/shared/socket/socket.service').socketService;const events=[];const reads=[];
 socket.notifyPayment=event=>{events.push(event);reads.push(db.query('SELECT status FROM payment_sessions WHERE session_code=?',[event.sessionCode||a.sessionCode]));};
 const results=await Promise.allSettled([ps.completeSession(customer,a.sessionCode,{result:'SUCCESS'}),ps.completeSession(customer,b.sessionCode,{result:'SUCCESS'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(events.length,1);
 assert.equal(Number((await db.query('SELECT SUM(amount) paid FROM order_receipts WHERE order_id=1'))[0].paid),a.deposit);
 await Promise.all(reads);
 const balance=await ps.createSession(customer,{...dto,paymentType:'BALANCE'});
 await ps.completeSession(customer,balance.sessionCode,{result:'FAILED'});
 await assert.rejects(()=>ps.completeSession(customer,balance.sessionCode,{result:'SUCCESS'}),e=>e.getStatus()===409);
 const retry=await ps.createSession(customer,{...dto,paymentType:'BALANCE'});assert.notEqual(retry.sessionCode,balance.sessionCode);
 await db.query("UPDATE orders SET status='CANCELLED' WHERE id=1");
 await assert.rejects(()=>ps.completeSession(customer,retry.sessionCode,{result:'SUCCESS'}),e=>e.getStatus()===409);
 await assert.rejects(()=>ps.createSession(customer,{...dto,paymentType:'BALANCE'}),e=>e.getStatus()===409);
 await db.query("UPDATE orders SET status='PREPARING' WHERE id=1");
 await db.query("UPDATE payment_sessions SET created_at=TIMESTAMPADD(MINUTE,-16,UTC_TIMESTAMP()) WHERE session_code=?",[retry.sessionCode]);
 await assert.rejects(()=>ps.completeSession(customer,retry.sessionCode,{result:'SUCCESS'}),e=>e.getStatus()===409);
 await db.query('UPDATE payment_sessions SET created_at=UTC_TIMESTAMP() WHERE session_code=?',[retry.sessionCode]);
 assert.ok((await ps.getSession(customer,retry.sessionCode)).expiresAt);
 const paid=await ps.completeSession(customer,retry.sessionCode,{result:'SUCCESS'});assert.equal(paid.balance,0);
 await assert.rejects(()=>ps.getOrderPayments({id:'1',role:'SPECIALIST'},'1'),e=>e.getStatus()===403);
 assert.equal((await ps.getOrderPayments(manager,'1')).isFullyPaid,true);
 // An unpaid quote cannot be paid after its deposit deadline.
 await db.query('DELETE FROM order_receipts WHERE order_id=1');await db.query("UPDATE order_quotes SET expires_at=TIMESTAMPADD(HOUR,-1,UTC_TIMESTAMP()) WHERE id=?",[q1.id]);
 await assert.rejects(()=>ps.createSession(customer,dto),e=>e.getStatus()===409);
 console.log('PASS payment permissions, concurrent deposit sessions, retry, cancelled orders, expiry and balance.');
 }finally{if(db?.isInitialized)await db.destroy();if(admin){if(created&&/^wdp_flow1_test_[0-9a-f]{16}$/.test(name))await admin.query('DROP DATABASE `'+name+'`');await admin.end();}}})().catch(e=>{console.error(e);process.exitCode=1;});
