import { Requirements } from '../readiness/requirements';
import {requiredHorseDocuments} from '../documents/required-horse-documents';
import { OrdersRepository } from './orders.repository';
import { BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '../../shared/core/error.response';
import { DataSource, EntityManager } from 'typeorm';
import { nextOrderCode } from './order-code';
import { Role } from '@my-project/shared';
import { User } from '../users/users.model';
import { DraftOrderDto, OrderDto, OrderQueryDto, ReviewDto } from './orders.dto';
import { parse } from '../../shared/utils/validation.util';
import { orderSchema } from './orders.validation';

type Row = Record<string, any>;
const editable = ['DRAFT','NEED_INFO'];
const dateOnly = (v: string | Date | null) => v instanceof Date ? v.toISOString().slice(0,10) : v?.slice(0,10) || '';
function fieldError(fields: Record<string,string>) { return new BadRequestException({message:'Vui lòng kiểm tra các trường được đánh dấu.',fields}); }
function dbCode(e: unknown) { const x=e as {code?:string;driverError?:{code?:string}}; return x.driverError?.code || x.code; }


export class OrdersService {
  constructor(private readonly db: DataSource, private readonly repository = new OrdersRepository()) {}

  async customerWorkspace(user:User){
    if(user.role!==Role.CUSTOMER)throw new ForbiddenException('Chỉ khách hàng được xem dữ liệu này.');
    const [orders,horses,receipts]=await Promise.all([
      this.db.query(`SELECT o.id,o.order_code,o.status,o.origin_address,o.destination_address,o.origin_country,o.destination_country,o.desired_departure_date,o.created_at,
        (SELECT COUNT(*) FROM horses h WHERE h.order_id=o.id AND h.order_status<>'REMOVED') horse_count,
        (SELECT GROUP_CONCAT(h.name ORDER BY h.id SEPARATOR ', ') FROM horses h WHERE h.order_id=o.id AND h.order_status<>'REMOVED') horse_names,
        (SELECT q.total FROM order_quotes q WHERE q.order_id=o.id AND q.status='APPROVED' ORDER BY q.id DESC LIMIT 1) quote_total,
        (SELECT COALESCE(SUM(r.amount),0) FROM order_receipts r WHERE r.order_id=o.id) paid
        FROM orders o WHERE o.customer_id=? ORDER BY o.created_at DESC,o.id DESC`,[user.id]),
      this.db.query(`SELECT h.id,h.order_id,h.name,h.passport_no,h.breed,h.birth_date,h.sex,h.coat_color,h.note,o.order_code,o.status order_status,
        (SELECT COUNT(*) FROM documents d WHERE d.horse_id=h.id) document_count,
        (SELECT COUNT(*) FROM documents d WHERE d.horse_id=h.id AND (d.status IN ('NOT_SUBMITTED','INVALID','EXPIRED') OR (d.status='VALID' AND d.expiry_date<UTC_DATE()))) missing_documents,
        (SELECT COUNT(*) FROM documents d WHERE d.horse_id=h.id AND d.status='SUBMITTED') pending_documents
        FROM horses h JOIN orders o ON o.id=h.order_id WHERE h.owner_id=? AND o.customer_id=? AND h.order_status<>'REMOVED' ORDER BY h.id DESC`,[user.id,user.id]),
      this.db.query(`SELECT r.id, r.order_id, o.order_code, r.quote_id, r.amount, r.method, r.source, r.reference, r.received_at
        FROM order_receipts r
        JOIN orders o ON o.id=r.order_id
        WHERE o.customer_id=?
        ORDER BY r.received_at DESC, r.id DESC`,[user.id])
    ]);
    return {orders,horses,receipts};
  }

  async quote(user:User,id:string){
    await this.owned(this.db.manager,user,id);
    const [q]=await this.db.query("SELECT q.id,q.input,q.items,q.adjustment,q.adjustment_reason,q.vat_percent,q.vat_amount,q.total,q.deposit,q.deposit_percent,q.expires_at,(SELECT COALESCE(SUM(amount),0) FROM order_receipts r WHERE r.order_id=q.order_id) paid FROM order_quotes q WHERE q.order_id=? AND q.status='APPROVED' ORDER BY q.id DESC LIMIT 1",[id]);
    const receipts = await this.db.query(`SELECT id, quote_id, amount, reference, method, source, received_at FROM order_receipts WHERE order_id=? ORDER BY received_at DESC, id DESC`, [id]);
    return q?{...q,input:typeof q.input==='string'?JSON.parse(q.input):q.input,items:typeof q.items==='string'?JSON.parse(q.items):q.items, receipts}:null;
  }

  async deleteDraft(user:User,id:string){
    if(user.role!==Role.CUSTOMER)throw new ForbiddenException('Chỉ Customer được xóa đơn nháp.');
    try{return await this.db.transaction(async m=>{
      const order=await this.owned(m,user,id,true);
      if(order.status!=='DRAFT')throw new ConflictException('Chỉ được xóa đơn ở trạng thái Nháp.');
      await this.audit(m,user,id,'DELETE_DRAFT',{order_code:order.order_code,status:order.status},null);
      await this.repository.deleteDraft(m,[id,user.id]);
      return {id,deleted:true};
    });}catch(e){
      if(dbCode(e)==='ER_ROW_IS_REFERENCED_2')throw new ConflictException('Đơn có dữ liệu liên quan nên không thể xóa.');
      throw e;
    }
  }

  async list(user: User, p: OrderQueryDto) {
    const clauses: string[]=[]; const args: unknown[]=[];
    if(user.role===Role.CUSTOMER){clauses.push('o.customer_id=?');args.push(user.id);}
    else {clauses.push("o.status <> 'DRAFT'");}
    if(p.group==='pending')clauses.push("o.status IN ('PENDING','NEED_INFO')");
    if(p.group==='approved')clauses.push("o.status IN ('APPROVED','PREPARING','READY','IN_TRANSIT','DELIVERED')");
    if(p.group==='documents')clauses.push("o.status IN ('APPROVED','PREPARING','READY') AND EXISTS (SELECT 1 FROM horses gh JOIN documents gd ON gd.horse_id=gh.id WHERE gh.order_id=o.id AND (gd.status IN ('NOT_SUBMITTED','INVALID','EXPIRED') OR (gd.status='VALID' AND gd.expiry_date < UTC_DATE())))");
    if(p.group==='closed')clauses.push("o.status IN ('REJECTED','CANCELLED')");
    if(p.status){clauses.push('o.status=?');args.push(p.status);}
    if(p.search?.trim()){clauses.push('(LOCATE(?,o.order_code)>0 OR EXISTS(SELECT 1 FROM users su WHERE su.id=o.customer_id AND LOCATE(?,su.full_name)>0))');args.push(p.search.trim(),p.search.trim());}
    const where=clauses.length?'WHERE '+clauses.join(' AND '):'';
    const items=await this.repository.list(this.db, [...args,p.limit,(p.page-1)*p.limit], where,user.role===Role.MANAGER);
    const [count]=await this.repository.count(this.db, args, where);
    return {items,total:Number(count.total),page:p.page,limit:p.limit};
  }

  async owned(m: EntityManager,user: User,id: string,lock=false) {
    const [order]=await this.repository.findOrder(m, [id], lock?'FOR UPDATE':'');
    if(order?.status==='DRAFT' && (user.role!==Role.CUSTOMER || String(order.customer_id)!==String(user.id))) throw new NotFoundException('Không tìm thấy đơn.');
    if(!order || (user.role===Role.CUSTOMER && String(order.customer_id)!==String(user.id))) throw new NotFoundException('Không tìm thấy đơn.');
    return order as Row;
  }

  private payload(order: Row,horses: Row[]): DraftOrderDto {
    if(order.draft_payload) return typeof order.draft_payload==='string'?JSON.parse(order.draft_payload):order.draft_payload;
    return {booking:order.booking_details?(typeof order.booking_details==='string'?JSON.parse(order.booking_details):order.booking_details):undefined,originAddress:order.origin_address||'',originCountry:order.origin_country||'',destinationAddress:order.destination_address||'',destinationCountry:order.destination_country||'',desiredDepartureDate:dateOnly(order.desired_departure_date),specialRequirements:order.special_requirements||'',horses:horses.map(h=>({id:String(h.id),name:h.name,passportNo:h.passport_no,breed:h.breed||'',birthDate:dateOnly(h.birth_date),sex:h.sex||'',coatColor:h.coat_color||'',note:h.note||''}))};
  }

  async detail(user: User,id: string) {
    const order=await this.owned(this.db.manager,user,id);
    const horses=await this.repository.findHorses(this.db, [id]);
    const documents=await this.repository.findDocuments(this.db, [id]);
    const [customer]=await this.repository.findCustomer(this.db, [order.customer_id]);
    const history=await this.repository.findHistory(this.db, [id]);
    const {draft_payload,client_request_id,...safe}=order;
    return {...safe,desired_departure_date:dateOnly(order.desired_departure_date),horses,documents,customer,history,draft:editable.includes(order.status)?this.payload(order,horses):null};
  }

  async reviewOptions(user: User,id: string) {
    const order=await this.owned(this.db.manager,user,id);
    const coordinators=await this.repository.findCoordinators(this.db, []);
    return {coordinators};
  }

  async audit(m: EntityManager,user: User,id: string,action: string,oldValue: unknown,newValue: unknown,reason?: string) {
    await this.repository.insertAudit(m, [user.id,id,action,JSON.stringify(oldValue),JSON.stringify(newValue),reason||null]);
  }
  async notify(m: EntityManager,recipient: string,id: string,event: string,content: string) {
    await this.repository.insertNotification(m, [recipient,event,content,id]);
  }

  async save(user: User,dto: DraftOrderDto,id?: string) {
    const {requestId,...payload}=dto;
    const requestedId=id;
    for(let attempt=0;attempt<10;attempt++) {
    id=requestedId;
    let inserting=false;
    try {
      return await this.db.transaction(async m=>{
        let old: Row|null=null;
        // Retries of POST return the original order, never replay an old payload over newer edits.
        if(!id && requestId){const [prior]=await this.repository.findRequest(m, [user.id,requestId]);if(prior)return {id:String(prior.id)};}
        if(id){old=await this.owned(m,user,id,true);if(!editable.includes(old.status))throw new ConflictException('Chỉ sửa đơn nháp hoặc cần bổ sung.');}
        else {
          const code=await nextOrderCode(m);
          inserting=true;
          await this.repository.insertDraft(m, [code,user.id,requestId||null]);
          inserting=false;
          const [row]=await this.repository.findByCode(m, [code]);id=String(row.id);
        }
        const previous=old?this.payload(old,await this.repository.findDraftHorses(m, [id])):null;
        // Keep incomplete values in JSON; only valid calendar dates reach MySQL DATE.
        const date=payload.desiredDepartureDate||'';
        const validDate=/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date;
        await this.repository.updateDraft(m, [payload.originAddress?.trim()||null,payload.originCountry||null,payload.destinationAddress?.trim()||null,payload.destinationCountry||null,validDate?date:null,payload.specialRequirements||null,JSON.stringify(payload),id]);
        await m.query('UPDATE orders SET booking_details=? WHERE id=?',[payload.booking?JSON.stringify(payload.booking):null,id]);
        await this.audit(m,user,id!,old?'EDIT':'CREATE',previous,payload);
        return {id};
      });
    } catch(e) {
      if(dbCode(e)==='ER_DUP_ENTRY' && inserting && !requestedId){
        if(requestId){const [prior]=await this.repository.findRetriedRequest(this.db, [user.id,requestId]);if(prior)return {id:String(prior.id)};}
        if(attempt<9)continue;
      }
      throw e;
    }
    }
    throw new ConflictException('Chưa cấp được mã đơn. Vui lòng thử lại.');
  }

  private async validated(payload: DraftOrderDto): Promise<OrderDto> {
    const clean={...payload,horses:payload.horses.map(h=>({...h,birthDate:h.birthDate||undefined}))};
    const dto=parse(orderSchema,clean);
    const fields: Record<string,string>={};
    if(dto.desiredDepartureDate<new Date().toISOString().slice(0,10))fields.desiredDepartureDate='Ngày khởi hành không được ở quá khứ (UTC).';
    const seen=new Set<string>();const ids=new Set<string>();
    dto.horses.forEach((h,i)=>{
      const passport=h.passportNo.toLocaleLowerCase();
      if(seen.has(passport))fields[`horses.${i}.passportNo`]='Định danh bị trùng trong đơn.';seen.add(passport);
      if(h.id&&ids.has(h.id))fields[`horses.${i}.name`]='Ngựa bị lặp trong đơn.';if(h.id)ids.add(h.id);
      if(h.birthDate&&h.birthDate>new Date().toISOString().slice(0,10))fields[`horses.${i}.birthDate`]='Ngày sinh không được ở tương lai.';
      if(h.birthDate&&h.birthDate<'1000-01-01')fields[`horses.${i}.birthDate`]='Ngày sinh không hợp lệ.';
    });
    if(Object.keys(fields).length)throw fieldError(fields);
    return dto;
  }

  async submit(user: User,id: string) {
    try {return await this.db.transaction(async m=>{
      const order=await this.owned(m,user,id,true);
      if(!editable.includes(order.status))throw new ConflictException('Đơn không ở trạng thái được gửi.');
      const previous=await this.repository.findSubmittedHorses(m, [id]);
      const dto=await this.validated(this.payload(order,previous));
      if(dto.booking){
        if(!dto.booking.termsAccepted)throw fieldError({booking:'Bạn cần đồng ý điều khoản vận chuyển.'});
        for(const contact of [dto.booking.sender,dto.booking.recipient])if(!contact.name||!contact.phone||!contact.address)throw fieldError({booking:'Điền đủ tên, điện thoại và địa chỉ của người gửi, người nhận.'});
        const capacity={LIGHT:2,MEDIUM:6,HEAVY:9}[dto.booking.vehicleClass];
        if(dto.horses.length>capacity)throw fieldError({booking:'Số ngựa vượt sức chứa của hạng xe.'});
      }
      const kept=new Set<string>();
      for(const [index,h] of dto.horses.entries()) {
        // IDs belong to this order only. Never accept another customer's horse ID.
        const current=h.id?previous.find((x:Row)=>String(x.id)===h.id):previous.find((x:Row)=>x.passport_no.toLowerCase()===h.passportNo.toLowerCase());
        if(h.id&&!current)throw fieldError({[`horses.${index}.name`]:'Ngựa không thuộc đơn này.'});
        if(current&&kept.has(String(current.id)))throw fieldError({[`horses.${index}.passportNo`]:'Ngựa bị lặp trong đơn.'});
        const [profile]=await m.query('SELECT * FROM customer_horse_profiles WHERE passport_no=? FOR UPDATE',[h.passportNo]);
        if(h.profileId){const [owned]=await m.query('SELECT * FROM customer_horse_profiles WHERE id=? AND owner_id=? FOR UPDATE',[h.profileId,user.id]);
          if(!owned||String(owned.passport_no).toLowerCase()!==h.passportNo.toLowerCase())throw fieldError({[`horses.${index}.passportNo`]:'Hồ sơ ngựa đã thay đổi hoặc không thuộc bạn. Hãy chọn lại.'});}
        if(profile&&String(profile.owner_id)!==String(user.id))throw fieldError({[`horses.${index}.passportNo`]:'Định danh này đã được sử dụng.'});
        if(!profile)await m.query('INSERT INTO customer_horse_profiles(owner_id,name,passport_no,payload) VALUES (?,?,?,?)',[user.id,h.name,h.passportNo,JSON.stringify(h)]);
        const [occupied]=await m.query(`SELECT o.order_code FROM horses h JOIN orders o ON o.id=h.order_id LEFT JOIN specialist_assessments a ON a.order_id=o.id WHERE h.passport_no=? AND h.owner_id=? AND h.order_status<>'REMOVED' AND o.id<>? AND o.status NOT IN ('DRAFT','DELIVERED','CANCELLED','REJECTED') AND (a.status IS NULL OR a.status<>'REJECTED') LIMIT 1 FOR UPDATE`,[h.passportNo,user.id,id]);
        if(occupied)throw new ConflictException('Ngựa '+h.name+' đang thuộc đơn '+occupied.order_code+'. Chỉ được đặt chuyến mới khi đơn trước đã hoàn thành, bị hủy hoặc từ chối.');
        if(current){
          kept.add(String(current.id));
          await this.repository.updateHorse(m, [h.name,h.passportNo,h.breed||null,h.birthDate||null,h.sex||null,h.coatColor||null,h.note||null,current.id]);
        }else await this.repository.insertHorse(m, [id,user.id,h.name,h.passportNo,h.breed||null,h.birthDate||null,h.sex||null,h.coatColor||null,h.note||null]);
      }
      for(const horse of previous)if(!kept.has(String(horse.id)))await this.repository.deleteHorse(m, [horse.id]);
      await this.repository.markPending(m, [dto.originAddress,dto.destinationAddress,id]);
      const managers=await this.repository.findManagers(m, []);
      for(const manager of managers)await this.notify(m,manager.id,id,'ORDER_SUBMITTED',`Đơn ${order.order_code} đang chờ duyệt.`);
      await this.audit(m,user,id,'SUBMIT',{status:order.status,horses:previous},{status:'PENDING',...dto});
      return {id,status:'PENDING'};
    });}catch(e){
      if(dbCode(e)==='ER_DUP_ENTRY')throw new ConflictException('Định danh ngựa vừa được dùng ở một đơn khác. Hãy kiểm tra lại.');
      if(dbCode(e)==='ER_ROW_IS_REFERENCED_2')throw new ConflictException('Không thể bỏ ngựa đã có hồ sơ hoặc lịch sử. Các thay đổi chưa được gửi.');
      throw e;
    }
  }

  async review(user: User,id: string,dto: ReviewDto) {
    if(dto.decision!=='APPROVED'&&!dto.reason?.trim())throw fieldError({reason:'Cần nêu lý do hoặc nội dung bổ sung.'});
    return this.db.transaction(async m=>{
      const order=await this.owned(m,user,id,true);
      if(order.status!=='PENDING')throw new ConflictException('Chỉ duyệt đơn đang chờ duyệt.');
      if(dto.decision==='APPROVED'){
        if(!dto.coordinatorId)throw fieldError({coordinatorId:'Chọn điều phối viên phụ trách chuyến.'});
        const [coordinator]=await this.repository.lockCoordinator(m, [dto.coordinatorId]);
        if(!coordinator)throw fieldError({coordinatorId:'Điều phối viên không hoạt động.'});
        const horses:Row[]=await this.repository.findActiveHorses(m, [id]);
        if(!horses.length||horses.some(h=>h.order_status!=='NORMAL'))throw new ConflictException('Cần xử lý ngựa bị đánh dấu trước khi duyệt.');
        // Reject obsolete schedules even when they were valid when submitted.
        if(dateOnly(order.desired_departure_date)<new Date().toISOString().slice(0,10))throw new ConflictException('Ngày khởi hành đã qua. Hãy yêu cầu khách cập nhật.');
        const snapshot: Requirements = {version:2,horses:horses.map(h=>({horseId:String(h.id),documents:[],authorityIds:[]}))};
        const types=await requiredHorseDocuments(m);
        if(types.length!==3)throw new ConflictException('Chưa cấu hình đủ 3 giấy tờ ngựa bắt buộc.');
        for(const expected of snapshot.horses){
          for(const type of types){
            expected.documents.push({documentTypeId:String(type.id),hasExpiry:Boolean(type.has_expiry)});
            await this.repository.ensureDocument(m,[expected.horseId,type.id,expected.horseId,type.id]);
          }
        }
        // Staged profile documents enter review; they are never automatically approved.
        const staged=await m.query(`SELECT d.id AS document_id,f.*,p.owner_id,JSON_UNQUOTE(JSON_EXTRACT(p.payload,'$.documentNote')) profile_note FROM documents d JOIN horses h ON h.id=d.horse_id
          JOIN customer_horse_profiles p ON p.passport_no=h.passport_no AND p.owner_id=h.owner_id
          JOIN customer_profile_files f ON f.profile_id=p.id AND f.kind='DOCUMENT' AND f.slot=CAST(d.document_type_id AS CHAR)
          WHERE h.order_id=? AND d.status='NOT_SUBMITTED' AND f.id=(SELECT MAX(f2.id) FROM customer_profile_files f2 WHERE f2.profile_id=p.id AND f2.kind='DOCUMENT' AND f2.slot=f.slot)`,[id]);
        for(const file of staged){
          const attachment=await m.query('INSERT INTO attachments(original_name,file_type,size_bytes,storage_path,uploaded_by) VALUES (?,?,?,?,?)',[file.original_name,file.file_type,file.size_bytes,file.storage_path,file.owner_id]);
          await m.query('INSERT INTO document_versions(document_id,version_no,attachment_id,uploaded_by,uploaded_at) VALUES (?,1,?,?,UTC_TIMESTAMP())',[file.document_id,attachment.insertId,file.owner_id]);
          await m.query("UPDATE documents SET status='SUBMITTED' WHERE id=?",[file.document_id]);
          await m.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,new_value,reason) VALUES (?,'DOCUMENT',?,'UPLOAD_VERSION',?,?)",[user.id,file.document_id,JSON.stringify({status:'SUBMITTED',source:'CUSTOMER_PROFILE',attachmentId:String(attachment.insertId)}),file.profile_note||null]);
        }
        {const specialists=await m.query("SELECT id FROM users WHERE role='SPECIALIST' AND account_status='ACTIVE'");for(const specialist of specialists)await this.notify(m,specialist.id,id,'DOCUMENT_SUBMITTED',`Đơn ${order.order_code} đã được quản lý duyệt, chờ tiếp nhận thẩm định.`);}
        await m.query('UPDATE orders SET requirements_snapshot=? WHERE id=?', [JSON.stringify(snapshot), id]);
        await this.repository.insertTrip(m, [id,coordinator.id]);
        await this.notify(m,coordinator.id,id,'ORDER_ASSIGNED',`Bạn phụ trách lập kế hoạch cho đơn ${order.order_code}.`);
      }
      await this.repository.recordReview(m, [dto.decision,dto.reason?.trim()||null,user.id,id]);
      const label={APPROVED:'đã được duyệt',REJECTED:'bị từ chối',NEED_INFO:'cần bổ sung thông tin'}[dto.decision];
      await this.notify(m,order.customer_id,id,'ORDER_REVIEWED',`Đơn ${order.order_code} ${label}. Mở chi tiết để xem phản hồi.`);
      await this.audit(m,user,id,'REVIEW',{status:order.status},{status:dto.decision,coordinatorId:dto.coordinatorId},dto.reason);
      return {id,status:dto.decision};
    });
  }
}

