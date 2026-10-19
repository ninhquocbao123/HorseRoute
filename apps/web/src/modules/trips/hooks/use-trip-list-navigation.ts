import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { readTripListParams, tripListSearch } from '../utils/trip-list.utils';

export function useTripListNavigation() {
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const params = readTripListParams(search);
  const canonical = tripListSearch(params).slice(1);
  // Normalize invalid/repeated/unsupported parameters before they reach the API.
  useEffect(() => {
    if (search.toString() !== canonical) setSearch(canonical, { replace: true });
  }, [search, canonical, setSearch]);

  return {
    params,
    setPage: (page: number, replace = false) => setSearch(tripListSearch({ ...params, page }), { replace }),
    setLimit: (limit: number) => setSearch(tripListSearch({ page: 1, limit })),
    openTrip: (id: string) => navigate(`/dashboard/trips/${encodeURIComponent(id)}${tripListSearch(params)}`),
  };
}
