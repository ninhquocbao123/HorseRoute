export const coordinatorPaths = {
  root: "/coordinator",
  dashboard: "/coordinator/dashboard",
  trips: "/coordinator/trips",
  operations: "/coordinator/operations",
  fleet: "/coordinator/fleet",
  notifications: "/coordinator/notifications",
  account: "/coordinator/account",
} as const;

export function coordinatorLegacyTripPath(pathname: string) {
  return pathname.replace(/^\/dashboard\/trips/, coordinatorPaths.trips);
}
