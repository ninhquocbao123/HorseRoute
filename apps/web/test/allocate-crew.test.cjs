const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require('../../api/node_modules/typescript');
const source=ts.transpileModule(fs.readFileSync(require('node:path').resolve(__dirname,'../src/modules/trips/utils/allocate-crew.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const out={};vm.runInNewContext(source,{exports:out,Set,Error});
const {allocateCrew,crewQuota}=out;
const people=[{userId:'1',role:'DRIVER'},{userId:'2',role:'ESCORT'},{userId:'3',role:'DRIVER'},{userId:'4',role:'ESCORT'}];
const car=id=>({vehicleId:id,horseCount:1,crew:[]});
const plain=x=>JSON.parse(JSON.stringify(x));
test('people before vehicles preserved; missing/excess quotas',()=>{
 assert.match(crewQuota(0,people),/Chưa chọn/);assert.match(crewQuota(3,people),/Thiếu/);assert.match(crewQuota(1,[...people,{userId:'5',role:'DRIVER'}]),/Thừa/);
 assert.equal(people.length,4);
});
test('keeps old team and moves second members to cover new vehicle',()=>{
 const old=[{...car('10'),crew:people}];const result=allocateCrew([car('10'),car('20')],people,old);
 assert.deepEqual(plain(result[0].crew),people.slice(0,2));assert.equal(result[1].crew.length,2);
 assert.deepEqual(plain(allocateCrew([car('10'),car('20')],people,result)),plain(result));
 assert.deepEqual(old[0].crew,people);
});
test('replacement uses exactly selected people; stable across input ordering',()=>{
 const old=[{...car('10'),crew:people}];const result=allocateCrew([car('20')],people,old);
 assert.deepEqual(result.flatMap(v=>v.crew.map(p=>p.userId)).sort(),['1','2','3','4']);
 assert.deepEqual(plain(allocateCrew([car('20')],[...people].reverse(),old)),plain(result));
 assert.throws(()=>allocateCrew([car('20')],[people[0],people[0]],old),/một lần/);
});
test('existing distinct teams survive unchanged',()=>{
 const old=[{...car('10'),crew:people.slice(0,2)},{...car('20'),crew:people.slice(2)}];
 assert.deepEqual(plain(allocateCrew(old,people,old)),old);
});

test('API response metadata never leaks into strict assignment input',()=>{
 const old=[{...car('10'),id:'999',plateNumber:'ABC',crew:people.map(p=>({...p,fullName:'Name',assignedAt:'date',workStatus:'RESERVED'}))}];
 const result=allocateCrew([car('10')],people,old);
 assert.deepEqual(Object.keys(result[0]).sort(),['crew','horseCount','vehicleId']);
 for(const p of result[0].crew)assert.deepEqual(Object.keys(p).sort(),['role','userId']);
});
