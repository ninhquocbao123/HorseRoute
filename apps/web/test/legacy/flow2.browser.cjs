const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');const {pathToFileURL}=require('node:url');
(async()=>{
const web=path.resolve(__dirname,'..');const {createServer}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite',{paths:[web]})),'dist/node/index.js')).href);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const server=await createServer({root:web,server:{host:'127.0.0.1',port:5181,strictPort:true}});await server.listen();let browser;
try{browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const detail={order:{id:'1',order_code:'TEST-ORDER',customer_name:'Customer',origin_country:'VN',destination_country:'SG'},documents:[{id:'1',horse_id:'1',horse_name:'Ngựa kiểm thử',document_name:'Giấy sức khỏe',status:'NOT_SUBMITTED',has_expiry:1,expiry_date:null,latest_version_id:null}],versions:[],dossiers:[{id:'1',horse_id:'1',horse_name:'Ngựa kiểm thử',authority_name:'Cơ quan kiểm thử',status:'NOT_SUBMITTED'}],history:[]};let uploads=0,reviews=0,updates=0;
await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/api/v1/')){let body={};const p=url.pathname;
if(p.endsWith('/upload')){uploads++;detail.documents[0].status='SUBMITTED';detail.documents[0].latest_version_id='1';detail.versions=[{id:'1',document_id:'1',version_no:1,attachment_id:'1',original_name:'test.pdf',uploaded_at:new Date().toISOString()}];}
else if(p.endsWith('/review')){reviews++;const data=route.request().postDataJSON();assert.equal(data.versionId,'1');detail.documents[0].status='VALID';detail.documents[0].expiry_date=data.expiryDate;}
else if(p.endsWith('/dossiers/1')){updates++;detail.dossiers[0].status='SUBMITTED';detail.dossiers[0].receipt_code='R1';}
else if(p.endsWith('/orders/1'))body=detail;
else if(p.endsWith('/orders'))body={items:[detail.order],total:1};
return route.fulfill({json:body});}if(url.hostname==='127.0.0.1')return route.continue();return route.abort();});
await page.goto('http://127.0.0.1:5181/test/flow2.html');await page.getByRole('button',{name:/TEST-ORDER/}).click();await page.locator('input[type=file]').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});await page.getByRole('button',{name:'Nộp phiên bản mới',exact:true}).click();await page.getByText('Đã lưu cập nhật hồ sơ.').waitFor();assert.equal(uploads,1);
await page.goto('http://127.0.0.1:5181/test/flow2.html?role=SPECIALIST');await page.getByRole('button',{name:/TEST-ORDER/}).click();await page.getByLabel('Ngày hết hạn',{exact:true}).fill('2030-01-01');await page.getByRole('button',{name:'Đánh dấu hợp lệ',exact:true}).click();await page.getByText('Đã lưu cập nhật hồ sơ.').waitFor();assert.equal(reviews,1);
await page.getByRole('button',{name:'Hồ sơ cơ quan',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Ở lại',exact:true}).click();await page.getByRole('button',{name:'Hồ sơ cơ quan',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.getByLabel('Mã biên nhận *',{exact:true}).fill('R1');await page.getByRole('button',{name:'Ghi nhận cập nhật',exact:true}).click();await page.getByText('Biên nhận: R1',{exact:false}).waitFor();assert.equal(updates,1);
fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/flow2-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-results/flow2-mobile.png',fullPage:true});await page.goto('http://127.0.0.1:5181/test/portal.html?role=SPECIALIST');
await page.setViewportSize({width:1440,height:1000});
assert.equal(await page.getByRole('button',{name:'Đăng xuất',exact:true}).count(),0);
assert.equal(await page.getByRole('navigation').getByRole('button',{name:'Tài khoản',exact:true}).count(),0);
const profile=page.getByRole('button',{name:/Phan Thị Lan/});await profile.click();await page.getByRole('button',{name:'Tài khoản',exact:true}).waitFor();assert.equal(await page.locator('#account-options button').count(),2);
await page.keyboard.press('Escape');assert.equal(await profile.getAttribute('aria-expanded'),'false');
await profile.click();await page.getByRole('heading',{name:'Hồ sơ & thủ tục',exact:true}).click();assert.equal(await profile.getAttribute('aria-expanded'),'false');
await profile.click();await page.screenshot({path:'test-results/account-menu-desktop.png',fullPage:true});
await page.getByRole('button',{name:'Tài khoản',exact:true}).click();await page.getByText('test@example.invalid',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Đăng xuất',exact:true}).count(),0);
await page.setViewportSize({width:390,height:844});await profile.click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-results/account-menu-mobile.png',fullPage:true});await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.getByRole('dialog',{name:'Bạn muốn đăng xuất?'}).getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.getByText('Đã đăng xuất (kiểm thử)',{exact:true}).waitFor();
console.log('PASS account menu: hidden until opened, exactly two options, Escape/outside close, account navigation, logout and mobile viewport.');
assert.deepEqual(errors,[]);console.log('PASS browser: Customer upload, Specialist review and dossier submission, mobile overflow, no JS errors. Mock API only.');
}finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});


