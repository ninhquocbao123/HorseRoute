import { DataSource, EntityManager } from 'typeorm';
import { ConflictException } from '../../shared/core/error.response';
type DB = DataSource | EntityManager;
export const activeResourceOrder = "o.status NOT IN ('DELIVERED','CANCELLED')";
export const resourceIds = (ids: string[]) => [...new Set(ids)].sort((a,b) => a.length-b.length || a.localeCompare(b));
export async function resourceOwners(db: DB, kind: 'vehicle'|'crew', id: string): Promise<{tripId:string; orderCode:string}[]> {
  const table = kind === 'vehicle' ? 'trip_vehicles' : 'trip_assignments';
  const column = kind === 'vehicle' ? 'vehicle_id' : 'user_id';
  return db.query(`SELECT DISTINCT CAST(t.id AS CHAR) tripId,o.order_code orderCode FROM ${table} a
    JOIN trips t ON t.id=a.trip_id JOIN orders o ON o.id=t.order_id WHERE a.${column}=? AND ${activeResourceOrder} ORDER BY tripId`,[id]);
}
// All writers lock vehicles first, then users/profiles, in numeric ID order. Call inside a transaction.
export async function lockResources(db: DB, vehicles: string[], crew: string[]) {
  for (const id of resourceIds(vehicles)) await db.query('SELECT id FROM vehicles WHERE id=? FOR UPDATE',[id]);
  for (const id of resourceIds(crew)) {
    await db.query('SELECT id FROM users WHERE id=? FOR UPDATE',[id]);
    await db.query('SELECT user_id FROM crew_profiles WHERE user_id=? FOR UPDATE',[id]);
  }
}
export async function assertResourceOwner(db: DB, kind:'vehicle'|'crew', id:string, tripId:string) {
  if ((await resourceOwners(db,kind,id)).some(o => o.tripId!==tripId))
    throw new ConflictException(`${kind==='vehicle'?'Xe':'Nhân sự'} ${id} đang thuộc chuyến khác.`);
}
export async function writeResourceStatus(db: DB, kind:'vehicle'|'crew', id:string, value:string, tripId:string, actor?:string) {
  const [before] = await db.query(kind==='vehicle'?'SELECT status FROM vehicles WHERE id=?':'SELECT work_status status FROM crew_profiles WHERE user_id=?',[id]);
  if (before?.status===value) return;
  await db.query(kind==='vehicle'?'UPDATE vehicles SET status=? WHERE id=?':'UPDATE crew_profiles SET work_status=? WHERE user_id=?',[value,id]);
  await db.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value) VALUES (?,?,?,'RESOURCE_STATUS',?,?)",
    [actor ?? null,kind==='vehicle'?'VEHICLE':'CREW_PROFILE',id,JSON.stringify({status:before?.status,tripId}),JSON.stringify({status:value,tripId})]);
}
export async function syncTripResources(db: DB, tripId:string, status:string, actor?:string) {
  const vehicles: {id:string}[] = await db.query('SELECT CAST(vehicle_id AS CHAR) id FROM trip_vehicles WHERE trip_id=?',[tripId]);
  const crew: {id:string}[] = await db.query('SELECT CAST(user_id AS CHAR) id FROM trip_assignments WHERE trip_id=?',[tripId]);
  await lockResources(db,vehicles.map(v=>v.id),crew.map(p=>p.id));
  const release = status==='DELIVERED' || status==='CANCELLED';
  for (const [kind,rows] of [['vehicle',vehicles],['crew',crew]] as const) for(const {id} of rows) {
    const others = (await resourceOwners(db,kind,id)).some(o=>o.tripId!==tripId);
    if (release && others) continue; // Historical corrections must never release another trip's resource.
    await assertResourceOwner(db,kind,id,tripId);
    const value = release?'AVAILABLE':status==='IN_TRANSIT'?(kind==='vehicle'?'IN_TRANSIT':'IN_TRIP'):'RESERVED';
    await writeResourceStatus(db,kind,id,value,tripId,actor);
  }
}
