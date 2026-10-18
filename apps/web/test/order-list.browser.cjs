const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const web=path.resolve(__dirname,'..');const {createServer}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite',{paths:[web]})),'dist/node/index.js')).href);
 const server=await createServer({root:web,server:{host:'127.0.0.1',port:5185,strictPort:true}});await server.listen();let browser;
 try{
  const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const items=Array.from({length:7},(_,i)=>({id:String(i+1),order_code:'ORD-2026-000'+(i+1),status:'DRAFT',origin_country:'VN',destination_country:'SG',created_at:'2026-10-01'}));
  await page.route('**/api/v1/**',r=>r.fulfill({json:{items,total:7}}));
  await page.goto('http://127.0.0.1:5185/test/flow1.html');await page.locator('.order-row').last().waitFor();
  const region=page.getByRole('region',{name:'Danh sách đơn vận chuyển'});
  assert.ok(await region.evaluate(e=>e.scrollHeight>e.clientHeight));
  assert.ok((await page.locator('.flow-list').boundingBox()).height<=740);
  await region.evaluate(e=>e.scrollTop=e.scrollHeight);await page.locator('.order-row').last().isVisible();
  await page.screenshot({path:'test-results/compact-orders-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok((await page.locator('.flow-list').boundingBox()).height<=540);
  await page.screenshot({path:'test-results/compact-orders-mobile.png',fullPage:true});
  console.log('PASS seven orders scroll inside bounded panel; desktop/mobile widths and panel heights.');
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
