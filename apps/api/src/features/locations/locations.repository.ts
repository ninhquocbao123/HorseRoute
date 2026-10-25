import { DataSource, EntityManager } from 'typeorm';
import { LocationInput, LOCATION_TYPES } from './locations.validation';

export type LocationType = typeof LOCATION_TYPES[number];
export interface LocationItem {
  id: string; name: string; locationType: LocationType; country: string; timezone: string; address: string | null;
  /** WGS84; null khi địa điểm cũ chưa được ghim trên bản đồ. */
  latitude: number | null; longitude: number | null;
  /** Số chặng (mọi chuyến) đi từ hoặc đến địa điểm: > 0 thì không xóa được. */
  legCount: number;
  /** Số quy định kiểm dịch dùng địa điểm làm cửa khẩu: > 0 thì không xóa được. */
  ruleCount: number;
  /** Nằm trong kế hoạch đã duyệt của đơn chưa giao xong: không được đổi loại (Flow 4 dựa vào loại BORDER). */
  inActiveUse: boolean;
}
export interface LocationFilters {
  locationType?: LocationType; country?: string; coordinates: 'all' | 'missing' | 'present'; q?: string;
}

// Cùng định nghĩa "đang dùng" với danh mục phương tiện: kế hoạch APPROVED của đơn chưa kết thúc.
const ACTIVE_USE = `t.plan_status='APPROVED' AND o.status IN ('APPROVED','PREPARING','READY','IN_TRANSIT')`;
const select = `SELECT CAST(x.id AS CHAR) AS id, x.name, x.location_type AS locationType, x.country, x.timezone, x.address,
  x.latitude, x.longitude,
  (SELECT COUNT(*) FROM legs l WHERE l.from_location_id=x.id OR l.to_location_id=x.id) AS legCount,
  (SELECT COUNT(*) FROM quarantine_rules r WHERE r.border_location_id=x.id) AS ruleCount,
  EXISTS(SELECT 1 FROM legs l JOIN trips t ON t.id=l.trip_id JOIN orders o ON o.id=t.order_id
    WHERE (l.from_location_id=x.id OR l.to_location_id=x.id) AND ${ACTIVE_USE}) AS inActiveUse
  FROM locations x`;
// mysql2 returns DECIMAL as string; keep null for locations that were never pinned.
const coordinate = (value: unknown) => value === null || value === undefined ? null : Number(value);
const map = (row: any): LocationItem => ({
  id: row.id, name: row.name, locationType: row.locationType, country: row.country, timezone: row.timezone, address: row.address ?? null,
  latitude: coordinate(row.latitude), longitude: coordinate(row.longitude),
  legCount: Number(row.legCount), ruleCount: Number(row.ruleCount), inActiveUse: Number(row.inActiveUse) === 1,
});

export class LocationsRepository {
  constructor(private readonly db: DataSource | EntityManager) {}
  transaction<T>(work: (repository: LocationsRepository) => Promise<T>): Promise<T> {
    return this.db.transaction('READ COMMITTED', manager => work(new LocationsRepository(manager)));
  }
  async list(filters: LocationFilters, limit: number, offset: number): Promise<{ rows: LocationItem[]; total: number }> {
    const where: string[] = [], args: unknown[] = [];
    if (filters.locationType) { where.push('x.location_type=?'); args.push(filters.locationType); }
    if (filters.country) { where.push('x.country=?'); args.push(filters.country); }
    if (filters.coordinates === 'missing') where.push('x.latitude IS NULL');
    if (filters.coordinates === 'present') where.push('x.latitude IS NOT NULL');
    if (filters.q) { where.push('x.name LIKE ?'); args.push('%' + filters.q.replace(/[\\%_]/g, c => '\\' + c) + '%'); }
    const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const rows = await this.db.query(`${select}${clause} ORDER BY x.name ASC, x.id ASC LIMIT ? OFFSET ?`, [...args, limit, offset]);
    const [count] = await this.db.query(`SELECT COUNT(*) AS total FROM locations x${clause}`, args);
    return { rows: rows.map(map), total: Number(count.total) };
  }
  async find(id: string): Promise<LocationItem | undefined> {
    const [row] = await this.db.query(`${select} WHERE x.id=?`, [id]);
    return row ? map(row) : undefined;
  }
  /** Khóa dòng địa điểm; xung đột với FOR SHARE mà Flow 3 đặt khi lưu chặng, nên không xóa được giữa lúc đang lập kế hoạch. */
  async lock(id: string): Promise<boolean> {
    const rows = await this.db.query('SELECT id FROM locations WHERE id=? FOR UPDATE', [id]);
    return rows.length > 0;
  }
  async create(input: LocationInput): Promise<string> {
    const result = await this.db.query(
      'INSERT INTO locations(name,location_type,country,timezone,address,latitude,longitude) VALUES (?,?,?,?,?,?,?)',
      [input.name, input.locationType, input.country, input.timezone, input.address, input.latitude, input.longitude]);
    return String(result.insertId);
  }
  async update(id: string, input: LocationInput): Promise<void> {
    await this.db.query(
      'UPDATE locations SET name=?,location_type=?,country=?,timezone=?,address=?,latitude=?,longitude=? WHERE id=?',
      [input.name, input.locationType, input.country, input.timezone, input.address, input.latitude, input.longitude, id]);
  }
  /** Tuyến cache theo cặp địa điểm (location_routes) tự xóa theo khóa ngoại. */
  async remove(id: string): Promise<void> {
    await this.db.query('DELETE FROM locations WHERE id=?', [id]);
  }
  /** Tọa độ đổi thì tuyến đã cache không còn đúng. */
  async clearRoutes(id: string): Promise<void> {
    await this.db.query('DELETE FROM location_routes WHERE from_location_id=? OR to_location_id=?', [id, id]);
  }
  async audit(actor: string, id: string, action: string, before: unknown, after: unknown): Promise<void> {
    await this.db.query('INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value) VALUES (?,?,?,?,?,?)',
      [actor, 'LOCATION', id, action, before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after)]);
  }
}
