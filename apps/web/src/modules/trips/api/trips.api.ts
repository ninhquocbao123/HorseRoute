import { api } from "../../../lib/axios";
import type {
  TripDetail,
  TripListParams,
  TripListResponse,
  TripPlanOptions, TripPlanInput,
} from "../types/trip.types";

export async function getTrips(
  { page, limit }: TripListParams,
  signal?: AbortSignal,
): Promise<TripListResponse> {
  const { data } = await api.get<TripListResponse>("/trips", {
    params: { page, limit },
    signal,
  });
  return data;
}
export async function getTripPlanOptions(tripId:string, signal?:AbortSignal) { const {data}=await api.get<TripPlanOptions>(`/trips/${encodeURIComponent(tripId)}/plan-options`,{signal}); return data; }
export async function saveTripPlan(tripId:string,input:TripPlanInput) { const {data}=await api.put<TripDetail>(`/trips/${encodeURIComponent(tripId)}/plan`,input); return data; }
export async function submitTripPlan(tripId:string) { const {data}=await api.post<TripDetail>(`/trips/${encodeURIComponent(tripId)}/submit-plan`,{}); return data; }
export async function reviewTripPlan(tripId:string,input:{decision:'APPROVED'}|{decision:'RETURNED';reason:string}) { const {data}=await api.post<TripDetail>(`/trips/${encodeURIComponent(tripId)}/review-plan`,input); return data; }
export async function getAssignmentOptions(tripId:string,signal?:AbortSignal){const {data}=await api.get<{items:import('../types/trip.types').CrewOption[]}>(`/trips/${encodeURIComponent(tripId)}/assignment-options`,{signal});return data;}
export async function getTripAssignments(tripId:string,signal?:AbortSignal){const {data}=await api.get<import('../types/trip.types').TripAssignments>(`/trips/${encodeURIComponent(tripId)}/assignments`,{signal});return data;}
export async function saveTripAssignments(tripId:string,input:import('../types/trip.types').TripAssignmentsInput){const {data}=await api.put<import('../types/trip.types').TripAssignments>(`/trips/${encodeURIComponent(tripId)}/assignments`,input);return data;}
export async function getTripDetail(
  tripId: string,
  signal?: AbortSignal,
): Promise<TripDetail> {
  const { data } = await api.get<TripDetail>(
    `/trips/${encodeURIComponent(tripId)}`,
    {
      signal,
    },
  );
  return data;
}
