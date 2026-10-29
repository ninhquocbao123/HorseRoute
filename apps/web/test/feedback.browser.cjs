const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const web=path.resolve(__dirname,'..');const {createServer}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite',{paths:[web]})),'dist/node/index.js')).href);
 const server=await createServer({root:web,server:{host:'127.0.0.1',port:5196,strictPort:true}});await server.listen();let browser;
 try{
 const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],uploads=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 page.setDefaultNavigationTimeout(60000);
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());await page.route('https://fonts.gstatic.com/**',route=>route.abort());
 await page.addInitScript(()=>{if(location.protocol==='http:')localStorage.setItem('accessToken','customer-test');});


 await page.route('http://127.0.0.1:5196/feedback-test',async route=>route.fulfill({contentType:'text/html',body:await server.transformIndexHtml('/feedback-test','<div id="root"></div><script type="module" src="/test/feedback-harness.tsx"></script>')}));
 await page.goto('http://127.0.0.1:5196/feedback-test');
 await page.getByRole('button',{name:'Thành công hai lần'}).click();await page.getByText('Thao tác thành công',{exact:true}).waitFor();assert.equal(await page.locator('.ant-notification-notice').count(),1);
 await page.getByRole('button',{name:'Lỗi',exact:true}).click();await page.getByText('Không thể hoàn tất',{exact:true}).waitFor();
 await page.screenshot({path:'test-results/feedback-desktop.png',fullPage:true});
 const box=await page.locator('.ant-notification-notice').first().boundingBox();assert.ok(box.x>900);
 await page.getByRole('button',{name:'Xác nhận',exact:true}).click();await page.getByRole('button',{name:'Duyệt hồ sơ',exact:true}).waitFor();await page.screenshot({path:'test-results/feedback-confirm.png'});await page.getByRole('button',{name:'Quay lại',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Bổ sung giấy tờ',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:'test-results/feedback-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS shared notifications, duplicate suppression, top-right placement, confirm labels and mobile actions.');
 }finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
