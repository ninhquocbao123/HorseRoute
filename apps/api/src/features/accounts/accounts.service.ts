import * as bcrypt from 'bcrypt';
import { z } from 'zod';
import type { DataSource, EntityManager } from 'typeorm';
import type { User } from '../users/users.model';
import { BadRequestException, ConflictException, NotFoundException } from '../../shared/core/error.response';
import { parse } from '../../shared/utils/validation.util';
import type { Mailer } from '../../shared/mail/mailer';
import { Logger } from '../../shared/utils/logger.util';
const logger = new Logger('Accounts');

// Quản trị tài khoản (A3): ADMIN tạo nhân sự, đổi vai trò, khóa và mở, đặt lại mật khẩu. Khách tự đăng ký, admin chỉ khóa hoặc mở.
// "kind" gộp vai trò và loại tổ lái: DRIVER và ESCORT đều là DRIVER_ESCORT kèm hồ sơ tổ lái đúng loại.
export const STAFF_KINDS = ['ADMIN', 'MANAGER', 'SPECIALIST', 'COORDINATOR', 'DRIVER', 'ESCORT'] as const;
export type StaffKind = typeof STAFF_KINDS[number];
const roleOf = (kind: StaffKind) => (kind === 'DRIVER' || kind === 'ESCORT' ? 'DRIVER_ESCORT' : kind);

const password = z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.').max(72).regex(/\S/, 'Mật khẩu không được chỉ gồm khoảng trắng.')
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Mật khẩu không được vượt quá 72 byte UTF-8.');
const kind = z.enum(STAFF_KINDS, { errorMap: () => ({ message: 'Chọn vai trò hợp lệ.' }) });
const phone = z.string().trim().max(20).regex(/^[+0-9 ()-]*$/, 'Số điện thoại không hợp lệ.');
const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  kind: z.enum([...STAFF_KINDS, 'CUSTOMER', 'STAFF']).optional(),
  status: z.enum(['ACTIVE', 'LOCKED', 'PENDING']).optional(),
  q: z.string().trim().max(100).optional(),
}).strict();
const createSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ.').max(100),
  fullName: z.string().trim().min(1, 'Nhập họ tên.').max(100),
  phone: phone.optional(),
  kind,
  password,
}).strict();
const updateSchema = z.object({ fullName: z.string().trim().min(1, 'Nhập họ tên.').max(100), phone: phone.optional(), kind: kind.optional() }).strict();
const statusSchema = z.object({ reason: z.string().trim().min(1, 'Nêu lý do.').max(255) }).strict();
const resetSchema = z.object({ password }).strict();

type Row = Record<string, any>;
const SELECT = `SELECT CAST(u.id AS CHAR) id,u.email,u.full_name fullName,u.phone,u.role,u.account_status status,u.created_at createdAt,
  c.crew_type crewType,c.work_status workStatus FROM users u LEFT JOIN crew_profiles c ON c.user_id=u.id`;
const kindOf = (row: Row): string => (row.role === 'DRIVER_ESCORT' ? row.crewType || 'DRIVER_ESCORT' : row.role);
const view = (row: Row) => ({
  id: row.id, email: row.email, fullName: row.fullName, phone: row.phone ?? null, role: row.role, kind: kindOf(row),
  status: row.status, workStatus: row.workStatus ?? null, createdAt: row.createdAt,
});

export class AccountsService {
  constructor(private readonly db: DataSource, private readonly mailer?: Mailer) {}

