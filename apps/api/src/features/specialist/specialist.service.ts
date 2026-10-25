import { DataSource } from 'typeorm';
import { User } from '../users/users.model';
import { DocumentsService } from '../documents/documents.service';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '../../shared/core/error.response';
import { loadFile } from '../documents/file-storage';
import { socketService } from '../../shared/socket/socket.service';

type Row=Record<string,any>;
const json=(value:any)=>typeof value==='string'?JSON.parse(value):value;
const active=['APPROVED','PREPARING','READY'];

export class SpecialistService {
  constructor(private db:DataSource){}

  private allow(user:User){
    if(user.role!=='SPECIALIST') throw new ForbiddenException('Chỉ chuyên viên được thẩm định hồ sơ.');
  }

  async queue(user:User){
    this.allow(user);
    return this.db.query(`SELECT o.id,o.order_code,o.status,o.origin_country,o.destination_country,o.origin_address,o.destination_address,o.desired_departure_date,o.reviewed_at,
    u.full_name customer_name,a.specialist_id,a.status assessment_status,a.accepted_at,a.note,a.revision,
    (SELECT COUNT(*) FROM horses h WHERE h.order_id=o.id AND h.order_status<>'REMOVED') horse_count,
    (SELECT COUNT(*) FROM documents d JOIN horses h ON h.id=d.horse_id WHERE h.order_id=o.id AND h.order_status<>'REMOVED') document_count,
    (SELECT COUNT(*) FROM documents d JOIN horses h ON h.id=d.horse_id WHERE h.order_id=o.id AND d.status IN ('VALID','INVALID','EXPIRED') AND h.order_status<>'REMOVED') reviewed_count,
    (SELECT COUNT(*) FROM documents d JOIN horses h ON h.id=d.horse_id WHERE h.order_id=o.id AND d.status='SUBMITTED' AND h.order_status<>'REMOVED') submitted_count
    FROM orders o JOIN users u ON u.id=o.customer_id LEFT JOIN specialist_assessments a ON a.order_id=o.id
    WHERE o.status IN ('APPROVED','PREPARING','READY','IN_TRANSIT','DELIVERED')
    AND EXISTS(SELECT 1 FROM horses h JOIN documents d ON d.horse_id=h.id WHERE h.order_id=o.id)
    AND (a.specialist_id=? OR (a.order_id IS NULL AND o.status IN ('APPROVED','PREPARING','READY')))
    ORDER BY o.desired_departure_date,o.id`,[user.id]);
  }

