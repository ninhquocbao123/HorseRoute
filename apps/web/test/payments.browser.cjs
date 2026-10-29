const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const web=path.resolve(__dirname,'..');const {createServer}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite',{paths:[web]})),'dist/node/index.js')).href);
 const server=await createServer({root:web,server:{host:'127.0.0.1',port:5196,strictPort:true}});await server.listen();let browser;
 try{
 const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],uploads=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 page.setDefaultNavigationTimeout(60000);
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());await page.route('https://fonts.gstatic.com/**',route=>route.abort());
 await page.addInitScript(()=>{if(location.protocol==='http:')localStorage.setItem('accessToken','customer-test');});

 let sessions=0;const completed=[];
 await page.route('**/api/v1/payments/**',async route=>{const request=route.request();if(request.url().endsWith('/sessions'))return route.fulfill({json:{sessionCode:'PAY-'+(++sessions),amount:300000,paymentMethod:request.postDataJSON().paymentMethod}});completed.push(request.url());return route.fulfill({json:{status:request.postDataJSON().result}});});
 await page.route('http://127.0.0.1:5196/payment-test',async route=>route.fulfill({contentType:'text/html',body:await server.transformIndexHtml('/payment-test','<div id="root"></div><script type="module" src="/test/payment-harness.tsx"></script>')}));
 await page.goto('http://127.0.0.1:5196/payment-test');
 await page.getByRole('button',{name:/Thất bại/}).click({timeout:10000}).catch(async e=>{console.error(await page.locator('body').innerText());throw e;});
 await page.getByRole('button',{name:'Thử lại',exact:true}).click();
 await page.getByRole('button',{name:'Hủy',exact:true}).click();
 await page.getByRole('button',{name:'Thực hiện lại',exact:true}).click();
 await page.getByRole('tab',{name:'Ví điện tử',exact:true}).click();
 await page.getByRole('button',{name:'Mở màn hình ví giả lập',exact:true}).click();
 await page.getByRole('heading',{name:'Xác nhận thanh toán ví',exact:true}).waitFor();
 const walletCode=await page.locator('.psm-wallet-confirm dd').nth(2).innerText();
 await page.getByRole('button',{name:'Quay lại mã QR',exact:true}).click();
 await page.getByRole('button',{name:'Mở màn hình ví giả lập',exact:true}).click();
 await page.getByRole('button',{name:'Xác nhận thanh toán giả lập',exact:true}).click();
 assert.ok(completed.at(-1).includes(walletCode));
 await page.getByText('Thanh toán thành công (Mô phỏng)',{exact:true}).waitFor();
 assert.equal(sessions,4);assert.equal(new Set(completed).size,3);assert.deepEqual(errors,[]);
 console.log('PASS payment retry after failure and cancellation creates fresh sessions.');
 }finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
