import {
  CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import * as admin from 'firebase-admin';
import { FIREBASE_ADMIN } from '../../infrastructure/firebase/firebase.module';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject(FIREBASE_ADMIN) private readonly firebase: admin.app.App,
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Thiếu token');

    const cacheKey = `auth:token:${createHash('sha256').update(token).digest('hex')}`;
    let decoded = await this.redis.get<admin.auth.DecodedIdToken>(cacheKey);

    if (!decoded) {
      try {
        decoded = await this.firebase.auth().verifyIdToken(token);
      } catch {
        throw new UnauthorizedException('Token không hợp lệ');
      }
      const ttl = Math.min(300, decoded.exp - Math.floor(Date.now() / 1000));
      await this.redis.set(cacheKey, decoded, ttl);
    }

    req.user = decoded;
    return true;
  }
}
