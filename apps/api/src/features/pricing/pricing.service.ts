import { DataSource, EntityManager } from 'typeorm';
import { Role, calculateEstimate, type PricingConfig, type PricingVersion, type EstimateInput } from '@my-project/shared';
import { User } from '../users/users.model';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '../../shared/core/error.response';
import { parse } from '../../shared/utils/validation.util';
import { draftPricingSchema, updatePricingSchema, publishPricingSchema, estimateSchema, pricingConfigSchema } from './pricing.validation';
type Row=Record<string,any>;
const iso=(v:Date|string|null)=>v ? (v instanceof Date?v:new Date(v)).toISOString() : null;
export class PricingService {
 constructor(private readonly db:DataSource){}
 private manager(user:User){if(user.role!==Role.MANAGER)throw new ForbiddenException('Chỉ Manager được quản lý bảng giá.');}
 private map(row:Row):PricingVersion{return {id:String(row.id),title:row.title,note:row.note,status:row.status,revision:Number(row.revision),config:parse(pricingConfigSchema,typeof row.config==='string'?JSON.parse(row.config):row.config),effectiveFrom:iso(row.effective_from),publishedAt:iso(row.published_at),createdAt:iso(row.created_at)!,updatedAt:iso(row.updated_at)!,createdByName:row.creator_name||null,publishedByName:row.publisher_name||null};}
 async current(){
  const [row]=await this.db.query("SELECT * FROM pricing_versions WHERE status='PUBLISHED' AND effective_from<=UTC_TIMESTAMP(3) ORDER BY effective_from DESC,id DESC LIMIT 1");
  if(!row)throw new ServiceUnavailableException('Chưa có bảng giá đang hiệu lực. Vui lòng liên hệ để được báo giá.');
  const version=this.map(row);
  return {id:version.id,title:version.title,effectiveFrom:version.effectiveFrom,config:version.config};
 }
 async list(user:User){this.manager(user);const rows=await this.db.query('SELECT p.*,c.full_name creator_name,u.full_name publisher_name FROM pricing_versions p LEFT JOIN users c ON c.id=p.created_by LEFT JOIN users u ON u.id=p.published_by ORDER BY p.id DESC LIMIT 100');return rows.map((r:Row)=>this.map(r));}
 async create(user:User,body:unknown){this.manager(user);const dto=parse(draftPricingSchema,body);return this.db.transaction(async m=>{
  const result=await m.query('INSERT INTO pricing_versions(title,note,config,created_by,updated_by) VALUES (?,?,?,?,?)',[dto.title,dto.note,JSON.stringify(dto.config),user.id,user.id]);
  const id=String(result.insertId);await this.audit(m,user,id,'CREATE_DRAFT',null,dto);return {id,revision:1};
 });}
 async update(user:User,id:string,body:unknown){this.manager(user);const dto=parse(updatePricingSchema,body);return this.db.transaction(async m=>{
  const row=await this.lockDraft(m,id,dto.revision);
  await m.query('UPDATE pricing_versions SET title=?,note=?,config=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?',[dto.title,dto.note,JSON.stringify(dto.config),user.id,id]);
  await this.audit(m,user,id,'UPDATE_DRAFT',this.map(row),dto);return {id,revision:dto.revision+1};
 });}
 async publish(user:User,id:string,body:unknown){this.manager(user);const dto=parse(publishPricingSchema,body);return this.db.transaction(async m=>{
  await m.query('SELECT id FROM pricing_publish_lock WHERE id=1 FOR UPDATE');
  const row=await this.lockDraft(m,id,dto.revision);parse(pricingConfigSchema,typeof row.config==='string'?JSON.parse(row.config):row.config);
  const [clock]=await m.query('SELECT UTC_TIMESTAMP(3) now');const now=new Date(clock.now),effective=dto.effectiveFrom?new Date(dto.effectiveFrom):now;
  if(effective.getTime()<now.getTime())throw new BadRequestException('Ngày hiệu lực không được ở quá khứ.');
  const date=effective.toISOString().slice(0,23).replace('T',' ');
  const [duplicate]=await m.query("SELECT id FROM pricing_versions WHERE effective_from=?",[date]);
  if(duplicate)throw new ConflictException('Đã có bảng giá ở thời điểm này. Chọn thời điểm khác.');
  await m.query("UPDATE pricing_versions SET status='PUBLISHED',effective_from=?,published_at=UTC_TIMESTAMP(3),published_by=?,updated_by=?,updated_at=UTC_TIMESTAMP(3),revision=revision+1 WHERE id=?",[date,user.id,user.id,id]);
  await this.audit(m,user,id,'PUBLISH',null,{effectiveFrom:effective.toISOString(),revision:dto.revision+1});
  return {id,effectiveFrom:effective.toISOString(),revision:dto.revision+1};
 });}
 // Shared calculator returns the base fare and excess-kilometre charge separately.
 async estimate(body:unknown){const input=parse(estimateSchema,body) as EstimateInput;const current=await this.current();try{return calculateEstimate(current.config as PricingConfig,input,current.id);}catch(e){throw new BadRequestException(e instanceof Error?e.message:'Không tính được dự toán.');}}
 private async lockDraft(m:EntityManager,id:string,revision:number){
  const [row]=await m.query('SELECT * FROM pricing_versions WHERE id=? FOR UPDATE',[id]);
  if(!row)throw new NotFoundException('Không tìm thấy phiên bản bảng giá.');
  if(row.status!=='DRAFT')throw new ConflictException('Bảng giá đã áp dụng không thể chỉnh sửa. Hãy tạo phiên bản mới.');
  if(Number(row.revision)!==revision)throw new ConflictException('Bản nháp đã được người khác thay đổi. Tải lại trước khi tiếp tục.');return row;
 }
 private async audit(m:EntityManager,user:User,id:string,action:string,old:unknown,value:unknown){await m.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value,reason) VALUES (?,'PRICING',?,?,?,?,?)",[user.id,id,action,old?JSON.stringify(old):null,JSON.stringify(value),'Quản lý bảng giá theo phiên bản']);}
}
