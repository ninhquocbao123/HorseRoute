const {test}=require('node:test'),assert=require('node:assert/strict');
require('reflect-metadata');require('ts-node').register({project:require('node:path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {orderCodePrefix,nextOrderCode}=require('../src/features/orders/order-code');
const {OrdersService}=require('../src/features/orders/orders.service');
const {DocumentsService}=require('../src/features/documents/documents.service');

test('order codes use Vietnam calendar date, padded daily sequence and reject overflow',async()=>{
 assert.equal(orderCodePrefix(new Date('2026-10-22T17:00:00Z')),'VCN-20261023-');
 assert.equal(orderCodePrefix(new Date('2026-10-22T16:59:59Z')),'VCN-20261022-');
 for(const [last,suffix] of [[0,'0001'],[9,'0010'],[998,'0999']])assert.ok((await nextOrderCode({query:async()=>[{last_number:last}]})).endsWith('-'+suffix));
 await assert.rejects(()=>nextOrderCode({query:async()=>[{last_number:9999}]}),/hết số thứ tự/);
});

test('concurrent code collision retries a fresh transaction; idempotent request returns prior order',async()=>{
 let attempts=0,inserted=[];
 const manager={query:async sql=>sql.startsWith('SELECT COALESCE')?[{last_number:attempts-1}]:[]};
 const db={transaction:async work=>{attempts++;return work(manager);}};
 const repository={findRequest:async()=>[],insertDraft:async(m,args)=>{inserted.push(args[0]);if(attempts===1)throw Object.assign(new Error('duplicate'),{code:'ER_DUP_ENTRY'});},findByCode:async()=>[{id:'11'}],updateDraft:async()=>{},insertAudit:async()=>{},findRetriedRequest:async()=>[]};
 const service=new OrdersService(db,repository);
 assert.deepEqual(await service.save({id:'1',role:'CUSTOMER'},{requestId:'request',horses:[]}),{id:'11'});
 assert.equal(attempts,2);assert.ok(inserted[0].endsWith('-0001'));assert.ok(inserted[1].endsWith('-0002'));
 repository.findRequest=async()=>[{id:'11'}];
 assert.deepEqual(await service.save({id:'1',role:'CUSTOMER'},{requestId:'request',horses:[]}),{id:'11'});
 assert.equal(inserted.length,2);
});

test('supplement request and resubmission change only the selected horse document',async()=>{
 const docs=[{id:'1',horse_id:'1',horse_name:'Silver Storm',document_name:'EIA',status:'VALID'},{id:'2',horse_id:'2',horse_name:'Ocean Pearl',document_name:'EIA',status:'VALID'},{id:'3',horse_id:'3',horse_name:'Velvet Thunder',document_name:'EIA',status:'SUBMITTED'}];
 const notices=[];let locked=false;
 const repo={lockOrder:async()=>[{id:'10',customer_id:'7',status:'APPROVED',order_code:'VCN-20261023-0001'}],lockDocument:async(m,[id])=>docs.filter(d=>d.id===id),findSubmittedDossier:async()=>locked?[{id:'1'}]:[],requestSupplement:async(m,[reason,user,id])=>Object.assign(docs.find(d=>d.id===id),{status:'INVALID',invalid_reason:reason}),insertAudit:async()=>{},notifyDocument:async(m,args)=>notices.push(args),findMaxVersion:async()=>[{n:1}],insertAttachment:async()=>({insertId:4}),insertVersion:async()=>({insertId:5}),markSubmitted:async(m,[id])=>Object.assign(docs.find(d=>d.id===id),{status:'SUBMITTED',invalid_reason:null}),findSpecialists:async()=>[{id:'9'}],notifySpecialist:async()=>{}};
 const service=new DocumentsService({transaction:async work=>work({})},repo);
 await service.request({id:'9',role:'SPECIALIST'},'10','3','Cần kết quả EIA còn hạn');
 assert.deepEqual(docs.map(d=>d.status),['VALID','VALID','INVALID']);assert.equal(notices[0][2],'3');assert.match(notices[0][1],/Velvet Thunder/);
 const storage=require('../src/features/documents/file-storage');const save=storage.saveFile;storage.saveFile=async()=>({name:'eia.pdf',type:'PDF',size:10,key:'test'});
 try{await service.upload({id:'7',role:'CUSTOMER'},'10','3',{buffer:Buffer.from('%PDF-demo'),originalname:'eia.pdf',size:9});}finally{storage.saveFile=save;}
 assert.deepEqual(docs.map(d=>d.status),['VALID','VALID','SUBMITTED']);assert.equal(docs[2].invalid_reason,null);
 locked=true;await assert.rejects(()=>service.request({id:'9',role:'SPECIALIST'},'10','1','Yêu cầu bổ sung'),/Hồ sơ đã nộp/);
 assert.equal(docs[0].status,'VALID');
 await assert.rejects(()=>service.request({id:'8',role:'CUSTOMER'},'10','3','test'),/Không tìm thấy đơn/);
});
