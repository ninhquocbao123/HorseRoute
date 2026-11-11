const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const assert=require('node:assert/strict');
const fs=require('fs');
(async()=>{
 const path=require('node:path');const {pathToFileURL}=require('node:url');const web=path.resolve(__dirname,'..');
 const {createServer}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite',{paths:[web]})),'dist/node/index.js')).href);
 const server=await createServer({root:web,server:{host:'127.0.0.1',port:5183,strictPort:true}});await server.listen();
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let detail={id:'1',order_code:'WDP-TEST',status:'DRAFT',origin_country:null,destination_country:null,origin_address:null,destination_address:null,desired_departure_date:'',special_requirements:'',manager_note:null,customer:{full_name:'Khách hàng thử',email:'one@example.com',phone:null},horses:[],documents:[],history:[],draft:{originAddress:'',originCountry:'VN',destinationAddress:'',destinationCountry:'',desiredDepartureDate:'',specialRequirements:'',horses:[]}};
 let mode='customer';let submits=0;let reviews=0;let failSave=false;
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.startsWith('/api/v1/')){
     const path=url.pathname.slice(7);const method=route.request().method();
     let result={};let status=200;
     if(path==='/orders'&&method==='GET')result={items:mode==='manager'?[detail]:[],total:mode==='manager'?1:0};
     else if(path==='/orders'&&method==='POST'||path==='/orders/1'&&method==='PUT'){
       if(failSave){await route.abort('failed');return;}
       detail.draft=route.request().postDataJSON();result={id:'1'};
     }else if(path==='/orders/1'&&method==='GET')result=detail;
     else if(path==='/orders/1/submit'){submits++;status=400;result={message:'Kiểm tra thông tin.',fields:{originAddress:'Nhập địa chỉ đi.',horses:'Cần ít nhất một ngựa.'}};}
     else if(path==='/orders/1/review-options')result={coordinators:[{id:'4',full_name:'Điều phối A'}],rules:[{id:'1',border_location_id:null,border_name:null,authority_name:'Cơ quan A'}]};
     else if(path==='/orders/1/review'){const payload=route.request().postDataJSON();reviews++;if(!payload.reason&&payload.decision!=='APPROVED'){status=400;result={message:'Cần phản hồi.',fields:{reason:'Cần nêu lý do hoặc nội dung bổ sung.'}};}else{detail.status=payload.decision;detail.manager_note=payload.reason;}}
     else {status=404;result={message:'Unexpected mock endpoint: '+path};}
     await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});return;
   }
   if(url.hostname==='127.0.0.1'||url.hostname==='localhost'){await route.continue();return;}
   await route.abort(); // No real Firebase/API traffic in UI tests.
 });
 await page.goto('http://127.0.0.1:5183/test/flow1.html');
 await page.getByRole('button',{name:'Tạo đơn +'}).click();
 await page.getByRole('button',{name:'Xóa đơn',exact:true}).click();
 await page.getByRole('dialog',{name:'Xóa đơn nháp?'}).waitFor();
 await page.getByRole('button',{name:'Giữ lại đơn',exact:true}).click();
 await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();
 await page.getByText('Đã lưu nháp. Bạn có thể tiếp tục chỉnh sửa sau.').waitFor();
 await page.getByRole('button',{name:'Chỉnh sửa và gửi duyệt'}).click();
 await page.getByRole('button',{name:'Lưu và gửi duyệt'}).click();
 await page.getByText('Nhập địa chỉ đi.',{exact:true}).waitFor();assert.equal(submits,1);
 await page.getByLabel(/^Địa chỉ đi/).fill('Địa chỉ vẫn còn khi mất mạng');
 failSave=true;
 await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();
 await page.getByText(/Không kết nối được máy chủ/).waitFor();assert.equal(await page.getByLabel(/^Địa chỉ đi/).inputValue(),'Địa chỉ vẫn còn khi mất mạng');failSave=false;
 await page.getByRole('button',{name:'+ Thêm ngựa',exact:true}).click();
 await page.getByLabel('Tên ngựa',{exact:true}).fill('Ngựa thử');
 fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/flow1-customer-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'test-results/flow1-customer-mobile.png',fullPage:true});
 page.on('dialog',d=>d.accept());
 mode='manager';detail={...detail,status:'PENDING',draft:null,origin_country:'VN',destination_country:'SG',desired_departure_date:'2030-01-01',horses:[{id:'1',name:'Ngựa thử',passport_no:'TEST-1'}]};
 await page.goto('http://127.0.0.1:5183/test/flow1.html?role=MANAGER');
 assert.equal(await page.locator('#order-status option[value="DRAFT"]').count(),0);
 for(const [group,label] of [['pending','Chưa duyệt'],['approved','Đã duyệt'],['documents','Cần bổ sung giấy tờ']]){
  const response=page.waitForResponse(r=>new URL(r.url()).searchParams.get('group')===group);
  await page.getByRole('navigation',{name:'Nhóm đơn vận chuyển'}).getByRole('button',{name:new RegExp('^'+label)}).click();
  await response;
 }
 await page.getByRole('navigation',{name:'Nhóm đơn vận chuyển'}).getByRole('button',{name:/^Tất cả đơn đã gửi/}).click();
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:/WDP-TEST/}).click();
 assert.equal(await page.getByRole('button',{name:'Xóa đơn',exact:true}).count(),0);
 await page.screenshot({path:'test-results/flow1-manager-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Yêu cầu bổ sung',exact:true}).click();await page.getByText('Cần nêu lý do hoặc nội dung bổ sung.',{exact:true}).waitFor();
 await page.getByLabel(/^Nội dung phản hồi/).fill('Bổ sung thông tin ngựa');
 await page.getByRole('button',{name:'Yêu cầu bổ sung',exact:true}).click();await page.getByText('Đã ghi nhận kết quả duyệt và gửi thông báo cho khách hàng.').waitFor();assert.equal(reviews,2);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log('PASS UI: empty draft, inline validation, retained values after network failure, add horse, manager reason validation, NEED_INFO, desktop/mobile layout. No real Firebase account used.');
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