  async accept(user:User,id:string){
    this.allow(user);
    return this.db.transaction(async m=>{
      const [order]=await m.query('SELECT id,status FROM orders WHERE id=? FOR UPDATE',[id]);
      if(!order) throw new NotFoundException('Không tìm thấy đơn.');
      if(!active.includes(order.status)) throw new ConflictException('Đơn không còn ở giai đoạn thẩm định.');
      const [prior]=await m.query('SELECT * FROM specialist_assessments WHERE order_id=? FOR UPDATE',[id]);
      if(prior){
        if(String(prior.specialist_id)!==String(user.id)) throw new ConflictException('Đơn đã được chuyên viên khác tiếp nhận.');
        return prior;
      }
      await m.query("INSERT INTO specialist_assessments(order_id,specialist_id,accepted_at) VALUES (?,?,UTC_TIMESTAMP())",[id,user.id]);
      await m.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,new_value) VALUES (?,'ORDER',?,'ASSESSMENT_ACCEPTED',?)",[user.id,id,JSON.stringify({specialistId:String(user.id)})]);
      return {order_id:id,specialist_id:String(user.id),status:'IN_REVIEW',revision:1};
    });
  }

  async detail(user:User,id:string){
    this.allow(user);
    const detail=await new DocumentsService(this.db).detail(user,id);
    const [assessment]=await this.db.query('SELECT a.*,u.full_name specialist_name FROM specialist_assessments a JOIN users u ON u.id=a.specialist_id WHERE a.order_id=?',[id]);
    if(assessment&&String(assessment.specialist_id)!==String(user.id)) throw new ForbiddenException('Hồ sơ do chuyên viên khác phụ trách.');
    const [customer]=await this.db.query('SELECT full_name,email,phone FROM users WHERE id=?',[detail.order.customer_id]);
    const horses=await this.db.query(`SELECT h.*,p.payload profile,
      (SELECT f.id FROM customer_profile_files f WHERE f.profile_id=p.id AND f.kind='PHOTO' ORDER BY f.id DESC LIMIT 1) photo_id
      FROM horses h LEFT JOIN customer_horse_profiles p ON p.owner_id=h.owner_id AND p.passport_no=h.passport_no
      WHERE h.order_id=? AND h.order_status<>'REMOVED' ORDER BY h.id`,[id]);
    return {...detail,order:{...detail.order,booking:json(detail.order.booking_details)||null},customer,assessment:assessment||null,horses:horses.map((h:Row)=>({...h,profile:json(h.profile)||{}}))};
  }

  async conclude(user:User,id:string,decision:'APPROVED'|'NEED_INFO'|'REJECTED',note:string,revision:number){
    this.allow(user);
    return this.db.transaction(async m=>{
      const [order]=await m.query('SELECT * FROM orders WHERE id=? FOR UPDATE',[id]);
      if(!order) throw new NotFoundException('Không tìm thấy đơn.');
      if(!active.includes(order.status)) throw new ConflictException('Đơn không còn ở giai đoạn thẩm định.');
      const [assessment]=await m.query('SELECT * FROM specialist_assessments WHERE order_id=? FOR UPDATE',[id]);
      if(!assessment||String(assessment.specialist_id)!==String(user.id)) throw new ForbiddenException('Bạn phải tiếp nhận đơn trước khi kết luận.');
      if(assessment.status!=='IN_REVIEW') throw new ConflictException('Hồ sơ đã có kết luận. Chỉ thẩm định lại khi có giấy tờ bổ sung.');
      if(Number(assessment.revision)!==revision) throw new ConflictException('Kết quả đã thay đổi. Vui lòng tải lại.');

      const documents:Row[]=await m.query("SELECT d.*,t.has_expiry FROM documents d JOIN horses h ON h.id=d.horse_id JOIN document_types t ON t.id=d.document_type_id WHERE h.order_id=? AND h.order_status<>'REMOVED' FOR UPDATE",[id]);
      const today=new Date().toISOString().slice(0,10);
      const missing=documents.filter(d=>d.status!=='VALID'||(d.has_expiry&&!d.expiry_date)||(d.expiry_date&&(d.expiry_date instanceof Date?d.expiry_date.toISOString():String(d.expiry_date)).slice(0,10)<today));
      const [unchecked]=await m.query("SELECT COUNT(*) n FROM horses h WHERE h.order_id=? AND h.order_status<>'REMOVED' AND NOT EXISTS(SELECT 1 FROM documents d WHERE d.horse_id=h.id)",[id]);

      if(decision==='APPROVED'&&(!documents.length||missing.length||Number(unchecked.n)>0)) throw new ConflictException('Cần duyệt hợp lệ và kiểm tra thời hạn của tất cả giấy tờ trước khi duyệt hồ sơ.');
      if(decision!=='APPROVED'&&!note.trim()) throw new BadRequestException('Cần ghi rõ lý do hoặc nội dung bổ sung.');
      if(decision==='NEED_INFO'&&!documents.some(d=>['NOT_SUBMITTED','INVALID','EXPIRED'].includes(d.status))) throw new ConflictException('Hãy chọn đúng giấy tờ cần bổ sung trước khi gửi kết luận.');

      await m.query('UPDATE specialist_assessments SET status=?,note=?,concluded_at=UTC_TIMESTAMP(),revision=revision+1 WHERE order_id=?',[decision,note.trim()||null,id]);
      await m.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value,reason) VALUES (?,'ORDER',?,'ASSESSMENT_CONCLUDED',?,?,?)",[user.id,id,JSON.stringify({status:assessment.status}),JSON.stringify({status:decision,note}),note.slice(0,255)||null]);

      // Khi chuyên viên từ chối hồ sơ, chuyển trạng thái đơn hàng sang REJECTED
      if(decision==='REJECTED'){
        const rejectNote=`Chuyên viên từ chối hồ sơ: ${note.trim()}`;
        await m.query("UPDATE orders SET status='REJECTED', manager_note=? WHERE id=?",[rejectNote,id]);
        await m.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value,reason) VALUES (?,'ORDER',?,'REJECT',?,?,?)",
          [user.id,id,JSON.stringify({status:order.status}),JSON.stringify({status:'REJECTED',manager_note:rejectNote}),note.trim().slice(0,255)]
        );
      }

      const label={APPROVED:'đã được chuyên viên duyệt',NEED_INFO:'cần bổ sung giấy tờ',REJECTED:'bị từ chối thẩm định'}[decision];
      const content=`Hồ sơ đơn ${order.order_code} ${label}.${note?' '+note:''}`.slice(0,500);
      await m.query("INSERT INTO notifications(recipient_id,event_type,content,related_type,related_id,channel) VALUES (?,'ASSESSMENT_RESULT',?,'ORDER',?,'IN_APP')",[order.customer_id,content,id]);
      await m.query("INSERT INTO notifications(recipient_id,event_type,content,related_type,related_id,channel) SELECT id,'ASSESSMENT_RESULT',?,'ORDER',?,'IN_APP' FROM users WHERE role='MANAGER' AND account_status='ACTIVE'",[content,id]);

      // Thông báo cập nhật trạng thái đơn thời gian thực qua WebSocket
      if(decision==='REJECTED'){
        socketService.notifyOrderStatus(String(id),String(order.customer_id),'REJECTED',{reason:note.trim(),orderCode:order.order_code});
      }else{
        socketService.notifyOrderStatus(String(id),String(order.customer_id),order.status,{assessmentStatus:decision,orderCode:order.order_code});
      }

      return {status:decision,revision:revision+1};
    });
  }

  async photo(user:User,orderId:string,fileId:string){
    this.allow(user);
    await this.detail(user,orderId);
    const [file]=await this.db.query(`SELECT f.* FROM customer_profile_files f JOIN customer_horse_profiles p ON p.id=f.profile_id JOIN horses h ON h.owner_id=p.owner_id AND h.passport_no=p.passport_no WHERE h.order_id=? AND f.id=? AND f.kind='PHOTO' LIMIT 1`,[orderId,fileId]);
    if(!file) throw new NotFoundException('Không tìm thấy ảnh ngựa.');
    return {...file,buffer:await loadFile(file.storage_path)};
  }
}
