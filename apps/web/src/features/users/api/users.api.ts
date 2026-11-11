import { api } from '../../../lib/axios';
import type { IUser } from '@my-project/shared';

export interface LoginResponse {
  accessToken: string;
  user: IUser;
}

export const login = (email: string, password: string) =>
  api.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data);

/** Có cấu hình email thì đăng ký trả về yêu cầu xác minh thay vì phiên đăng nhập. */
export type VerificationRequired = { verificationRequired: true; email: string; message: string };
export const needsVerification = (value: LoginResponse | VerificationRequired): value is VerificationRequired => 'verificationRequired' in value;

export const register = (email: string, password: string, fullName: string, phone: string, address: string, customerType?: 'CLUB' | 'INDIVIDUAL', organizationName?: string) =>
  api.post<LoginResponse | VerificationRequired>('/auth/register', { email, password, fullName, phone, address, customerType, organizationName }).then((r) => r.data);

export const getMe = () => api.get<IUser>('/users/me').then((r) => r.data);

export const verifyEmail = (email: string, code: string) =>
  api.post<LoginResponse>('/auth/verify-email', { email, code }).then((r) => r.data);
export const resendVerification = (email: string) =>
  api.post<{ message: string }>('/auth/resend-verification', { email }).then((r) => r.data);
export const forgotPassword = (email: string) =>
  api.post<{ message: string }>('/auth/forgot-password', { email }).then((r) => r.data);
export const resetPassword = (email: string, code: string, password: string) =>
  api.post<{ message: string }>('/auth/reset-password', { email, code, password }).then((r) => r.data);

