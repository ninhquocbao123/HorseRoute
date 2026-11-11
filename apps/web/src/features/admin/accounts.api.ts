import { api } from '../../lib/axios';

export const STAFF_KINDS = [
  { value: 'ADMIN', label: 'Quản trị' },
  { value: 'MANAGER', label: 'Quản lý' },
  { value: 'SPECIALIST', label: 'Chuyên viên' },
  { value: 'COORDINATOR', label: 'Điều phối' },
  { value: 'DRIVER', label: 'Tài xế' },
  { value: 'ESCORT', label: 'Hộ tống' },
] as const;
export type StaffKind = typeof STAFF_KINDS[number]['value'];
export type AccountStatus = 'ACTIVE' | 'LOCKED' | 'PENDING';
export type Account = {
  id: string; email: string; fullName: string; phone: string | null; role: string; kind: string;
  status: AccountStatus; workStatus: 'AVAILABLE' | 'RESERVED' | 'IN_TRIP' | null; createdAt: string;
};
export type AccountQuery = { page: number; limit: number; kind?: string; status?: AccountStatus; q?: string };

export const kindLabel = (kind: string) => STAFF_KINDS.find(k => k.value === kind)?.label ?? (kind === 'CUSTOMER' ? 'Khách hàng' : kind);
export const statusLabel: Record<AccountStatus, string> = { ACTIVE: 'Hoạt động', LOCKED: 'Đã khóa', PENDING: 'Chờ kích hoạt' };
export const workLabel: Record<string, string> = { AVAILABLE: 'Rảnh', RESERVED: 'Đã giữ chỗ', IN_TRIP: 'Đang chạy chuyến' };

export const accountsApi = {
  list: (query: AccountQuery, signal?: AbortSignal) =>
    api.get<{ items: Account[]; total: number }>('/admin/accounts', { params: { ...query, q: query.q || undefined }, signal }).then(r => r.data),
  create: (input: { email: string; fullName: string; phone?: string; kind: StaffKind; password: string }) =>
    api.post<Account>('/admin/accounts', input).then(r => r.data),
  update: (id: string, input: { fullName: string; phone?: string; kind?: StaffKind }) =>
    api.patch<Account>(`/admin/accounts/${encodeURIComponent(id)}`, input).then(r => r.data),
  setLocked: (id: string, locked: boolean, reason: string) =>
    api.post<Account>(`/admin/accounts/${encodeURIComponent(id)}/${locked ? 'lock' : 'unlock'}`, { reason }).then(r => r.data),
  resetPassword: (id: string, password: string) =>
    api.post<{ message: string }>(`/admin/accounts/${encodeURIComponent(id)}/reset-password`, { password }).then(r => r.data),
};
