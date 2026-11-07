import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import Map, { NavigationControl, type ErrorEvent, type MapProps, type MapRef } from 'react-map-gl/maplibre';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapRuntime } from './MapView';
import { loadLocalizedStyle } from './map-labels';
import { MAP_LOCALE } from './map-style';
import { MIN_ZOOM } from './map-view-plan';

const LOAD_TIMEOUT_MS = 20_000;
type BaseMapProps = Omit<MapProps, 'mapStyle' | 'style' | 'children'> & { children?: ReactNode };

/** Only imported by lazy map chunks. Style, language and failure handling for every map. */
const BaseMap = forwardRef<MapRef, BaseMapProps>(function BaseMap({ children, onLoad, onError, ...props }, ref) {
  const { config, height, label, fail } = useMapRuntime();
  const loaded = useRef(false);
  const [ready, setReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { if (!loaded.current) fail('timeout'); }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [fail]);

  useEffect(() => {
    let active = true;
    loadLocalizedStyle(config.style).then(
      style => { if (active) setMapStyle(style); },
      error => { console.warn('[map] style', error); if (active) fail('load-failed'); },
    );
    return () => { active = false; };
  }, [config.style, fail]);

  function handleError(event: ErrorEvent) {
    onError?.(event);
    const status = (event.error as { status?: number } | undefined)?.status;
    // A rejected style is fatal; a single failed tile is not, even before the first full render.
    const tileError = 'tile' in event || 'sourceId' in event;
    const styleLoaded = event.target?.isStyleLoaded?.() ?? false;
    const fatal = !tileError && (status === 401 || status === 403 || (!loaded.current && !styleLoaded));
    console.warn('[map] error', status ?? '', event.error?.message);
    if (fatal) fail('load-failed');
  }

  return (
    <div className={'trackmap' + (ready ? ' is-ready' : '')} style={{ height }} role="region" aria-label={label}>
      {mapStyle && (
        <Map
          ref={ref}
          {...props}
          mapStyle={mapStyle}
          minZoom={MIN_ZOOM}
          locale={MAP_LOCALE}
          style={{ width: '100%', height: '100%' }}
          onLoad={event => {
            loaded.current = true;
            setReady(true);
            // Chỉ ở môi trường dev: cho test trình duyệt đọc zoom/projection thật của bản đồ.
            if (import.meta.env?.DEV) (window as unknown as { __wdpMap?: unknown }).__wdpMap = event.target;
            onLoad?.(event);
          }}
          onError={handleError}
        >
          <NavigationControl position="top-right" showCompass={false} />
          {children}
        </Map>
      )}
    </div>
  );
});
export default BaseMap;
