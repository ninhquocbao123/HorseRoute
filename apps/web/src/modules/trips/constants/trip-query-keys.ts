import type { TripListParams } from "../types/trip.types";

export const tripQueryKeys = {
  list: (accountId: string | undefined, params: TripListParams) =>
    ["trips", accountId, "list", params] as const,
  detail: (accountId: string | undefined, tripId: string) =>
    ["trips", accountId, tripId, "detail"] as const,
};

