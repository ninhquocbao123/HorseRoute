import { api } from '../../../lib/axios';
import type { IUser } from '@my-project/shared';

export interface LoginResponse {
  accessToken: string;
  user: IUser;
}

export const login = (email: string, password: string) =>
  api.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data);

export const register = (email: string, password: string, fullName: string, phone: string, address: string) =>
  api.post<LoginResponse>('/auth/register', { email, password, fullName, phone, address }).then((r) => r.data);

export const getMe = () => api.get<IUser>('/users/me').then((r) => r.data);

