// Render every role and route without Firebase, HTTP requests, or a real account.
const path=require('node:path');
const assert=require('node:assert/strict');
const Module=require('node:module');
const web=path.resolve(__dirname,'..');
const esbuild=require(require.resolve('esbuild',{paths:[require.resolve('vite',{paths:[web]})]}));
(async()=>{
const result=await esbuild.build({stdin:{contents:`
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {StaticRouter} from 'react-router-dom/server';
import HomePage from './src/features/home/HomePage';
import {workspaces} from './src/features/home/role-workspaces';
export {workspaces};
export function render(role,view='overview'){
 globalThis.testAccount={id:'test',role,fullName:'Người kiểm thử',email:'test@example.invalid',accountStatus:'ACTIVE'};
 return renderToStaticMarkup(<StaticRouter location={'/dashboard?view='+view}><HomePage/></StaticRouter>);
}`,resolveDir:web,loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'isolated-services',setup(build){
 build.onResolve({filter:/hooks\/useAuth$/},()=>({path:'auth',namespace:'test'}));
 build.onResolve({filter:/lib\/firebase$/},()=>({path:'firebase',namespace:'test'}));
 build.onResolve({filter:/lib\/axios$/},()=>({path:'api',namespace:'test'}));
 build.onResolve({filter:/^firebase\/auth$/},()=>({path:'actions',namespace:'test'}));
 build.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='auth'?'export const useAuth=()=>({account:globalThis.testAccount})':args.path==='firebase'?'export const auth={currentUser:null}':args.path==='actions'?'export const signOut=async()=>{}; export const sendPasswordResetEmail=async()=>{}':'export const api={get:async()=>({data:[]}),post:async()=>({data:{}})}',loader:'js'}));
}}]});
const mod=new Module(path.join(web,'role-render-test.cjs'),module);mod.filename=path.join(web,'role-render-test.cjs');mod.paths=module.paths;mod._compile(result.outputFiles[0].text,mod.filename);
const {render,workspaces}=mod.exports;let checks=0;const trackingAreas={DRIVER_ESCORT:['assignments','milestones','horse-logs'],CUSTOMER:['tracking'],COORDINATOR:['operations'],MANAGER:['operations'],SPECIALIST:['tracking']};
for(const role of ['MANAGER','CUSTOMER','SPECIALIST','COORDINATOR','DRIVER_ESCORT']){
 const config=workspaces[role],html=render(role);assert.ok(html.includes(config.title.replaceAll('&','&amp;')));assert.ok(html.includes('Người kiểm thử'));
 for(const area of config.areas){if(area.id==='trips'&&['MANAGER','COORDINATOR'].includes(role)){checks++;continue;}/* mở trang Flow 3 riêng (/dashboard/trips) */const page=render(role,area.id);assert.ok(page.includes(area.title.replaceAll('&','&amp;')),role+':'+area.id);if(trackingAreas[role].includes(area.id))assert.ok(page.includes('Đang tải'),role+':'+area.id);else if(!['orders','documents','submissions'].includes(area.id))assert.ok(page.includes('Chưa kết nối dữ liệu'));checks++;}
 assert.ok(render(role,'account').includes('test@example.invalid'));assert.ok(render(role,'notifications').includes('Hộp thông báo'));
 if(!['MANAGER','CUSTOMER'].includes(role)){assert.ok(!html.includes('Yêu cầu vận chuyển'));assert.ok(render(role,'orders').includes(config.title.replaceAll('&','&amp;')));}
 checks+=4;
}
console.log('PASS: '+checks+' role-page render checks; role-specific navigation, invalid view fallback, account, notifications, and disconnected-data labels. No real API/Firebase called.');
})().catch(e=>{console.error(e);process.exitCode=1});



