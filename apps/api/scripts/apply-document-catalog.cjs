require('reflect-metadata');
const path=require('path'),fs=require('fs');require('ts-node').register({project:path.resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {createDatabase}=require('../src/shared/config/db'),{MigrationExecutor}=require('typeorm');
const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../../../.env')));
(async()=>{const db=createDatabase(env);try{await db.initialize();const pending=(await new MigrationExecutor(db).getPendingMigrations()).map(m=>m.name);if(pending.some(n=>n!=='RemoveQuarantineRules1800000011000'))throw Error('Unexpected pending migrations: '+pending.join(','));
const backup={date:new Date().toISOString(),tables:{}};for(const table of ['document_types','quarantine_rules','quarantine_rule_doctypes','documents','document_versions','customer_profile_files','notifications','orders']){const exists=await db.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);if(exists.length)backup.tables[table]={ddl:(await db.query('SHOW CREATE TABLE `'+table+'`'))[0],rows:await db.query('SELECT * FROM `'+table+'`')};}
const dir=path.resolve(__dirname,'../../../test-results/document-catalog-backups');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,new Date().toISOString().replace(/[:.]/g,'-')+'.json');fs.writeFileSync(file,JSON.stringify(backup,null,2));console.log('Backup: '+file);
if(!process.argv.includes('--apply'))return;
await db.runMigrations({transaction:'none'});
console.log(JSON.stringify({types:await db.query('SELECT id,name FROM document_types'),rules:await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE 'quarantine_rule%'"),orders:await db.query('SELECT COUNT(*) total FROM orders'),profileFiles:await db.query("SELECT slot,COUNT(*) total FROM customer_profile_files WHERE kind='DOCUMENT' GROUP BY slot")}));
}finally{if(db.isInitialized)await db.destroy();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
