import { DataSource, EntityManager } from 'typeorm';
import { CreateVehicleInput, UpdateVehicleInput } from './vehicles.validation';

export type VehicleType = 'TRUCK' | 'AIRCRAFT_HOLD' | 'CRATE';
export interface VehicleItem {
  id: string; plateOrCode: string; vehicleType: VehicleType; capacityStalls: number; isActive: boolean;
  /** Số chặng (mọi chuyến) đã tham chiếu xe này: > 0 thì không xóa được, chỉ ngừng hoạt động. */
  legCount: number;
  /** Xe đang nằm trong kế hoạch đã duyệt của đơn chưa giao xong: không được ngừng hoạt động hay giảm sức chứa dưới nhu cầu. */
  inActiveUse: boolean;
}
export interface VehicleUse { orderCode: string; tripId: string; orderStatus: string; horseCount: number }

// Cùng định nghĩa "đang dùng" với kiểm tra trùng lịch xe của Flow 3: kế hoạch APPROVED của đơn chưa kết thúc.
const ACTIVE_USE = `t.plan_status='APPROVED' AND o.status IN ('APPROVED','PREPARING','READY','IN_TRANSIT')`;
const select = `SELECT CAST(v.id AS CHAR) AS id, v.plate_or_code AS plateOrCode, v.vehicle_type AS vehicleType,
  v.capacity_stalls AS capacityStalls, v.is_active AS isActive,
  (SELECT COUNT(*) FROM legs l WHERE l.vehicle_id=v.id) AS legCount,
  EXISTS(SELECT 1 FROM legs l JOIN trips t ON t.id=l.trip_id JOIN orders o ON o.id=t.order_id WHERE l.vehicle_id=v.id AND ${ACTIVE_USE}) AS inActiveUse
  FROM vehicles v`;
const map = (row: any): VehicleItem => ({
  id: row.id, plateOrCode: row.plateOrCode, vehicleType: row.vehicleType, capacityStalls: Number(row.capacityStalls),
  isActive: Number(row.isActive) === 1, legCount: Number(row.legCount), inActiveUse: Number(row.inActiveUse) === 1,
});

export class VehiclesRepository {
  constructor(private readonly db: DataSource | EntityManager) {}
  transaction<T>(work: (repository: VehiclesRepository) => Promise<T>): Promise<T> {
    return this.db.transaction('READ COMMITTED', manager => work(new VehiclesRepository(manager)));
  }
  async list(status: 'all' | 'active' | 'inactive', q: string | undefined, limit: number, offset: number): Promise<{ rows: VehicleItem[]; total: number }> {
    const where: string[] = [], args: unknown[] = [];
    if (status !== 'all') { where.push('v.is_active=?'); args.push(status === 'active' ? 1 : 0); }
    if (q) { where.push('v.plate_or_code LIKE ?'); args.push('%' + q.replace(/[\\%_]/g, c => '\\' + c) + '%'); }
    const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const rows = await this.db.query(`${select}${clause} ORDER BY v.plate_or_code ASC, v.id ASC LIMIT ? OFFSET ?`, [...args, limit, offset]);
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
    const result = await this.db.query('INSERT INTO vehicles(vehicle_type,capacity_stalls,plate_or_code,is_active) VALUES (?,?,?,1)',
      [input.vehicleType, input.capacityStalls, input.plateOrCode]);
    return String(result.insertId);
  }
  async update(id: string, input: UpdateVehicleInput): Promise<void> {
    await this.db.query('UPDATE vehicles SET vehicle_type=?,capacity_stalls=?,plate_or_code=?,is_active=? WHERE id=?',
      [input.vehicleType, input.capacityStalls, input.plateOrCode, input.isActive ? 1 : 0, id]);
  }
  async remove(id: string): Promise<void> {
    await this.db.query('DELETE FROM vehicles WHERE id=?', [id]);
  }
  /** Các đơn đang dùng xe trong kế hoạch đã duyệt, kèm số ngựa NORMAL cần chở. */
  async uses(id: string): Promise<VehicleUse[]> {
    const rows = await this.db.query(`SELECT DISTINCT o.order_code AS orderCode, CAST(t.id AS CHAR) AS tripId, o.status AS orderStatus,
      (SELECT COUNT(*) FROM horses h WHERE h.order_id=o.id AND h.order_status='NORMAL') AS horseCount
      FROM legs l JOIN trips t ON t.id=l.trip_id JOIN orders o ON o.id=t.order_id
      WHERE l.vehicle_id=? AND ${ACTIVE_USE} ORDER BY tripId`, [id]);
    return rows.map((row: any) => ({ ...row, horseCount: Number(row.horseCount) }));
  }
  async audit(actor: string, id: string, action: string, before: unknown, after: unknown): Promise<void> {
    await this.db.query('INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value) VALUES (?,?,?,?,?,?)',
      [actor, 'VEHICLE', id, action, before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after)]);
  }
}
