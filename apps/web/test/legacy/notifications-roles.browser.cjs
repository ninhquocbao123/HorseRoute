const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const web=path.resolve(__dirname,'..');const {createServer}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite',{paths:[web]})),'dist/node/index.js')).href);
 const server=await createServer({root:web,server:{host:'127.0.0.1',port:5196,strictPort:true}});await server.listen();let browser;
 try{
 const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],uploads=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 page.setDefaultNavigationTimeout(60000);
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());await page.route('https://fonts.gstatic.com/**',route=>route.abort());
 await page.addInitScript(()=>{if(location.protocol==='http:')localStorage.setItem('accessToken','customer-test');});



 let role='CUSTOMER',read=false;
 await page.route('**/api/v1/**',route=>{const p=new URL(route.request().url()).pathname.replace('/api/v1','');let data={};if(p==='/users/me')data={id:'1',role,accountStatus:'ACTIVE',fullName:'Người thử nghiệm',email:'test@example.com'};else if(p==='/notifications')data=[{id:'1',content:'Đơn VCN-20261025-0002 có cập nhật.',event_type:'ORDER_APPROVED',created_at:'2026-10-26T03:00:00Z',is_read:read?1:0,order_id:'1'}];else if(p==='/notifications/1/read'){read=true;}else if(p==='/orders/customer-workspace')data={orders:[],horses:[]};else if(p==='/specialist/orders')data=[];return route.fulfill({json:data});});
 for(const current of ['CUSTOMER','MANAGER','SPECIALIST']){role=current;read=false;await page.goto('http://127.0.0.1:5196/dashboard?view=notifications');await page.getByRole('heading',{name:'Hộp thông báo',exact:true}).waitFor();
 const button=page.getByRole('button',{name:/Đánh dấu đã đọc/});await button.waitFor();
 const colors=await button.evaluate(el=>{const label=el.querySelector('span:last-child');return {text:getComputedStyle(label).color,bg:getComputedStyle(el).backgroundColor,visible:getComputedStyle(label).visibility};});assert.notEqual(colors.text,colors.bg);assert.equal(colors.visible,'visible');
 assert.equal(await page.getByRole('button',{name:'Xem đơn hàng',exact:true}).count(),role==='SPECIALIST'?0:1);
 await page.screenshot({path:'test-results/notifications-'+role.toLowerCase()+'.png',fullPage:true});await button.click();await page.locator('.notification-center__read-tag').waitFor();assert.equal(read,true);
 }
 assert.deepEqual(errors,[]);console.log('PASS actual customer/manager/specialist notification pages, readable actions, specialist has no order link and mark read works.');
 }finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
