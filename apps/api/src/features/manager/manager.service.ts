import { DataSource, EntityManager } from 'typeorm';
import { Role, calculateEstimate } from '@my-project/shared';
import { User } from '../users/users.model';
import { PricingService } from '../pricing/pricing.service';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '../../shared/core/error.response';
import { parse } from '../../shared/utils/validation.util';
import { quoteSchema, quoteReviewSchema, receiptSchema, reportSchema } from './manager.validation';
import { estimateSchema } from '../pricing/pricing.validation';
const json=(v:any)=>typeof v==='string'?JSON.parse(v):v;
export function bookingEstimateInput(booking:any,horseCount:number,international:boolean){
 if(!booking)return null;
 const input={distanceKm:booking.distanceKm,vehicleClass:booking.vehicleClass,horseCount,durationDays:booking.durationDays,insurance:booking.insurance,feed:booking.feed,extraStall:booking.extraStall,international,water:booking.water,waterRounds:booking.waterRounds};
 const parsed=estimateSchema.safeParse(input);return parsed.success?parsed.data:null;
}
export function quoteAmounts(subtotal:number,adjustment:number,vatPercent:number,depositPercent:number){
 const net=subtotal+adjustment;if(net<0)throw new BadRequestException('Giảm giá vượt giá trị dự toán.');
 const vatAmount=Math.round(net*vatPercent/100),total=net+vatAmount;
 if(!Number.isSafeInteger(total))throw new BadRequestException('Giá trị báo giá vượt giới hạn.');
 return {vatAmount,total,deposit:Math.round(total*depositPercent/100)};
}
export class ManagerService {
 constructor(private db:DataSource){}
 async intake(u:User){this.allow(u);return this.db.query(`SELECT o.id,o.order_code,o.status,o.created_at,o.desired_departure_date,o.origin_country,o.destination_country,o.origin_address,o.destination_address,JSON_UNQUOTE(JSON_EXTRACT(o.booking_details,'$.sender.city')) origin_city,JSON_UNQUOTE(JSON_EXTRACT(o.booking_details,'$.recipient.city')) destination_city,JSON_UNQUOTE(JSON_EXTRACT(o.booking_details,'$.durationDays')) duration_days,u.full_name customer_name,a.status assessment_status,s.full_name specialist_name,
 (SELECT COUNT(DISTINCT l.vehicle_id) FROM legs l JOIN trips t ON t.id=l.trip_id WHERE t.order_id=o.id) vehicle_count,
 (SELECT COUNT(*) FROM horses h WHERE h.order_id=o.id AND h.order_status<>'REMOVED') horse_count,
 (SELECT COUNT(*) FROM documents d JOIN horses h ON h.id=d.horse_id WHERE h.order_id=o.id AND h.order_status<>'REMOVED') document_count,
 (SELECT COUNT(*) FROM documents d JOIN horses h ON h.id=d.horse_id WHERE h.order_id=o.id AND h.order_status<>'REMOVED' AND d.status='VALID') valid_count,
 (SELECT q.deposit FROM order_quotes q WHERE q.order_id=o.id AND q.status='APPROVED' ORDER BY q.id DESC LIMIT 1) deposit,
 (SELECT COALESCE(SUM(r.amount),0) FROM order_receipts r WHERE r.order_id=o.id) paid
 FROM orders o JOIN users u ON u.id=o.customer_id LEFT JOIN specialist_assessments a ON a.order_id=o.id LEFT JOIN users s ON s.id=a.specialist_id
 WHERE o.status<>'DRAFT' ORDER BY o.created_at DESC,o.id DESC`);}
 private allow(u:User){if(u.role!==Role.MANAGER)throw new ForbiddenException('Chỉ Manager được sử dụng chức năng này.');}
 async context(u:User,orderId:string){this.allow(u);const [order]=await this.db.query('SELECT * FROM orders WHERE id=?',[orderId]);if(!order)throw new NotFoundException('Không tìm thấy đơn.');
  const saved=json(order.booking_details)||json(order.draft_payload)?.booking;
  const booking=saved?{...saved,recipient:saved.recipient||{name:order.recipient_name,phone:order.recipient_phone}}:(order.recipient_name||order.recipient_phone?{recipient:{name:order.recipient_name,phone:order.recipient_phone}}:null);
  const [count]=await this.db.query("SELECT COUNT(*) n FROM horses WHERE order_id=? AND order_status<>'REMOVED'",[orderId]);
  const [assessment]=await this.db.query('SELECT a.*,u.full_name specialist_name FROM specialist_assessments a JOIN users u ON u.id=a.specialist_id WHERE a.order_id=?',[orderId]);
  const [staged]=await this.db.query(`SELECT COUNT(*) n FROM customer_profile_files f JOIN customer_horse_profiles p ON p.id=f.profile_id JOIN horses h ON h.passport_no=p.passport_no AND h.owner_id=p.owner_id WHERE h.order_id=? AND h.order_status<>'REMOVED' AND f.kind='DOCUMENT' AND f.id=(SELECT MAX(f2.id) FROM customer_profile_files f2 WHERE f2.profile_id=p.id AND f2.kind='DOCUMENT' AND f2.slot=f.slot)`,[orderId]);
  const input=bookingEstimateInput(booking,Number(count.n),order.origin_country!==order.destination_country);let estimate=null,estimateError=null;
  if(input){try{const current=await new PricingService(this.db).current();estimate=calculateEstimate(current.config,input,current.id);}catch{estimateError='Chưa tính được giá từ bảng giá hiện hành.';}}
  else estimateError='Đơn chưa có đủ thông tin để tính giá.';
  return {booking,input,estimate,estimateError,assessment:assessment||null,stagedDocumentCount:Number(staged.n)};
 }
 async overview(u:User){this.allow(u);const [counts]=await this.db.query(`SELECT COUNT(*) total,SUM(DATE(CONVERT_TZ(created_at,'+00:00','+07:00'))=DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+07:00'))) newToday,SUM(status='PENDING') pending,SUM(status='REJECTED') rejected,SUM(status IN ('APPROVED','PREPARING','READY','IN_TRANSIT','DELIVERED') AND YEAR(reviewed_at)=YEAR(UTC_TIMESTAMP()) AND MONTH(reviewed_at)=MONTH(UTC_TIMESTAMP())) approvedMonth FROM orders WHERE status<>'DRAFT'`);
 const [quotes]=await this.db.query("SELECT COUNT(*) pending FROM orders o WHERE o.status IN ('APPROVED','PREPARING','READY','IN_TRANSIT') AND NOT EXISTS(SELECT 1 FROM order_quotes q WHERE q.order_id=o.id AND q.status='APPROVED')");return {...counts,quotesPending:Number(quotes.pending)};}
 async queue(u:User){this.allow(u);return this.db.query(`SELECT o.id,o.order_code,o.status,o.origin_address,o.destination_address,o.origin_country,o.destination_country,u.full_name customer_name,(SELECT COUNT(*) FROM horses h WHERE h.order_id=o.id AND h.order_status<>'REMOVED') horse_count FROM orders o JOIN users u ON u.id=o.customer_id WHERE o.status IN ('APPROVED','PREPARING','READY','IN_TRANSIT','DELIVERED') ORDER BY o.reviewed_at DESC,o.id DESC LIMIT 300`);}
 async quotes(u:User,orderId:string){this.allow(u);const rows=await this.db.query('SELECT q.*,p.title pricing_title,u.full_name creator_name FROM order_quotes q JOIN pricing_versions p ON p.id=q.pricing_version_id JOIN users u ON u.id=q.created_by WHERE order_id=? ORDER BY q.id DESC',[orderId]);const receipts=await this.db.query('SELECT id,quote_id,amount,reference,method,source,received_at FROM order_receipts WHERE order_id=? ORDER BY received_at DESC,id DESC',[orderId]);return {quotes:rows.map((r:any)=>({...r,input:json(r.input),items:json(r.items)})),receipts};}
 async create(u:User,orderId:string,body:unknown){this.allow(u);const dto=parse(quoteSchema,body);return this.db.transaction(async m=>{
  const order=await this.lockOrder(m,orderId);if(!['APPROVED','PREPARING','READY','IN_TRANSIT'].includes(order.status))throw new ConflictException('Chỉ lập giá cho đơn đã duyệt và chưa hoàn tất.');
  const [count]=await m.query("SELECT COUNT(*) n FROM horses WHERE order_id=? AND order_status<>'REMOVED'",[orderId]);
  if(Number(count.n)!==dto.input.horseCount)throw new BadRequestException('Số ngựa phải khớp với đơn.');
  if(dto.input.international!==(order.origin_country!==order.destination_country))throw new BadRequestException('Loại tuyến không khớp quốc gia của đơn.');
  const [approved]=await m.query("SELECT id FROM order_quotes WHERE order_id=? AND status='APPROVED' LIMIT 1",[orderId]);if(approved)throw new ConflictException('Đơn đã có báo giá chính thức. Không ghi đè giá đã gửi khách.');
  const current=await new PricingService(this.db).current();let estimate;try{estimate=calculateEstimate(current.config,dto.input,current.id);}catch(e){throw new BadRequestException((e as Error).message);}
  const amounts=quoteAmounts(estimate.total,dto.adjustment,dto.vatPercent,estimate.depositPercent);
  const result=await m.query(`INSERT INTO order_quotes(order_id,pricing_version_id,input,items,subtotal,adjustment,adjustment_reason,vat_percent,vat_amount,total,deposit,deposit_percent,validity_hours,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[orderId,current.id,JSON.stringify(dto.input),JSON.stringify(estimate.items),estimate.total,dto.adjustment,dto.reason,dto.vatPercent,amounts.vatAmount,amounts.total,amounts.deposit,estimate.depositPercent,estimate.quoteValidityHours,u.id]);
  await this.audit(m,u,String(result.insertId),'CREATE',dto);return {id:String(result.insertId)};
 });}
 async review(u:User,id:string,body:unknown){this.allow(u);const dto=parse(quoteReviewSchema,body);return this.db.transaction(async m=>{
  const [ref]=await m.query('SELECT order_id FROM order_quotes WHERE id=?',[id]);if(!ref)throw new NotFoundException('Không tìm thấy báo giá.');
  const order=await this.lockOrder(m,String(ref.order_id));const [q]=await m.query('SELECT * FROM order_quotes WHERE id=? FOR UPDATE',[id]);
  if(!['APPROVED','PREPARING','READY','IN_TRANSIT'].includes(order.status)||q.status!=='DRAFT'||Number(q.revision)!==dto.revision)throw new ConflictException('Báo giá hoặc đơn đã thay đổi. Tải lại để tiếp tục.');
  const [other]=await m.query("SELECT id FROM order_quotes WHERE order_id=? AND status='APPROVED' LIMIT 1 FOR UPDATE",[q.order_id]);if(other)throw new ConflictException('Đơn đã có báo giá chính thức.');
  await m.query("UPDATE order_quotes SET status=?,revision=revision+1,review_note=?,approved_by=?,approved_at=IF(?='APPROVED',UTC_TIMESTAMP(3),NULL),expires_at=IF(?='APPROVED',TIMESTAMPADD(HOUR,validity_hours,UTC_TIMESTAMP(3)),NULL) WHERE id=?",[dto.decision,dto.note,u.id,dto.decision,dto.decision,id]);
  if(dto.decision==='APPROVED')await m.query("INSERT INTO notifications(recipient_id,event_type,content,related_type,related_id,channel) VALUES (?,'QUOTE_APPROVED',?,'ORDER',?,'IN_APP')",[order.customer_id,`Báo giá ${order.order_code} đã được duyệt: ${Number(q.total).toLocaleString('vi-VN')} đ. Hiệu lực ${q.validity_hours} giờ.`,order.id]);
  await this.audit(m,u,id,dto.decision,dto);return {id,status:dto.decision};
 });}
 async receipt(u:User,id:string,body:unknown){this.allow(u);const dto=parse(receiptSchema,body);if(new Date(dto.receivedAt).getTime()>Date.now()+60000)throw new BadRequestException('Ngày thu tiền không được ở tương lai.');return this.db.transaction(async m=>{
  const [ref]=await m.query('SELECT order_id FROM order_quotes WHERE id=?',[id]);if(!ref)throw new NotFoundException('Không tìm thấy báo giá.');await this.lockOrder(m,String(ref.order_id));
  const [q]=await m.query('SELECT * FROM order_quotes WHERE id=? FOR UPDATE',[id]);if(q.status!=='APPROVED')throw new ConflictException('Chỉ ghi nhận thu tiền cho báo giá đã duyệt.');
  const paidRows=await m.query('SELECT amount FROM order_receipts WHERE order_id=? FOR UPDATE',[q.order_id]);if(paidRows.reduce((sum:number,r:any)=>sum+Number(r.amount),0)+dto.amount>Number(q.total))throw new BadRequestException('Số tiền thu vượt số còn phải thanh toán.');
  const [duplicate]=await m.query('SELECT id FROM order_receipts WHERE reference=?',[dto.reference]);if(duplicate)throw new ConflictException('Mã chứng từ đã được ghi nhận.');
  const result=await m.query('INSERT INTO order_receipts(order_id,quote_id,amount,method,source,reference,received_at,recorded_by) VALUES(?,?,?,?,?,?,?,?)',[q.order_id,id,dto.amount,'MANUAL','MANUAL',dto.reference,new Date(dto.receivedAt),u.id]);await this.audit(m,u,id,'RECEIPT',dto);return {id:String(result.insertId)};
 });}
 async revenue(u:User,query:unknown){this.allow(u);const dto=parse(reportSchema,query);
  // Revenue follows the date the delivered order becomes fully paid, in Vietnam time.
  const rows=await this.db.query(`SELECT o.id,o.order_code,u.full_name customer_name,o.origin_address,o.destination_address,o.origin_country,o.destination_country,q.total,CONVERT_TZ(GREATEST(COALESCE((SELECT MAX(a.occurred_at) FROM audit_logs a WHERE a.entity_type='ORDER' AND a.entity_id=o.id AND a.new_value LIKE '%DELIVERED%'),r.paid_at),r.paid_at),'+00:00','+07:00') completed_at FROM orders o JOIN users u ON u.id=o.customer_id JOIN order_quotes q ON q.order_id=o.id AND q.status='APPROVED' JOIN (SELECT order_id,SUM(amount) paid,MAX(received_at) paid_at FROM order_receipts GROUP BY order_id) r ON r.order_id=o.id WHERE o.status='DELIVERED' AND r.paid>=q.total`);
  const yearly=rows.filter((r:any)=>new Date(r.completed_at).getUTCFullYear()===dto.year),selected=dto.month?yearly.filter((r:any)=>new Date(r.completed_at).getUTCMonth()+1===dto.month):yearly;
  const sum=(rs:any[])=>rs.reduce((s,r)=>s+Number(r.total),0);
  return {year:dto.year,month:dto.month||null,total:sum(selected),yearTotal:sum(yearly),count:selected.length,average:selected.length?Math.round(sum(selected)/selected.length):0,domestic:sum(selected.filter((r:any)=>r.origin_country===r.destination_country)),international:sum(selected.filter((r:any)=>r.origin_country!==r.destination_country)),months:Array.from({length:12},(_,i)=>({month:i+1,total:sum(yearly.filter((r:any)=>new Date(r.completed_at).getUTCMonth()===i))})),items:selected};
 }
 private async lockOrder(m:EntityManager,id:string){const [o]=await m.query('SELECT * FROM orders WHERE id=? FOR UPDATE',[id]);if(!o)throw new NotFoundException('Không tìm thấy đơn.');return o;}
 private async audit(m:EntityManager,u:User,id:string,action:string,value:unknown){await m.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,new_value,reason) VALUES (?,'QUOTE',?,?,?,?)",[u.id,id,action,JSON.stringify(value),'Quản lý báo giá vận chuyển']);}
}
