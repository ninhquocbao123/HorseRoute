import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import Map, { NavigationControl, type ErrorEvent, type MapProps, type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapRuntime } from './MapView';
import { MAP_LOCALE } from './map-style';

const LOAD_TIMEOUT_MS = 20_000;
type BaseMapProps = Omit<MapProps, 'mapboxAccessToken' | 'mapStyle' | 'style' | 'children'> & { children?: ReactNode };

/** Only imported by lazy map chunks. Token, style, language and failure handling for every map. */
const BaseMap = forwardRef<MapRef, BaseMapProps>(function BaseMap({ children, onLoad, onError, ...props }, ref) {
  const { config, height, label, fail } = useMapRuntime();
  const loaded = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { if (!loaded.current) fail('timeout'); }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [fail]);

  function handleError(event: ErrorEvent) {
    onError?.(event);
    const status = (event.error as { status?: number } | undefined)?.status;
    // A bad token or missing style is fatal; a single failed tile after the style loaded is not.
    const styleLoaded = (event.target as { isStyleLoaded?: () => boolean } | undefined)?.isStyleLoaded?.() ?? false;
    const fatal = status === 401 || status === 403 || (!loaded.current && !styleLoaded);
    console.warn('[map] error', status ?? '', event.error?.message);
    if (fatal) fail('load-failed');
  }

  return (
    <div className={'trackmap' + (ready ? ' is-ready' : '')} style={{ height }} role="region" aria-label={label}>
      <Map
        ref={ref}
        {...props}
        mapboxAccessToken={config.token}
        mapStyle={config.style}
        language="vi"
        locale={MAP_LOCALE}
        style={{ width: '100%', height: '100%' }}
        onLoad={event => { loaded.current = true; setReady(true); onLoad?.(event); }}
        onError={handleError}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {children}
      </Map>
    </div>
  );
});
export default BaseMap;
