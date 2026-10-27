const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const web=path.resolve(__dirname,'..');const {createServer}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite',{paths:[web]})),'dist/node/index.js')).href);
 const server=await createServer({root:web,server:{host:'127.0.0.1',port:5196,strictPort:true}});await server.listen();let browser;
 try{
 const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],uploads=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 page.setDefaultNavigationTimeout(60000);
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());await page.route('https://fonts.gstatic.com/**',route=>route.abort());
 await page.addInitScript(()=>{if(location.protocol==='http:')localStorage.setItem('accessToken','customer-test');});


 let sessions=0;const records={},completed=[];
 await page.route('**/api/v1/payments/**',async route=>{const req=route.request(),url=req.url();if(url.includes('/orders/'))return route.fulfill({json:{orderCode:'VCN-20261025-0002',deposit:300000,paid:0,balance:1000000}});
 if(url.endsWith('/sessions')){const body=req.postDataJSON(),sessionCode='PAY-'+(++sessions);records[sessionCode]={sessionCode,orderId:'1',orderCode:'VCN-20261025-0002',amount:300000,paymentMethod:body.paymentMethod,status:'PENDING',expiresAt:new Date(Date.now()+900000).toISOString()};return route.fulfill({json:records[sessionCode]});}
 const code=url.split('/sessions/')[1].split('/')[0];if(url.endsWith('/complete')){completed.push(code);records[code].status=req.postDataJSON().result;}return route.fulfill({json:records[code]});});
 await page.route('http://127.0.0.1:5196/payment-test',async route=>route.fulfill({contentType:'text/html',body:await server.transformIndexHtml('/payment-test','<div id="root"></div><script type="module" src="/test/sandbox-harness.tsx"></script>')}));
 await page.goto('http://127.0.0.1:5196/payment-test');
 await page.getByRole('button',{name:/Ứng dụng ngân hàng/}).click();
 await page.getByRole('heading',{name:'Thông tin đơn hàng (Test)'}).waitFor();
 await page.screenshot({path:path.join(web,'../../test-results/payment-sandbox-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Giả lập thất bại',exact:true}).click();
 await page.getByRole('button',{name:'Thử lại với phiên mới'}).click();
 await page.getByRole('button',{name:/Ví điện tử/}).click();
 await page.getByRole('button',{name:'Mở ví giả lập'}).click();
 await page.getByRole('button',{name:'Xác nhận thanh toán giả lập'}).click();
 await page.getByText('Thanh toán giả lập thành công',{exact:true}).waitFor();
 assert.equal(sessions,2);assert.deepEqual(completed,['PAY-1','PAY-2']);assert.deepEqual(errors,[]);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 console.log('PASS sandbox method selection, QR, retry, wallet confirmation, correct sessions and mobile layout.');
 }finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
