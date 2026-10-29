require('reflect-metadata');require('ts-node').register({project:require('path').resolve(__dirname,'../tsconfig.json'),transpileOnly:true});
const assert=require('node:assert/strict'),{createServer}=require('node:http');
const {io}=require(require.resolve('socket.io-client',{paths:[require('path').resolve(__dirname,'../../web')]}));
const {SocketService}=require('../src/shared/socket/socket.service');const {TokenService}=require('../src/shared/utils/jwt.util');
(async()=>{const server=createServer(),service=new SocketService(),tokens=new TokenService('test-only-secret');const clients=[];
const db={query:async(sql,args)=>sql.includes('FROM users')?[{id:args[0],role:args[0]==='3'?'MANAGER':'CUSTOMER',account_status:'ACTIVE'}]:[{customer_id:'1'}]};
service.attach(server,tokens,undefined,db);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{for(const id of ['1','2','3']){const client=io('http://127.0.0.1:'+server.address().port,{auth:{token:tokens.sign({sub:id,email:'test@example.com',role:'CUSTOMER'})},reconnection:false});clients.push(client);await new Promise((resolve,reject)=>{client.on('connect',resolve);client.on('connect_error',reject);});}
const join=(client,id)=>new Promise((resolve,reject)=>client.timeout(2000).emit('join:order',id,(err,result)=>err?reject(err):resolve(result)));
assert.deepEqual(await join(clients[0],'1'),{ok:true});assert.deepEqual(await join(clients[1],'1'),{ok:false});assert.deepEqual(await join(clients[2],'1'),{ok:true});assert.deepEqual(await join(clients[0],{}),{ok:false});
const events=[[],[],[]];clients.forEach((c,i)=>c.on('payment:updated',e=>events[i].push(e)));
service.notifyPayment({orderId:'1',customerId:'1',paymentType:'DEPOSIT',paymentMethod:'CARD',amount:30,status:'SUCCESS',paid:30,total:100,balance:70});
await new Promise(resolve=>setTimeout(resolve,150));assert.deepEqual(events.map(e=>e.length),[1,0,1]);console.log('PASS socket ownership, manager access, malformed room ID and private event delivery.');
}finally{clients.forEach(c=>c.disconnect());await new Promise(resolve=>service.io.close(resolve));server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
