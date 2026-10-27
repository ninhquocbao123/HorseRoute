import {createHmac,timingSafeEqual} from 'crypto';
import {ConflictException} from '../../shared/core/error.response';
export type VnpParams=Record<string,string>;
const encode=(s:string)=>encodeURIComponent(s).replace(/%20/g,'+');
export const canonical=(p:VnpParams)=>Object.keys(p).sort().map(k=>encode(k)+'='+encode(p[k])).join('&');
export const sign=(p:VnpParams,secret:string)=>createHmac('sha512',secret).update(canonical(p)).digest('hex');
export function vnpConfig(){
 const tmn=process.env.VNPAY_TMN_CODE,secret=process.env.VNPAY_HASH_SECRET,returnUrl=process.env.VNPAY_RETURN_URL;
 if(!tmn||!secret||!returnUrl)throw new ConflictException('Chưa cấu hình tài khoản VNPAY Sandbox. Cần TmnCode, HashSecret và Return URL ở backend.');
 const url=new URL(returnUrl);if(!['http:','https:'].includes(url.protocol))throw new ConflictException('Return URL không hợp lệ.');
 return {tmn,secret,returnUrl};
}
export function vnpDate(date:Date){return new Date(date.getTime()+7*60*60*1000).toISOString().replace(/[-:T]/g,'').slice(0,14);}
export function verifyVnp(query:unknown):VnpParams|null{
 const {secret,tmn}=vnpConfig();if(!query||typeof query!=='object')return null;
 const p:VnpParams={};let hash='';
 for(const [key,value] of Object.entries(query)){if(typeof value!=='string')return null;if(key==='vnp_SecureHash')hash=value;else if(key!=='vnp_SecureHashType'){if(!key.startsWith('vnp_'))return null;p[key]=value;}}
 if(!/^[a-f0-9]{128}$/i.test(hash)||p.vnp_TmnCode!==tmn)return null;
 return timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(sign(p,secret),'hex'))?p:null;
}
export function paymentUrl(ref:string,amount:number,ip:string){
 const {tmn,secret,returnUrl}=vnpConfig();const now=new Date();
 const p:VnpParams={vnp_Version:'2.1.0',vnp_Command:'pay',vnp_TmnCode:tmn,vnp_Amount:String(amount*100),vnp_CurrCode:'VND',vnp_TxnRef:ref,vnp_OrderInfo:'Thanh toan don van chuyen '+ref,vnp_OrderType:'other',vnp_Locale:'vn',vnp_ReturnUrl:returnUrl,vnp_IpAddr:ip.replace(/^::ffff:/,'')==='::1'?'127.0.0.1':ip.replace(/^::ffff:/,''),vnp_CreateDate:vnpDate(now),vnp_ExpireDate:vnpDate(new Date(now.getTime()+15*60*1000))};
 return 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?'+canonical(p)+'&vnp_SecureHash='+sign(p,secret);
}
