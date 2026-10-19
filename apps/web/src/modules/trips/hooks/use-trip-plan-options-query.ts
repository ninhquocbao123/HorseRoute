import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import { getTripPlanOptions } from '../api/trips.api';
import { tripQueryKeys } from '../constants/trip-query-keys';
export function useTripPlanOptionsQuery(tripId:string|undefined) { const {account}=useAuth(); return useQuery({queryKey:tripQueryKeys.planOptions(account?.id,tripId||''),queryFn:({signal})=>getTripPlanOptions(tripId!,signal),enabled:!!tripId&&account?.role==='COORDINATOR'}); }
