// Real API + isolated MySQL + actual browser. Uses only synthetic fixture data.
const assert=require('node:assert/strict');
(async()=>{
 const f=await require('./route-acceptance.fixture.cjs')();let browser;
 try {
  const {CrewReservations1800000091000}=require('../src/database/migrations/1800000091000-CrewReservations');
  const r=f.db.createQueryRunner();await new CrewReservations1800000091000().up(r);await new (require('../src/database/migrations/1800000090000-AccountAvatars').AccountAvatars1800000090000)().up(r);await r.release();
  await f.q('DELETE FROM trip_assignments');await f.q('DELETE FROM trip_vehicles');
  await f.q("INSERT INTO vehicles(id,vehicle_type,capacity_stalls,license_plate,status) VALUES (2,'LIGHT',4,'FREE-2','AVAILABLE'),(3,'LIGHT',4,'FREE-3','AVAILABLE'),(4,'LIGHT',4,'MOVING-4','IN_TRANSIT')");
  for(const [id,type,status] of [[7,'DRIVER','RESERVED'],[8,'ESCORT','RESERVED'],[9,'DRIVER','IN_TRIP']]){
   await f.q("INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES (?,?,'x',?,'DRIVER_ESCORT','ACTIVE')",[id,id+'@fixture.test','Busy '+id]);
   await f.q('INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (?,?,?)',[id,type,status]);
  }
  const fleet=(v,d='5',e='6')=>({vehicles:[{vehicleId:v,horseCount:1,crew:[{userId:d,role:'DRIVER'},{userId:e,role:'ESCORT'}]}]});
  // Reserve busy resources through service, starting from AVAILABLE.
  await f.q("UPDATE crew_profiles SET work_status='AVAILABLE' WHERE user_id IN (7,8)");
  assert.equal((await f.call('PUT','/trips/106/assignments',3,fleet('1','7','8'))).status,200);
  await f.q("UPDATE trips SET planned_departure_at=NULL,planned_arrival_at=NULL WHERE id=105");await f.q('DELETE FROM legs WHERE trip_id=105');
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/home/minhcup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/home/minhcup/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.addInitScript(token=>localStorage.setItem('accessToken',token),f.token(3));const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(12000);
  await page.goto('http://127.0.0.1:5178/coordinator/trips/105');
  const crewButton=()=>page.getByRole('button',{name:/^(Chọn|Cập nhật) nhân sự$/});
  const vehicleButton=()=>page.getByRole('button',{name:/^(Chọn|Cập nhật) phương tiện$/});
  const dialog=()=>page.getByRole('dialog');
  const card=name=>dialog().locator('.resource-card').filter({hasText:name});
  const confirm=()=>dialog().getByRole('button',{name:'Xác nhận chọn',exact:true}).click();
  const cancel=()=>dialog().getByRole('button',{name:'Hủy',exact:true}).click();
  const closed=()=>dialog().waitFor({state:'hidden'});
  await crewButton().click();await dialog().waitFor();
  await dialog().getByText('Tất cả trạng thái',{exact:true}).waitFor();
  assert.equal(await dialog().getByRole('tab').count(),2);assert.equal(await card('Busy 7').isDisabled(),true);assert.equal(await card('Busy 9').isDisabled(),true);
  assert.doesNotMatch(await dialog().innerText(),/Chưa kiểm tra lịch nháp|TEST-106|TEST-ONLY/);
  await card('Tài xế thử').click();await dialog().getByRole('tab',{name:'Lơ xe',exact:true}).click();await card('Lơ xe thử').click();await confirm();await closed();
  assert.match(await page.locator('.assignment-personnel-list').innerText(),/Tài xế thử/);assert.equal(Number((await f.q('SELECT COUNT(*) n FROM trip_assignments WHERE trip_id=105'))[0].n),0);console.log('PASS choose crew before vehicle without dates; all statuses; modal confirm does not persist');
  await crewButton().click();await card('Tài xế thử').click();await cancel();await closed();await crewButton().click();assert.equal(await card('Tài xế thử').getAttribute('aria-pressed'),'true');await cancel();await closed();console.log('PASS cancel crew modal restores confirmed draft');
  await vehicleButton().click();assert.equal(await card('TEST-ONLY').isDisabled(),true);assert.match(await card('TEST-ONLY').innerText(),/Chuyến đang giữ: TEST-106/);assert.equal(await card('MOVING-4').isDisabled(),true);await card('FREE-2').click();await confirm();await closed();
  await vehicleButton().click();await card('FREE-2').click();await card('FREE-3').click();await confirm();await closed();assert.match(await page.locator('.assignment-personnel-list').innerText(),/Tài xế thử/);
  await vehicleButton().click();await card('FREE-3').click();await confirm();await closed();assert.match(await page.locator('.assignment-personnel-list').innerText(),/Lơ xe thử/);console.log('PASS all vehicle states, busy locked, replace/remove all vehicles keeps people');
  // Prepare own persisted reservation and valid schedule to exercise resave/partial save error.
  assert.equal((await f.call('PUT','/trips/105/assignments',3,fleet('2'))).status,200);
  const {issueRouteToken,routeInputKey}=require('../src/features/trips/trip-route-plan');
  const points=[{id:'a',kind:'ORIGIN',label:'A',latitude:10,longitude:106,note:''},{id:'b',kind:'DESTINATION',label:'B',latitude:11,longitude:107,note:''}];
  const route={geometry:{type:'LineString',coordinates:[[106,10],[107,11]]},distanceM:10000,durationS:1000,provider:'mapbox',calculatedAt:new Date().toISOString(),inputKey:routeInputKey(points)};
  assert.equal((await f.call('PUT','/trips/105/route-plan',3,{revision:0,routePlan:{version:1,waypoints:points,selectedRoute:route},verificationToken:issueRouteToken('105',route)})).status,200);
  assert.equal((await f.call('PUT','/trips/105/plan',3,{plannedDepartureAt:'2031-01-01T01:00:00Z',plannedArrivalAt:'2031-01-02T01:00:00Z',routePlanRevision:1})).status,200);
  await page.reload();await crewButton().click();assert.equal(await card('Tài xế thử').getAttribute('aria-pressed'),'true');await card('Tài xế thử').click();await card('Tài xế thử').click();await confirm();await closed();
  await vehicleButton().click();assert.equal(await card('FREE-2').getAttribute('aria-pressed'),'true');await card('FREE-2').click();await card('FREE-2').click();await cancel();await closed();console.log('PASS own reserved people/vehicle deselect and reselect');
  await page.route('**/trips/105/plan',route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'Lịch thử nghiệm thất bại'})}));
  await page.getByRole('button',{name:/Lưu chặng và phân công/}).click();await page.getByText(/Phân công đã lưu; thời gian kế hoạch chưa được xác nhận/).waitFor();assert.equal((await f.q("SELECT work_status FROM crew_profiles WHERE user_id=5"))[0].work_status,'RESERVED');
  assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/horseroute-reservations-browser.png',fullPage:true});console.log('PASS assignment saved / schedule failed message; no page errors');
 }finally{if(browser)await browser.close();await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
