require('reflect-metadata');
const path=require('node:path'),fs=require('node:fs');
require('ts-node').register({project:path.resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {createDatabase}=require('../src/shared/config/db'),{MigrationExecutor}=require('typeorm');
const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../../../.env')));
(async()=>{const db=createDatabase(env);try{
 await db.initialize();const names=(await new MigrationExecutor(db).getPendingMigrations()).map(m=>m.name);
 if(names.some(n=>n!=='CustomerProfiles1800000009000'))throw new Error('Dừng: có migration ngoài phạm vi Customer: '+names.join(', '));
 const columns=await db.query("SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND ((TABLE_NAME='orders') OR (TABLE_NAME IN ('notifications','audit_logs') AND COLUMN_NAME IN ('event_type','entity_type','related_type','action'))) ORDER BY TABLE_NAME,ORDINAL_POSITION");
 const before={checkedAt:new Date().toISOString(),pending:names,columns};fs.mkdirSync(path.resolve(__dirname,'../../../test-results'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../../../test-results/customer-migration-before.json'),JSON.stringify(before,null,2));
 if(!process.argv.includes('--apply')){console.log(JSON.stringify(before));return;}
 const applied=await db.runMigrations({transaction:'each'});console.log(JSON.stringify({applied:applied.map(m=>m.name),profiles:await db.query('SELECT COUNT(*) profiles FROM customer_horse_profiles'),files:await db.query('SELECT COUNT(*) files FROM customer_profile_files')}));
 }finally{if(db.isInitialized)await db.destroy();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
