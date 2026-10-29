import { DataSource, EntityManager } from 'typeorm';
import { CreateVehicleInput, UpdateVehicleInput } from './vehicles.validation';

export type VehicleType = 'LIGHT' | 'MEDIUM' | 'HEAVY';
export type VehicleStatus = 'AVAILABLE' | 'RESERVED' | 'IN_TRANSIT';
export interface VehicleItem {
  id: string; plateOrCode: string; vehicleType: VehicleType; capacityStalls: number; status: VehicleStatus;
  /** Số chặng (mọi chuyến) đã tham chiếu xe này: > 0 thì không xóa được. */
  legCount: number;
  /** Xe đang nằm trong kế hoạch đã duyệt của đơn chưa giao xong: không được đổi trạng thái hay giảm sức chứa dưới nhu cầu. */
  inActiveUse: boolean;
}
export interface VehicleUse { orderCode: string; tripId: string; orderStatus: string; horseCount: number }

// Cùng định nghĩa "đang dùng" với kiểm tra trùng lịch xe của Flow 3: kế hoạch APPROVED của đơn chưa kết thúc.
const ACTIVE_USE = `t.plan_status='APPROVED' AND o.status IN ('APPROVED','PREPARING','READY','IN_TRANSIT')`;
const select = `SELECT CAST(v.id AS CHAR) AS id, v.license_plate AS plateOrCode, v.vehicle_type AS vehicleType,
  v.capacity_stalls AS capacityStalls, v.status,
  ((SELECT COUNT(*) FROM legs l WHERE l.vehicle_id=v.id)+(SELECT COUNT(*) FROM trip_vehicles tv WHERE tv.vehicle_id=v.id)) AS legCount,
  EXISTS(SELECT 1 FROM trip_vehicles tv JOIN trips t ON t.id=tv.trip_id JOIN orders o ON o.id=t.order_id WHERE tv.vehicle_id=v.id AND ${ACTIVE_USE}) AS inActiveUse
  FROM vehicles v`;
const map = (row: any): VehicleItem => ({
  id: row.id, plateOrCode: row.plateOrCode, vehicleType: row.vehicleType, capacityStalls: Number(row.capacityStalls),
  status: row.status, legCount: Number(row.legCount), inActiveUse: Number(row.inActiveUse) === 1,
});

export class VehiclesRepository {
  constructor(private readonly db: DataSource | EntityManager) {}
  transaction<T>(work: (repository: VehiclesRepository) => Promise<T>): Promise<T> {
    return this.db.transaction('READ COMMITTED', manager => work(new VehiclesRepository(manager)));
  }
  async list(status: 'all' | VehicleStatus, q: string | undefined, limit: number, offset: number): Promise<{ rows: VehicleItem[]; total: number }> {
    const where: string[] = [], args: unknown[] = [];
    if (status !== 'all') { where.push('v.status=?'); args.push(status); }
    if (q) { where.push('v.license_plate LIKE ?'); args.push('%' + q.replace(/[\\%_]/g, c => '\\' + c) + '%'); }
    const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const rows = await this.db.query(`${select}${clause} ORDER BY v.license_plate ASC, v.id ASC LIMIT ? OFFSET ?`, [...args, limit, offset]);
    const [count] = await this.db.query(`SELECT COUNT(*) AS total FROM vehicles v${clause}`, args);
    return { rows: rows.map(map), total: Number(count.total) };
  }
  async find(id: string): Promise<VehicleItem | undefined> {
    const [row] = await this.db.query(`${select} WHERE v.id=?`, [id]);
    return row ? map(row) : undefined;
  }
  /** Khóa dòng xe trước khi tính toán (FOR UPDATE không đặt được trong câu SELECT có subquery). */
  async lock(id: string): Promise<boolean> {
    const rows = await this.db.query('SELECT id FROM vehicles WHERE id=? FOR UPDATE', [id]);
    return rows.length > 0;
  }
  async create(input: CreateVehicleInput): Promise<string> {
    const result = await this.db.query("INSERT INTO vehicles(vehicle_type,capacity_stalls,license_plate,status) VALUES (?,?,?,'AVAILABLE')",
      [input.vehicleType, input.capacityStalls, input.plateOrCode]);
    return String(result.insertId);
  }
  async update(id: string, input: UpdateVehicleInput): Promise<void> {
    await this.db.query('UPDATE vehicles SET vehicle_type=?,capacity_stalls=?,license_plate=?,status=? WHERE id=?',
      [input.vehicleType, input.capacityStalls, input.plateOrCode, input.status, id]);
  }
  async remove(id: string): Promise<void> {
    await this.db.query('DELETE FROM vehicles WHERE id=?', [id]);
  }
  /** Các đơn đang dùng xe trong kế hoạch đã duyệt, kèm số ngựa NORMAL cần chở. */
  async uses(id: string): Promise<VehicleUse[]> {
    const rows = await this.db.query(`SELECT DISTINCT o.order_code AS orderCode, CAST(t.id AS CHAR) AS tripId, o.status AS orderStatus,
      tv.horse_count AS horseCount
      FROM trip_vehicles tv JOIN trips t ON t.id=tv.trip_id JOIN orders o ON o.id=t.order_id
      WHERE tv.vehicle_id=? AND ${ACTIVE_USE} ORDER BY tripId`, [id]);
    return rows.map((row: any) => ({ ...row, horseCount: Number(row.horseCount) }));
  }
  async audit(actor: string, id: string, action: string, before: unknown, after: unknown): Promise<void> {
    await this.db.query('INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value) VALUES (?,?,?,?,?,?)',
      [actor, 'VEHICLE', id, action, before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after)]);
  }
}
