import { Role } from '@my-project/shared';
import { User } from '../users/users.model';
import { parse } from '../../shared/utils/validation.util';
import { ConflictException, ForbiddenException, NotFoundException } from '../../shared/core/error.response';
import { VehicleItem, VehiclesRepository } from './vehicles.repository';
import { createVehicleSchema, updateVehicleSchema, vehicleIdSchema, vehicleQuerySchema } from './vehicles.validation';

const dbCode = (error: unknown) => (error as { code?: string }).code ?? (error as { driverError?: { code?: string } }).driverError?.code;
const DUPLICATE = 'Biển số hoặc mã xe đã tồn tại.';
const snapshot = (v: VehicleItem) => ({ plateOrCode: v.plateOrCode, vehicleType: v.vehicleType, capacityStalls: v.capacityStalls, status: v.status });

export class VehiclesService {
  constructor(private readonly repository: VehiclesRepository) {}
  private canRead(account: Pick<User, 'role'>) {
    if (account.role !== Role.COORDINATOR && account.role !== Role.MANAGER) throw new ForbiddenException('Không đủ quyền');
  }
  private canWrite(account: Pick<User, 'role'>) {
    if (account.role !== Role.COORDINATOR) throw new ForbiddenException('Chỉ Coordinator được quản lý phương tiện.');
  }
  async list(account: User, rawQuery: unknown) {
    this.canRead(account);
    const query = parse(vehicleQuerySchema, rawQuery);
    const { rows, total } = await this.repository.list(query.status, query.q || undefined, query.limit, (query.page - 1) * query.limit);
    return { items: rows, total, page: query.page, limit: query.limit };
  }
  async detail(account: User, rawId: string) {
    this.canRead(account);
    const vehicle = await this.repository.find(parse(vehicleIdSchema, rawId));
    if (!vehicle) throw new NotFoundException('Không tìm thấy phương tiện.');
    return vehicle;
  }
  async create(account: User, body: unknown) {
    this.canWrite(account);
    const input = parse(createVehicleSchema, body);
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
    const id = parse(vehicleIdSchema, rawId), input = parse(updateVehicleSchema, body);
    try {
      return await this.repository.transaction(async repo => {
        if (!await repo.lock(id)) throw new NotFoundException('Không tìm thấy phương tiện.');
        const before = (await repo.find(id))!;
        const uses = await repo.uses(id);
        if (before.status !== input.status && uses.length) {
          throw new ConflictException(`Xe đang nằm trong kế hoạch đã duyệt của đơn ${uses.map(u => u.orderCode).join(', ')}; chưa thể đổi trạng thái vận hành.`);
        }
        const need = Math.max(0, ...uses.map(u => u.horseCount));
        if (input.capacityStalls < need) {
          throw new ConflictException(`Xe đang được dùng cho đơn cần chở ${need} ngựa; sức chứa không được nhỏ hơn ${need}.`);
        }
        await repo.update(id, input);
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
    const id = parse(vehicleIdSchema, rawId);
    try {
      await this.repository.transaction(async repo => {
        if (!await repo.lock(id)) throw new NotFoundException('Không tìm thấy phương tiện.');
        const before = (await repo.find(id))!;
        if (before.legCount > 0) {
          throw new ConflictException('Xe đã được dùng trong kế hoạch chuyến nên không thể xóa; hãy quản lý bằng trạng thái vận hành.');
        }
        await repo.remove(id);
        await repo.audit(account.id, id, 'DELETE', snapshot(before), null);
      });
    } catch (error) {
      if (dbCode(error) === 'ER_ROW_IS_REFERENCED_2') throw new ConflictException('Xe đang được tham chiếu nên không thể xóa; hãy quản lý bằng trạng thái vận hành.');
      throw error;
    }
  }
}
