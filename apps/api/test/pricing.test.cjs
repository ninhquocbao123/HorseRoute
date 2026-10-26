const {test}=require('node:test');const assert=require('node:assert/strict');
require('reflect-metadata');require('ts-node').register({project:require('node:path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {initialPricingConfig}=require('../src/features/pricing/pricing.seed');
const {pricingConfigSchema,estimateSchema}=require('../src/features/pricing/pricing.validation');
const {calculateEstimate}=require('@my-project/shared');
const input={distanceKm:50,vehicleClass:'LIGHT',horseCount:2,durationDays:1,insurance:'NONE',feed:'STANDARD',extraStall:true,international:false,water:'EVERY_2_HOURS',waterRounds:4};

test('standard water omits paid cadence even after switching back from hourly service',()=>{
 for(const water of ['EVERY_2_HOURS','EVERY_HOUR']) {
  const result=calculateEstimate(initialPricingConfig,{...input,water,waterRounds:0},'1');
  assert.equal(result.items.some(i=>i.code==='WATER'),false);
  assert.equal(result.total,4515000+1890000+496000+3000000);
 }
 const hourly=calculateEstimate(initialPricingConfig,{...input,water:'EVERY_HOUR',waterRounds:2},'1').items.find(i=>i.code==='WATER');
 assert.match(hourly.label,/mỗi giờ/);
 assert.equal(hourly.amount,2*2*initialPricingConfig.fees.water1hPerHorse);
});
test('estimate includes crew, proportional fuel, water and selected extras exactly once',()=>{
 const result=calculateEstimate(initialPricingConfig,input,'1');
 assert.equal(result.total,4515000+1890000+496000+400000+3000000);assert.equal(result.deposit,Math.round(result.total*.3));assert.equal(result.balance+result.deposit,result.total);
 assert.deepEqual(result.items.map(i=>i.code),['TRANSPORT','CREW','FUEL','WATER','EXTRA_STALL']);
});
test('excess kilometres use lower anchor plus per-km rate, with continuous prices at boundaries',()=>{
 const trip={...input,vehicleClass:'MEDIUM',distanceKm:238};
 const items=calculateEstimate(initialPricingConfig,trip,'1').items;
 assert.equal(items.find(i=>i.code==='TRANSPORT').amount,10143000);
 const excess=items.find(i=>i.code==='EXCESS_DISTANCE');
 assert.equal(excess.quantity,88);assert.equal(excess.unitPrice,38220);assert.equal(excess.amount,3363360);
 assert.equal(items.filter(i=>['TRANSPORT','EXCESS_DISTANCE'].includes(i.code)).reduce((sum,i)=>sum+i.amount,0),13506360);
 for(const [vehicleClass,key] of [['LIGHT','light'],['MEDIUM','medium'],['HEAVY','heavy']]) {
  for(const row of initialPricingConfig.distanceRates) {
   const result=calculateEstimate(initialPricingConfig,{...input,vehicleClass,distanceKm:row.km},'1');
   assert.equal(result.items.find(i=>i.code==='TRANSPORT').amount,row[key]);
   assert.equal(result.items.some(i=>i.code==='EXCESS_DISTANCE'),false);
  }
 }
 const before=calculateEstimate(initialPricingConfig,{...trip,distanceKm:150},'1');
 const after=calculateEstimate(initialPricingConfig,{...trip,distanceKm:151},'1');
 assert.equal(after.items.find(i=>i.code==='EXCESS_DISTANCE').amount,38220);
 assert.equal(before.items.find(i=>i.code==='TRANSPORT').amount,10143000);
 assert.equal(calculateEstimate(initialPricingConfig,{...input,distanceKm:1},'1').items[0].amount,4515000);
});

test('fare intervals retain coverage metadata and reject distance beyond coverage',()=>{
 assert.equal(calculateEstimate(initialPricingConfig,{...input,distanceKm:51},'1').distanceBandKm,150);
 assert.equal(calculateEstimate(initialPricingConfig,{...input,distanceKm:150},'1').distanceBandKm,150);
 assert.throws(()=>calculateEstimate(initialPricingConfig,{...input,distanceKm:1501},'1'),/phạm vi/);
});
test('vehicle capacity is enforced for every class',()=>{
 for(const [vehicleClass,limit] of [['LIGHT',2],['MEDIUM',6],['HEAVY',9]])assert.throws(()=>calculateEstimate(initialPricingConfig,{...input,vehicleClass,horseCount:limit+1},'1'),/sức chứa/);
});
test('versions reject duplicate or decreasing bands, negative fees and inverted class prices',()=>{
 for(const change of [c=>c.distanceRates[1].km=50,c=>c.distanceRates[1].light=0,c=>c.distanceRates[0].light=99999999,c=>c.fees.crewPerDay=-1,c=>c.depositPercent=101]){const c=structuredClone(initialPricingConfig);change(c);assert.equal(pricingConfigSchema.safeParse(c).success,false);}
 assert.equal(pricingConfigSchema.safeParse(initialPricingConfig).success,true);
});
test('estimate input rejects price injection and invalid units',()=>{
 for(const change of [{total:1},{durationDays:0},{horseCount:1.5},{waterRounds:-1},{distanceKm:-1},{feed:'FREE'}])assert.equal(estimateSchema.safeParse({...input,...change}).success,false);
});
