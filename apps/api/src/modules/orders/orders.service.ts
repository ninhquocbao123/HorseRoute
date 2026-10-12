import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Role } from '@my-project/shared';
import { User } from '../users/entities/user.entity';
import { DraftOrderDto, OrderDto, OrderQueryDto, ReviewDto } from './orders.dto';
import { validationException } from '../../common/dto/validation-errors';

type Row = Record<string, any>;
const editable = ['DRAFT','NEED_INFO'];
const dateOnly = (v: string | Date | null) => v instanceof Date ? v.toISOString().slice(0,10) : v?.slice(0,10) || '';
function fieldError(fields: Record<string,string>) { return new BadRequestException({message:'Vui lòng kiểm tra các trường được đánh dấu.',fields}); }
function dbCode(e: unknown) { const x=e as {code?:string;driverError?:{code?:string}}; return x.driverError?.code || x.code; }

@Injectable()
export class OrdersService {
  constructor(private readonly db: DataSource) {}

  async list(user: User, p: OrderQueryDto) {
    const clauses: string[]=[]; const args: unknown[]=[];
    if(user.role===Role.CUSTOMER){clauses.push('o.customer_id=?');args.push(user.id);}
    if(p.status){clauses.push('o.status=?');args.push(p.status);}
    if(p.search?.trim()){clauses.push('LOCATE(?,o.order_code)>0');args.push(p.search.trim());}
    const where=clauses.length?'WHERE '+clauses.join(' AND '):'';
    const items=await this.db.query(`SELECT o.id,o.order_code,o.status,o.origin_country,o.destination_country,o.desired_departure_date,o.created_at,u.full_name AS customer_name FROM orders o JOIN users u ON u.id=o.customer_id ${where} ORDER BY o.created_at DESC,o.id DESC LIMIT ? OFFSET ?`,[...args,p.limit,(p.page-1)*p.limit]);
    const [count]=await this.db.query(`SELECT COUNT(*) AS total FROM orders o ${where}`,args);
    return {items,total:Number(count.total),page:p.page,limit:p.limit};
  }

  async owned(m: EntityManager,user: User,id: string,lock=false) {
    const [order]=await m.query(`SELECT * FROM orders WHERE id=? ${lock?'FOR UPDATE':''}`,[id]);
    if(!order || (user.role===Role.CUSTOMER && String(order.customer_id)!==String(user.id))) throw new NotFoundException('Không tìm thấy đơn.');
    return order as Row;
  }

  private payload(order: Row,horses: Row[]): DraftOrderDto {
    if(order.draft_payload) return typeof order.draft_payload==='string'?JSON.parse(order.draft_payload):order.draft_payload;
    return {originAddress:order.origin_address||'',originCountry:order.origin_country||'',destinationAddress:order.destination_address||'',destinationCountry:order.destination_country||'',desiredDepartureDate:dateOnly(order.desired_departure_date),specialRequirements:order.special_requirements||'',horses:horses.map(h=>({id:String(h.id),name:h.name,passportNo:h.passport_no,breed:h.breed||'',birthDate:dateOnly(h.birth_date),sex:h.sex||'',coatColor:h.coat_color||'',note:h.note||''}))};
  }

  async detail(user: User,id: string) {
    const order=await this.owned(this.db.manager,user,id);
    const horses=await this.db.query('SELECT * FROM horses WHERE order_id=? ORDER BY id',[id]);
    const documents=await this.db.query('SELECT d.*,dt.name AS document_name,h.name AS horse_name FROM documents d JOIN document_types dt ON dt.id=d.document_type_id JOIN horses h ON h.id=d.horse_id WHERE h.order_id=? ORDER BY h.id,d.id',[id]);
    const [customer]=await this.db.query('SELECT full_name,email,phone,organization_name FROM users WHERE id=?',[order.customer_id]);
    const history=await this.db.query("SELECT a.id,a.occurred_at,a.action,a.reason,u.full_name AS actor_name FROM audit_logs a JOIN users u ON u.id=a.actor_id WHERE a.entity_type='ORDER' AND a.entity_id=? ORDER BY a.occurred_at DESC,a.id DESC LIMIT 100",[id]);
    const {draft_payload,client_request_id,...safe}=order;
    return {...safe,desired_departure_date:dateOnly(order.desired_departure_date),horses,documents,customer,history,draft:editable.includes(order.status)?this.payload(order,horses):null};
  }

  async reviewOptions(user: User,id: string) {
    const order=await this.owned(this.db.manager,user,id);
    const coordinators=await this.db.query("SELECT id,full_name FROM users WHERE role='COORDINATOR' AND account_status='ACTIVE' ORDER BY full_name");
    const rules=await this.db.query('SELECT q.id,q.border_location_id,l.name AS border_name,a.name AS authority_name FROM quarantine_rules q LEFT JOIN locations l ON l.id=q.border_location_id LEFT JOIN authorities a ON a.id=q.authority_id WHERE q.origin_country=? AND q.destination_country=? ORDER BY q.id',[order.origin_country,order.destination_country]);
    return {coordinators,rules};
  }

