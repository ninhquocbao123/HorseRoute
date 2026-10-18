import { DocumentsRepository } from './documents.repository';
import { Logger, safeError } from '../../shared/utils/logger.util';
import { BadRequestException, ConflictException, NotFoundException } from '../../shared/core/error.response';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../users/users.model';
import { DocumentReviewDto, DossierUpdateDto } from './documents.dto';
import { Upload, saveFile, removeFile, loadFile } from './file-storage';
import { PaginationDto } from '../../shared/utils/pagination.util';
type Row=Record<string,any>;
const day=(v:Date|string|null)=>v instanceof Date?v.toISOString().slice(0,10):v?.slice(0,10)||'';
const today=()=>new Date().toISOString().slice(0,10);

export class DocumentsService {
 private timer?:ReturnType<typeof setInterval>;private expiryRun?:Promise<void>;private readonly logger=new Logger(DocumentsService.name);
 constructor(private readonly db: DataSource, private readonly repository = new DocumentsRepository()){}
 startExpiryJob(){if(this.timer)return;this.timer=setInterval(()=>void this.expireAll(),60_000);this.timer.unref();void this.expireAll();}
 async stopExpiryJob(){if(this.timer)clearInterval(this.timer);this.timer=undefined;await this.expiryRun;}
 private async audit(m:EntityManager,actor:string|null,kind:string,id:string,action:string,old:unknown,value:unknown,reason?:string){await this.repository.insertAudit(m, [actor,kind,id,action,JSON.stringify(old),JSON.stringify(value),reason||null]);}
 private async notify(m:EntityManager,order:Row,text:string){await this.repository.insertNotification(m, [order.customer_id,text.slice(0,500),order.id]);}
 async order(m:EntityManager,user:User,id:string){const [o]=await this.repository.lockOrder(m, [id]);if(!o||(o.status==='DRAFT'&&user.role!=='CUSTOMER')||(user.role==='CUSTOMER'&&String(o.customer_id)!==String(user.id)))throw new NotFoundException('Không tìm thấy đơn.');return o as Row;}
 private editable(o:Row){if(!['APPROVED','PREPARING','READY'].includes(o.status))throw new ConflictException('Chỉ xử lý hồ sơ của đơn đã duyệt, chưa vận chuyển.');}
 private async expireOrder(m:EntityManager,orderId:string){const docs:Row[]=await this.repository.lockExpiredDocuments(m, [orderId]);for(const d of docs){await this.repository.markExpired(m, [d.id]);await this.audit(m,null,'DOCUMENT',d.id,'AUTO_EXPIRE',{status:'VALID'},{status:'EXPIRED'},'Hệ thống tự cập nhật theo ngày UTC.');}}
 expireAll():Promise<void>{
  if(this.expiryRun)return this.expiryRun;
  this.expiryRun=this.runExpiry().finally(()=>{this.expiryRun=undefined;});
  return this.expiryRun;
 }
 private async runExpiry(){
  try{
   const orders=await this.repository.findOrdersWithExpiredDocuments(this.db, []);
   for(const o of orders)await this.db.transaction(async m=>{
    await this.repository.lockOrderId(m, [o.order_id]);
    await this.expireOrder(m,o.order_id);
   });
  }catch(error){this.logger.warn('expiry_job_failed',safeError(error));}
 }

