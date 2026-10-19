import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import { isValidTripId } from '../utils/trip-detail.utils';
import { getTripDetail } from '../api/trips.api';
import { tripQueryKeys } from '../constants/trip-query-keys';

/**
 * Fetches trip detail by ID.
 * Enabled only when account exists with MANAGER/COORDINATOR role and tripId is a valid BIGINT UNSIGNED string.
 * Retries once for server errors; does not retry for 4xx.
 */
export function useTripDetailQuery(tripId: string | undefined) {
  const { account } = useAuth();
  const validId = isValidTripId(tripId) ? tripId : '';

  return useQuery({
    queryKey: tripQueryKeys.detail(account?.id, validId),
    queryFn: ({ signal }) => getTripDetail(validId, signal),
    enabled: !!account && ['MANAGER', 'COORDINATOR'].includes(account.role) && validId.length > 0,
    retry: (count, error) => {
      if (isAxiosError(error) && error.response && error.response.status < 500) return false;
      return count < 1;
    },
  });
}

