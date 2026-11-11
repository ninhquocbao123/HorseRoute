import type { RequestHandler } from 'express';
import { Role } from '@my-project/shared';
import { UsersService } from '../../features/users/users.service';
import { TokenService } from '../utils/jwt.util';
import { ForbiddenException, UnauthorizedException } from '../core/error.response';
export function authenticate(users: UsersService, tokens: TokenService): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Thiếu token.');
    const payload = tokens.verify(header.slice(7));
    const user = await users.getById(payload.sub!);
    if (user.accountStatus !== 'ACTIVE') throw new ForbiddenException('Tài khoản không hoạt động.');
    // Đổi, đặt lại mật khẩu hoặc bị khóa thì token_version tăng: token cũ hết hiệu lực. Token cũ không có ver được coi là 0.
    if (Number(user.tokenVersion ?? 0) !== Number(payload.ver ?? 0)) throw new UnauthorizedException('Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.');
    req.account = user;
    next();
  };
}
export function authorize(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.account) throw new UnauthorizedException('Thiếu token.');
    if (!roles.includes(req.account.role)) throw new ForbiddenException('Không đủ quyền');
    next();
  };
}