  async audit(m: EntityManager,user: User,id: string,action: string,oldValue: unknown,newValue: unknown,reason?: string) {
    await m.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value,reason) VALUES (?,'ORDER',?,?,?,?,?)",[user.id,id,action,JSON.stringify(oldValue),JSON.stringify(newValue),reason||null]);
  }
  async notify(m: EntityManager,recipient: string,id: string,event: string,content: string) {
    await m.query("INSERT INTO notifications(recipient_id,event_type,content,related_type,related_id,channel) VALUES (?,?,?,'ORDER',?,'IN_APP')",[recipient,event,content,id]);
  }

  async save(user: User,dto: DraftOrderDto,id?: string) {
    const {requestId,...payload}=dto;
    try {
      return await this.db.transaction(async m=>{
        let old: Row|null=null;
        // Retries of POST return the original order, never replay an old payload over newer edits.
        if(!id && requestId){const [prior]=await m.query('SELECT id FROM orders WHERE customer_id=? AND client_request_id=?',[user.id,requestId]);if(prior)return {id:String(prior.id)};}
        if(id){old=await this.owned(m,user,id,true);if(!editable.includes(old.status))throw new ConflictException('Chỉ sửa đơn nháp hoặc cần bổ sung.');}
        else {
          const code='WDP-'+randomUUID().replace(/-/g,'').slice(0,16);
          await m.query("INSERT INTO orders(order_code,customer_id,client_request_id) VALUES (?,?,?)",[code,user.id,requestId||null]);
          const [row]=await m.query('SELECT id FROM orders WHERE order_code=?',[code]);id=String(row.id);
        }
        const previous=old?this.payload(old,await m.query('SELECT * FROM horses WHERE order_id=?',[id])):null;
        // Keep incomplete values in JSON; only valid calendar dates reach MySQL DATE.
        const date=payload.desiredDepartureDate||'';
        const validDate=/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date;
        await m.query('UPDATE orders SET origin_address=?,origin_country=?,destination_address=?,destination_country=?,desired_departure_date=?,special_requirements=?,draft_payload=? WHERE id=?',[payload.originAddress?.trim()||null,payload.originCountry||null,payload.destinationAddress?.trim()||null,payload.destinationCountry||null,validDate?date:null,payload.specialRequirements||null,JSON.stringify(payload),id]);
        await this.audit(m,user,id!,old?'EDIT':'CREATE',previous,payload);
        return {id};
      });
    } catch(e) {
      if(dbCode(e)==='ER_DUP_ENTRY' && requestId && !id){const [prior]=await this.db.query('SELECT id FROM orders WHERE customer_id=? AND client_request_id=?',[user.id,requestId]);if(prior)return {id:String(prior.id)};}
      throw e;
    }
  }

  private async validated(payload: DraftOrderDto): Promise<OrderDto> {
    const clean={...payload,horses:payload.horses.map(h=>({...h,birthDate:h.birthDate||undefined}))};
    const dto=plainToInstance(OrderDto,clean);
    const errors=await validate(dto,{whitelist:true,forbidNonWhitelisted:true});
    if(errors.length)throw validationException(errors);
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
      const previous=await m.query('SELECT * FROM horses WHERE order_id=? ORDER BY id',[id]);
      const dto=await this.validated(this.payload(order,previous));
      const kept=new Set<string>();
      for(const [index,h] of dto.horses.entries()) {
        // IDs belong to this order only. Never accept another customer's horse ID.
        const current=h.id?previous.find((x:Row)=>String(x.id)===h.id):previous.find((x:Row)=>x.passport_no.toLowerCase()===h.passportNo.toLowerCase());
        if(h.id&&!current)throw fieldError({[`horses.${index}.name`]:'Ngựa không thuộc đơn này.'});
        if(current&&kept.has(String(current.id)))throw fieldError({[`horses.${index}.passportNo`]:'Ngựa bị lặp trong đơn.'});
        const [duplicate]=await m.query('SELECT id FROM horses WHERE passport_no=? AND id<>?',[h.passportNo,current?.id||'0']);
        if(duplicate)throw fieldError({[`horses.${index}.passportNo`]:'Định danh này đã được sử dụng.'});
        if(current){
          kept.add(String(current.id));
          await m.query('UPDATE horses SET name=?,passport_no=?,breed=?,birth_date=?,sex=?,coat_color=?,note=? WHERE id=?',[h.name,h.passportNo,h.breed||null,h.birthDate||null,h.sex||null,h.coatColor||null,h.note||null,current.id]);
        }else await m.query('INSERT INTO horses(order_id,owner_id,name,passport_no,breed,birth_date,sex,coat_color,note) VALUES (?,?,?,?,?,?,?,?,?)',[id,user.id,h.name,h.passportNo,h.breed||null,h.birthDate||null,h.sex||null,h.coatColor||null,h.note||null]);
      }
      for(const horse of previous)if(!kept.has(String(horse.id)))await m.query('DELETE FROM horses WHERE id=?',[horse.id]);
      await m.query("UPDATE orders SET status='PENDING',origin_address=?,destination_address=?,submitted_at=UTC_TIMESTAMP(),response_deadline=NULL,draft_payload=NULL WHERE id=?",[dto.originAddress,dto.destinationAddress,id]);
      const managers=await m.query("SELECT id FROM users WHERE role='MANAGER' AND account_status='ACTIVE'");
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
        const [coordinator]=await m.query("SELECT id FROM users WHERE id=? AND role='COORDINATOR' AND account_status='ACTIVE' FOR UPDATE",[dto.coordinatorId]);
        if(!coordinator)throw fieldError({coordinatorId:'Điều phối viên không hoạt động.'});
        const rules:Row[]=await m.query('SELECT * FROM quarantine_rules WHERE origin_country=? AND destination_country=? FOR UPDATE',[order.origin_country,order.destination_country]);
        const selected=new Set(dto.ruleIds||[]);
        if(!selected.size||[...selected].some(key=>!rules.some(r=>String(r.id)===key)))throw fieldError({ruleIds:'Chọn quy định thuộc đúng cặp quốc gia của đơn.'});
        const applicable=rules.filter(r=>selected.has(String(r.id)));
        // Include every general rule; permit at most one border context before detailed routing.
        if(rules.some(r=>r.border_location_id===null&&!selected.has(String(r.id))))throw fieldError({ruleIds:'Cần chọn đủ quy định chung của cặp quốc gia.'});
        const borders=new Set(applicable.filter(r=>r.border_location_id!==null).map(r=>String(r.border_location_id)));
        if(borders.size>1)throw fieldError({ruleIds:'Chỉ chọn quy định của một cửa khẩu cho lần duyệt này.'});
        const horses:Row[]=await m.query("SELECT * FROM horses WHERE order_id=? AND order_status<>'REMOVED'",[id]);
        if(!horses.length||horses.some(h=>h.order_status!=='NORMAL'))throw new ConflictException('Cần xử lý ngựa bị đánh dấu trước khi duyệt.');
        // Reject obsolete schedules even when they were valid when submitted.
        if(dateOnly(order.desired_departure_date)<new Date().toISOString().slice(0,10))throw new ConflictException('Ngày khởi hành đã qua. Hãy yêu cầu khách cập nhật.');
        for(const rule of applicable){
          if(!rule.authority_id)throw new ConflictException('Quy định chưa có cơ quan tiếp nhận.');
          const types=await m.query('SELECT document_type_id FROM quarantine_rule_doctypes WHERE rule_id=?',[rule.id]);
          if(!types.length)throw new ConflictException('Quy định chưa có danh sách giấy tờ.');
          for(const horse of horses){
            for(const type of types)await m.query('INSERT INTO documents(horse_id,document_type_id) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM documents WHERE horse_id=? AND document_type_id=?)',[horse.id,type.document_type_id,horse.id,type.document_type_id]);
            await m.query('INSERT INTO dossiers(horse_id,authority_id) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM dossiers WHERE horse_id=? AND authority_id=?)',[horse.id,rule.authority_id,horse.id,rule.authority_id]);
          }
        }
        await m.query('INSERT INTO trips(order_id,planned_by) VALUES (?,?)',[id,coordinator.id]);
        await this.notify(m,coordinator.id,id,'ORDER_ASSIGNED',`Bạn phụ trách lập kế hoạch cho đơn ${order.order_code}.`);
      }
      await m.query('UPDATE orders SET status=?,manager_note=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?',[dto.decision,dto.reason?.trim()||null,user.id,id]);
      const label={APPROVED:'đã được duyệt',REJECTED:'bị từ chối',NEED_INFO:'cần bổ sung thông tin'}[dto.decision];
      await this.notify(m,order.customer_id,id,'ORDER_REVIEWED',`Đơn ${order.order_code} ${label}. Mở chi tiết để xem phản hồi.`);
      await this.audit(m,user,id,'REVIEW',{status:order.status},{status:dto.decision,coordinatorId:dto.coordinatorId,ruleIds:dto.ruleIds},dto.reason);
      return {id,status:dto.decision};
    });
  }
}
