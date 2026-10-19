const {test}=require('node:test'),assert=require('node:assert/strict');
require('ts-node').register({project:require('node:path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {COUNTRY_CODES,isCountryCode}=require('@my-project/shared');
const {orderSchema}=require('../src/features/orders/orders.validation');
test('country catalog contains unique ISO codes and common outbound/inbound routes validate',()=>{
 assert.equal(COUNTRY_CODES.length,249);assert.equal(new Set(COUNTRY_CODES).size,249);
 for(const code of COUNTRY_CODES)assert.match(code,/^[A-Z]{2}$/);
 const base={originAddress:'A',destinationAddress:'B',desiredDepartureDate:'2030-01-01',horses:[{name:'Horse',passportNo:'H1'}]};
 for(const [originCountry,destinationCountry]of [['VN','US'],['US','VN'],['VN','VN'],['FR','JP']])assert.equal(orderSchema.safeParse({...base,originCountry,destinationCountry}).success,true);
 assert.equal(isCountryCode('ZZ'),false);assert.equal(orderSchema.safeParse({...base,originCountry:'ZZ',destinationCountry:'VN'}).success,false);
});
