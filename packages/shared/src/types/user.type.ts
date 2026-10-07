import { Role } from '../enums/role.enum';

export interface IUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName?: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface IPaginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
