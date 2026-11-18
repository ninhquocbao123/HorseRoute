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
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  kind: string;
  status: AccountStatus;
  workStatus: 'AVAILABLE' | 'RESERVED' | 'IN_TRIP' | null;
  createdAt: string;
};

export type AccountQuery = {
  page: number;
  limit: number;
  kind?: string;
  status?: AccountStatus;
  q?: string;
};

export const kindLabel = (kind: string) =>
  STAFF_KINDS.find(k => k.value === kind)?.label ?? (kind === 'CUSTOMER' ? 'Khách hàng' : kind);

export const statusLabel: Record<AccountStatus, string> = {
  ACTIVE: 'Hoạt động',
  LOCKED: 'Đã khóa',
  PENDING: 'Chờ kích hoạt',
};

export const workLabel: Record<string, string> = {
  AVAILABLE: 'Rảnh',
  RESERVED: 'Đã giữ chỗ',
  IN_TRIP: 'Đang chạy chuyến',
};

export type AdminOverviewStats = {
  total: number;
  staff: number;
  customer: number;
  active: number;
  locked: number;
  pending: number;
  crew: {
    total: number;
    driver: number;
    escort: number;
  };
  roles: {
    admin: number;
    manager: number;
    specialist: number;
    coordinator: number;
    driver: number;
    escort: number;
    customer: number;
  };
};

export const accountsApi = {
  list: (query: AccountQuery, signal?: AbortSignal) =>
    api.get<{ items: Account[]; total: number }>('/admin/accounts', {
      params: { ...query, q: query.q || undefined },
      signal,
    }).then(r => r.data),

  create: (input: { email: string; fullName: string; phone?: string; kind: StaffKind; password: string }) =>
    api.post<Account>('/admin/accounts', input).then(r => r.data),

  update: (id: string, input: { fullName: string; phone?: string; kind?: StaffKind }) =>
    api.patch<Account>(`/admin/accounts/${encodeURIComponent(id)}`, input).then(r => r.data),

  setLocked: (id: string, locked: boolean, reason: string) =>
    api.post<Account>(`/admin/accounts/${encodeURIComponent(id)}/${locked ? 'lock' : 'unlock'}`, { reason }).then(r => r.data),

  resetPassword: (id: string, password: string) =>
    api.post<{ message: string }>(`/admin/accounts/${encodeURIComponent(id)}/reset-password`, { password }).then(r => r.data),

  getOverviewStats: async (signal?: AbortSignal): Promise<AdminOverviewStats> => {
    const [
      all,
      staff,
      customer,
      active,
      locked,
      pending,
      admin,
      manager,
      specialist,
      coordinator,
      driver,
      escort,
    ] = await Promise.all([
      accountsApi.list({ page: 1, limit: 1 }, signal),
      accountsApi.list({ page: 1, limit: 1, kind: 'STAFF' }, signal),
      accountsApi.list({ page: 1, limit: 1, kind: 'CUSTOMER' }, signal),
      accountsApi.list({ page: 1, limit: 1, status: 'ACTIVE' }, signal),
      accountsApi.list({ page: 1, limit: 1, status: 'LOCKED' }, signal),
      accountsApi.list({ page: 1, limit: 1, status: 'PENDING' }, signal),
      accountsApi.list({ page: 1, limit: 1, kind: 'ADMIN' }, signal),
      accountsApi.list({ page: 1, limit: 1, kind: 'MANAGER' }, signal),
      accountsApi.list({ page: 1, limit: 1, kind: 'SPECIALIST' }, signal),
      accountsApi.list({ page: 1, limit: 1, kind: 'COORDINATOR' }, signal),
      accountsApi.list({ page: 1, limit: 1, kind: 'DRIVER' }, signal),
      accountsApi.list({ page: 1, limit: 1, kind: 'ESCORT' }, signal),
    ]);

    return {
      total: all.total,
      staff: staff.total,
      customer: customer.total,
      active: active.total,
      locked: locked.total,
      pending: pending.total,
      crew: {
        total: driver.total + escort.total,
        driver: driver.total,
        escort: escort.total,
      },
      roles: {
        admin: admin.total,
        manager: manager.total,
        specialist: specialist.total,
        coordinator: coordinator.total,
        driver: driver.total,
        escort: escort.total,
        customer: customer.total,
      },
    };
  },
};
