require('reflect-metadata');require('ts-node').register({project:require('path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const {test}=require('node:test');const assert=require('node:assert/strict');
const {openApiDocument:doc}=require('../src/shared/config/openapi');
test('Swagger preserves all routes, registration, nested horses and multipart security',()=>{
 const registration=doc.components.schemas.RegisterDto;
 for(const field of ['email','password','fullName','phone','address'])assert.ok(registration.required.includes(field),field);
 assert.equal(Object.values(doc.paths).reduce((n,p)=>n+Object.keys(p).length,0),32);
 assert.deepEqual(doc.paths['/api/v1/auth/register'].post.security,[]);
 assert.ok(doc.paths['/api/v1/orders/{id}/review'].post.security.length);
 assert.ok(doc.components.schemas.DraftOrderDto.properties.horses.items.$ref);
 assert.ok(doc.paths['/api/v1/documents/orders/{orderId}/items/{id}/upload'].post.requestBody.content['multipart/form-data']);
 assert.ok(doc.paths['/api/v1/documents/orders/{orderId}/files/{id}'].get.security.length);
});



test('Trip design contract exposes complete schemas, examples and explicit implementation status', () => {
 const operations = [
  ['/api/v1/trips', 'get', 'TripList'],
  ['/api/v1/trips/{id}', 'get', 'TripDetail'],
  ['/api/v1/trips/{id}/plan-options', 'get', 'TripPlanOptions'],
  ['/api/v1/trips/{id}/plan', 'put', 'TripDetail'],
 ];
 for (const [path, method, response] of operations) {
  const op = doc.paths[path][method];
  assert.equal(op['x-implementation-status'], 'implemented');
  assert.equal(op['x-contract-status'], 'proposed');
  assert.match(op.description, method === 'get' ? /ĐÃ TRIỂN KHAI API ĐỌC/ : /ĐÃ TRIỂN KHAI API LƯU KẾ HOẠCH/);
  assert.deepEqual(op.security, [{ bearer: [] }]);
  assert.equal(op.responses[200].content['application/json'].schema.$ref, '#/components/schemas/' + response);
  assert.ok(op.responses[200].headers['X-Request-ID']);
  assert.ok(op.responses[500]);
 }
 const input = doc.components.schemas.TripPlanInput;
 assert.equal(input.additionalProperties, false);
 assert.deepEqual(input.required, ['legs']);
 assert.equal(input.properties.legs.minItems, 1);
 assert.equal(input.properties.legs.maxItems, 50);
 const leg = doc.components.schemas.TripPlanLegInput;
 assert.equal(leg.additionalProperties, false);
 assert.ok(!leg.required.includes('id'));
 assert.ok(!leg.properties.planStatus);
 assert.equal(doc.components.schemas.TripLeg.properties.vehicleActive.nullable, true);
 const save = doc.paths['/api/v1/trips/{id}/plan'].put;
 const examples = save.requestBody.content['application/json'].examples;
 assert.ok(examples.firstSave.value.legs.every(x => x.id === undefined));
 assert.deepEqual(examples.editExisting.value.legs.map(x => x.id), ['301', '302']);
 assert.ok(save.responses[409]);
 assert.ok(!doc.paths['/api/v1/trips'].get.responses[409]);
 assert.equal(doc.paths['/api/v1/trips/{id}'].get.responses[200].content['application/json'].examples.noLegs.value.legs.length, 0);
 assert.ok(!doc.paths['/api/v1/trips'].post, 'No second Trip creation endpoint');
 assert.equal(doc.components.schemas.Error.properties.requestId.format, 'uuid');
});

test('All OpenAPI references resolve and Trip response examples match declared required fields', () => {
 function visit(value) {
  if (!value || typeof value !== 'object') return;
  if (value.$ref) {
   assert.ok(value.$ref.startsWith('#/'));
   const target = value.$ref.slice(2).split('/').reduce((o, key) => o?.[key], doc);
   assert.ok(target, value.$ref);
  }
  Object.values(value).forEach(visit);
 }
 visit(doc);
 function validate(value, schema) {
  if (schema.$ref) schema = doc.components.schemas[schema.$ref.split('/').at(-1)];
  if (value === null) { assert.ok(schema.nullable); return; }
  if (schema.type === 'object') {
   for (const key of schema.required || []) assert.ok(key in value, key);
   for (const [key, child] of Object.entries(value)) {
    assert.ok(schema.properties[key], key);
    validate(child, schema.properties[key]);
   }
  } else if (schema.type === 'array') {
   assert.ok(Array.isArray(value));
   if (schema.minItems) assert.ok(value.length >= schema.minItems);
   if (schema.maxItems) assert.ok(value.length <= schema.maxItems);
   value.forEach(item => validate(item, schema.items));
  } else if (schema.type === 'integer') {
   assert.ok(Number.isInteger(value));
   if (schema.minimum !== undefined) assert.ok(value >= schema.minimum);
  } else {
   assert.equal(typeof value, schema.type);
  }
  if (schema.enum) assert.ok(schema.enum.includes(value));
  if (schema.pattern) assert.match(value, new RegExp(schema.pattern));
  if (schema.format === 'date-time') assert.ok(!Number.isNaN(Date.parse(value)));
 }
 for (const [path, item] of Object.entries(doc.paths)) {
  if (!path.startsWith('/api/v1/trips')) continue;
  for (const op of Object.values(item)) {
   const media = op.responses[200].content['application/json'];
   for (const example of Object.values(media.examples)) validate(example.value, media.schema);
   const body = op.requestBody?.content['application/json'];
   if (body) for (const example of Object.values(body.examples)) validate(example.value, body.schema);
  }
 }
});

test('Submit plan is documented as implemented, accepted, authenticated with strict empty body',()=>{
 const op=doc.paths['/api/v1/trips/{id}/submit-plan'].post;
 assert.equal(op['x-implementation-status'],'implemented');assert.equal(op['x-contract-status'],'accepted');
 assert.deepEqual(op.security,[{bearer:[]}]);assert.equal(doc.components.schemas.SubmitTripPlanInput.additionalProperties,false);
 assert.deepEqual(doc.components.schemas.SubmitTripPlanInput.properties,{});assert.ok(op.responses[409]);
});

test('Review plan documents decisions and review metadata in TripDetail',()=>{
 const op=doc.paths['/api/v1/trips/{id}/review-plan'].post;
 assert.equal(op['x-implementation-status'],'implemented');assert.deepEqual(op.security,[{bearer:[]}]);
 assert.equal(op.requestBody.content['application/json'].schema.$ref,'#/components/schemas/ReviewTripPlanInput');
 for(const key of ['orderStatus','approvedBy','approvedAt','returnReason']) assert.ok(doc.components.schemas.TripDetail.required.includes(key));
 assert.equal(doc.components.schemas.ReviewTripPlanInput.oneOf.length,2);
});

test('Crew API documents strict input, both roles and crew-only readiness',()=>{
 for(const [path,method] of [['/api/v1/trips/{id}/assignment-options','get'],['/api/v1/trips/{id}/assignments','get'],['/api/v1/trips/{id}/assignments','put']]) {
  const op=doc.paths[path][method];assert.equal(op['x-implementation-status'],'implemented');assert.deepEqual(op.security,[{bearer:[]}]);
 }
 const input=doc.components.schemas.TripAssignmentsInput;
 assert.equal(input.additionalProperties,false);assert.equal(input.properties.assignments.items.additionalProperties,false);
 assert.equal(input.properties.assignments.minItems,2);assert.equal(input.properties.assignments.maxItems,100);
 assert.ok(doc.components.schemas.TripAssignments.properties.crewReadiness);
});

test('Readiness and mark-ready expose real endpoints, blockers and strict empty body', () => {
 const get = doc.paths['/api/v1/trips/{id}/readiness'].get;
 const post = doc.paths['/api/v1/orders/{id}/mark-ready'].post;
 assert.equal(get['x-implementation-status'], 'implemented');
 assert.ok(!get.requestBody);
 assert.match(post.description, /Manager/);
 assert.match(post.parameters[0].description, /Order/);
 assert.equal(post.responses[200].content['application/json'].schema.$ref, '#/components/schemas/MarkReadyResult');
 assert.equal(doc.components.schemas.SubmitTripPlanInput.additionalProperties, false);
 assert.ok(doc.components.schemas.Error.properties.blockers);
 assert.ok(post.responses[409]);
});
