import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@my-project/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';

/** Đọc role từ Firebase custom claim `role` (mặc định USER). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;
    const user = ctx.switchToHttp().getRequest().user;
    const role: Role = user?.role ?? Role.USER;
    if (!required.includes(role)) throw new ForbiddenException('Không đủ quyền');
    return true;
  }
}
