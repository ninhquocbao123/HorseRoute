import { lazy } from 'react';
// Each map is its own chunk: maplibre-gl downloads only when a map is actually shown.
export const LocationPickerMap = lazy(() => import('./LocationPickerMap'));
export const DriverRouteMap = lazy(() => import('./DriverRouteMap'));
export const CustomerRouteMap = lazy(() => import('./CustomerRouteMap'));
