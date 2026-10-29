require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const {test}=require('node:test'); const assert=require('node:assert/strict');
const {tripFleetSchema}=require('../src/features/trips/trip-fleet.schema');
const team=(v,d,e)=>({vehicleId:v,horseCount:9,crew:[{userId:d,role:'DRIVER'},{userId:e,role:'ESCORT'}]});
test('two vehicles each have their own complete crew',()=>assert.ok(tripFleetSchema.safeParse({vehicles:[team('1','11','12'),team('2','21','22')]}).success));
test('reject duplicate person across vehicles or roles and duplicate vehicle',()=>{
 for(const vehicles of [[team('1','11','12'),team('2','11','22')],[team('1','11','11')],[team('1','11','12'),team('1','21','22')]]) assert.equal(tripFleetSchema.safeParse({vehicles}).success,false);
});
test('one to two per role per vehicle, not just fleet totals',()=>{
 const v=team('1','11','12');v.crew.push({userId:'13',role:'DRIVER'},{userId:'14',role:'ESCORT'});assert.ok(tripFleetSchema.safeParse({vehicles:[v]}).success);
 v.crew[3].role='DRIVER';assert.equal(tripFleetSchema.safeParse({vehicles:[v]}).success,false);
 assert.equal(tripFleetSchema.safeParse({vehicles:[{...v,horseCount:0}]}).success,false);
});
