// Read-only report. Never changes statuses or chooses a winning trip.
require('ts-node').register({project:require('path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {createDatabase}=require('../src/shared/config/db');
const fs=require('node:fs'),path=require('node:path');
const env={...require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../../../.env'))),...process.env};
(async()=>{
 const db=await createDatabase(env).initialize(); const r=db.createQueryRunner();
 try {
  await r.connect(); await r.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'); await r.query('START TRANSACTION READ ONLY');
  const report={generatedAt:new Date().toISOString(),mode:'READ ONLY',vehicles:[],crew:[],unlinkedCrew:[]};
  for(const kind of ['vehicles','crew']) {
   const vehicle=kind==='vehicles';
   const rows=await r.query(`SELECT CAST(r.${vehicle?'id':'user_id'} AS CHAR) resourceId,r.${vehicle?'status':'work_status'} actualStatus,
     CAST(t.id AS CHAR) tripId,o.status orderStatus FROM ${vehicle?'vehicles':'crew_profiles'} r
     LEFT JOIN ${vehicle?'trip_vehicles':'trip_assignments'} a ON a.${vehicle?'vehicle_id':'user_id'}=r.${vehicle?'id':'user_id'}
     LEFT JOIN trips t ON t.id=a.trip_id LEFT JOIN orders o ON o.id=t.order_id ORDER BY r.${vehicle?'id':'user_id'},t.id`);
   const grouped=new Map();
   for(const row of rows) {
    if(!grouped.has(row.resourceId))grouped.set(row.resourceId,{resourceId:row.resourceId,actualStatus:row.actualStatus,activeTrips:[]});
    const item=grouped.get(row.resourceId);
    if(row.tripId && !['DELIVERED','CANCELLED'].includes(row.orderStatus) && !item.activeTrips.some(t=>t.tripId===row.tripId))item.activeTrips.push({tripId:row.tripId,orderStatus:row.orderStatus});
   }
   report[kind]=[...grouped.values()].map(item=>({...item,expectedStatus:item.activeTrips.length>1?null:item.activeTrips.length===0?'AVAILABLE':item.activeTrips[0].orderStatus==='IN_TRANSIT'?(vehicle?'IN_TRANSIT':'IN_TRIP'):'RESERVED'})).filter(item=>item.expectedStatus===null || item.expectedStatus!==item.actualStatus);
  }
  report.unlinkedCrew=await r.query('SELECT CAST(trip_id AS CHAR) tripId,CAST(user_id AS CHAR) userId FROM trip_assignments WHERE trip_vehicle_id IS NULL');
  await r.query('ROLLBACK');
  console.log(JSON.stringify(report,null,2));
 } finally {await r.release();await db.destroy();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
