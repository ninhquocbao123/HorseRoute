const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const web=path.resolve(__dirname,'..');const {createServer}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite',{paths:[web]})),'dist/node/index.js')).href);
 const server=await createServer({root:web,server:{host:'127.0.0.1',port:5191,strictPort:true}});await server.listen();let browser;
 try{
 const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('accessToken','customer-test'));
 const orders=[{id:'1',order_code:'VCN-2610-018',status:'NEED_INFO',origin_address:'TP. Hồ Chí Minh',destination_address:'Hà Nội',origin_country:'VN',destination_country:'VN',horse_count:1,desired_departure_date:'2026-11-20',created_at:'2026-10-20',quote_total:30000000,paid:9000000},{id:'2',order_code:'VCN-2610-011',status:'IN_TRANSIT',origin_address:'Hà Nội',destination_address:'Nam Ninh',origin_country:'VN',destination_country:'CN',horse_count:1,created_at:'2026-10-19',quote_total:20000000,paid:20000000}];
 const horses=[{id:'1',order_id:'1',name:'Thunder Bolt',passport_no:'VN-001',breed:'Thoroughbred',sex:'Đực',birth_date:'2021-03-12',order_code:orders[0].order_code,document_count:3,missing_documents:1,pending_documents:0},{id:'2',order_id:'2',name:'Silver Moon',passport_no:'VN-002',breed:'Arabian',sex:'Cái',order_code:orders[1].order_code,document_count:3,missing_documents:0,pending_documents:0}];let saved,submitted=false,failUpload=true,createCount=0;
 const profiles=horses.map((h,i)=>({id:h.id,revision:1,name:h.name,passportNo:h.passport_no,breed:h.breed,birthDate:'2021-03-12',sex:h.sex,coatColor:'Nâu',microchip:'98511200438122'+i,ownerName:'Phạm Trường Long',feed:'Cỏ khô',note:'',documentNote:'',files:[],documents:[]}));
 const estimate={versionId:'1',total:7201000,deposit:2160300,depositPercent:30,quoteValidityHours:24,items:[{code:'TRANSPORT',label:'Cước vận chuyển',amount:4515000},{code:'CREW',label:'Tài xế + hộ tống',amount:1890000},{code:'FUEL',label:'Nhiên liệu, cầu đường',amount:496000},{code:'INTERNATIONAL',label:'Kiểm dịch quốc tế',amount:300000}]};
 await page.route('**/api/v1/**',async route=>{const req=route.request(),p=new URL(req.url()).pathname.replace('/api/v1','');let data={};
 if(p==='/users/me')data={id:'10',role:'CUSTOMER',accountStatus:'ACTIVE',fullName:'Phạm Trường Long',email:'customer@example.com',phone:'0901234567',address:'TP. Hồ Chí Minh'};
 else if(p==='/orders/customer-workspace')data={orders,horses};
 else if(p==='/customer/profiles'&&req.method()==='POST'){createCount++;profiles.push({...req.postDataJSON(),id:'3',revision:1,files:[],documents:[]});data={id:'3'};}
 else if(/^\/customer\/profiles\/\d+\/files$/.test(p)){if(failUpload){failUpload=false;return route.fulfill({status:500,json:{message:'Lỗi tải tệp thử nghiệm'}});}const body=req.postData(),slot=body.match(/name="slot"\r\n\r\n([^\r]+)/)[1];profiles.find(x=>x.id===p.split('/')[3]).files.unshift({id:slot,kind:'DOCUMENT',slot,original_name:'certificate.png'});data={id:slot};}
 else if(p==='/customer/profiles')data=profiles;
 else if(p==='/customer/document-types')data=[{id:'1',name:'Hộ chiếu ngựa (FEI Passport)'},{id:'2',name:'Sổ tiêm phòng'},{id:'3',name:'Kết quả xét nghiệm EIA (Coggins)'}];
 else if(/^\/customer\/profiles\/\d+$/.test(p)&&req.method()==='PUT'){Object.assign(profiles.find(x=>x.id===p.split('/')[3]),req.postDataJSON());data={id:p.split('/')[3]};}
 else if(p==='/pricing/estimate')data=estimate;
 else if(p==='/orders/3/submit'){submitted=true;data={id:'3',status:'PENDING'};}
 else if(p==='/notifications')data=[{id:'1',content:'Bổ sung giấy tờ cho Thunder Bolt',is_read:0}];
 else if(p==='/orders'&&req.method()==='POST'){saved=req.postDataJSON();data={id:'3'};}
 else if(p==='/orders')data={items:orders,total:orders.length};
 else if(p.endsWith('/quote'))data=null;
 else if(/^\/orders\/\d+$/.test(p))data={...(orders.find(o=>o.id===p.split('/')[2])||{id:'3',order_code:'VCN-NEW',status:'DRAFT'}),customer:{full_name:'Phạm Trường Long',email:'customer@example.com'},horses:[],documents:[],history:[],draft:p.endsWith('/3')?saved:null};
 else if(p==='/documents/orders')data={items:[{...orders[0],customer_name:'Phạm Trường Long'}],total:1};
 else if(p==='/documents/orders/1')data={order:orders[0],documents:[],versions:[],dossiers:[],history:[]};
 else if(p.startsWith('/tracking'))data=[];
 return route.fulfill({json:data});});

 await page.goto('http://127.0.0.1:5191/dashboard?view=horses');
 await page.getByRole('heading',{name:'Thunder Bolt',exact:true}).waitFor();
 await page.getByRole('button',{name:/Thêm ngựa mới/}).click();
 const dialog=page.locator('.hp-modal');await dialog.waitFor();
 await page.getByRole('button',{name:/Tiếp tục: Giấy tờ/}).click();
 assert.equal(await dialog.getByLabel('Tên ngựa *',{exact:true}).isVisible(),true);
 await dialog.getByLabel('Tên ngựa *',{exact:true}).fill('Storm Runner');
 await dialog.getByLabel('Mã microchip *',{exact:true}).fill('VN-985211');
 await dialog.getByLabel('Giống ngựa *',{exact:true}).fill('Arabian');
 await dialog.getByLabel('Ngày sinh *',{exact:true}).fill('2021-03-12');
 await dialog.getByLabel('Màu lông *',{exact:true}).fill('Nâu đỏ');
 await dialog.getByLabel('Cân nặng (kg)',{exact:true}).fill('450');
 assert.equal(await dialog.getByText('Ảnh nhận dạng & chế độ chăm sóc',{exact:true}).count(),0);
 await page.screenshot({path:'test-results/horse-profile-step1.png',fullPage:true});
 await page.getByRole('button',{name:/Tiếp tục: Giấy tờ/}).click();
 await dialog.locator('legend').filter({hasText:'Giấy tờ sức khỏe & kiểm dịch'}).waitFor();
 const png={name:'certificate.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64')};
 for(const label of ['Hộ chiếu ngựa (FEI Passport)','Sổ tiêm phòng','Kết quả xét nghiệm EIA (Coggins)'])await dialog.getByLabel('Tải '+label,{exact:true}).setInputFiles(png);
 await dialog.getByRole('button',{name:'Xem Sổ tiêm phòng',exact:true}).click();await page.getByAltText('Xem trước certificate.png').waitFor();await page.locator('.document-preview-dialog').getByRole('button',{name:'Đóng',exact:true}).last().click();
 await page.screenshot({path:'test-results/horse-profile-step2.png',fullPage:true});
 await dialog.locator('.hp-modal-footer').getByRole('button',{name:/Thông tin ngựa/}).click();assert.equal(await dialog.getByLabel('Tên ngựa *',{exact:true}).inputValue(),'Storm Runner');
 await dialog.getByRole('button',{name:/Tiếp tục: Giấy tờ/}).click();
 await dialog.getByRole('button',{name:'Lưu vào hồ sơ',exact:true}).click();await dialog.getByText(/Thông tin ngựa đã lưu/).waitFor();
 await dialog.getByRole('button',{name:'Lưu vào hồ sơ',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(createCount,1);assert.equal(profiles[2].files.length,3);
 await page.getByRole('button',{name:'Đủ giấy tờ',exact:true}).click();assert.equal(await page.locator('.hp-cards article').count(),1);await page.getByRole('heading',{name:'Storm Runner',exact:true}).waitFor();await page.getByText('450 kg',{exact:true}).waitFor();
 await page.screenshot({path:'test-results/horse-profile-cards.png',fullPage:true});
 await page.getByRole('button',{name:/Sửa hồ sơ/}).click();await dialog.getByLabel('Tên ngựa *',{exact:true}).fill('Unsaved');await dialog.getByRole('button',{name:'Hủy',exact:true}).click();await page.getByRole('button',{name:'Tiếp tục chỉnh sửa',exact:true}).click();assert.equal(await dialog.getByLabel('Tên ngựa *',{exact:true}).inputValue(),'Unsaved');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/horse-profile-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await dialog.getByRole('button',{name:'Hủy',exact:true}).click();await page.getByRole('button',{name:'Bỏ thay đổi',exact:true}).click();await dialog.waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);console.log('PASS two-step validation, documents preview, retained values, upload retry without duplicate profiles, summaries, filters, discard guard and mobile layout');
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
