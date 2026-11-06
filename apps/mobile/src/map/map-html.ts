/**
 * Trang HTML chạy MapLibre trong WebView. Không chứa dữ liệu chuyến: app gửi "cảnh" (map-scene.ts) xuống
 * qua window.__hr.render, trang báo lại ready, loaded, failed, userMoved.
 */
import { MIN_ZOOM, VN_VIEW } from "../../../../packages/shared/src/map/map-view-plan.ts";
import { MAPLIBRE_CSS, MAPLIBRE_JS } from "./vendor.generated";

export const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const MAP_PAGE_URL = "https://horseroute.local/";

const PAGE_SCRIPT = String.raw`
(function () {
  var config = window.__HR_CONFIG;
  var map = null, base = null, scene = null, installedDark = null, styleReady = false;
  var stopMarkers = [], stopsKey = '', vehicleMarker = null, vehicleKey = '';
  var fittedKey = null, wasNavigating = false, lastFollowKey = '';

  function send(type, detail) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, detail: detail == null ? '' : String(detail) }));
  }
  window.onerror = function (message) { send('log', message); };

  var NAME = ['coalesce', ['get', 'name:vi'], ['get', 'name:latin'], ['get', 'name']];
  var HIDDEN = /^(natural_earth|building-3d|poi_|road_area_pattern|road_one_way|highway-shield|road_shield|.*_hatching$|.*transit_rail)/;

  /** Làm dịu style gốc cho gần nền sáng, nhạt của web. Giữ nguyên nguồn tile, font, biểu tượng. */
  function tune(source, c) {
    var style = JSON.parse(JSON.stringify(source));
    style.layers = style.layers.filter(function (layer) { return !HIDDEN.test(layer.id); });
    style.layers.forEach(function (layer) {
      var id = layer.id, paint = layer.paint = layer.paint || {};
      if (layer.type === 'background') paint['background-color'] = c.land;
      else if (layer.type === 'fill') {
        delete paint['fill-pattern'];
        paint['fill-outline-color'] = 'rgba(0,0,0,0)';
        paint['fill-opacity'] = 1;
        if (id === 'water') paint['fill-color'] = c.water;
        else if (id === 'building') paint['fill-color'] = c.building;
        else if (/park|wood|grass|wetland|pitch|cemetery/.test(id)) paint['fill-color'] = c.green;
        else paint['fill-color'] = c.land;
      } else if (layer.type === 'line') {
        if (/^waterway/.test(id)) paint['line-color'] = c.water;
        else if (/^boundary/.test(id)) paint['line-color'] = c.boundary;
        else if (/casing|rail/.test(id)) paint['line-color'] = c.casing;
        else if (/^(road|tunnel|bridge|aeroway)/.test(id)) paint['line-color'] = c.road;
        else if (/park_outline/.test(id)) paint['line-opacity'] = 0;
      } else if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
        layer.layout['text-field'] = NAME;
        paint['text-color'] = /^water/.test(id) ? c.boundary : c.label;
        paint['text-halo-color'] = c.halo;
        paint['text-halo-width'] = 1.2;
      }
    });
    return style;
  }

  function collection(lines) {
    return { type: 'FeatureCollection', features: lines.map(function (line) {
      return { type: 'Feature', properties: { mode: line.mode }, geometry: { type: 'LineString', coordinates: line.coordinates } };
    }) };
  }
  var SOLID = ['==', ['get', 'mode'], 'ROAD'], DASHED = ['!=', ['get', 'mode'], 'ROAD'];

  /** style.load chạy cả sau khi đổi sáng/tối: mọi lớp tuyến phải vẽ lại ở đây. */
  function installLayers() {
    var c = scene.colors, round = { 'line-cap': 'round', 'line-join': 'round' };
    ['route', 'done', 'off'].forEach(function (id) {
      map.addSource(id, { type: 'geojson', data: collection([]) });
    });
    map.addLayer({ id: 'route-casing', type: 'line', source: 'route', filter: SOLID, layout: round, paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': scene.dark ? 0.25 : 0.95 } });
    map.addLayer({ id: 'route-solid', type: 'line', source: 'route', filter: SOLID, layout: round, paint: { 'line-color': c.routeRest, 'line-width': 5 } });
    map.addLayer({ id: 'route-dashed', type: 'line', source: 'route', filter: DASHED, paint: { 'line-color': c.routeAir, 'line-width': 4, 'line-dasharray': [2, 1.5] } });
    map.addLayer({ id: 'done-solid', type: 'line', source: 'done', filter: SOLID, layout: round, paint: { 'line-color': c.routeDone, 'line-width': 5 } });
    map.addLayer({ id: 'done-dashed', type: 'line', source: 'done', filter: DASHED, paint: { 'line-color': c.routeDone, 'line-width': 4, 'line-dasharray': [2, 1.5] } });
    map.addLayer({ id: 'off-track', type: 'line', source: 'off', layout: round, paint: { 'line-color': c.routeDone, 'line-width': 1.5, 'line-opacity': 0.8 } });
    installedDark = scene.dark;
    styleReady = true;
    drawData();
  }

  function drawData() {
    if (!styleReady) return;
    map.getSource('route').setData(collection(scene.route));
    map.getSource('done').setData(collection(scene.done));
    map.getSource('off').setData(collection(scene.offTrack.length > 1 ? [{ coordinates: scene.offTrack, mode: 'GPS' }] : []));
    map.setPaintProperty('route-solid', 'line-color', scene.routeColor === 'plan' ? scene.colors.routePlan : scene.colors.routeRest);
  }

  function drawStops() {
    var key = JSON.stringify([scene.stops, scene.colors.stop, scene.colors.stopRing]);
    if (key === stopsKey) return;
    stopsKey = key;
    stopMarkers.forEach(function (item) { item.marker.remove(); });
    stopMarkers = scene.stops.map(function (stop) {
      var dot = document.createElement('div');
      dot.className = 'hr-stop hr-' + stop.kind;
      dot.style.background = stop.kind === 'mid' ? scene.colors.stop : scene.colors.stopRing;
      dot.style.borderColor = stop.kind === 'mid' ? scene.colors.stopRing : scene.colors.stop;
      var label = null;
      if (stop.label) {
        label = document.createElement('span');
        label.className = 'hr-label';
        // Tên điểm là dữ liệu người nhập: chỉ gán bằng textContent.
        label.textContent = stop.label;
        dot.appendChild(label);
      }
      return { stop: stop, label: label, marker: new maplibregl.Marker({ element: dot }).setLngLat([stop.lng, stop.lat]).addTo(map) };
    });
    updateFlips();
  }

  /** Nhãn mặc định nằm bên phải chấm; sát mép phải thì đổi sang bên trái để không bị cắt. */
  function updateFlips() {
    var width = map.getContainer().clientWidth;
    stopMarkers.forEach(function (item) {
      if (!item.label) return;
      var x = map.project([item.stop.lng, item.stop.lat]).x;
      item.label.classList.toggle('is-left', x + 26 + item.label.offsetWidth > width - 8);
    });
  }

  var TRUCK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#2b1a00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>';
  var ARROW = '<svg viewBox="0 0 24 24" width="22" height="22" fill="#2b1a00"><path d="M12 2 20 21l-8-4-8 4z"/></svg>';

  function drawVehicle() {
    var v = scene.vehicle;
    if (!v) {
      if (vehicleMarker) { vehicleMarker.remove(); vehicleMarker = null; vehicleKey = ''; }
      return;
    }
    var key = [scene.navigating, v.estimated, scene.colors.vehicle].join('|');
    if (key !== vehicleKey && vehicleMarker) { vehicleMarker.remove(); vehicleMarker = null; }
    if (!vehicleMarker) {
      var el = document.createElement('div');
      el.className = 'hr-truck' + (v.estimated ? ' is-estimated' : '');
      el.style.background = scene.colors.vehicle;
      el.innerHTML = scene.navigating ? ARROW : TRUCK; // Hằng số trong file này, không phải dữ liệu.
      vehicleMarker = new maplibregl.Marker({ element: el, rotationAlignment: scene.navigating ? 'map' : 'viewport', pitchAlignment: scene.navigating ? 'map' : 'viewport' }).setLngLat([v.lng, v.lat]).addTo(map);
      vehicleKey = key;
    }
    vehicleMarker.setLngLat([v.lng, v.lat]);
    vehicleMarker.setRotation(scene.navigating ? scene.bearing : 0);
    vehicleMarker.getElement().setAttribute('aria-label', v.label);
  }

  function home() { map.jumpTo({ center: [config.home.longitude, config.home.latitude], zoom: config.home.zoom, pitch: 0, bearing: 0 }); }
  function fit() {
    var plan = scene.view;
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    if (plan.kind === 'default') home();
    else if (plan.kind === 'point') map.jumpTo({ center: plan.center, zoom: plan.zoom, pitch: 0, bearing: 0 });
    else {
      try { map.fitBounds(plan.bounds, { padding: scene.compact ? 28 : plan.padding, maxZoom: plan.maxZoom, duration: 0, pitch: 0, bearing: 0 }); } catch (e) { home(); }
    }
    fittedKey = scene.fitKey;
  }
  function follow(force) {
    var v = scene.vehicle;
    if (!v) return;
    var key = [v.lng, v.lat, scene.bearing].join('|');
    if (!force && key === lastFollowKey) return;
    lastFollowKey = key;
    var height = map.getContainer().clientHeight;
    map.easeTo({ center: [v.lng, v.lat], zoom: 16, pitch: 55, bearing: scene.bearing, duration: 900, padding: { top: Math.round(height * 0.35), bottom: 90, left: 0, right: 0 } });
  }
  function camera() {
    if (scene.navigating !== wasNavigating) {
      wasNavigating = scene.navigating;
      if (scene.navigating) follow(true); else fit();
      return;
    }
    if (scene.navigating) { if (scene.following) follow(false); else fittedKey = scene.fitKey; return; }
    if (fittedKey !== scene.fitKey) fit();
  }

  function draw() {
    if (!map || !styleReady) return;
    drawData();
    drawStops();
    drawVehicle();
    camera();
  }

  function start() {
    map = new maplibregl.Map({
      container: 'map', style: tune(base, scene.colors),
      center: [config.home.longitude, config.home.latitude], zoom: config.home.zoom, minZoom: config.minZoom, maxPitch: 60,
      interactive: !scene.compact, pitchWithRotate: false, attributionControl: { compact: true }
    });
    wasNavigating = false;
    map.on('style.load', function () { styleReady = false; installLayers(); draw(); });
    map.on('moveend', updateFlips);
    map.on('error', function (event) { send('log', event && event.error && event.error.message); });
    function userMoved(event) { if (event.originalEvent && scene.navigating) send('userMoved'); }
    map.on('dragstart', userMoved);
    map.on('zoomstart', userMoved);
    map.once('load', function () {
      // Dòng ghi công thu gọn lúc đầu để không che bản đồ, vẫn còn nút (i) để mở.
      var attribution = document.querySelector('.maplibregl-ctrl-attrib');
      if (attribution) attribution.classList.remove('maplibregl-compact-show');
      send('loaded');
    });
  }

  window.__hr = {
    render: function (next) {
      var changedTheme = scene && map && next.dark !== installedDark;
      scene = next;
      document.body.style.background = next.colors.land;
      if (!base) return;
      if (!map) { start(); return; }
      if (changedTheme) { styleReady = false; map.setStyle(tune(base, scene.colors), { diff: false }); return; }
      draw();
    },
    command: function (name) {
      if (!map || !scene) return;
      if (name === 'recenter') follow(true);
      else if (name === 'fit') fit();
    }
  };

  if (!document.createElement('canvas').getContext('webgl2')) { send('failed', 'no-webgl'); return; }
  fetch(config.styleUrl).then(function (res) {
    if (!res.ok) throw new Error('style http ' + res.status);
    return res.json();
  }).then(function (json) {
    base = json;
    if (scene) start();
    send('ready');
  }).catch(function (error) { send('failed', 'load-failed:' + (error && error.message)); });
  send('booted');
})();
`;

