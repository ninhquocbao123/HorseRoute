// Applies only the reviewed pricing migration; refuses unrelated pending migrations.
require('reflect-metadata');
const path=require('node:path'),fs=require('node:fs');
require('ts-node').register({project:path.resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {createDatabase}=require('../src/shared/config/db');const {MigrationExecutor}=require('typeorm');
const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../../../.env')));
(async()=>{const db=createDatabase(env);try{
 await db.initialize();const pending=await new MigrationExecutor(db).getPendingMigrations();
 const names=pending.map(m=>m.name);
 if(names.some(n=>n!=='PricingVersions1800000007000'))throw new Error('Có migration khác đang chờ. Dừng để kiểm tra trước: '+names.join(', '));
 const existing=await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('pricing_versions','pricing_publish_lock')");
 const history=await db.query('SELECT name FROM migrations ORDER BY id');
 const before={checkedAt:new Date().toISOString(),pending:names,existingTables:existing.map(r=>r.TABLE_NAME),migrationHistory:history.map(r=>r.name)};
 fs.mkdirSync(path.resolve(__dirname,'../../../test-results'),{recursive:true});
 fs.writeFileSync(path.resolve(__dirname,'../../../test-results/pricing-migration-before.json'),JSON.stringify(before,null,2));
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({mode:'preflight',...before}));return;}
 const applied=await db.runMigrations({transaction:'each'});
 const [row]=await db.query("SELECT id,title,status,JSON_LENGTH(JSON_EXTRACT(config,'$.distanceRates')) distance_bands FROM pricing_versions ORDER BY id LIMIT 1");
 console.log(JSON.stringify({applied:applied.map(m=>m.name),initialVersion:row}));
 }finally{if(db.isInitialized)await db.destroy();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
