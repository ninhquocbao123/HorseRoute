import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import { getTrips } from '../api/trips.api';
import { tripQueryKeys } from '../constants/trip-query-keys';
import type { TripListParams } from '../types/trip.types';

export function useTripsQuery(params: TripListParams) {
  const { account } = useAuth();
  return useQuery({
    queryKey: tripQueryKeys.list(account?.id, params),
    queryFn: ({ signal }) => getTrips(params, signal),
    enabled: !!account && ['MANAGER', 'COORDINATOR'].includes(account.role),
    retry: (count, error) => {
      if (isAxiosError(error) && error.response && error.response.status < 500) return false;
      return count < 1;
    },
  });
}
