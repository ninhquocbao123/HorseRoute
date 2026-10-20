// UI regression checks with isolated API fixtures, no backend writes.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const base = process.env.TRIPS_TEST_URL || 'http://127.0.0.1:5178';
const errors = [], calls = [];
let failure = 0, networkFailure = false;
const detail = id => ({id,orderId:'100',orderCode:`ORD-${id}`,plannedBy:'9007199254740993',planStatus:id==='201'?'APPROVED':'DRAFT',orderStatus:'PREPARING',approvedBy:id==='201'?'42':null,approvedAt:id==='201'?'2026-10-20T00:00:00Z':null,returnReason:id==='200'?'Cần chỉnh sửa\n'+ 'Nội dung dài '.repeat(60):null,plannedDepartureAt:'2026-10-20T01:00:00Z',plannedArrivalAt:'2026-10-20T05:00:00Z',legs:id==='201'?[]:[2,1].map(seqNo=>({id:String(seqNo),seqNo,fromLocationId:'1',toLocationId:'2',fromLocationName:`Điểm đi ${seqNo} `+'A'.repeat(180),toLocationName:'Điểm đến '+'B'.repeat(180),vehicleId:seqNo===1?'10':null,vehicleCode:seqNo===1?'XE-10':null,vehicleActive:seqNo===1?false:null,plannedDepartureAt:'2026-10-20T01:00:00Z',plannedArrivalAt:'2026-10-20T05:00:00Z',status:'NOT_STARTED'}))});
const context = await browser.newContext({viewport:{width:1440,height:900}});
await context.addInitScript(()=>localStorage.setItem('accessToken','ui-test'));
await context.route('**/api/v1/**', async route=>{
 const url=new URL(route.request().url());
 assert.equal(route.request().method(),'GET');
 if(url.pathname.endsWith('/users/me')) return route.fulfill({json:{id:'2',role:'MANAGER',fullName:'Kiểm tra',email:'test@example.test'}});
 const match=url.pathname.match(/\/trips\/([^/]+)$/);
 if(match){
  calls.push(match[1]);
  if(networkFailure) return route.abort('failed');
  if(failure) return route.fulfill({status:failure,json:{message:'Test error'}});
  if(match[1]==='201') await new Promise(r=>setTimeout(r,350));
  return route.fulfill({json:detail(match[1])});
 }
 if(url.pathname.endsWith('/assignments')) return route.fulfill({json:{tripId:'200',items:[],crewReadiness:{complete:false,blockers:[]}}});
 if(url.pathname.endsWith('/assignment-options')) return route.fulfill({json:{items:[]}});
 return route.fulfill({json:[]});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(base+'/dashboard/trips/200?page=2&limit=10&tab=plan');
 await page.getByRole('heading',{name:'Chuyến #200 · Đơn ORD-200'}).waitFor();
 assert((await page.locator('.trip-status-row').innerText()).includes('Kế hoạch:'));
 assert((await page.locator('.trip-status-row').innerText()).includes('Đơn:'));
 assert((await page.locator('[data-returned]').innerText()).includes('Cần chỉnh sửa'));
 assert.equal((await page.locator('.trip-leg-seq').allTextContents()).map(s=>s.trim()).join(','),'01,02');
 await page.getByText('9007199254740993',{exact:true}).waitFor();
 assert((await page.locator('.trip-leg-timeline').innerText()).includes('08:00'));
 assert((await page.locator('.trip-leg-timeline').innerText()).includes('Ngừng hoạt động'));
 for(const width of [320,375,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
 }
 assert.equal(await page.getByRole('tab').count(),2);
 assert.equal(await page.getByRole('tab',{name:'Điều kiện READY',exact:true}).count(),0);
 await page.getByRole('tab',{name:'Nhân sự',exact:true}).focus();await page.keyboard.press('Home');
 await page.getByRole('tab',{name:'Kế hoạch',selected:true,exact:true}).waitFor();
 assert.equal(await page.getByRole('tabpanel').getAttribute('aria-labelledby'),'trip-tab-plan');
 await page.goto(base+'/dashboard/trips/200?tab=bad&page=2&limit=10');
 await page.waitForURL('**/trips/200?tab=plan&page=2&limit=10');
 await page.getByRole('heading',{name:'Chuyến #200 · Đơn ORD-200'}).waitFor();
 // Change ID without remounting the app: old trip must disappear while the new one loads.
 await page.evaluate(()=>{history.pushState({},'', '/dashboard/trips/201?tab=plan');dispatchEvent(new PopStateEvent('popstate'));});
 await page.getByRole('status',{name:'Đang tải chi tiết chuyến'}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Chuyến #200 · Đơn ORD-200'}).count(),0);
 await page.getByRole('heading',{name:'Chuyến #201 · Đơn ORD-201'}).waitFor();
 await page.getByText('Chưa có chặng nào trong kế hoạch.',{exact:true}).waitFor();
 await page.getByText('42',{exact:true}).waitFor();
 assert((await page.locator('.trip-summary-dl').innerText()).includes('07:00'));
 assert.equal(await page.locator('.trip-return-banner').count(),0);
 for(const id of ['abc','0','01','-1','18446744073709551616']){
  const before=calls.length;await page.goto(base+'/dashboard/trips/'+id);
  await page.getByRole('heading',{name:'ID chuyến không hợp lệ'}).waitFor();
  assert.equal(calls.length,before);
 }
 for(const code of [400,403,404,503]){
  failure=code;await page.goto(base+'/dashboard/trips/202');
  await page.getByRole('alert').waitFor();
  const text=await page.getByRole('alert').innerText();
  assert(text.includes(code===400?'không hợp lệ':code===403?'không có quyền':code===404?'không tồn tại':'Không tải được'));
  assert.equal(await page.locator('.trip-summary-dl').count(),0);
 }
 failure=0;await page.getByRole('button',{name:'Thử lại',exact:true}).click();
 await page.getByRole('heading',{name:'Chuyến #202 · Đơn ORD-202'}).waitFor();
 networkFailure=true;await page.goto(base+'/dashboard/trips/203');await page.getByRole('alert').waitFor();
 networkFailure=false;await page.getByRole('button',{name:'Thử lại',exact:true}).click();
 await page.getByRole('heading',{name:'Chuyến #203 · Đơn ORD-203'}).waitFor();
 await page.goto(base+'/dashboard/trips/200?tab=plan&page=2&limit=10');
 await page.getByRole('heading',{name:'Chuyến #200 · Đơn ORD-200'}).waitFor();
 assert((await page.getByRole('link',{name:'Danh sách chuyến',exact:false}).getAttribute('href')).endsWith('?page=2&limit=10'));
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'/tmp/flow03-detail-desktop.png',fullPage:true});
 await page.setViewportSize({width:320,height:800});await page.screenshot({path:'/tmp/flow03-detail-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS detail: statuses, returned reason, actual IDs/metadata/dates, sorted legs, empty state, URL tabs/reload/keyboard, invalid ID/400/403/404/503/network/retry, ID switch isolation, list params, 6 responsive widths with long content.');
}finally{await browser.close();}
