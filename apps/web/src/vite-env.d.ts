/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Mapbox public token (pk.*). Missing → map shows fallback. */
  readonly VITE_MAPBOX_TOKEN?: string;
  /** 'false' turns every map off (fallback only). Default: enabled. */
  readonly VITE_MAP_ENABLED?: string;
  /** Mapbox style URL. Default: mapbox://styles/mapbox/light-v11. */
  readonly VITE_MAP_STYLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
