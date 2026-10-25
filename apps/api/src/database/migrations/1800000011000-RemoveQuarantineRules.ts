import {MigrationInterface,QueryRunner} from 'typeorm';
import {horseDocumentNames} from '../../features/documents/required-horse-documents';

export class RemoveQuarantineRules1800000011000 implements MigrationInterface {
  async up(q:QueryRunner){
    for(const [index,name] of horseDocumentNames.entries()){
      await q.query('INSERT INTO document_types(name,description,has_expiry) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM document_types WHERE name=?)',[name,'Giấy tờ bắt buộc cho mỗi ngựa',index===0?0:1,name]);
    }
    await q.query('DROP TABLE IF EXISTS quarantine_rule_doctypes');
    await q.query('DROP TABLE IF EXISTS quarantine_rules');
    await q.startTransaction();
    try {
      const types=await q.query('SELECT id,has_expiry FROM document_types WHERE name IN (?,?,?)', [...horseDocumentNames]);
      if(types.length!==3)throw new Error('Expected exactly three distinct horse document types.');
      const ids=types.map((t:any)=>String(t.id));
      await q.query("DELETE n FROM notifications n JOIN documents d ON n.related_type='DOCUMENT' AND n.related_id=d.id WHERE d.document_type_id NOT IN (?,?,?)",ids);
      await q.query('DELETE v FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE d.document_type_id NOT IN (?,?,?)',ids);
      await q.query('DELETE FROM documents WHERE document_type_id NOT IN (?,?,?)',ids);
      await q.query("DELETE FROM customer_profile_files WHERE kind='DOCUMENT' AND slot NOT IN (?,?,?)",ids);
      await q.query('DELETE FROM document_types WHERE id NOT IN (?,?,?)',ids);
      const orders=await q.query('SELECT id,requirements_snapshot FROM orders WHERE requirements_snapshot IS NOT NULL');
      for(const order of orders){
        const snapshot=typeof order.requirements_snapshot==='string'?JSON.parse(order.requirements_snapshot):order.requirements_snapshot;
        const horses=await q.query("SELECT id FROM horses WHERE order_id=? AND order_status<>'REMOVED'",[order.id]);
        const requirements={version:2,horses:horses.map((h:any)=>({horseId:String(h.id),documents:types.map((t:any)=>({documentTypeId:String(t.id),hasExpiry:!!t.has_expiry})),authorityIds:snapshot.horses?.find((x:any)=>String(x.horseId)===String(h.id))?.authorityIds||[]}))};
        for(const h of horses)for(const t of types)await q.query('INSERT INTO documents(horse_id,document_type_id) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM documents WHERE horse_id=? AND document_type_id=?)',[h.id,t.id,h.id,t.id]);
        await q.query('UPDATE orders SET requirements_snapshot=? WHERE id=?',[JSON.stringify(requirements),order.id]);
      }
      await q.commitTransaction();
    } catch(error){await q.rollbackTransaction();throw error;}
  }
  async down(){throw new Error('Restore the saved database backup to recover removed rule definitions.');}
}
