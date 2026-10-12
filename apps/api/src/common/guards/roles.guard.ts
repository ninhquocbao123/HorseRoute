import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@my-project/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UsersService } from '../../modules/users/users.service';

/** Quyền và trạng thái được đọc lại từ MySQL trên mỗi request. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly users: UsersService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest();
    const user = await this.users.getById(req.user.sub);
    if (user.accountStatus !== 'ACTIVE') throw new ForbiddenException('Tài khoản không hoạt động.');
    if (required?.length && !required.includes(user.role)) throw new ForbiddenException('Không đủ quyền');
    req.account = user;
    return true;
  }
}
