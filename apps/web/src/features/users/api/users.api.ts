import type { IUser } from '@my-project/shared';
import { api } from '../../../lib/axios';

export const syncUser = () => api.post<IUser>('/auth/sync').then((r) => r.data);
export const getMe = () => api.get<IUser>('/users/me').then((r) => r.data);
