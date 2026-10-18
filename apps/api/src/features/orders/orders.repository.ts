// SQL stays here; callers pass the transaction manager when holding row locks.
type QueryExecutor = { query(sql: string, parameters?: any[]): Promise<any> };
export class OrdersRepository {
  deleteDraft(db:QueryExecutor,parameters:any[]){
    return db.query("DELETE FROM orders WHERE id=? AND customer_id=? AND status='DRAFT'",parameters);
  }
  list(db: QueryExecutor, parameters: any[] = [], ...parts: any[]) {
    return db.query(`SELECT o.id,o.order_code,o.status,o.origin_country,o.destination_country,o.desired_departure_date,o.created_at,u.full_name AS customer_name FROM orders o JOIN users u ON u.id=o.customer_id ${parts[0]} ORDER BY o.created_at ASC,o.id ASC LIMIT ? OFFSET ?`, parameters);
  }
  count(db: QueryExecutor, parameters: any[] = [], ...parts: any[]) {
    return db.query(`SELECT COUNT(*) AS total FROM orders o ${parts[0]}`, parameters);
  }
  findOrder(db: QueryExecutor, parameters: any[] = [], ...parts: any[]) {
    return db.query(`SELECT * FROM orders WHERE id=? ${parts[0]}`, parameters);
  }
  findHorses(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT * FROM horses WHERE order_id=? ORDER BY id', parameters);
  }
  findDocuments(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT d.*,dt.name AS document_name,h.name AS horse_name FROM documents d JOIN document_types dt ON dt.id=d.document_type_id JOIN horses h ON h.id=d.horse_id WHERE h.order_id=? ORDER BY h.id,d.id', parameters);
  }
  findCustomer(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT full_name,email,phone,organization_name FROM users WHERE id=?', parameters);
  }
  findHistory(db: QueryExecutor, parameters: any[] = []) {
    return db.query("SELECT a.id,a.occurred_at,a.action,a.reason,u.full_name AS actor_name FROM audit_logs a JOIN users u ON u.id=a.actor_id WHERE a.entity_type='ORDER' AND a.entity_id=? ORDER BY a.occurred_at DESC,a.id DESC LIMIT 100", parameters);
  }
  findCoordinators(db: QueryExecutor, parameters: any[] = []) {
    return db.query("SELECT id,full_name FROM users WHERE role='COORDINATOR' AND account_status='ACTIVE' ORDER BY full_name", parameters);
  }
  findRuleOptions(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT q.id,q.border_location_id,l.name AS border_name,a.name AS authority_name FROM quarantine_rules q LEFT JOIN locations l ON l.id=q.border_location_id LEFT JOIN authorities a ON a.id=q.authority_id WHERE q.origin_country=? AND q.destination_country=? ORDER BY q.id', parameters);
  }
  insertAudit(db: QueryExecutor, parameters: any[] = []) {
    return db.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value,reason) VALUES (?,'ORDER',?,?,?,?,?)", parameters);
  }
  insertNotification(db: QueryExecutor, parameters: any[] = []) {
    return db.query("INSERT INTO notifications(recipient_id,event_type,content,related_type,related_id,channel) VALUES (?,?,?,'ORDER',?,'IN_APP')", parameters);
  }
  findRequest(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT id FROM orders WHERE customer_id=? AND client_request_id=?', parameters);
  }
  insertDraft(db: QueryExecutor, parameters: any[] = []) {
    return db.query("INSERT INTO orders(order_code,customer_id,client_request_id) VALUES (?,?,?)", parameters);
  }
  findByCode(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT id FROM orders WHERE order_code=?', parameters);
  }
  findDraftHorses(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT * FROM horses WHERE order_id=?', parameters);
  }
  updateDraft(db: QueryExecutor, parameters: any[] = []) {
    return db.query('UPDATE orders SET origin_address=?,origin_country=?,destination_address=?,destination_country=?,desired_departure_date=?,special_requirements=?,draft_payload=? WHERE id=?', parameters);
  }
  findRetriedRequest(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT id FROM orders WHERE customer_id=? AND client_request_id=?', parameters);
  }
  findSubmittedHorses(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT * FROM horses WHERE order_id=? ORDER BY id', parameters);
  }
  findDuplicatePassport(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT id FROM horses WHERE passport_no=? AND id<>?', parameters);
  }
  updateHorse(db: QueryExecutor, parameters: any[] = []) {
    return db.query('UPDATE horses SET name=?,passport_no=?,breed=?,birth_date=?,sex=?,coat_color=?,note=? WHERE id=?', parameters);
  }
  insertHorse(db: QueryExecutor, parameters: any[] = []) {
    return db.query('INSERT INTO horses(order_id,owner_id,name,passport_no,breed,birth_date,sex,coat_color,note) VALUES (?,?,?,?,?,?,?,?,?)', parameters);
  }
  deleteHorse(db: QueryExecutor, parameters: any[] = []) {
    return db.query('DELETE FROM horses WHERE id=?', parameters);
  }
  markPending(db: QueryExecutor, parameters: any[] = []) {
    return db.query("UPDATE orders SET status='PENDING',origin_address=?,destination_address=?,submitted_at=UTC_TIMESTAMP(),response_deadline=NULL,draft_payload=NULL WHERE id=?", parameters);
  }
  findManagers(db: QueryExecutor, parameters: any[] = []) {
    return db.query("SELECT id FROM users WHERE role='MANAGER' AND account_status='ACTIVE'", parameters);
  }
  lockCoordinator(db: QueryExecutor, parameters: any[] = []) {
    return db.query("SELECT id FROM users WHERE id=? AND role='COORDINATOR' AND account_status='ACTIVE' FOR UPDATE", parameters);
  }
  lockRules(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT * FROM quarantine_rules WHERE origin_country=? AND destination_country=? FOR UPDATE', parameters);
  }
  findActiveHorses(db: QueryExecutor, parameters: any[] = []) {
    return db.query("SELECT * FROM horses WHERE order_id=? AND order_status<>'REMOVED'", parameters);
  }
  findRuleDocumentTypes(db: QueryExecutor, parameters: any[] = []) {
    return db.query('SELECT q.document_type_id,t.has_expiry FROM quarantine_rule_doctypes q JOIN document_types t ON t.id=q.document_type_id WHERE q.rule_id=? FOR SHARE', parameters);
  }
  ensureDocument(db: QueryExecutor, parameters: any[] = []) {
    return db.query('INSERT INTO documents(horse_id,document_type_id) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM documents WHERE horse_id=? AND document_type_id=?)', parameters);
  }
  ensureDossier(db: QueryExecutor, parameters: any[] = []) {
    return db.query('INSERT INTO dossiers(horse_id,authority_id) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM dossiers WHERE horse_id=? AND authority_id=?)', parameters);
  }
  insertTrip(db: QueryExecutor, parameters: any[] = []) {
    return db.query('INSERT INTO trips(order_id,planned_by) VALUES (?,?)', parameters);
  }
  recordReview(db: QueryExecutor, parameters: any[] = []) {
    return db.query('UPDATE orders SET status=?,manager_note=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?', parameters);
  }
}
