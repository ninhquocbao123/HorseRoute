import { useEffect, useRef, useState } from 'react';
import { AutoComplete, Input } from 'antd';
import { Marker, type MapMouseEvent, type MapRef, type MarkerDragEvent } from 'react-map-gl/mapbox';
import BaseMap from './BaseMap';
import { useMapRuntime } from './MapView';
import { DEFAULT_VIEW, formatCoordinate } from './map-style';

export type LatLng = { latitude: number; longitude: number };
type Place = { id: string; label: string; detail: string; longitude: number; latitude: number; bbox?: [number, number, number, number] };

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
const PIN_ZOOM = 12;

/**
 * Mapbox Geocoding v6, used only to move the map. Results are temporary geocoding: they are never saved;
 * the stored coordinate is always the pin the Specialist places (Mapbox terms forbid storing temporary results).
 */
async function searchPlaces(query: string, token: string, country: string | undefined, signal: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, access_token: token, language: 'vi', limit: '6', autocomplete: 'true' });
  if (country) params.set('country', country.toLowerCase());
  const response = await fetch('https://api.mapbox.com/search/geocode/v6/forward?' + params, { signal });
  if (!response.ok) throw new Error('geocoding ' + response.status);
  const data = await response.json() as { features?: { id: string; geometry: { coordinates: [number, number] }; properties: { name?: string; full_address?: string; place_formatted?: string; bbox?: [number, number, number, number] } }[] };
  return (data.features ?? []).map(feature => ({
    id: feature.id,
    label: feature.properties.name ?? feature.properties.full_address ?? '',
    detail: feature.properties.place_formatted ?? feature.properties.full_address ?? '',
    longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1], bbox: feature.properties.bbox,
  }));
}

/** Click or drag the pin to set WGS84 coordinates; the search box only pans the map. */
export default function LocationPickerMap({ value, onChange, country, disabled = false }: {
  value: LatLng | null; onChange: (value: LatLng) => void; country?: string; disabled?: boolean;
}) {
  const { config } = useMapRuntime();
  const map = useRef<MapRef>(null);
  const lastPicked = useRef<LatLng | null>(null);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [searchError, setSearchError] = useState('');

  function pick(lngLat: { lng: number; lat: number }) {
    if (disabled) return;
    const next = { latitude: round6(lngLat.lat), longitude: round6(lngLat.lng) };
    lastPicked.current = next;
    onChange(next);
  }

  // Coordinates typed into the form: bring the pin into view. Picks made on the map do not move it.
  useEffect(() => {
    if (!value || !map.current) return;
    const picked = lastPicked.current;
    if (picked && picked.latitude === value.latitude && picked.longitude === value.longitude) return;
    map.current.easeTo({ center: [value.longitude, value.latitude], zoom: Math.max(map.current.getZoom(), PIN_ZOOM), duration: 600 });
  }, [value]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) { setPlaces([]); setSearchError(''); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchPlaces(text, config.token, country, controller.signal)
        .then(result => { setPlaces(result); setSearchError(result.length ? '' : 'Không tìm thấy nơi phù hợp.'); })
        .catch(error => { if (!controller.signal.aborted) { setPlaces([]); setSearchError('Không tìm kiếm được lúc này; hãy kéo bản đồ hoặc nhập tọa độ.'); console.warn('[map] search', error); } });
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, country, config.token]);

  function goTo(id: string) {
    const place = places.find(p => p.id === id);
    if (!place || !map.current) return;
    if (place.bbox) map.current.fitBounds([[place.bbox[0], place.bbox[1]], [place.bbox[2], place.bbox[3]]], { padding: 40, maxZoom: 15, duration: 800 });
    else map.current.flyTo({ center: [place.longitude, place.latitude], zoom: 14, duration: 800 });
    setQuery(place.label);
  }

  return (
    <div className="trackmap-picker">
      <AutoComplete
        className="trackmap-search" value={query} onChange={setQuery} onSelect={goTo} disabled={disabled}
        options={places.map(place => ({ value: place.id, label: <span className="trackmap-place"><strong>{place.label}</strong><small>{place.detail}</small></span> }))}
        notFoundContent={searchError || undefined}
      >
        <Input.Search placeholder="Tìm nơi để di chuyển bản đồ (không tự đặt ghim)" aria-label="Tìm nơi trên bản đồ" allowClear />
      </AutoComplete>
      <BaseMap
        ref={map}
        initialViewState={value ? { ...value, zoom: PIN_ZOOM } : DEFAULT_VIEW}
        cursor={disabled ? 'default' : 'crosshair'}
        onClick={(event: MapMouseEvent) => pick(event.lngLat)}
      >
        {value && (
          <Marker longitude={value.longitude} latitude={value.latitude} anchor="bottom" draggable={!disabled}
            onDragEnd={(event: MarkerDragEvent) => pick(event.lngLat)}>
            <span className="trackmap-pin" role="img" aria-label={`Vị trí đã ghim: ${formatCoordinate(value.latitude)}, ${formatCoordinate(value.longitude)}`} />
          </Marker>
        )}
      </BaseMap>
      <p className="trackmap-help">{disabled ? 'Chỉ xem.' : value ? 'Kéo ghim hoặc bấm chỗ khác để chỉnh vị trí.' : 'Bấm lên bản đồ để đặt ghim vị trí.'}</p>
    </div>
  );
}
