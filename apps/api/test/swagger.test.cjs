require('reflect-metadata');require('ts-node').register({project:require('path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {test}=require('node:test');const assert=require('node:assert/strict');
const {openApiDocument:doc}=require('../src/shared/config/openapi');
test('Swagger preserves all routes, registration, nested horses and multipart security',()=>{
 const registration=doc.components.schemas.RegisterDto;
 for(const field of ['email','password','fullName','phone','address'])assert.ok(registration.required.includes(field),field);
 assert.equal(Object.values(doc.paths).reduce((n,p)=>n+Object.keys(p).length,0),21);
 assert.deepEqual(doc.paths['/api/v1/auth/register'].post.security,[]);
 assert.ok(doc.paths['/api/v1/orders/{id}/review'].post.security.length);
 assert.ok(doc.components.schemas.DraftOrderDto.properties.horses.items.$ref);
 assert.ok(doc.paths['/api/v1/documents/orders/{orderId}/items/{id}/upload'].post.requestBody.content['multipart/form-data']);
 assert.ok(doc.paths['/api/v1/documents/orders/{orderId}/files/{id}'].get.security.length);
});