 async list(user:User,p:PaginationDto){const scope=user.role==='CUSTOMER'?'AND o.customer_id=?':'';const args=user.role==='CUSTOMER'?[user.id]:[];const where=`WHERE o.status <> 'DRAFT' AND EXISTS(SELECT 1 FROM horses h JOIN documents d ON d.horse_id=h.id WHERE h.order_id=o.id) ${scope}`;const items=await this.repository.listOrders(this.db, [...args,p.limit,(p.page-1)*p.limit], where);const [count]=await this.repository.countOrders(this.db, args, where);return {items,total:Number(count.total),page:p.page,limit:p.limit};}
 async detail(user:User,id:string){return this.db.transaction(async m=>{const order=await this.order(m,user,id);await this.expireOrder(m,id);const documents=await this.repository.findChecklist(m, [id]);const versions=await this.repository.findVersions(m, [id]);const dossiers=await this.repository.findDossiers(m, [id]);const history=await this.repository.findHistory(m, [id,id]);return {order,documents,versions,dossiers,history};});}
 private async document(m:EntityManager,orderId:string,id:string){const [d]=await this.repository.lockDocument(m, [id,orderId]);if(!d)throw new NotFoundException('Không tìm thấy giấy tờ.');return d as Row;}
 private async mutable(m:EntityManager,horseId:string){const [row]=await this.repository.findSubmittedDossier(m, [horseId]);if(row)throw new ConflictException('Hồ sơ đã nộp hoặc đã được cơ quan duyệt. Chỉ bổ sung khi cơ quan yêu cầu hoặc từ chối.');}
 private async attach(m:EntityManager,user:User,file:Awaited<ReturnType<typeof saveFile>>){const result=await this.repository.insertAttachment(m, [file.name,file.type,file.size,file.key,user.id]);return String(result.insertId);}
 async upload(user:User,orderId:string,id:string,file:Upload){
 // Authorization before writing the file, and rechecked within the mutation transaction.
 await this.db.transaction(async m=>{const o=await this.order(m,user,orderId);this.editable(o);await this.document(m,orderId,id);});
 const stored=await saveFile(file);
 try{return await this.db.transaction(async m=>{const o=await this.order(m,user,orderId);this.editable(o);const d=await this.document(m,orderId,id);await this.mutable(m,d.horse_id);const [max]=await this.repository.findMaxVersion(m, [id]);const attachment=await this.attach(m,user,stored);const result=await this.repository.insertVersion(m, [id,Number(max.n)+1,attachment,user.id]);await this.repository.markSubmitted(m, [id]);await this.audit(m,user.id,'DOCUMENT',id,'UPLOAD_VERSION',{status:d.status},{status:'SUBMITTED',versionId:String(result.insertId),versionNo:Number(max.n)+1,attachmentId:attachment});const specialists=await this.repository.findSpecialists(m, []);for(const s of specialists)await this.repository.notifySpecialist(m, [s.id,`Đơn ${o.order_code}: ${d.horse_name} đã nộp ${d.document_name}.`,orderId]);return {id,versionNo:Number(max.n)+1};});}catch(e){await removeFile(stored.key);throw e;}
 }
 async review(user:User,orderId:string,id:string,dto:DocumentReviewDto){return this.db.transaction(async m=>{const o=await this.order(m,user,orderId);this.editable(o);await this.expireOrder(m,orderId);const d=await this.document(m,orderId,id);await this.mutable(m,d.horse_id);const [latest]=await this.repository.findLatestVersion(m, [id]);if(!latest||String(latest.id)!==dto.versionId)throw new ConflictException('Phiên bản đã thay đổi. Hãy tải lại hồ sơ.');if(dto.status==='INVALID'&&!dto.reason?.trim())throw new BadRequestException('Không hợp lệ phải kèm lý do.');if(dto.status==='VALID'&&d.has_expiry&&(!dto.expiryDate||dto.expiryDate<today()))throw new BadRequestException('Giấy tờ có hạn cần ngày hết hạn từ hôm nay trở đi.');if(dto.expiryDate&&dto.expiryDate<'1000-01-01')throw new BadRequestException('Ngày hết hạn không hợp lệ.');const expiry=d.has_expiry?dto.expiryDate||null:null;await this.repository.recordReview(m, [dto.status,expiry,dto.status==='INVALID'?dto.reason!.trim():null,user.id,id]);await this.audit(m,user.id,'DOCUMENT',id,'REVIEW',{status:d.status,expiryDate:d.expiry_date},{...dto,expiryDate:expiry},dto.reason);await this.notify(m,o,`${d.horse_name} / ${d.document_name}: ${dto.status==='VALID'?'hợp lệ':'không hợp lệ — '+dto.reason}.`);return {id,status:dto.status};});}
 async request(user:User,orderId:string,id:string,reason:string){return this.db.transaction(async m=>{const o=await this.order(m,user,orderId);this.editable(o);const d=await this.document(m,orderId,id);await this.audit(m,user.id,'DOCUMENT',id,'REQUEST_SUPPLEMENT',null,null,reason.trim());await this.notify(m,o,`${d.horse_name} / ${d.document_name}: ${reason.trim()}`);return {id};});}
 async updateDossier(user:User,orderId:string,id:string,dto:DossierUpdateDto,file?:Upload){
 if(dto.date>today()||dto.date<'1000-01-01')throw new BadRequestException('Ngày ghi nhận phải hợp lệ và không ở tương lai.');
 if(['NEED_INFO','REJECTED'].includes(dto.status)&&!dto.reason?.trim())throw new BadRequestException('Cần nêu lý do hoặc nội dung bổ sung.');
 if(dto.status==='SUBMITTED'&&!dto.receiptCode?.trim())throw new BadRequestException('Cần mã biên nhận khi ghi nhận đã nộp cơ quan.');
 if(dto.status==='APPROVED'&&!file)throw new BadRequestException('Cần file giấy phép khi ghi nhận cơ quan phê duyệt.');
 if(file&&dto.status!=='APPROVED')throw new BadRequestException('Chỉ đính kèm giấy phép khi ghi nhận phê duyệt.');
 await this.db.transaction(async m=>{this.editable(await this.order(m,user,orderId));});
 const stored=file?await saveFile(file):null;
 try{return await this.db.transaction(async m=>{const o=await this.order(m,user,orderId);this.editable(o);await this.expireOrder(m,orderId);const [s]=await this.repository.lockDossier(m, [id,orderId]);if(!s)throw new NotFoundException('Không tìm thấy hồ sơ.');const transitions:Record<string,string[]>={NOT_SUBMITTED:['SUBMITTED'],SUBMITTED:['REVIEWING','NEED_INFO','APPROVED','REJECTED'],REVIEWING:['NEED_INFO','APPROVED','REJECTED'],NEED_INFO:['SUBMITTED'],REJECTED:['SUBMITTED'],APPROVED:[]};if(!transitions[s.status]?.includes(dto.status))throw new ConflictException('Không thể chuyển trạng thái hồ sơ như yêu cầu.');if(s.submitted_at&&dto.date<day(s.submitted_at))throw new BadRequestException('Ngày ghi nhận không được trước ngày nộp.');if(['SUBMITTED','APPROVED'].includes(dto.status)){const docs=await this.repository.findHorseDocuments(m, [s.horse_id]);if(!docs.length||docs.some((d:Row)=>d.status!=='VALID'||(d.expiry_date&&day(d.expiry_date)<today())))throw new ConflictException('Tất cả giấy tờ trong checklist của ngựa phải hợp lệ và còn hạn.');}
 const permit=stored?await this.attach(m,user,stored):null;
 await this.repository.updateDossier(m, [dto.status,user.id,dto.status==='SUBMITTED'?dto.date:s.submitted_at,dto.status==='SUBMITTED'?dto.receiptCode!.trim():s.receipt_code,['APPROVED','REJECTED'].includes(dto.status)?dto.date:null,dto.reason?.trim()||null,dto.status==='REJECTED'?dto.reason!.trim():null,permit,id]);await this.audit(m,user.id,'DOSSIER',id,'STATUS_CHANGE',s,{...dto,permitAttachmentId:permit},dto.reason);await this.notify(m,o,`Đơn ${o.order_code}: hồ sơ cơ quan cập nhật ${dto.status}${dto.reason?' — '+dto.reason:''}.`);return {id,status:dto.status};});}catch(e){if(stored)await removeFile(stored.key);throw e;}
 }
 async download(user:User,orderId:string,id:string){const attachment=await this.db.transaction(async m=>{await this.order(m,user,orderId);const [a]=await this.repository.findOrderAttachment(m, [id,orderId,orderId]);if(!a)throw new NotFoundException('Không tìm thấy file.');return a;});return {...attachment,buffer:await loadFile(attachment.storage_path)};}
}

