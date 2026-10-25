// Explicit maintenance command. Defaults to read-only; --apply updates orders.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
require('ts-node').register({project:path.resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const mysql=require('mysql2/promise'),options=require('../test/mysql-options.cjs');
const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../../../.env')));
const apply=process.argv.includes('--apply');
(async()=>{
 const db=await mysql.createConnection({...options,database:env.DB_NAME,dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});
 let transaction=false;
 try{
  const [references]=await db.query("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='orders' AND REFERENCED_COLUMN_NAME='order_code'");
  if(references.length)throw new Error('CODE_REFERENCED_BY_FOREIGN_KEY');
  if(apply){await db.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');await db.beginTransaction();transaction=true;}
  const [rows]=await db.query("SELECT id,order_code,created_at,DATE_FORMAT(DATE_ADD(created_at,INTERVAL 7 HOUR),'%Y%m%d') code_day FROM orders ORDER BY created_at,id"+(apply?' FOR UPDATE':''));
  const daily=new Map();
  const mapping=rows.map(row=>{if(!/^\d{8}$/.test(row.code_day))throw new Error('INVALID_CREATED_AT');const number=(daily.get(row.code_day)||0)+1;daily.set(row.code_day,number);if(number>9999)throw new Error('DAILY_SEQUENCE_OVERFLOW');return {id:String(row.id),created_at:row.created_at,old_code:row.order_code,new_code:`VCN-${row.code_day}-${String(number).padStart(4,'0')}`};});
  const changed=mapping.filter(row=>row.old_code!==row.new_code);
  if(new Set(mapping.map(row=>row.new_code)).size!==rows.length)throw new Error('DUPLICATE_TARGET_CODES');
  console.log(JSON.stringify({mode:apply?'apply':'preview',total:rows.length,changes:changed.length,days:Object.fromEntries(daily),examples:changed.slice(0,8)}));
  if(!apply)return;
  if(changed.length){
   const backupDir=path.resolve(__dirname,'../../../test-results/order-code-backups');fs.mkdirSync(backupDir,{recursive:true});
   const backup=path.join(backupDir,new Date().toISOString().replace(/[:.]/g,'-')+'.json');
   fs.writeFileSync(backup,JSON.stringify({createdAt:new Date().toISOString(),mapping},null,2),{flag:'wx'});
   // Temporary values avoid collisions when existing VCN codes are reordered.
   const reserved=new Set([...mapping.map(r=>r.old_code),...mapping.map(r=>r.new_code)]);
   for(const row of changed){let temporary;do{temporary='TMP-'+crypto.randomBytes(8).toString('hex');}while(reserved.has(temporary));reserved.add(temporary);await db.execute('UPDATE orders SET order_code=? WHERE id=?',[temporary,row.id]);}
   for(const row of changed)await db.execute('UPDATE orders SET order_code=? WHERE id=?',[row.new_code,row.id]);
   const [verified]=await db.query('SELECT id,order_code FROM orders');const byId=new Map(verified.map(r=>[String(r.id),r.order_code]));
   if(verified.length!==mapping.length||mapping.some(r=>byId.get(r.id)!==r.new_code))throw new Error('VERIFICATION_FAILED');
   await db.commit();transaction=false;console.log(JSON.stringify({committed:true,updated:changed.length,verified:verified.length,backup}));
  }else{await db.commit();transaction=false;console.log(JSON.stringify({committed:true,updated:0,verified:rows.length}));}
 }catch(e){if(transaction)await db.rollback();throw e;}finally{await db.end();}
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
