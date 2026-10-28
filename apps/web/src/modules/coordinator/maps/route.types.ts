import type { LineString } from 'geojson'

export type LatLng = [lat: number, lng: number]

export interface Waypoint {
  id: string
  label: string
  kind: 'origin' | 'stop' | 'destination'
  position?: LatLng
}

export interface RouteCandidate {
  id: string
  geometry: LineString
  distanceM: number
  durationS: number
}

export interface RouteSnapshot extends RouteCandidate {
  waypoints: Waypoint[]
  inputKey: string
  calculatedAt: string
  provider: 'osrm'
  profile: 'driving'
}

export interface AddressResult {
  id: string
  label: string
  position: LatLng
}
