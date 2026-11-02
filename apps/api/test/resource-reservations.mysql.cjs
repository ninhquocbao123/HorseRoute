// Isolated local MySQL only. No .env or application credentials.
require('reflect-metadata');
require('ts-node').register({project:require('path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {DataSource}=require('typeorm'),{User}=require('../src/features/users/users.model');
const {TripsService}=require('../src/features/trips/trips.service'),{TripsRepository}=require('../src/features/trips/trips.repository');
const {TrackingService}=require('../src/features/tracking/tracking.service'),{TrackingRepository}=require('../src/features/tracking/tracking.repository');
const {VehiclesService}=require('../src/features/vehicles/vehicles.service'),{VehiclesRepository}=require('../src/features/vehicles/vehicles.repository');
const socket=process.env.RESOURCE_TEST_MYSQL_SOCKET;
assert.match(socket||'',/^\/tmp\/horseroute-acceptance-mysql-[a-zA-Z0-9]+\/mysql.sock$/);
const options={type:'mysql',username:'root',timezone:'Z',supportBigNumbers:true,bigNumberStrings:true,entities:[User],extra:{socketPath:socket,connectionLimit:10}};
const name='wdp_flow3_test_'+crypto.randomBytes(8).toString('hex');let admin,db;
(async()=>{try {
 admin=await new DataSource({...options,database:'mysql'}).initialize();await admin.query('CREATE DATABASE '+name+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
 db=await new DataSource({...options,database:name}).initialize();await require('./load-schema.cjs')(db);
 const q=(sql,args)=>db.query(sql,args),runner=db.createQueryRunner();
 for(const [file,klass] of [['1800000013000-TripRoutePlan','TripRoutePlan1800000013000'],['1800000015000-TripFleet','TripFleet1800000015000'],['1800000016000-RepresentativeTripLeg','RepresentativeTripLeg1800000016000'],['1800000091000-CrewReservations','CrewReservations1800000091000']])await new (require('../src/database/migrations/'+file)[klass])().up(runner);
 await runner.release();console.log('PASS migrations on isolated MySQL '+name);
 await q(`INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES
 (1,'c@test','x','Customer','CUSTOMER','ACTIVE'),(3,'coord@test','x','Coordinator','COORDINATOR','ACTIVE'),(4,'m@test','x','Manager','MANAGER','ACTIVE')`);
 for(let id=10;id<18;id++){await q("INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES (?,?,'x',?,'DRIVER_ESCORT','ACTIVE')",[id,id+'@test','Person '+id]);await q("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (?,?,'AVAILABLE')",[id,id%2?'ESCORT':'DRIVER']);}
 for(let id=20;id<24;id++)await q("INSERT INTO vehicles(id,vehicle_type,capacity_stalls,license_plate,status) VALUES (?,'HEAVY',9,?,'AVAILABLE')",[id,'TEST-'+id]);
 for(let id=100;id<106;id++){
 await q("INSERT INTO orders(id,order_code,customer_id,status) VALUES (?,?,1,'APPROVED')",[id,'TEST-'+id]);
 await q("INSERT INTO trips(id,order_id,plan_status,planned_by) VALUES (?,?,'DRAFT',3)",[id,id]);
 await q("INSERT INTO horses(order_id,owner_id,name,passport_no) VALUES (?,1,'Horse',?)",[id,'H-'+id]);}
 const svc=new TripsService(new TripsRepository(db)),tracking=new TrackingService(new TrackingRepository(db));
 const actor={id:'3',role:'COORDINATOR'},manager={id:'4',role:'MANAGER'};
 const team=(v,d='10',e='11')=>({vehicles:[{vehicleId:v,horseCount:1,crew:[{userId:d,role:'DRIVER'},{userId:e,role:'ESCORT'}]}]});
 const state=async()=>({v:await q('SELECT id,status FROM vehicles ORDER BY id'),p:await q('SELECT user_id,work_status FROM crew_profiles ORDER BY user_id'),a:await q('SELECT trip_id,user_id,trip_vehicle_id FROM trip_assignments ORDER BY trip_id,user_id')});
 await svc.saveAssignments(actor,'100',team('20'));
 assert.equal((await q('SELECT status FROM vehicles WHERE id=20'))[0].status,'RESERVED');assert.equal((await q('SELECT work_status FROM crew_profiles WHERE user_id=10'))[0].work_status,'RESERVED');
 assert.equal((await svc.assignmentOptions(actor,'100')).items.find(p=>p.id==='10').selectable,true);assert.equal((await svc.assignmentOptions(actor,'101')).items.find(p=>p.id==='10').selectable,false);
 assert.equal((await svc.planOptions(actor,'100')).vehicles.find(v=>v.id==='20').selectable,true);assert.equal((await svc.planOptions(actor,'101')).vehicles.find(v=>v.id==='20').currentTrips[0].tripId,'100');
 await svc.saveAssignments(actor,'100',team('20'));console.log('PASS reserve draft, own resources selectable and resave');
 const before=await state();await assert.rejects(()=>svc.saveAssignments(actor,'100',team('21','12','10')));assert.deepEqual(await state(),before);
 // Fail after fleet replacement/status updates, proving full rollback including audit.
 await q("CREATE TRIGGER test_fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW BEGIN IF NEW.action='ASSIGN_CREW' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected rollback'; END IF; END");
 await assert.rejects(()=>svc.saveAssignments(actor,'100',team('21','12','13')));assert.deepEqual(await state(),before);await q('DROP TRIGGER test_fail_audit');
 await svc.saveAssignments(actor,'100',team('21'));
 assert.equal((await q('SELECT status FROM vehicles WHERE id=20'))[0].status,'AVAILABLE');assert.equal((await q('SELECT work_status FROM crew_profiles WHERE user_id=10'))[0].work_status,'RESERVED');console.log('PASS validation + late failure rollback, vehicle replacement keeps crew');
 const vehicles=new VehiclesService(new VehiclesRepository(db));await assert.rejects(()=>vehicles.update(actor,'21',{plateOrCode:'TEST-21',vehicleType:'HEAVY',capacityStalls:9,status:'AVAILABLE'}));await assert.rejects(()=>vehicles.update(actor,'22',{plateOrCode:'TEST-22',vehicleType:'HEAVY',capacityStalls:9,status:'IN_TRANSIT'}));console.log('PASS manual status blocked for draft reservation and idle vehicle');
 let races=await Promise.allSettled([svc.saveAssignments(actor,'101',team('20','12','13')),svc.saveAssignments(actor,'102',team('20','14','15'))]);assert.equal(races.filter(r=>r.status==='fulfilled').length,1);
 const winner=races[0].status==='fulfilled'?'101':'102';console.log('PASS concurrent same vehicle: one winner');
 races=await Promise.allSettled([svc.saveAssignments(actor,'103',team('22','16','17')),svc.saveAssignments(actor,'104',team('23','16','17'))]);assert.equal(races.filter(r=>r.status==='fulfilled').length,1);console.log('PASS concurrent same crew with different vehicles: one winner');
 // Create verified route and schedule for first trip.
 const {issueRouteToken,routeInputKey}=require('../src/features/trips/trip-route-plan');process.env.ROUTE_PREVIEW_SECRET='reservation-tests-secret-at-least-thirty-two-characters';
 const points=[{id:'a',kind:'ORIGIN',label:'A',latitude:10,longitude:106,note:''},{id:'b',kind:'DESTINATION',label:'B',latitude:11,longitude:107,note:''}];
 const route={geometry:{type:'LineString',coordinates:[[106,10],[107,11]]},distanceM:10000,durationS:1000,provider:'mapbox',calculatedAt:new Date().toISOString(),inputKey:routeInputKey(points)};
 await svc.saveRoutePlan(actor,'100',{revision:0,routePlan:{version:1,waypoints:points,selectedRoute:route},verificationToken:issueRouteToken('100',route)});
 await svc.savePlan(actor,'100',{plannedDepartureAt:'2031-01-01T01:00:00Z',plannedArrivalAt:'2031-01-02T01:00:00Z',routePlanRevision:1});
 await svc.submitPlan(actor,'100',{});await svc.reviewPlan(manager,'100',{decision:'RETURNED',reason:'Test return retains resources'});assert.equal((await q('SELECT status FROM vehicles WHERE id=21'))[0].status,'RESERVED');
 await svc.submitPlan(actor,'100',{});await svc.reviewPlan(manager,'100',{decision:'APPROVED'});assert.equal((await svc.readiness(manager,'100')).canStart,true);
 await svc.releaseToDriver(manager,'100',{});assert.equal((await q('SELECT status FROM vehicles WHERE id=21'))[0].status,'RESERVED');assert.equal((await q('SELECT work_status FROM crew_profiles WHERE user_id=10'))[0].work_status,'RESERVED');console.log('PASS submit/return/review/readiness/READY retains reservations');
 const leg=(await svc.detail(actor,'100')).legs[0].id,driver={id:'10',role:'DRIVER_ESCORT'};
 const milestone=type=>tracking.recordMilestone(driver,leg,{milestoneType:type,occurredAt:new Date(Math.floor(Date.now()/1000)*1000).toISOString()});
 await milestone('DEPARTED');assert.equal((await q('SELECT status FROM vehicles WHERE id=21'))[0].status,'IN_TRANSIT');assert.equal((await q('SELECT work_status FROM crew_profiles WHERE user_id=10'))[0].work_status,'IN_TRIP');
 await milestone('ARRIVED_AT_STOP');await milestone('DELIVERED');assert.equal((await q('SELECT status FROM vehicles WHERE id=21'))[0].status,'AVAILABLE');assert.equal((await q('SELECT work_status FROM crew_profiles WHERE user_id=10'))[0].work_status,'AVAILABLE');assert.equal((await svc.assignments(actor,'100')).items.length,2);console.log('PASS DEPARTED/DELIVERED lifecycle with assignment history');
 await tracking.correctLeg(manager,leg,{status:'MOVING',reason:'Reopen with resources still free'});
 assert.equal((await q('SELECT status FROM vehicles WHERE id=21'))[0].status,'IN_TRANSIT');
 await tracking.correctLeg(manager,leg,{status:'NOT_STARTED',reason:'Reset to READY with own resources'});
 assert.equal((await q('SELECT work_status FROM crew_profiles WHERE user_id=10'))[0].work_status,'RESERVED');
 await milestone('DEPARTED');await milestone('ARRIVED_AT_STOP');await milestone('DELIVERED');console.log('PASS correction reacquires free resources and READY reserves them');
 await svc.saveAssignments(actor,'105',team('21'));const afterReused=await state();await assert.rejects(()=>tracking.correctLeg(manager,leg,{status:'MOVING',reason:'Cannot reclaim resources of next trip'}));assert.deepEqual(await state(),afterReused);assert.equal((await svc.detail(actor,'100')).orderStatus,'DELIVERED');console.log('PASS old tracking correction cannot reclaim reused resources; transaction rolls back');
 const free=await q("SELECT CAST(user_id AS CHAR) id,crew_type role FROM crew_profiles WHERE work_status='AVAILABLE' AND user_id IN (12,13,14,15) ORDER BY user_id");
 await svc.saveAssignments(actor,'105',team('21',free.find(p=>p.role==='DRIVER').id,free.find(p=>p.role==='ESCORT').id));
 assert.equal((await q('SELECT work_status FROM crew_profiles WHERE user_id=10'))[0].work_status,'AVAILABLE');
 assert.equal((await q('SELECT status FROM vehicles WHERE id=21'))[0].status,'RESERVED');console.log('PASS removed crew released while unchanged vehicle remains reserved');
 const {CrewReservations1800000091000}=require('../src/database/migrations/1800000091000-CrewReservations');const r=db.createQueryRunner();await assert.rejects(()=>new CrewReservations1800000091000().down(r));await q("UPDATE crew_profiles SET work_status='AVAILABLE'");await new CrewReservations1800000091000().down(r);await new CrewReservations1800000091000().up(r);assert.match((await q("SHOW COLUMNS FROM crew_profiles LIKE 'work_status'"))[0].Type,/RESERVED/);await r.release();console.log('PASS migration downgrade guarded, down/up works without reservations');
}finally {if(db?.isInitialized)await db.destroy();if(admin?.isInitialized){await admin.query('DROP DATABASE '+name);await admin.destroy();}}})().catch(e=>{console.error(e);process.exitCode=1;});
