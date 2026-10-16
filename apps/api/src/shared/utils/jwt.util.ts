import jwt from 'jsonwebtoken';
import { UnauthorizedException } from '../core/error.response';
export class TokenService {
  constructor(private readonly secret: string) {}
  sign(payload: { sub: string; email: string; role: string }) {
    return jwt.sign(payload, this.secret, { algorithm: 'HS256', expiresIn: '7d' });
  }
  verify(token: string) {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || typeof payload.sub !== 'string' || !/^[1-9]\d{0,19}$/.test(payload.sub)) throw new Error('subject');
      return payload;
    } catch { throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn.'); }
  }
}

