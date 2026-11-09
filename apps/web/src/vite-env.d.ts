/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** 'false' turns every map off (fallback only). Default: enabled. */
  readonly VITE_MAP_ENABLED?: string;
  /** MapLibre style URL. Default: OpenFreeMap Positron. */
  readonly VITE_MAP_STYLE?: string;
  /** Photon-compatible search endpoint for the location picker. Default: photon.komoot.io. */
  readonly VITE_GEOCODING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