  async list(query: unknown) {
    const p = parse(listSchema, query);
    const where: string[] = [], params: unknown[] = [];
    if (p.kind === 'CUSTOMER') where.push("u.role='CUSTOMER'");
    else if (p.kind === 'STAFF') where.push("u.role<>'CUSTOMER'");
    else if (p.kind === 'DRIVER' || p.kind === 'ESCORT') { where.push("u.role='DRIVER_ESCORT' AND c.crew_type=?"); params.push(p.kind); }
    else if (p.kind) { where.push('u.role=?'); params.push(p.kind); }
    if (p.status) { where.push('u.account_status=?'); params.push(p.status); }
    if (p.q) { where.push('(u.email LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ?)'); const like = '%' + p.q.replace(/[\\%_]/g, m => '\\' + m) + '%'; params.push(like, like, like); }
    const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const [{ total }] = await this.db.query(`SELECT COUNT(*) total FROM users u LEFT JOIN crew_profiles c ON c.user_id=u.id${clause}`, params);
    const rows = await this.db.query(`${SELECT}${clause} ORDER BY u.created_at DESC,u.id DESC LIMIT ? OFFSET ?`, [...params, p.limit, (p.page - 1) * p.limit]);
    return { items: rows.map(view), total: Number(total), page: p.page, limit: p.limit };
  }

  async create(admin: User, body: unknown) {
    const dto = parse(createSchema, body);
    return this.db.transaction(async m => {
      const [existing] = await m.query('SELECT id FROM users WHERE email=? FOR UPDATE', [dto.email]);
      if (existing) throw new BadRequestException({ message: 'Email đã có tài khoản.', fields: { email: 'Email đã có tài khoản.' } });
      const result = await m.query("INSERT INTO users(email,password_hash,full_name,phone,role,account_status) VALUES (?,?,?,?,?,'ACTIVE')",
        [dto.email, await bcrypt.hash(dto.password, 12), dto.fullName, dto.phone || null, roleOf(dto.kind)]);
      const id = String(result.insertId);
      if (roleOf(dto.kind) === 'DRIVER_ESCORT') await m.query("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (?,?,'AVAILABLE')", [id, dto.kind]);
      await this.audit(m, admin, id, 'CREATE', null, { email: dto.email, fullName: dto.fullName, kind: dto.kind });
      return this.get(m, id);
    }).then(async account => { await this.welcome(account); return account; });
  }

  async update(admin: User, id: string, body: unknown) {
    const dto = parse(updateSchema, body);
    return this.db.transaction(async m => {
      const before = await this.lock(m, id);
      const next = dto.kind ?? kindOf(before);
      if (dto.kind && dto.kind !== kindOf(before)) {
        if (before.role === 'CUSTOMER') throw new ConflictException('Không đổi tài khoản khách hàng thành nhân sự. Hãy tạo tài khoản nhân sự riêng.');
        if (id === String(admin.id)) throw new ConflictException('Không tự đổi vai trò của chính mình.');
        if (before.role === 'DRIVER_ESCORT' && before.workStatus && before.workStatus !== 'AVAILABLE')
          throw new ConflictException('Nhân sự đang được giữ chỗ hoặc đang chạy chuyến; chỉ đổi vai trò khi đã rảnh.');
        await this.lastAdminGuard(m, before, 'đổi vai trò');
        const role = roleOf(dto.kind);
        await m.query('UPDATE users SET role=? WHERE id=?', [role, id]);
        if (role === 'DRIVER_ESCORT') await m.query("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (?,?,'AVAILABLE') ON DUPLICATE KEY UPDATE crew_type=VALUES(crew_type)", [id, dto.kind]);
        else await m.query('DELETE FROM crew_profiles WHERE user_id=?', [id]);
      }
      await m.query('UPDATE users SET full_name=?,phone=? WHERE id=?', [dto.fullName, dto.phone ?? before.phone ?? null, id]);
      await this.audit(m, admin, id, 'UPDATE', { fullName: before.fullName, phone: before.phone, kind: kindOf(before) }, { fullName: dto.fullName, phone: dto.phone ?? before.phone, kind: next });
      return this.get(m, id);
    });
  }

