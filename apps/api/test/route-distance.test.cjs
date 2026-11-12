const {test}=require('node:test');const assert=require('node:assert/strict');
require('ts-node').register({project:require('node:path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {RouteDistanceService,routeDistanceSchema}=require('../src/features/customer/route-distance');
const input={from:{country:'VN',city:'Tỉnh Đồng Tháp',ward:''},to:{country:'VN',city:'Tỉnh Cà Mau',ward:''}};
function feature(name,coords,countrycode='VN',osm_value='state'){return {properties:{name,countrycode,osm_value},geometry:{coordinates:coords}};}
test('road metres convert to km, historic places ignored, repeated routes cached',async()=>{
 let calls=0;
 const service=new RouteDistanceService(async url=>{calls++;const u=new URL(url);if(u.pathname.includes('route/'))return {code:'Ok',routes:[{distance:218602.4}]};return {features:u.searchParams.get('q').includes('Đồng')?[feature('Đồng Tháp cũ',[0,0],'VN','historic'),feature('Đồng Tháp',[105.9,10.4])]:[feature('Cà Mau',[105.1,9])]};});
 assert.deepEqual(await service.estimate(input),{distanceKm:219,precision:'city',source:'OpenStreetMap / OSRM'});
 await service.estimate(input);assert.equal(calls,3);
});
test('provider outage and missing route never return a default distance',async()=>{
 await assert.rejects(new RouteDistanceService(async()=>{throw Error('offline');}).estimate(input),/kết nối/);
 const service=new RouteDistanceService(async url=>url.includes('/route/')?{code:'NoRoute'}:{features:[feature(url.includes('ng')?'Đồng Tháp':'Cà Mau',[105,10])]});
 await assert.rejects(service.estimate(input));
});
test('only approved public locality fields accepted',()=>{
 assert.equal(routeDistanceSchema.safeParse(input).success,true);
 for(const field of ['name','phone','address','identityNumber'])assert.equal(routeDistanceSchema.safeParse({...input,from:{...input.from,[field]:'private'}}).success,false);
 assert.equal(routeDistanceSchema.safeParse({...input,to:{...input.to,country:'US'}}).success,false);
});
test('same mapped area is not presented as zero or a fabricated distance',async()=>{
 const service=new RouteDistanceService(async()=>({features:[feature('Đồng Tháp',[105,10])]}));
 await assert.rejects(service.estimate({from:input.from,to:input.from}),/cùng khu vực/);
});

test('Photon lỗi mạng thì tra dự phòng (Nominatim); không tìm thấy (400) thì không gọi dự phòng', async () => {
  const calls = [];
  const fallback = async (query, country) => { calls.push([query, country]); return query.startsWith('Hoàn Kiếm') ? [105.85, 21.03] : null; };
  const down = new RouteDistanceService(async () => { throw new Error('The operation was aborted due to timeout'); }, fallback);
  assert.deepEqual(await down.locate({ country: 'VN', city: 'Thành phố Hà Nội', ward: 'Phường Hoàn Kiếm' }), { coordinates: [105.85, 21.03], precision: 'ward' });
  assert.deepEqual(calls[0], ['Hoàn Kiếm, Hà Nội', 'VN']);
  // Cầu dao đã bật vì Photon vừa lỗi: 5 phút tới đi thẳng sang dự phòng. Tắt lại để thử nhánh "không tìm thấy".
  const { photonHealth } = require('../src/shared/config/nominatim');
  assert.equal(photonHealth.isDown(), true);
  photonHealth.downUntil = 0;
  const missing = new RouteDistanceService(async () => ({ features: [] }), async () => { throw new Error('không được gọi'); });
  await assert.rejects(() => missing.locate({ country: 'VN', city: 'Thành phố Hà Nội', ward: 'Phường Không Có' }), /Chưa xác định được khu vực/);
});
