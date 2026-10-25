import {requiredHorseDocuments} from '../documents/required-horse-documents';
import { DataSource } from 'typeorm';
import { User } from '../users/users.model';
import { z } from 'zod';
import { profileSchema } from './customer.validation';
import { BadRequestException,ConflictException,NotFoundException } from '../../shared/core/error.response';
import { fileType,loadFile,removeFile,saveFile,Upload } from '../documents/file-storage';
export class CustomerService {
 constructor(private db:DataSource){}
 async owned(user:User,id:string){const [row]=await this.db.query('SELECT * FROM customer_horse_profiles WHERE id=? AND owner_id=?',[id,user.id]);if(!row)throw new NotFoundException('Không tìm thấy hồ sơ ngựa.');return row;}
 async list(user:User){
  const rows=await this.db.query(`SELECT p.id,p.payload,p.revision,
   (SELECT o.id FROM horses h JOIN orders o ON o.id=h.order_id LEFT JOIN specialist_assessments a ON a.order_id=o.id WHERE h.owner_id=p.owner_id AND h.passport_no=p.passport_no AND h.order_status<>'REMOVED' AND o.status NOT IN ('DRAFT','DELIVERED','CANCELLED','REJECTED') AND (a.status IS NULL OR a.status<>'REJECTED') ORDER BY o.id DESC LIMIT 1) active_order_id,
   (SELECT o.order_code FROM horses h JOIN orders o ON o.id=h.order_id LEFT JOIN specialist_assessments a ON a.order_id=o.id WHERE h.owner_id=p.owner_id AND h.passport_no=p.passport_no AND h.order_status<>'REMOVED' AND o.status NOT IN ('DRAFT','DELIVERED','CANCELLED','REJECTED') AND (a.status IS NULL OR a.status<>'REJECTED') ORDER BY o.id DESC LIMIT 1) active_order_code
   FROM customer_horse_profiles p WHERE p.owner_id=? AND NOT EXISTS(SELECT 1 FROM horses h JOIN orders o ON o.id=h.order_id WHERE h.owner_id=p.owner_id AND h.passport_no=p.passport_no AND h.order_status<>'REMOVED' AND o.status='IN_TRANSIT') ORDER BY p.id`,[user.id]);
  const files=await this.db.query('SELECT f.id,f.profile_id,f.kind,f.slot,f.original_name,f.file_type,f.created_at FROM customer_profile_files f JOIN customer_horse_profiles p ON p.id=f.profile_id WHERE p.owner_id=? ORDER BY f.id DESC',[user.id]);
  const documents=await this.db.query(`SELECT p.id profile_id,d.id,d.document_type_id,d.status,d.invalid_reason,d.expiry_date,h.order_id,o.order_code,o.status order_status,
   (SELECT v.attachment_id FROM document_versions v WHERE v.document_id=d.id ORDER BY v.version_no DESC LIMIT 1) attachment_id
   FROM customer_horse_profiles p JOIN horses h ON h.passport_no=p.passport_no AND h.owner_id=p.owner_id
   JOIN orders o ON o.id=h.order_id JOIN documents d ON d.horse_id=h.id WHERE p.owner_id=? ORDER BY o.id DESC`,[user.id]);
  return rows.map((r:any)=>({...(typeof r.payload==='string'?JSON.parse(r.payload):r.payload),id:String(r.id),revision:r.revision,activeOrderId:r.active_order_id?String(r.active_order_id):null,activeOrderCode:r.active_order_code||null,documents:documents.filter((d:any)=>String(d.profile_id)===String(r.id)),files:files.filter((f:any)=>String(f.profile_id)===String(r.id))}));
 }
 async save(user:User,data:z.infer<typeof profileSchema>,id?:string){
  if(data.birthDate&&data.birthDate>new Date().toISOString().slice(0,10))throw new BadRequestException('Ngày sinh không được ở tương lai.');
  const {revision,...payload}=data;
  try{return await this.db.transaction(async m=>{
   if(id){const [old]=await m.query('SELECT * FROM customer_horse_profiles WHERE id=? AND owner_id=? FOR UPDATE',[id,user.id]);if(!old)throw new NotFoundException('Không tìm thấy hồ sơ ngựa.');if(old.passport_no&&old.passport_no!==payload.passportNo)throw new ConflictException('Không đổi số hộ chiếu của hồ sơ đã định danh.');if(old.revision!==revision)throw new ConflictException('Hồ sơ đã thay đổi. Hãy tải lại.');
    await m.query('UPDATE customer_horse_profiles SET name=?,passport_no=?,payload=?,revision=revision+1,updated_at=UTC_TIMESTAMP() WHERE id=?',[payload.name,payload.passportNo||null,JSON.stringify(payload),id]);
   }else{const r=await m.query('INSERT INTO customer_horse_profiles(owner_id,name,passport_no,payload) VALUES (?,?,?,?)',[user.id,payload.name,payload.passportNo||null,JSON.stringify(payload)]);id=String(r.insertId);}
   return {id};
  });}catch(e:any){if((e.code||e.driverError?.code)==='ER_DUP_ENTRY')throw new ConflictException('Số hộ chiếu đã có hồ sơ. Hãy kiểm tra lại.');throw e;}
 }
 async upload(user:User,id:string,kind:'PHOTO'|'DOCUMENT',slot:string,file:Upload){
  await this.owned(user,id);
  if(kind==='PHOTO'&&!['left','right','front','other'].includes(slot))throw new BadRequestException('Góc ảnh không hợp lệ.');
  if(kind==='DOCUMENT'){const [type]=await this.db.query('SELECT id FROM document_types WHERE id=?',[slot]);if(!type)throw new BadRequestException('Loại giấy tờ không hợp lệ.');}
  if(kind==='PHOTO'&&fileType(file)==='PDF')throw new BadRequestException('Ảnh ngựa cần định dạng JPG hoặc PNG.');
  const saved=await saveFile(file);
  try{const r=await this.db.query('INSERT INTO customer_profile_files(profile_id,kind,slot,original_name,file_type,size_bytes,storage_path) VALUES (?,?,?,?,?,?,?)',[id,kind,slot,saved.name,saved.type,saved.size,saved.key]);return {id:String(r.insertId)};}catch(e){await removeFile(saved.key);throw e;}
 }
 async download(user:User,id:string){const [f]=await this.db.query('SELECT f.* FROM customer_profile_files f JOIN customer_horse_profiles p ON p.id=f.profile_id WHERE f.id=? AND p.owner_id=?',[id,user.id]);if(!f)throw new NotFoundException('Không tìm thấy file.');return {...f,buffer:await loadFile(f.storage_path)};}
 async documentTypes(){return requiredHorseDocuments(this.db);}
}
