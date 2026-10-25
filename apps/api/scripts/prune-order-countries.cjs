// Explicit maintenance: preview by default. Keep VN/CN/TH; HK removal explicitly authorized.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
require('ts-node').register({project:path.resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const mysql=require('mysql2/promise'),options=require('../test/mysql-options.cjs');
const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../../../.env')));
const apply=process.argv.includes('--apply'),allowed=new Set(['VN','CN','TH']);
const pk=t=>t==='specialist_assessments'?'order_id':'id';
const ident=v=>{if(!/^[a-z_]+$/.test(v))throw Error('UNSAFE_IDENTIFIER');return '`'+v+'`';};
(async()=>{const db=await mysql.createConnection({...options,database:env.DB_NAME,dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});let active=false;
try{
 await db.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');await db.beginTransaction();active=true;
 const [keys]=await db.query('SELECT TABLE_NAME t,COLUMN_NAME c,REFERENCED_TABLE_NAME p,REFERENCED_COLUMN_NAME pc FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL');
 const [orders]=await db.query('SELECT * FROM orders ORDER BY id FOR UPDATE');
 const target=orders.filter(o=>(o.origin_country&&!allowed.has(o.origin_country))||(o.destination_country&&!allowed.has(o.destination_country)));
 const ids=new Set(target.map(o=>String(o.id))),kept=orders.filter(o=>!ids.has(String(o.id)));
 const tables=new Set(['orders']);let changed=true;while(changed){changed=false;for(const k of keys)if(tables.has(k.p)&&!tables.has(k.t)){tables.add(k.t);changed=true;}}
 tables.add('notifications');tables.add('audit_logs');
 const data={orders},selected={orders:new Map(target.map(r=>[String(r.id),r]))};
 for(const t of tables)if(t!=='orders'){const [rows]=await db.query('SELECT * FROM '+ident(t)+' ORDER BY '+ident(pk(t))+' FOR UPDATE');data[t]=rows;selected[t]=new Map();}
 function collect(){let added=false;for(const k of keys){if(!selected[k.p]||!selected[k.t])continue;const values=new Set([...selected[k.p].values()].map(r=>String(r[k.pc])));for(const r of data[k.t])if(r[k.c]!=null&&values.has(String(r[k.c]))&&!selected[k.t].has(String(r[pk(k.t)]))){if(r.order_id!=null&&!ids.has(String(r.order_id)))throw Error('CROSS_ORDER_REFERENCE');selected[k.t].set(String(r[pk(k.t)]),r);added=true;}}return added;}
 while(collect()){}
 // Also back up/delete attachments referenced only by the removed documents/dossiers.
 if(!data.attachments){const [rows]=await db.query('SELECT * FROM attachments ORDER BY id FOR UPDATE');data.attachments=rows;selected.attachments=new Map();tables.add('attachments');}
 const candidates=new Set();for(const r of selected.document_versions?.values()||[])candidates.add(String(r.attachment_id));for(const r of selected.dossiers?.values()||[])if(r.permit_attachment_id)candidates.add(String(r.permit_attachment_id));
 for(const r of data.attachments)if(candidates.has(String(r.id))){const shared=keys.filter(k=>k.p==='attachments').some(k=>(data[k.t]||[]).some(child=>String(child[k.c])===String(r.id)&&!selected[k.t]?.has(String(child.id))));if(!shared)selected.attachments.set(String(r.id),r);}
 while(collect()){}
 const entities={ORDER:'orders',HORSE:'horses',TRIP:'trips',LEG:'legs',DOCUMENT:'documents',DOSSIER:'dossiers',QUOTE:'order_quotes',ORDER_QUOTE:'order_quotes',INCIDENT:'incidents',HORSE_LOG:'horse_logs',ALERT:'alerts',ATTACHMENT:'attachments',RECEIPT:'order_receipts'};
 for(const [table,type,id] of [['notifications','related_type','related_id'],['audit_logs','entity_type','entity_id']])for(const r of data[table])if(selected[entities[r[type]]]?.has(String(r[id])))selected[table].set(String(r.id),r);
 const counts=Object.fromEntries(Object.entries(selected).filter(([,rows])=>rows.size).map(([t,rows])=>[t,rows.size]));
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify(target)).digest('hex');
 console.log(JSON.stringify({mode:apply?'apply':'preview',ordersBefore:orders.length,remove:target.length,keep:kept.length,counts,fingerprint,countries:target.reduce((a,r)=>{const key=r.origin_country+' → '+r.destination_country;a[key]=(a[key]||0)+1;return a;},{})}));
 if(!apply){await db.rollback();active=false;return;}
 const expected=process.argv.find(v=>v.startsWith('--fingerprint='))?.split('=')[1];if(expected!==fingerprint)throw Error('PREVIEW_CHANGED_OR_MISSING');
 if(!target.length){await db.rollback();active=false;return;}
 const dir=path.resolve(__dirname,'../../../test-results/order-country-backups');fs.mkdirSync(dir,{recursive:true});const backup=path.join(dir,new Date().toISOString().replace(/[:.]/g,'-')+'.json');
 const payload={createdAt:new Date().toISOString(),database:env.DB_NAME,allowed:[...allowed],fingerprint,foreignKeys:keys,keptOrderIds:kept.map(o=>String(o.id)),tables:Object.fromEntries(Object.entries(selected).map(([t,rows])=>[t,[...rows.values()]]))};
 fs.writeFileSync(backup,JSON.stringify(payload,null,2),{flag:'wx'});const verified=JSON.parse(fs.readFileSync(backup,'utf8'));if(verified.tables.orders.length!==target.length)throw Error('BACKUP_VERIFY_FAILED');
 // Delete leaves first with foreign-key checks enabled, including self-referencing horse logs.
 const pending=Object.fromEntries(Object.entries(selected).map(([t,rows])=>[t,new Map(rows)]));
 let remaining=Object.values(pending).reduce((n,rows)=>n+rows.size,0);
 while(remaining){let progress=0;for(const [t,rows] of Object.entries(pending))for(const [id,r] of rows){const blocked=keys.filter(k=>k.p===t).some(k=>[...(pending[k.t]?.values()||[])].some(child=>!(k.t===t&&String(child.id)===id)&&child[k.c]!=null&&String(child[k.c])===String(r[k.pc])));if(blocked)continue;const [result]=await db.execute('DELETE FROM '+ident(t)+' WHERE '+ident(pk(t))+'=?',[id]);if(result.affectedRows!==1)throw Error('DELETE_COUNT_MISMATCH');rows.delete(id);remaining--;progress++;}if(!progress)throw Error('REFERENCE_CYCLE');}
 const [after]=await db.query('SELECT * FROM orders ORDER BY id');if(JSON.stringify(after)!==JSON.stringify(kept))throw Error('KEPT_ORDERS_CHANGED');
 for(const [t,rows] of Object.entries(data)){const [n]=await db.query('SELECT COUNT(*) n FROM '+ident(t));if(Number(n[0].n)!==rows.length-selected[t].size)throw Error('TABLE_COUNT_MISMATCH_'+t);}
 await db.commit();active=false;console.log(JSON.stringify({committed:true,deletedOrders:target.length,remainingOrders:after.length,backup,remainingRoutes:after.map(o=>({id:o.id,code:o.order_code,from:o.origin_country,to:o.destination_country}))}));
}catch(e){if(active)await db.rollback();throw e;}finally{await db.end();}})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
