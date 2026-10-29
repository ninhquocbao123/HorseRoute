const {test}=require('node:test'),assert=require('node:assert/strict');
require('reflect-metadata');require('ts-node').register({project:require('node:path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const bcrypt=require('bcrypt');const {UsersService}=require('../src/features/users/users.service');
test('profile rejects role injection and updates only personal fields',async()=>{
 let saved;const service=new UsersService({updateProfile:async(id,data)=>{saved={id,...data};},findById:async()=>({id:'7',fullName:'New'})});
 await assert.rejects(()=>service.updateProfile('7',{fullName:'New',phone:'123',address:'Home',role:'ADMIN'}));
 assert.equal(saved,undefined);
 await service.updateProfile('7',{fullName:' New ',phone:'123',address:' Home '});assert.deepEqual(saved,{id:'7',fullName:'New',phone:'123',address:'Home'});
});
test('password requires old secret, rejects reuse and stores a hash',async()=>{
 const old=await bcrypt.hash('old-password',4);let saved;
 const service=new UsersService({findById:async()=>({id:'7',email:'user@test.local'}),findByEmailWithPassword:async()=>({passwordHash:old}),changePassword:async(id,previous,next)=>{saved={id,previous,next};return {affected:1};}});
 await assert.rejects(()=>service.changePassword('7',{currentPassword:'wrong',newPassword:'new-password'}),/hiện tại không đúng/);assert.equal(saved,undefined);
 await assert.rejects(()=>service.changePassword('7',{currentPassword:'old-password',newPassword:'old-password'}),/phải khác/);
 await service.changePassword('7',{currentPassword:'old-password',newPassword:'new-password'});
 assert.equal(saved.id,'7');assert.equal(saved.previous,old);assert.notEqual(saved.next,'new-password');assert.ok(await bcrypt.compare('new-password',saved.next));
 await assert.rejects(()=>service.changePassword('7',{currentPassword:'old-password',newPassword:'ắ'.repeat(25)}),/72 byte/);
});
test('avatar rejects invalid uploads and scopes saved image to signed-in user',async()=>{
 let saved;const service=new UsersService({saveAvatar:async(id,image)=>saved={id,image},avatar:async()=>null});
 await assert.rejects(()=>service.saveAvatar('7'),/không hợp lệ/);
 await assert.rejects(()=>service.saveAvatar('7',{size:4,mimetype:'image/svg+xml',buffer:Buffer.from('<svg')}),/không hợp lệ/);
 await assert.rejects(()=>service.saveAvatar('7',{size:6*1024*1024,mimetype:'image/jpeg',buffer:Buffer.from([255,216,255,217])}),/không hợp lệ/);
 const bytes=Buffer.from([255,216,0,255,217]);await service.saveAvatar('7',{size:bytes.length,mimetype:'image/jpeg',buffer:bytes});assert.equal(saved.id,'7');assert.ok(saved.image.startsWith('data:image/jpeg;base64,'));assert.deepEqual(await service.avatar('7'),{image:null});
});
