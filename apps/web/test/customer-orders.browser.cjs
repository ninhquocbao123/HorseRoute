const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const web=path.resolve(__dirname,'..');const {createServer}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite',{paths:[web]})),'dist/node/index.js')).href);
 const server=await createServer({root:web,server:{host:'127.0.0.1',port:5192,strictPort:true}});await server.listen();let browser;
 try{
 const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],uploads=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultNavigationTimeout(60000);
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());await page.route('https://fonts.gstatic.com/**',route=>route.abort());
 await page.addInitScript(()=>{if(location.protocol==='http:')localStorage.setItem('accessToken','customer-test');});
 const orders=['APPROVED','IN_TRANSIT','DELIVERED','DELIVERED','DELIVERED'].map((status,i)=>({id:String(i+1),order_code:'VCN-20261023-000'+(i+1),status,origin_address:'TP. Hồ Chí Minh',destination_address:'Đồng Nai',origin_country:'VN',destination_country:'VN',horse_count:3,horse_names:'Silver Storm, Ocean Pearl, Velvet Thunder',desired_departure_date:'2026-11-20',created_at:'2026-10-23',quote_total:i===4?null:30000000,paid:i===3?9000000:30000000}));
 const documents=['Silver Storm','Ocean Pearl','Velvet Thunder'].map((name,i)=>({id:String(i+1),horse_id:String(i+1),horse_name:name,document_name:'Xét nghiệm EIA',status:i===2?'INVALID':'VALID',invalid_reason:i===2?'Bổ sung kết quả EIA còn hạn':null}));
 const horses=documents.map(d=>({id:d.horse_id,order_id:'1',name:d.horse_name,order_code:orders[0].order_code,document_count:1,missing_documents:d.status==='INVALID'?1:0,pending_documents:0}));
 documents.push(...['Hộ chiếu ngựa','Tiêm phòng cúm'].map((name,i)=>({...documents[2],id:String(i+4),document_name:name,status:'VALID',invalid_reason:null})));
 await page.route('**/api/v1/**',async route=>{const req=route.request(),p=new URL(req.url()).pathname.replace('/api/v1','');let data={};
 if(p==='/users/me')data={id:'10',role:'CUSTOMER',accountStatus:'ACTIVE',fullName:'Khách kiểm thử',email:'customer@example.com'};
 else if(p==='/orders/customer-workspace')data={orders,horses};
 else if(p==='/customer/profiles'||p==='/customer/document-types')data=[];
 else if(p==='/notifications')data=[{id:'1',content:'Velvet Thunder: Bổ sung xét nghiệm EIA',is_read:0,event_type:'DOCUMENT_SUPPLEMENT',related_type:'DOCUMENT',related_id:'3',order_id:'1',horse_id:'3',document_id:'3'}];
 else if(p==='/orders')data={items:orders,total:orders.length};
 else if(p.endsWith('/quote'))data=null;
 else if(p==='/orders/1')data={...orders[0],customer:{full_name:'Khách kiểm thử',email:'customer@example.com'},horses:horses.map(h=>({...h,passport_no:'VN-'+h.id})),documents,history:[]};
 else if(p==='/documents/orders/1')data={documents,versions:[],dossiers:[]};
 else if(p==='/documents/orders/1/horses/3/upload'){uploads.push(p);assert.ok(req.headers()['content-type'].includes('multipart/form-data'));assert.ok(req.postData().includes('document_3'));assert.ok(!req.postData().includes('document_4'));assert.ok(!req.postData().includes('document_5'));documents.filter(d=>d.id==='3').forEach(d=>{d.status='SUBMITTED';d.invalid_reason=null;});data={id:'3',versionNo:2};}
 else throw new Error('Unexpected request '+req.method()+' '+p);
 await route.fulfill({json:data});});
 await page.goto('http://127.0.0.1:5192/dashboard?view=orders',{waitUntil:'domcontentloaded'});await page.locator('.co-order').first().waitFor();assert.equal(await page.locator('.co-order').count(),5);
 await page.getByPlaceholder('Mã đơn, điểm đón, điểm giao, tên ngựa').fill('0003');assert.equal(await page.locator('.co-order').count(),1);await page.getByPlaceholder('Mã đơn, điểm đón, điểm giao, tên ngựa').fill('');
 await page.screenshot({path:'test-results/customer-my-orders.png',fullPage:true});
 await page.locator('nav').getByRole('button',{name:'Lịch sử giao dịch',exact:true}).click();await page.locator('.customer-history tbody tr').waitFor();assert.equal(await page.locator('.customer-history tbody tr').count(),1);assert.match(await page.locator('.customer-history tbody').innerText(),/VCN-20261023-0003/);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất danh sách'}).click();const csv=await download;const stream=await csv.createReadStream();let text='';for await(const chunk of stream)text+=chunk.toString();assert.ok(text.includes('0003'));assert.ok(!text.includes('0004')&&!text.includes('0002'));
 await page.getByRole('button',{name:'Thông báo',exact:true}).click();await page.getByRole('button',{name:'Bổ sung giấy tờ',exact:true}).click();await page.locator('.co-document-item').first().waitFor();assert.ok(page.url().includes('view=orders&order=1&horse=3&document=3'));assert.match(await page.locator('.co-document-item').first().innerText(),/Velvet Thunder/);assert.equal(await page.locator('.co-documents tbody tr').count(),3);
 assert.ok(await page.locator('.customer-order-detail').evaluate(el=>el.getBoundingClientRect().width)>900);
 await page.locator('.co-documents .ant-spin-spinning').waitFor({state:'hidden'});await page.screenshot({path:'test-results/customer-order-supplement.png',fullPage:true,animations:'disabled'});
 assert.equal(await page.locator('.co-documents input[type=file]').count(),1);await page.locator('.co-documents input[type=file]').first().setInputFiles({name:'eia.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF')});
 await page.getByRole('button',{name:'Gửi bổ sung (1 giấy tờ)',exact:true}).click();await page.locator('.co-document-item').getByText('Chờ thẩm định',{exact:true}).first().waitFor();assert.deepEqual(uploads,['/documents/orders/1/horses/3/upload']);assert.deepEqual(documents.map(d=>d.status),['VALID','VALID','SUBMITTED','VALID','VALID']);assert.equal(await page.locator('.co-documents tbody').getByText('✓ Giấy tờ đã duyệt',{exact:true}).count(),2);
 await page.getByRole('button',{name:'← Quay lại danh sách',exact:true}).click();await page.locator('.co-order').first().waitFor();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/customer-my-orders-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('PASS order cards, search, settled-only history and CSV, notification deep link, targeted supplement, unchanged approved horses, return to list, mobile');
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