const PAGE_CSS = `
html,body,#map{margin:0;padding:0;width:100%;height:100%;background:transparent}
.hr-stop{width:14px;height:14px;border-radius:50%;border:3px solid;box-sizing:border-box}
.hr-mid{width:12px;height:12px;border-width:2px}
.hr-label{position:absolute;left:20px;top:-6px;max-width:55vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 12px/16px system-ui,sans-serif;color:#0d2a2e;background:rgba(255,255,255,.92);padding:2px 6px;border-radius:6px}
.hr-label.is-left{left:auto;right:20px}
.hr-truck{width:32px;height:32px;border-radius:50%;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.3);box-sizing:border-box}
.hr-truck.is-estimated{border-style:dashed;border-color:#0d2a2e}
.maplibregl-ctrl-attrib{font:11px/16px system-ui,sans-serif}
`;

/** Chỉ cho trang kết nối tới máy chủ nền bản đồ, kể cả khi có lỗi chèn nội dung. */
function contentSecurityPolicy(styleUrl: string) {
  const origin = new URL(styleUrl).origin;
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "worker-src blob:",
    "child-src blob:",
    `connect-src ${origin}`,
    `img-src ${origin} data: blob:`,
  ].join("; ");
}

export function mapHtml(styleUrl: string) {
  const config = JSON.stringify({ styleUrl, home: VN_VIEW, minZoom: MIN_ZOOM });
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(styleUrl)}"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>${MAPLIBRE_CSS}${PAGE_CSS}</style></head><body><div id="map"></div><script>window.__HR_CONFIG=${config};</script><script>${MAPLIBRE_JS}</script><script>${PAGE_SCRIPT}</script></body></html>`;
}
