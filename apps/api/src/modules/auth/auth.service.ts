import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService) {}

  /** Đồng bộ user Firebase vào MySQL (tạo nếu chưa có). */
  async sync(decoded: { uid: string; email?: string; name?: string }) {
    const existing = await this.users.findByFirebaseUid(decoded.uid);
    if (existing) return existing;
    return this.users.create({
      firebaseUid: decoded.uid,
      email: decoded.email ?? `${decoded.uid}@no-email.local`,
      displayName: decoded.name ?? null,
    });
  }
}
