export const horseDocumentNames=['Hộ chiếu ngựa','Giấy chứng nhận tiêm phòng cúm ngựa','Kết quả xét nghiệm EIA (Coggins)'] as const;
export async function requiredHorseDocuments(db:{query(sql:string,args?:any[]):Promise<any>}){
  return db.query('SELECT id,name,description,has_expiry FROM document_types WHERE name IN (?,?,?) ORDER BY FIELD(name,?,?,?)',[...horseDocumentNames,...horseDocumentNames]);
}
