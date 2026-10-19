import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import { getAssignmentOptions,getTripAssignments } from '../api/trips.api';
import { tripQueryKeys } from '../constants/trip-query-keys';
export function useTripAssignmentsQuery(id:string|undefined){const {account}=useAuth();const enabled=!!id&&!!account&&['MANAGER','COORDINATOR'].includes(account.role);return {assignments:useQuery({queryKey:tripQueryKeys.assignments(account?.id,id||''),queryFn:({signal})=>getTripAssignments(id!,signal),enabled}),options:useQuery({queryKey:tripQueryKeys.assignmentOptions(account?.id,id||''),queryFn:({signal})=>getAssignmentOptions(id!,signal),enabled})};}
