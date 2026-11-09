/**
 * Dữ liệu OpenStreetMap ghi tên hành chính nước ngoài và chữ Hán ở Hoàng Sa, Trường Sa: ẩn mọi nhãn và ranh giới
 * trong các vùng dưới đây rồi tự đặt nhãn của Việt Nam. Đây là vùng để ẨN nhãn, không phải đường biên giới.
 * Viết bằng chuỗi vì chạy trong trang WebView (nhúng vào PAGE_SCRIPT của map-html.ts); test chạy đúng chuỗi này.
 */
export const LABELS_SCRIPT = String.raw`
  var VN_ISLANDS_LAYER = 'vn-islands-label';
  var HIDDEN_LABEL_AREAS = { type: 'MultiPolygon', coordinates: [
    // Hoàng Sa
    [[[110.9, 15.5], [113.2, 15.5], [113.2, 17.4], [110.9, 17.4], [110.9, 15.5]]],
    // Trường Sa, chừa bờ biển Philippines, Malaysia, Brunei
    [[[110.8, 6], [114.5, 6], [115.5, 7.2], [116.8, 8.6], [117.6, 10], [117.6, 12.4], [110.8, 12.4], [110.8, 6]]],
    // Biển giữa hai quần đảo: dữ liệu có tên địa hình đáy biển bằng chữ Hán. Chừa Lý Sơn, Phú Quý, Côn Đảo.
    [[[110, 10.4], [113.2, 10.4], [113.2, 15.8], [110, 15.8], [110, 10.4]]]
  ] };
  var VN_ISLAND_LABELS = [
    { name: 'Quần đảo Hoàng Sa\n(Việt Nam)', coordinates: [112, 16.5] },
    { name: 'Quần đảo Trường Sa\n(Việt Nam)', coordinates: [114.3, 10] }
  ];
  var OUTSIDE_AREAS = ['!', ['within', HIDDEN_LABEL_AREAS]];

  /** Sửa trực tiếp bản sao style của tune. Style có text-font thì mới thêm nhãn Việt Nam, vì chữ cần font. */
  function localizeLabels(style, c) {
    var reference = null;
    style.layers.forEach(function (layer) {
      if (layer.type !== 'symbol' && !(layer.type === 'line' && /^boundary/.test(layer.id))) return;
      layer.filter = layer.filter ? ['all', layer.filter, OUTSIDE_AREAS] : OUTSIDE_AREAS;
      if (layer.type !== 'symbol' || !layer.layout || !layer.layout['text-font']) return;
      if (!reference || layer.id === 'water_name_point_label') reference = layer;
    });
    // within chỉ loại được feature nằm trọn trong vùng. Ở zoom thấp, tile gộp vòng ranh giới quanh đảo chung một
    // feature với đoạn trên đất Palawan nên lọt qua. Vẽ ranh giới dưới lớp nước thì mọi đoạn trên biển bị che, đảo vẫn còn.
    var boundaries = style.layers.filter(function (layer) { return layer.type === 'line' && /^boundary/.test(layer.id); });
    var others = style.layers.filter(function (layer) { return boundaries.indexOf(layer) < 0; });
    var waterAt = others.findIndex(function (layer) { return layer.id === 'water'; });
    if (waterAt >= 0) style.layers = others.slice(0, waterAt).concat(boundaries, others.slice(waterAt));
    if (!reference) return;
    style.sources[VN_ISLANDS_LAYER] = { type: 'geojson', data: { type: 'FeatureCollection', features: VN_ISLAND_LABELS.map(function (label) {
      return { type: 'Feature', properties: { name: label.name }, geometry: { type: 'Point', coordinates: label.coordinates } };
    }) } };
    style.layers.push({
      id: VN_ISLANDS_LAYER, type: 'symbol', source: VN_ISLANDS_LAYER,
      layout: { 'text-field': ['get', 'name'], 'text-font': reference.layout['text-font'], 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 1.2 }
    });
  }
`;
