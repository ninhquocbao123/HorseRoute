import type { User } from '../../features/users/users.model';
declare global {
  namespace Express { interface Request { account: User; } }
}
export {};

