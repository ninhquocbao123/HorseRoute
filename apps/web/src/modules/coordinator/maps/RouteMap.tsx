import { useEffect, useMemo, useState } from 'react'
import { Alert, Button } from 'antd'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { LineString } from 'geojson'
import type { LatLng, Waypoint } from './route.types'
import 'leaflet/dist/leaflet.css'
import './route-map.css'

interface Props {
  waypoints: Waypoint[]
  geometry?: LineString
  readOnly?: boolean
  picking?: boolean
  onPick?: (position: LatLng) => void
  onMove?: (id: string, position: LatLng) => void
}

function MapBehavior({ points, picking, onPick }: { points: LatLng[]; picking?: boolean; onPick?: Props['onPick'] }) {
  const map = useMap()
  useMapEvents({ click: e => { if (picking) onPick?.([e.latlng.lat, e.latlng.lng]) } })
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 14 })
    else if (points.length === 1) map.setView(points[0], 13)
  }, [map, points])
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

export function RouteMap({ waypoints, geometry, readOnly = false, picking, onPick, onMove }: Props) {
  const [tileError, setTileError] = useState(false)
  const [tileRevision, setTileRevision] = useState(0)
  const line = useMemo<LatLng[]>(() => geometry?.coordinates.map(([lng, lat]) => [lat, lng]) ?? [], [geometry])
  const points = useMemo(() => line.length ? line : waypoints.flatMap(p => p.position ? [p.position] : []), [line, waypoints])
  return <div className={`osm-map-frame ${picking ? 'is-picking' : ''}`} aria-label="Bản đồ lộ trình OpenStreetMap">
    {tileError && <Alert type="warning" title="Một số ảnh nền bản đồ chưa tải được. Kiểm tra kết nối hoặc thử lại." action={<Button size="small" onClick={() => { setTileError(false); setTileRevision(n => n + 1) }}>Tải lại nền</Button>} />}
    <MapContainer center={[16.1, 106.3]} zoom={5} scrollWheelZoom={false} className="osm-map">
      <TileLayer key={tileRevision} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url={import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} eventHandlers={{ tileerror: () => setTileError(true) }} />
      <MapBehavior points={points} picking={!readOnly && picking} onPick={onPick} />
      {line.length > 0 && <Polyline positions={line} pathOptions={{ color: '#0f6872', weight: 5, opacity: 0.9 }} />}
      {waypoints.map((p, i) => p.position && <Marker key={p.id} position={p.position} draggable={!readOnly && Boolean(onMove)} icon={L.divIcon({ className: 'osm-number-marker', html: `<span class="osm-point-${p.kind}">${i + 1}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] })} eventHandlers={{ dragend: event => { if (!readOnly) { const position = (event.target as L.Marker).getLatLng(); onMove?.(p.id, [position.lat, position.lng]) } } }}><Tooltip>{p.label}</Tooltip></Marker>)}
    </MapContainer>
  </div>
}
