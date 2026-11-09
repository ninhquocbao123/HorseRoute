import type { LineString } from 'geojson'

export type LatLng = [lat: number, lng: number]

export interface Waypoint {
  id: string
  label: string
  kind: 'origin' | 'stop' | 'destination'
  position?: LatLng
}

export interface RouteCandidate {
  geometry: LineString
  distanceM: number
  durationS: number
  /** 'mapbox' chỉ còn ở các tuyến đã lưu trước khi chuyển sang OSRM. */
  provider: 'mapbox' | 'osrm'
  calculatedAt: string
  inputKey: string
  verificationToken: string
}

export interface AddressResult {
  id: string
  label: string
  latitude: number
  longitude: number
}
