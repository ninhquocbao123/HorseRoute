const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const web=path.resolve(__dirname,'..'),apiRequire=require('node:module').createRequire(path.resolve(web,'../api/package.json'));
 apiRequire('ts-node').register({project:path.resolve(web,'../api/tsconfig.json'),transpileOnly:true});
 const {initialPricingConfig}=apiRequire('./src/features/pricing/pricing.seed.ts');
 const {createServer}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite',{paths:[web]})),'dist/node/index.js')).href);
 const server=await createServer({root:web,server:{host:'127.0.0.1',port:5188,strictPort:true}});await server.listen();let browser;
 try{
 const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const now=new Date().toISOString();const versions=[{id:'1',title:'Giá hiện tại',note:'HTML v7',status:'PUBLISHED',revision:1,config:structuredClone(initialPricingConfig),effectiveFrom:now,publishedAt:now,createdAt:now,updatedAt:now,createdByName:null,publishedByName:null}];let active='1';
 await page.addInitScript(()=>localStorage.setItem('accessToken','manager-pricing-test'));
 await page.context().route('**/users/me',route=>route.fulfill({json:{id:'2',role:'MANAGER',accountStatus:'ACTIVE',fullName:'Quản lý thử nghiệm',email:'manager@example.com',phone:null,address:null,createdAt:now}}));
 await page.context().route('**/manager/overview',route=>route.fulfill({json:{}}));
 await page.context().route('**/notifications',route=>route.fulfill({json:[]}));
 await page.context().route('**/pricing/current',route=>{const v=versions.find(v=>v.id===active);return route.fulfill({json:{id:v.id,title:v.title,effectiveFrom:v.effectiveFrom,config:v.config}})});
 await page.context().route('**/manager/pricing**',async route=>{const req=route.request(),url=new URL(req.url()),parts=url.pathname.split('/'),index=parts.indexOf('pricing'),id=parts[index+1],method=req.method();
 if(method==='GET')return route.fulfill({json:[...versions].reverse()});
 const body=req.postDataJSON();
 if(method==='POST'&&!id){const v={...versions[0],...body,id:String(versions.length+1),status:'DRAFT',revision:1,effectiveFrom:null,publishedAt:null,createdByName:'Quản lý thử nghiệm'};versions.push(v);return route.fulfill({status:201,json:{id:v.id,revision:1}});}
 const v=versions.find(v=>v.id===id);if(v.status!=='DRAFT'||v.revision!==body.revision)return route.fulfill({status:409,json:{message:'Xung đột phiên bản'}});
 if(method==='PUT'){Object.assign(v,body,{revision:v.revision+1});return route.fulfill({json:{id,revision:v.revision}});}
 Object.assign(v,{status:'PUBLISHED',publishedAt:now,effectiveFrom:now,revision:v.revision+1});active=id;return route.fulfill({json:{id,revision:v.revision}});
 });
 await page.goto('http://127.0.0.1:5188/dashboard?view=pricing');await page.getByRole('heading',{name:'Phiên bản #1',exact:true}).waitFor();await page.getByRole('heading',{name:'Đơn giá km vượt theo khoảng',exact:true}).waitFor();assert.equal(await page.getByRole('row').filter({hasText:'Trên 150 đến 300 km'}).getByRole('cell',{name:'38.220',exact:true}).count(),1);
 await page.locator('.mgr-sidebar').getByRole('button',{name:/Quản lý bảng giá/}).click();assert.equal(await page.locator('.mgr-sidebar').getByRole('button',{name:/Quản lý bảng giá/}).getAttribute('class'),'active');
 assert.equal(await page.getByLabel('Tài xế + hộ tống',{exact:true}).isDisabled(),true);
 const landing=await page.context().newPage();landing.on('pageerror',e=>errors.push(e.message));
 await landing.goto('http://127.0.0.1:5188/');await landing.waitForFunction(()=>document.querySelector('#pricing-version-note')?.textContent.includes('#1'));
 const originalCrew=await landing.locator('[data-fee="crewPerDay"]').textContent();
 await page.getByRole('button',{name:'Tạo bản nháp từ phiên bản này',exact:true}).click();await page.getByRole('heading',{name:'Phiên bản #2',exact:true}).waitFor();
 await page.getByLabel('Tài xế + hộ tống',{exact:true}).fill('2200000');
 await page.getByLabel('Tỷ lệ đặt cọc',{exact:true}).fill('40');await page.getByLabel('Hiệu lực báo giá',{exact:true}).fill('48');
 assert.equal(await page.getByRole('button',{name:'Áp dụng bảng giá',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Lưu bản nháp',exact:true}).click();await page.getByText('Bản nháp đã lưu',{exact:true}).waitFor();
 assert.equal(await landing.locator('[data-fee="crewPerDay"]').textContent(),originalCrew);
 await page.getByRole('button',{name:'Áp dụng bảng giá',exact:true}).click();await page.getByRole('button',{name:'Xác nhận áp dụng',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('input[aria-label="Tài xế + hộ tống"]')?.disabled);
 await landing.waitForFunction(()=>document.querySelector('#pricing-version-note')?.textContent.includes('#2'));
 assert.notEqual(await landing.locator('[data-fee="crewPerDay"]').textContent(),originalCrew);
 assert.equal(active,'2');assert.equal(versions[0].config.fees.crewPerDay,1890000);assert.equal(versions[1].config.fees.crewPerDay,2200000);
 const heights=await page.locator('.pricing-workspace input,.pricing-workspace select,.pricing-workspace textarea,.pricing-workspace .ant-btn').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));assert.ok(heights.every(height=>height===44),'Pricing controls must share the same 44px height');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/manager-pricing-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'test-results/manager-pricing-mobile.png',fullPage:true});
 await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:'Bảng giá cước Ước tính chi phí chuyến'}).click();await page.waitForFunction(()=>document.querySelector('#tt')?.textContent==='16.716.000 ₫');
 assert.ok((await page.locator('.pts').innerText()).includes('48 giờ'));assert.ok((await page.locator('#dat-chuyen').innerText()).includes('40%'));
 assert.deepEqual(errors,[]);console.log('PASS Manager navigation, immutable versions, draft editing/saving/publication, public price refresh and mobile layout.');
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
