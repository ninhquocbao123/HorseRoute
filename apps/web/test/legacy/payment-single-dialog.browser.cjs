const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const web=path.resolve(__dirname,'..');const {createServer}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite',{paths:[web]})),'dist/node/index.js')).href);
 const server=await createServer({root:web,server:{host:'127.0.0.1',port:5196,strictPort:true}});await server.listen();let browser;
 try{
 const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],uploads=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 page.setDefaultNavigationTimeout(60000);
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());await page.route('https://fonts.gstatic.com/**',route=>route.abort());
 await page.addInitScript(()=>{if(location.protocol==='http:')localStorage.setItem('accessToken','customer-test');});


 let sessions=0;
 await page.route('**/api/v1/orders/1/quote',r=>r.fulfill({json:{total:1000000,deposit:300000,paid:300000,subtotal:1000000,deposit_percent:30,vat_percent:0,vat_amount:0,adjustment:0,expires_at:'2027-01-01',items:[{code:'TRANSPORT',label:'Vận chuyển',amount:800000},{code:'FEED',label:'Thức ăn',amount:100000},{code:'INTERNATIONAL',label:'Thủ tục',amount:100000}]}}));
 await page.route('**/api/v1/payments/sessions',r=>{sessions++;return r.fulfill({json:{sessionCode:'PAY-'+sessions,amount:700000,paymentMethod:r.request().postDataJSON().paymentMethod}});});
 await page.route('http://127.0.0.1:5196/payment-test',async r=>r.fulfill({contentType:'text/html',body:await server.transformIndexHtml('/payment-test','<div id="root"></div><script type="module" src="/test/payment-single-dialog-harness.tsx"></script>')}));
 await page.goto('http://127.0.0.1:5196/payment-test');await page.getByRole('button',{name:/Thanh toán phần còn lại/}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('dialog').count(),1);await page.getByRole('button',{name:/Thành công/}).waitFor();assert.equal(sessions,1);
 await page.getByRole('tab',{name:'Thẻ quốc tế'}).click();await page.getByText('TEST CARD',{exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),1);await page.getByRole('button',{name:/Thành công/}).waitFor();
 await page.getByRole('dialog').getByRole('button',{name:/Close|Đóng/}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual(errors,[]);console.log('PASS multiple quote groups render one payment dialog and one initial session; switching method does not duplicate dialogs.');
 }finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
