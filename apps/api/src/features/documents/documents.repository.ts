// SQL stays here; callers pass the transaction manager when holding row locks.
type QueryExecutor = { query(sql: string, parameters?: any[]): Promise<any> };
export class DocumentsRepository {
  insertAudit(db: QueryExecutor, parameters: any[] = []) {
    return db.query('INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?)', parameters);
  }
  insertNotification(db: QueryExecutor, parameters: any[] = []) {
    return db.query("INSERT INTO notifications(recipient_id,event_type,content,related_type,related_id,channel) VALUES (?,'DOCUMENT_UPDATE',?,'ORDER',?,'IN_APP')", parameters);
  }
  lockOrder(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT * FROM orders WHERE id=? FOR UPDATE', parameters);
  }
  lockExpiredDocuments(db: QueryExecutor, parameters: any[] = []) {
    return db.query("SELECT d.* FROM documents d JOIN horses h ON h.id=d.horse_id WHERE h.order_id=? AND d.status='VALID' AND d.expiry_date<UTC_DATE() FOR UPDATE", parameters);
  }
  markExpired(db: QueryExecutor, parameters: any[] = []) {
    return db.query("UPDATE documents SET status='EXPIRED' WHERE id=?", parameters);
  }
  findOrdersWithExpiredDocuments(db: QueryExecutor, parameters: any[] = []) {
    return db.query("SELECT DISTINCT h.order_id FROM documents d JOIN horses h ON h.id=d.horse_id WHERE d.status='VALID' AND d.expiry_date<UTC_DATE()", parameters);
  }
  lockOrderId(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT id FROM orders WHERE id=? FOR UPDATE', parameters);
  }
  listOrders(db: QueryExecutor, parameters: any[] = [], ...parts: any[]) {
    return db.query(`SELECT o.id,o.order_code,o.status,o.origin_country,o.destination_country,u.full_name customer_name FROM orders o JOIN users u ON u.id=o.customer_id ${parts[0]} ORDER BY o.created_at ASC,o.id ASC LIMIT ? OFFSET ?`, parameters);
  }
  countOrders(db: QueryExecutor, parameters: any[] = [], ...parts: any[]) {
    return db.query(`SELECT COUNT(*) total FROM orders o ${parts[0]}`, parameters);
  }
  findChecklist(db: QueryExecutor, parameters: any[] = []) {
    return db.query(`SELECT d.*,h.name horse_name,t.name document_name,t.has_expiry,(SELECT CAST(v.id AS CHAR) FROM document_versions v WHERE v.document_id=d.id ORDER BY version_no DESC LIMIT 1) latest_version_id FROM documents d JOIN horses h ON h.id=d.horse_id JOIN document_types t ON t.id=d.document_type_id WHERE h.order_id=? ORDER BY h.id,d.id`, parameters);
  }
  findVersions(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT v.*,a.original_name,a.size_bytes FROM document_versions v JOIN documents d ON d.id=v.document_id JOIN horses h ON h.id=d.horse_id JOIN attachments a ON a.id=v.attachment_id WHERE h.order_id=? ORDER BY v.document_id,v.version_no DESC', parameters);
  }
  findDossiers(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT s.*,h.name horse_name,a.name authority_name FROM dossiers s JOIN horses h ON h.id=s.horse_id JOIN authorities a ON a.id=s.authority_id WHERE h.order_id=? ORDER BY h.id,s.id', parameters);
  }
  findHistory(db: QueryExecutor, parameters: any[] = []) {
    return db.query("SELECT l.*,u.full_name actor_name FROM audit_logs l LEFT JOIN users u ON u.id=l.actor_id WHERE (l.entity_type='DOCUMENT' AND l.entity_id IN (SELECT d.id FROM documents d JOIN horses h ON h.id=d.horse_id WHERE h.order_id=?)) OR (l.entity_type='DOSSIER' AND l.entity_id IN (SELECT s.id FROM dossiers s JOIN horses h ON h.id=s.horse_id WHERE h.order_id=?)) ORDER BY l.id DESC LIMIT 100", parameters);
  }
  lockDocument(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT d.*,t.has_expiry,t.name document_name,h.name horse_name FROM documents d JOIN horses h ON h.id=d.horse_id JOIN document_types t ON t.id=d.document_type_id WHERE d.id=? AND h.order_id=? FOR UPDATE', parameters);
  }
  findSubmittedDossier(db: QueryExecutor, parameters: any[] = []) {
    return db.query("SELECT id FROM dossiers WHERE horse_id=? AND status IN ('SUBMITTED','REVIEWING','APPROVED') LIMIT 1", parameters);
  }
  insertAttachment(db: QueryExecutor, parameters: any[] = []) {
    return db.query('INSERT INTO attachments(original_name,file_type,size_bytes,storage_path,uploaded_by) VALUES (?,?,?,?,?)', parameters);
  }
  findMaxVersion(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT COALESCE(MAX(version_no),0) n FROM document_versions WHERE document_id=?', parameters);
  }
  insertVersion(db: QueryExecutor, parameters: any[] = []) {
    return db.query('INSERT INTO document_versions(document_id,version_no,attachment_id,uploaded_by,uploaded_at) VALUES (?,?,?,?,UTC_TIMESTAMP())', parameters);
  }
  markSubmitted(db: QueryExecutor, parameters: any[] = []) {
    return db.query("UPDATE documents SET status='SUBMITTED',expiry_date=NULL,invalid_reason=NULL,reviewed_by=NULL,reviewed_at=NULL WHERE id=?", parameters);
  }
  findSpecialists(db: QueryExecutor, parameters: any[] = []) {
    return db.query("SELECT id FROM users WHERE role='SPECIALIST' AND account_status='ACTIVE'", parameters);
  }
  notifySpecialist(db: QueryExecutor, parameters: any[] = []) {
    return db.query("INSERT INTO notifications(recipient_id,event_type,content,related_type,related_id,channel) VALUES (?,'DOCUMENT_SUBMITTED',?,'ORDER',?,'IN_APP')", parameters);
  }
  findLatestVersion(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT id FROM document_versions WHERE document_id=? ORDER BY version_no DESC LIMIT 1', parameters);
  }
  recordReview(db: QueryExecutor, parameters: any[] = []) {
    return db.query('UPDATE documents SET status=?,expiry_date=?,invalid_reason=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?', parameters);
  }
  lockDossier(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT s.* FROM dossiers s JOIN horses h ON h.id=s.horse_id WHERE s.id=? AND h.order_id=? FOR UPDATE', parameters);
  }
  findHorseDocuments(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT * FROM documents WHERE horse_id=?', parameters);
  }
  updateDossier(db: QueryExecutor, parameters: any[] = []) {
    return db.query('UPDATE dossiers SET status=?,specialist_id=?,submitted_at=?,receipt_code=?,result_at=?,result=?,rejection_reason=?,permit_attachment_id=? WHERE id=?', parameters);
  }
  findOrderAttachment(db: QueryExecutor, parameters: any[] = []) {
    return db.query(`SELECT a.* FROM attachments a WHERE a.id=? AND (EXISTS(SELECT 1 FROM document_versions v JOIN documents d ON d.id=v.document_id JOIN horses h ON h.id=d.horse_id WHERE v.attachment_id=a.id AND h.order_id=?) OR EXISTS(SELECT 1 FROM dossiers s JOIN horses h ON h.id=s.horse_id WHERE s.permit_attachment_id=a.id AND h.order_id=?))`, parameters);
  }
}
