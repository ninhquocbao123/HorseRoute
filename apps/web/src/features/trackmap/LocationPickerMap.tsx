import { useEffect, useRef, useState } from 'react';
import { AutoComplete, Input } from 'antd';
import { Marker, type MapMouseEvent, type MapRef, type MarkerDragEvent } from 'react-map-gl/maplibre';
import BaseMap from './BaseMap';
import { DEFAULT_VIEW, formatCoordinate, geocodingUrl } from './map-style';

export type LatLng = { latitude: number; longitude: number };
type Place = { id: string; label: string; detail: string; longitude: number; latitude: number; bbox?: [number, number, number, number] };

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
const PIN_ZOOM = 12;

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string; osm_id?: number; name?: string; housenumber?: string; street?: string; district?: string; city?: string; state?: string; country?: string;
    /** [tây, bắc, đông, nam] */
    extent?: [number, number, number, number];
  };
};

/**
 * Photon, used only to move the map. The stored coordinate is always the pin the Specialist places.
 * Photon has no Vietnamese option (lang=vi is rejected) and otherwise follows the browser's Accept-Language, which turns
 * "Đắk Lắk, Việt Nam" into "Dak Lak province, Vietnam": lang=default keeps names as written in OpenStreetMap.
 */
async function searchPlaces(query: string, country: string | undefined, signal: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, limit: '6', lang: 'default' });
  if (country) params.set('countrycode', country.toUpperCase());
  else { params.set('lat', '16'); params.set('lon', '106'); } // ưu tiên kết quả gần Việt Nam
  const response = await fetch(geocodingUrl + '?' + params, { signal });
  if (!response.ok) throw new Error('geocoding ' + response.status);
  const data = await response.json() as { features?: PhotonFeature[] };
  return (data.features ?? []).map((feature, index) => {
    const { osm_type, osm_id, name, housenumber, street, district, city, state, country: countryName, extent } = feature.properties;
    const address = [housenumber, street].filter(Boolean).join(' ');
    return {
      id: `${osm_type ?? 'place'}${osm_id ?? ''}-${index}`,
      label: name ?? address,
      detail: [name ? address : '', district, city, state, countryName].filter(Boolean).join(', '),
      longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1],
      bbox: extent ? [extent[0], extent[3], extent[2], extent[1]] : undefined,
    };
  });
}

/** Click or drag the pin to set WGS84 coordinates; the search box only pans the map. */
export default function LocationPickerMap({ value, onChange, country, disabled = false }: {
  value: LatLng | null; onChange: (value: LatLng) => void; country?: string; disabled?: boolean;
}) {
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
      searchPlaces(text, country, controller.signal)
        .then(result => { setPlaces(result); setSearchError(result.length ? '' : 'Không tìm thấy nơi phù hợp.'); })
        .catch(error => { if (!controller.signal.aborted) { setPlaces([]); setSearchError('Không tìm kiếm được lúc này; hãy kéo bản đồ hoặc nhập tọa độ.'); console.warn('[map] search', error); } });
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, country]);

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
