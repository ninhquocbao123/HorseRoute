import { Component, createContext, Suspense, useCallback, useContext, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import MapFallback from './MapFallback';
import { mapAvailability, type MapConfig, type MapUnavailableReason } from './map-style';
import './trackmap.css';

type MapRuntime = { config: MapConfig; height: number; label: string; fail: (reason: MapUnavailableReason) => void };
const MapRuntimeContext = createContext<MapRuntime | null>(null);

/** For lazy map components rendered inside <MapView>. */
export function useMapRuntime(): MapRuntime {
  const runtime = useContext(MapRuntimeContext);
  if (!runtime) throw new Error('Map components must be rendered inside <MapView>.');
  return runtime;
}

/** A failed chunk download (offline, new deploy) must not take the page down. */
class MapErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.warn('[map] render failed', error, info.componentStack); this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * Boundary for every map on the site. Children are lazy map components (mapbox-gl lives only in their chunk).
 * Falls back when the map is turned off, has no token, lacks WebGL 2, or fails to load; `hint` tells the user
 * how to carry on without it.
 */
export default function MapView({ height = 320, label, hint, children }: { height?: number; label: string; hint?: ReactNode; children: ReactNode }) {
  const availability = useMemo(mapAvailability, []);
  const [failure, setFailure] = useState<MapUnavailableReason | null>(null);
  const [attempt, setAttempt] = useState(0);
  const fail = useCallback((reason: MapUnavailableReason) => setFailure(current => current ?? reason), []);
  const retry = () => { setFailure(null); setAttempt(n => n + 1); };

  if (!availability.ok) return <MapFallback reason={availability.reason} height={height}>{hint}</MapFallback>;
  if (failure) return <MapFallback reason={failure} height={height} onRetry={retry}>{hint}</MapFallback>;
  return (
    <MapRuntimeContext.Provider value={{ config: availability.config, height, label, fail }}>
      <MapErrorBoundary key={attempt} onError={() => fail('load-failed')}>
        <Suspense fallback={<MapFallback reason="loading" height={height} />}>{children}</Suspense>
      </MapErrorBoundary>
    </MapRuntimeContext.Provider>
  );
}
