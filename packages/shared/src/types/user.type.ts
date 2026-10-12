import { Role } from '../enums/role.enum';

export interface IUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  address: string | null;
  accountStatus: 'ACTIVE' | 'LOCKED' | 'PENDING';
  role: Role;
  createdAt: string;
}

export interface IPaginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