  async setStatus(admin: User, id: string, status: 'ACTIVE' | 'LOCKED', body: unknown) {
    const { reason } = parse(statusSchema, body);
    return this.db.transaction(async m => {
      const before = await this.lock(m, id);
      if (before.status === status) return view(before);
      if (status === 'LOCKED') {
        if (id === String(admin.id)) throw new ConflictException('Không tự khóa tài khoản của chính mình.');
        if (before.role === 'DRIVER_ESCORT' && before.workStatus && before.workStatus !== 'AVAILABLE')
          throw new ConflictException('Nhân sự đang được giữ chỗ hoặc đang chạy chuyến. Điều phối đổi người trước rồi mới khóa.');
        await this.lastAdminGuard(m, before, 'khóa');
      }
      // Khóa thì mọi phiên đang mở hết hiệu lực ngay (token_version).
      await m.query(`UPDATE users SET account_status=?${status === 'LOCKED' ? ',token_version=token_version+1' : ''} WHERE id=?`, [status, id]);
      await this.audit(m, admin, id, status === 'LOCKED' ? 'LOCK' : 'UNLOCK', { status: before.status }, { status }, reason);
      return this.get(m, id);
    });
  }

  async resetPassword(admin: User, id: string, body: unknown) {
    const dto = parse(resetSchema, body);
    return this.db.transaction(async m => {
      await this.lock(m, id);
      await m.query('UPDATE users SET password_hash=?,token_version=token_version+1 WHERE id=?', [await bcrypt.hash(dto.password, 12), id]);
      await this.audit(m, admin, id, 'RESET_PASSWORD', null, null);
      return { message: 'Đã đặt lại mật khẩu. Gửi mật khẩu mới cho người dùng qua kênh riêng.' };
    });
  }

  /** Báo cho nhân sự mới qua email (không gửi mật khẩu). Gửi lỗi không làm hỏng việc tạo tài khoản. */
  private async welcome(account: { email: string; fullName: string; kind: string }) {
    if (!this.mailer?.configured) return;
    try {
      await this.mailer.send({ to: account.email, subject: 'HorseRoute: tài khoản của bạn đã được tạo', text: [
        `Xin chào ${account.fullName},`, '', 'Quản trị viên đã tạo tài khoản HorseRoute cho bạn với email này.',
        'Mật khẩu ban đầu được quản trị viên gửi riêng. Bạn cũng có thể tự đặt mật khẩu bằng mục "Quên mật khẩu" ở màn đăng nhập nhân viên.',
        '', 'HorseRoute'].join('\n') });
    } catch (error) { logger.warn('mail_send_failed', { purpose: 'WELCOME', code: (error as { code?: string }).code || 'UNKNOWN' }); }
  }

  private async get(m: EntityManager, id: string) {
    const [row] = await m.query(`${SELECT} WHERE u.id=?`, [id]);
    if (!row) throw new NotFoundException('Không tìm thấy tài khoản.');
    return view(row);
  }
  private async lock(m: EntityManager, id: string) {
    const [row] = await m.query(`${SELECT} WHERE u.id=? FOR UPDATE`, [id]);
    if (!row) throw new NotFoundException('Không tìm thấy tài khoản.');
    return row as Row;
  }
  // Luôn còn ít nhất một quản trị viên hoạt động.
  private async lastAdminGuard(m: EntityManager, before: Row, action: string) {
    if (before.role !== 'ADMIN' || before.status !== 'ACTIVE') return;
    const [{ n }] = await m.query("SELECT COUNT(*) n FROM users WHERE role='ADMIN' AND account_status='ACTIVE' AND id<>? FOR UPDATE", [before.id]);
    if (!Number(n)) throw new ConflictException(`Không thể ${action} quản trị viên hoạt động cuối cùng.`);
  }
  private async audit(m: EntityManager, admin: User, id: string, action: string, oldValue: unknown, newValue: unknown, reason?: string) {
    await m.query("INSERT INTO audit_logs(actor_id,entity_type,entity_id,action,old_value,new_value,reason) VALUES (?,'USER',?,?,?,?,?)",
      [admin.id, id, action, oldValue === null ? null : JSON.stringify(oldValue), newValue === null ? null : JSON.stringify(newValue), reason ?? null]);
  }
}
