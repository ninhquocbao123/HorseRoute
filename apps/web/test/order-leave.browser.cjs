const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const web=path.resolve(__dirname,'..');
 const {createServer}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite',{paths:[web]})),'dist/node/index.js')).href);
 const server=await createServer({root:web,server:{host:'127.0.0.1',port:5184,strictPort:true}});await server.listen();
 const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
  let dialogs=0,saves=0,fail=false,payload;
  page.on('dialog',async d=>{dialogs++;await d.dismiss();});
  await page.route('**/api/v1/**',async r=>{
   const p=new URL(r.request().url()).pathname;let body=[];
   if(p.endsWith('/orders')){
    if(r.request().method()==='POST'){if(fail)return r.fulfill({status:500,json:{message:'Không lưu được nháp'}});saves++;payload=r.request().postDataJSON();body={id:'1'};}
    else body={items:[],total:0};
   }else if(p.endsWith('/orders/1'))body={id:'1',order_code:'TEST',status:'DRAFT',customer:{full_name:'Test',email:'test@example.invalid'},draft:payload,horses:[],documents:[],history:[]};
   await r.fulfill({json:body});
  });
  const overview=()=>page.getByRole('navigation',{name:'Điều hướng nghiệp vụ'}).getByRole('button',{name:/Tổng quan/});
  await page.goto('http://127.0.0.1:5184/test/portal.html?role=MANAGER&view=orders');await overview().click();assert.equal(dialogs,0);
  await page.goto('http://127.0.0.1:5184/test/portal.html?role=CUSTOMER&view=orders');await overview().click();assert.equal(dialogs,0);
  await page.goto('http://127.0.0.1:5184/test/portal.html?role=CUSTOMER&view=orders');
  await page.getByRole('button',{name:'Tạo đơn +'}).click();await page.getByLabel(/^Địa chỉ đi/).fill('Địa chỉ đang nhập');
  await overview().click();await page.getByRole('dialog',{name:'Bạn có thay đổi chưa lưu.'}).waitFor();await page.screenshot({path:'test-results/save-order-dialog.png'});await page.getByRole('button',{name:'Tiếp tục chỉnh sửa',exact:true}).click();assert.equal(dialogs,0);assert.equal(saves,0);assert.equal(await page.getByLabel(/^Địa chỉ đi/).inputValue(),'Địa chỉ đang nhập');
  await overview().click();await page.getByRole('button',{name:'Bỏ thay đổi và tiếp tục',exact:true}).click();await page.getByRole('heading',{name:'Công việc của bạn'}).waitFor();assert.equal(saves,0);
  await page.getByRole('button',{name:/Phan Thị Lan/}).click();await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.getByRole('dialog',{name:'Bạn muốn đăng xuất?'}).waitFor();await page.getByRole('button',{name:'Ở lại',exact:true}).click();
  await page.getByRole('button',{name:/Phan Thị Lan/}).click();await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.getByText('Đã đăng xuất (kiểm thử)',{exact:true}).waitFor();
  console.log('PASS Manager and clean Customer navigate silently; dirty Customer can cancel; discard does not save; logout requires confirmation.');
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
