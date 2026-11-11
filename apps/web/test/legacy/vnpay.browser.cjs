const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const web=path.resolve(__dirname,'..');const {createServer}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite',{paths:[web]})),'dist/node/index.js')).href);
 const server=await createServer({root:web,server:{host:'127.0.0.1',port:5196,strictPort:true}});await server.listen();let browser;
 try{
 const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],uploads=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 page.setDefaultNavigationTimeout(60000);
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());await page.route('https://fonts.gstatic.com/**',route=>route.abort());
 await page.addInitScript(()=>{if(location.protocol==='http:')localStorage.setItem('accessToken','customer-test');});


 let status='PENDING';
 await page.route('**/api/v1/payments/**',route=>{const url=route.request().url();if(url.endsWith('/vnpay'))return route.fulfill({json:{paymentUrl:'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=VNPTEST'}});if(url.includes('/sessions/'))return route.fulfill({json:{orderId:'1',orderCode:'VCN-TEST',status}});return route.fulfill({json:{orderId:'1',orderCode:'VCN-TEST',deposit:300000,paid:0,balance:1000000}});});
 await page.route('https://sandbox.vnpayment.vn/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Gateway test destination</h1>'}));
 await page.route('http://127.0.0.1:5196/payment-test**',async route=>route.fulfill({contentType:'text/html',body:await server.transformIndexHtml('/payment-test','<div id="root"></div><script type="module" src="/test/vnpay-harness.tsx"></script>')}));
 await page.goto('http://127.0.0.1:5196/payment-test');await page.getByRole('button',{name:'Tiếp tục đến VNPAY Sandbox'}).click();await page.waitForURL('https://sandbox.vnpayment.vn/**');
 await page.goto('http://127.0.0.1:5196/payment-test?return=1');await page.getByText('Đang chờ VNPAY xác nhận',{exact:true}).waitFor();assert.equal(await page.getByText('Thanh toán thành công',{exact:true}).count(),0);
 status='SUCCESS';await page.getByRole('button',{name:'Kiểm tra lại'}).click();await page.getByText('Thanh toán thành công',{exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS gateway redirect and return page trusts backend status, not browser response code.');
 }finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
