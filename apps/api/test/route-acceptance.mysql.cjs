const assert = require('node:assert/strict');
const fixture = require('./route-acceptance.fixture.cjs');
async function main() {
  const f = await fixture();
  const {issueRouteToken} = require('../src/features/trips/trip-route-plan');
  const points = [
    {id:'origin',kind:'ORIGIN',label:'Hồ Hoàn Kiếm',latitude:21.029,longitude:105.854,note:''},
    {id:'rest',kind:'REST_STOP',label:'Điểm nghỉ thử',latitude:21.021,longitude:105.849,note:'Ghi chú kiểm thử'},
    {id:'destination',kind:'DESTINATION',label:'Công viên Thống Nhất',latitude:21.011,longitude:105.841,note:''},
  ];
  const check = async (label,work) => {await work(); console.log('PASS '+label);};
  try {
    await check('legacy trip GET/list and auth/scope boundaries',async()=>{
      const detail = await f.call('GET','/trips/100');
      assert.equal(detail.status,200);assert.equal(detail.data.routePlan,null);assert.equal(detail.data.routePlanRevision,0);
      assert.equal((await f.call('GET','/trips')).status,200);
      for(const [actor,status] of [[null,401],[1,403],[4,404]]) {
        assert.equal((await f.call('GET','/trips/100',actor)).status,status);
        assert.equal((await f.call('PUT','/trips/100/route-plan',actor,{revision:0,routePlan:{version:1,waypoints:points,selectedRoute:null},verificationToken:null})).status,status);
      }
      assert.equal((await f.call('PUT','/trips/100/route-plan',2,{})).status,403);
    });
    const before = await f.snapshot();
    const preview = await f.call('POST','/trips/100/route-preview',3,{waypoints:points});
    assert.equal(preview.status,200);
    const {verificationToken,...selectedRoute} = preview.data.routes[1];
    const body = {revision:0,routePlan:{version:1,waypoints:points,selectedRoute},verificationToken};
    await check('preview does not persist; signed save and GET reload exact data',async()=>{
      assert.equal((await f.call('GET','/trips/100')).data.routePlan,null);
      const saved = await f.call('PUT','/trips/100/route-plan',3,body);
      assert.equal(saved.status,200,JSON.stringify(saved.data));
      assert.equal(saved.data.routePlanRevision,1);
      assert.deepEqual((await f.call('GET','/trips/100')).data.routePlan,body.routePlan);
      assert.deepEqual(await f.snapshot(),before);
    });
    await check('expired preview: reject unsaved token, preserve saved route for note-only edits',async()=>{
      const now = Date.now;let expired;
      try {Date.now=()=>now()-16*60000;expired=issueRouteToken('100',selectedRoute);}finally{Date.now=now;}
      assert.equal((await f.call('PUT','/trips/100/route-plan',3,{...body,revision:1,verificationToken:expired})).status,400);
      const edited = structuredClone(body);edited.revision=1;edited.verificationToken=null;edited.routePlan.waypoints[1].note='Sau khi token hết hạn';
      assert.equal((await f.call('PUT','/trips/100/route-plan',3,edited)).status,200);
      edited.revision=2;edited.routePlan.waypoints[1].latitude+=.001;
      assert.equal((await f.call('PUT','/trips/100/route-plan',3,edited)).status,400);
      assert.equal((await f.call('PUT','/trips/100/route-plan',3,{...body,revision:2,verificationToken:issueRouteToken('101',selectedRoute)})).status,400);
      assert.equal((await f.call('PUT','/trips/100/route-plan',3,{...body,revision:2,verificationToken:verificationToken+'x'})).status,400);
    });
    await check('two simultaneous revisions: exactly one 200 and one 409',async()=>{
      const edit={...body,revision:2,verificationToken:null};
      const results=await Promise.all([f.call('PUT','/trips/100/route-plan',3,edit),f.call('PUT','/trips/100/route-plan',3,edit)]);
      assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
      assert.equal((await f.call('GET','/trips/100')).data.routePlanRevision,3);
      assert.deepEqual(await f.snapshot(),before);
    });
    await check('new route saves one representative leg and submits with a valid vehicle crew',async()=>{
      const assignments = await f.call('PUT','/trips/100/assignments',3,{vehicles:[{
        vehicleId:'1',horseCount:1,crew:[{userId:'5',role:'DRIVER'},{userId:'6',role:'ESCORT'}],
      }]});
      assert.equal(assignments.status,200,JSON.stringify(assignments.data));
      const schedule = await f.call('PUT','/trips/100/plan',3,{
        plannedDepartureAt:'2031-01-01T01:00:00.000Z',
        plannedArrivalAt:'2031-01-01T03:00:00.000Z',
        routePlanRevision:3,
      });
      assert.equal(schedule.status,200,JSON.stringify(schedule.data));
      assert.equal(schedule.data.legs.length,1);
      assert.equal(schedule.data.legs[0].vehicleId,null);
      assert.equal(schedule.data.legs[0].fromLocationName,'Hồ Hoàn Kiếm');
      assert.equal(schedule.data.legs[0].toLocationName,'Công viên Thống Nhất');
      assert.equal((await f.call('POST','/trips/100/submit-plan',3,{})).status,200);
      assert.equal((await f.call('POST','/trips/101/submit-plan',3,{})).status,409);
    });
    await check('plan/order/actual operation state blocks route writes',async()=>{
      const draft={revision:0,routePlan:{version:1,waypoints:points,selectedRoute:null},verificationToken:null};
      await f.q("UPDATE trips SET plan_status='APPROVED' WHERE id=102");
      assert.equal((await f.call('PUT','/trips/102/route-plan',3,draft)).status,409);
      await f.q("UPDATE orders SET status='READY' WHERE id=103");
      assert.equal((await f.call('PUT','/trips/103/route-plan',3,draft)).status,409);
      await f.q("UPDATE legs SET actual_departure_at=UTC_TIMESTAMP() WHERE trip_id=104");
      assert.equal((await f.call('PUT','/trips/104/route-plan',3,draft)).status,409);
    });
    if(process.argv.includes('--browser')) {
      const {runBrowser} = await import('../../web/test/route-acceptance.browser.mjs');
      await runBrowser(f);
    }
    console.log('PASS acceptance database preserved for inspection: '+f.name);
  } finally {await f.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
