import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

// Runs only against route-acceptance.fixture.cjs: real API/MySQL, synthetic provider.
export async function runBrowser(f) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/home/minhcup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || '/home/minhcup/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});
  const context = await browser.newContext({viewport:{width:1440,height:1100}});
  await context.addInitScript(token=>localStorage.setItem('accessToken',token), f.token(3));
  const page = await context.newPage();
  const errors=[];page.on('pageerror', e=>errors.push(e.message));
  const root='http://127.0.0.1:5178';
  const out=new URL('../../../docs/artifacts/coordinator-route-planner-acceptance/',import.meta.url).pathname;
  await mkdir(out,{recursive:true});
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async fn=>{for(let i=0;i<80;i++){if(await fn())return;await wait(100);}throw Error('Timed out assertion');};
  const panel=page.locator('.osm-planner');
  const btn=name=>panel.getByRole('button',{name,exact:true});
  const rows=()=>panel.locator('.waypoint-editor');
  const shot=async name=>{
    await page.evaluate(()=>{if(document.querySelector('#fixture-label'))return; const e=document.createElement('div');e.id='fixture-label';e.textContent='KIỂM THỬ — MySQL riêng · provider giả · dữ liệu tổng hợp';Object.assign(e.style,{position:'fixed',top:'0',left:'0',zIndex:'10000',background:'#fff4ba',color:'#111',fontSize:'12px',padding:'4px',pointerEvents:'none'});document.body.append(e);});
    await page.screenshot({path:out+name+'.png',fullPage:true,timeout:5000});
  };
  const save=async()=>{const response=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith('/route-plan'));await btn('Lưu lộ trình').click();assert.equal((await response).status(),200);await until(()=>btn('Lưu lộ trình').isDisabled());};
  const choose=async(index,query)=>{const row=rows().nth(index);if(query)await row.locator('input').fill(query);await row.getByRole('button',{name:'Tìm',exact:true}).click();await row.locator('.address-results button').first().click();};
  try {
    await page.goto(root+'/coordinator/trips/105');
    await panel.waitFor();
    assert.equal(await rows().count(),2);
    assert.equal(await panel.getByLabel('Tìm ORIGIN').inputValue(),'Hồ Hoàn Kiếm, Hà Nội');
    assert.equal(await panel.locator('.address-results').count(),0);
    await panel.getByLabel('Tìm ORIGIN').fill('empty');await rows().nth(0).getByRole('button',{name:'Tìm',exact:true}).click();
    await panel.getByText('Không tìm thấy địa chỉ phù hợp').waitFor();
    f.control.mode='malformed';await chooseError();f.control.mode='ok';
    async function chooseError(){await panel.getByLabel('Tìm ORIGIN').fill('Hồ Hoàn Kiếm');await rows().nth(0).getByRole('button',{name:'Tìm',exact:true}).click();await panel.getByText('Dịch vụ tìm địa chỉ trả dữ liệu không hợp lệ.').waitFor();assert.equal(await panel.getByLabel('Tìm ORIGIN').inputValue(),'Hồ Hoàn Kiếm');}
    f.control.searchDelay=900;
    await rows().nth(0).getByRole('button',{name:'Tìm',exact:true}).click();
    await panel.getByLabel('Tìm ORIGIN').fill('Query mới');await wait(1100);
    assert.equal(await panel.locator('.address-results').count(),0);f.control.searchDelay=0;
    await choose(0,'Hồ Hoàn Kiếm');await choose(1);
    await panel.getByRole('button',{name:/Thêm điểm nghỉ/}).click();await choose(1,'Điểm nghỉ A');
    await panel.getByLabel('Ghi chú điểm nghỉ').fill('Nghỉ kiểm tra ngựa');
    await panel.getByRole('button',{name:/Thêm điểm nghỉ/}).click();await choose(2,'Điểm nghỉ B');
    await panel.getByLabel('Đưa điểm nghỉ lên').nth(1).click();
    assert.match(await rows().nth(1).locator('input').inputValue(),/Điểm nghỉ B/);
    await panel.getByLabel('Xóa điểm nghỉ').first().click();
    assert.equal(await rows().count(),3);
    console.log('PASS browser search empty/malformed/stale; add/reorder/delete and note');

    f.control.delay=1200;await btn('Tìm tuyến đường').click();
    await panel.getByRole('button',{name:/Thêm điểm nghỉ/}).click();
    await panel.getByLabel('Xóa điểm nghỉ').last().click();
    await wait(1400);assert.equal(await panel.getByRole('radio').count(),0);
    assert.equal(await btn('Tìm tuyến đường').getAttribute('class').then(c=>c.includes('loading')),false);
    f.control.delay=0;await btn('Tìm tuyến đường').click();await until(async()=>await panel.getByRole('radio').count()===2);
    assert.equal(await panel.locator('input[type=radio]:checked').count(),0);
    assert.equal(await panel.locator('.leaflet-overlay-pane path').count(),0);
    await panel.getByRole('radio').nth(0).check();const first=await panel.locator('.leaflet-overlay-pane path').getAttribute('d');
    await panel.getByRole('radio').nth(1).check();await wait(300);
    assert.equal(await panel.locator('input[type=radio]:checked').count(),1);
    assert.notEqual(await panel.locator('.leaflet-overlay-pane path').getAttribute('d'),first);
    console.log('PASS browser delayed preview invalidation; same-distance alternatives select distinct geometry');

    let release;const gate=new Promise(r=>release=r);let requests=0;
    await page.route('**/trips/105/route-plan',async route=>{requests++;await gate;await route.continue();});
    console.log('STEP delayed save click');
    await btn('Lưu lộ trình').click();console.log('STEP save clicked');await until(()=>panel.getByLabel('Ghi chú điểm nghỉ').isDisabled());
    assert.equal(await panel.getByRole('button',{name:/Thêm điểm nghỉ/}).isDisabled(),true);
    assert.equal(await panel.locator('.leaflet-marker-draggable').count(),0);
    assert.equal(await panel.getByRole('radio').first().isDisabled(),true);
    await shot('saving-locked');release();await until(()=>btn('Lưu lộ trình').isDisabled().then(async x=>x && await panel.getByText('Tuyến đã lưu',{exact:true}).count()===1));
    await page.unroute('**/trips/105/route-plan');assert.equal(requests,1);
    const saved=(await f.call('GET','/trips/105')).data;
    assert.equal(saved.routePlan.selectedRoute.durationS,660);
    await page.reload();await panel.getByText('Tuyến đã lưu',{exact:true}).waitFor();
    assert.equal(await panel.getByLabel('Ghi chú điểm nghỉ').inputValue(),'Nghỉ kiểm tra ngựa');
    let sent;page.on('request',r=>{if(r.method()==='PUT'&&r.url().endsWith('/route-plan'))sent=r.postDataJSON();});
    await panel.getByLabel('Ghi chú điểm nghỉ').fill('Ghi chú sau lưu');await save();assert.equal(sent.verificationToken,null);
    console.log('PASS browser delayed save locks edits; reload selected route/notes; note-only sends null token');

    const tab2=await context.newPage();await tab2.goto(root+'/coordinator/trips/105');await tab2.locator('.osm-planner').waitFor();
    await panel.getByLabel('Ghi chú điểm nghỉ').fill('Tab A');await save();
    await tab2.getByLabel('Ghi chú điểm nghỉ').fill('Tab B còn nguyên');
    const conflict=tab2.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith('/route-plan'));
    await tab2.getByRole('button',{name:'Lưu lộ trình',exact:true}).click();assert.equal((await conflict).status(),409);
    assert.equal(await tab2.getByLabel('Ghi chú điểm nghỉ').inputValue(),'Tab B còn nguyên');
    await tab2.screenshot({path:out+'conflict-409-fixture.png',fullPage:true});await tab2.close();
    console.log('PASS browser two tabs 409 retains local draft');

    for(const width of [1440,1024,768,390]){
      await page.setViewportSize({width,height:1100});await wait(350);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow '+width);
      await panel.scrollIntoViewIfNeeded();await shot('saved-'+width+'-fixture');
    }
    await page.setViewportSize({width:1440,height:1100});
    await page.getByLabel('Thu gọn sidebar',{exact:true}).click();await wait(300);
    assert.ok((await panel.locator('.leaflet-container').boundingBox()).width>0);
    console.log('PASS browser 1440/1024/768/390 no horizontal overflow; sidebar resize');
    assert.deepEqual(errors,[]);
  } catch(error) {console.log('BROWSER FAILURE',error.message);console.log((await panel.innerText()).slice(0,3500));await shot('failure-fixture').catch(()=>{});throw error;} finally {await browser.close();}
}
