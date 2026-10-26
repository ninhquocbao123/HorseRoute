const {test}=require('node:test'),assert=require('node:assert/strict');
require('ts-node').register({project:require('node:path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {contactSchema}=require('../src/features/customer/customer.validation');
test('booking contacts retain ward and identity fields',()=>{
 const contact={name:'Người nhận',phone:'+84901234567',address:'Trại ngựa',city:'Hà Nội',ward:'Phường Tây Hồ',identityNumber:'012345678901',country:'VN'};
 assert.deepEqual(contactSchema.parse(contact),contact);
 assert.equal(contactSchema.safeParse({...contact,identityNumber:'1'.repeat(31)}).success,false);
 assert.equal(contactSchema.safeParse({...contact,ward:'a'.repeat(61)}).success,false);
});
test('older booking contacts remain readable without the new fields',()=>{
 const parsed=contactSchema.parse({name:'Người gửi',phone:'0901234567',address:'Trại cũ',city:'Hà Nội',country:'VN'});
 assert.equal(parsed.ward,'');assert.equal(parsed.identityNumber,'');
});
