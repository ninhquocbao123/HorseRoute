import { Role } from '@my-project/shared';
import { User } from '../users/users.model';
import { parse } from '../../shared/utils/validation.util';
import { ConflictException, ForbiddenException, NotFoundException } from '../../shared/core/error.response';
import { LocationItem, LocationsRepository } from './locations.repository';
import { locationIdSchema, locationQuerySchema, locationSchema } from './locations.validation';

const dbCode = (error: unknown) => (error as { code?: string }).code ?? (error as { driverError?: { code?: string } }).driverError?.code;
// uq_locations_name_country uses utf8mb4_unicode_ci: case- and accent-insensitive.
const DUPLICATE = 'Đã có địa điểm cùng tên trong quốc gia này (không phân biệt hoa/thường, dấu).';
const NOT_FOUND = 'Không tìm thấy địa điểm.';
const snapshot = (l: LocationItem) => ({
  name: l.name, locationType: l.locationType, country: l.country, timezone: l.timezone, address: l.address, latitude: l.latitude, longitude: l.longitude,
});
const READERS: string[] = [Role.SPECIALIST, Role.COORDINATOR, Role.MANAGER];

export class LocationsService {
  constructor(private readonly repository: LocationsRepository) {}
  private canRead(account: Pick<User, 'role'>) {
    if (!READERS.includes(account.role)) throw new ForbiddenException('Không đủ quyền');
  }
  private canWrite(account: Pick<User, 'role'>) {
    if (account.role !== Role.SPECIALIST) throw new ForbiddenException('Chỉ Specialist được quản lý địa điểm.');
  }
  async list(account: User, rawQuery: unknown) {
    this.canRead(account);
    const { page, limit, ...filters } = parse(locationQuerySchema, rawQuery);
    const { rows, total } = await this.repository.list({ ...filters, q: filters.q || undefined }, limit, (page - 1) * limit);
    return { items: rows, total, page, limit };
  }
  async detail(account: User, rawId: string) {
    this.canRead(account);
    const location = await this.repository.find(parse(locationIdSchema, rawId));
    if (!location) throw new NotFoundException(NOT_FOUND);
    return location;
  }
  async create(account: User, body: unknown) {
    this.canWrite(account);
    const input = parse(locationSchema, body);
    try {
      return await this.repository.transaction(async repo => {
        const id = await repo.create(input);
        const created = (await repo.find(id))!;
        await repo.audit(account.id, id, 'CREATE', null, snapshot(created));
        return created;
      });
    } catch (error) {
      if (dbCode(error) === 'ER_DUP_ENTRY') throw new ConflictException(DUPLICATE);
      throw error;
    }
  }
  async update(account: User, rawId: string, body: unknown) {
    this.canWrite(account);
    const id = parse(locationIdSchema, rawId), input = parse(locationSchema, body);
    try {
      return await this.repository.transaction(async repo => {
        if (!await repo.lock(id)) throw new NotFoundException(NOT_FOUND);
        const before = (await repo.find(id))!;
        if (input.locationType !== before.locationType) {
          // Flow 4 requires customs at BORDER destinations; changing the type mid-plan would change that rule.
          if (before.inActiveUse) throw new ConflictException('Địa điểm đang nằm trong kế hoạch đã duyệt của đơn chưa giao xong; chưa thể đổi loại.');
          if (before.ruleCount > 0) throw new ConflictException('Địa điểm đang là cửa khẩu trong quy định kiểm dịch; chưa thể đổi loại.');
        }
        await repo.update(id, input);
        if (input.latitude !== before.latitude || input.longitude !== before.longitude) await repo.clearRoutes(id);
        const after = (await repo.find(id))!;
        await repo.audit(account.id, id, 'UPDATE', snapshot(before), snapshot(after));
        return after;
      });
    } catch (error) {
      if (dbCode(error) === 'ER_DUP_ENTRY') throw new ConflictException(DUPLICATE);
      throw error;
    }
  }
  async remove(account: User, rawId: string) {
    this.canWrite(account);
    const id = parse(locationIdSchema, rawId);
    try {
      await this.repository.transaction(async repo => {
        if (!await repo.lock(id)) throw new NotFoundException(NOT_FOUND);
        const before = (await repo.find(id))!;
        if (before.legCount > 0) throw new ConflictException('Địa điểm đã được dùng trong kế hoạch chuyến nên không thể xóa.');
        if (before.ruleCount > 0) throw new ConflictException('Địa điểm đang là cửa khẩu trong quy định kiểm dịch nên không thể xóa.');
        await repo.remove(id);
        await repo.audit(account.id, id, 'DELETE', snapshot(before), null);
      });
    } catch (error) {
      if (dbCode(error) === 'ER_ROW_IS_REFERENCED_2') throw new ConflictException('Địa điểm đang được tham chiếu nên không thể xóa.');
      throw error;
    }
  }
}
