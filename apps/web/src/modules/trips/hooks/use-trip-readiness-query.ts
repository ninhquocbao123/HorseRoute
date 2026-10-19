import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import { getTripReadiness } from '../api/trips.api';
import { tripQueryKeys } from '../constants/trip-query-keys';
import { isValidTripId } from '../utils/trip-detail.utils';

export function useTripReadinessQuery(tripId: string | undefined) {
  const { account } = useAuth();
  const validId = isValidTripId(tripId) ? tripId : '';
  return useQuery({
    queryKey: tripQueryKeys.readiness(account?.id, validId),
    queryFn: ({ signal }) => getTripReadiness(validId, signal),
    enabled: !!account && ['MANAGER', 'COORDINATOR'].includes(account.role) && !!validId,
    retry: (count, error) => {
      if (isAxiosError(error) && error.response && error.response.status < 500) return false;
      return count < 1;
    },
  });
}
