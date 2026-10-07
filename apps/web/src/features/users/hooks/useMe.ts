import { useQuery } from '@tanstack/react-query';
import { getMe } from '../api/users.api';

export const useMe = (enabled = true) =>
  useQuery({ queryKey: ['users', 'me'], queryFn: getMe, enabled });
