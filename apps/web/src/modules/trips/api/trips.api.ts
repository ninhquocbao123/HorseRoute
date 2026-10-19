import { api } from "../../../lib/axios";
import type {
  TripDetail,
  TripListParams,
  TripListResponse,
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
