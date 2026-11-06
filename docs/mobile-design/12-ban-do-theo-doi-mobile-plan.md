# 12 — Kế hoạch bản đồ và theo dõi chuyến trên mobile theo web

Ngày 06/11/2026. Trạng thái: **đã làm xong trên Android, chưa commit; còn phần Long kiểm tra trên iPhone và máy thật (mục 11).** Long đã chốt MapLibre và OpenFreeMap cho mobile, các mục khác theo đề xuất ở mục 9.

Mục tiêu: khách và tài xế xem được bản đồ thật trên mobile, cùng dữ liệu và cùng quy tắc với web. Giao diện làm riêng cho điện thoại.

Nguồn đã đọc:

- Web: `apps/web/src/features/trackmap/` (`MapView`, `CustomerRouteMap`, `DriverRouteMap`, `map-view-plan`, `route-progress`, `map-style`), `features/customer/CustomerTripMap.tsx`, `features/tracking/driver/` (`RouteMapCard`, `LiveStatsCards`, `useTripMap`, `DriverWorkspace`).
- API: `apps/api/src/features/tracking/` (`tracking.routes.ts`, `tracking.service.ts#getCustomerOrderMap`, `trackmap.build.ts`), `shared/socket/socket.service.ts`, `packages/shared/src/types/trackmap.type.ts`.
- Mobile: `RouteMap` trong `apps/mobile/src/live-ui.tsx`, `TrackingScreen` và `TrackingMapScreen` trong `screens/CustomerScreens.tsx`, `TripMapScreen` trong `screens/CrewWork.tsx`, `gps.ts`.

## 1. Kết luận chính

- **Không cần đổi API.** Mobile đã gọi đúng các endpoint web đang dùng. Khoảng cách nằm hoàn toàn ở phần hiển thị.
- **Mobile chưa có bản đồ.** `RouteMap` chỉ là sơ đồ SVG co giãn theo tọa độ, không có nền đường, không kéo hay phóng to được, và tự ghi "không phải bản đồ dẫn đường".
- **Mobile chưa tự làm mới.** Dữ liệu chỉ đổi khi kéo để tải lại. Web làm mới mỗi 60 giây.
- **"Theo dõi" trên web không phải realtime.** API không phát vị trí xe qua socket, web cũng chỉ hỏi lại định kỳ. Mobile làm giống vậy và chưa cần thêm socket. Luồng ở `03-user-flows.md` có ghi `socket join:order` nhưng mobile chưa có `socket.io-client`, cần sửa lại tài liệu này.
- **Khách không xem GPS, đây là quy tắc có chủ đích của web.** API khách trả `latestPosition: null`, xe đứng ở mốc tài xế đã ghi gần nhất. Hộp đồng ý chia sẻ vị trí trên web cũng nói rõ khách không xem được. Vì vậy với khách, xe **không chạy dần trên tuyến**; chỉ nhảy khi tài xế ghi mốc.

## 2. So sánh với web

| Khả năng | Web | Mobile hiện tại | Kế hoạch |
| --- | --- | --- | --- |
| Nền bản đồ thật, kéo, phóng to | Có (Mapbox) | Không | Thêm (OpenFreeMap) |
| Đoạn đã đi đậm, chưa đi nhạt | Có | Một màu | Thêm |
| Chặng `ROAD` nét liền, ước lượng và bay nét đứt | Có | Không phân biệt | Thêm |
| Điểm đầu, điểm cuối có nhãn gửi/nhận | Có | Chỉ chấm tròn | Thêm |
| Xe ước tính khác xe GPS | Có | Chỉ đổi chữ | Thêm |
| Khách: câu mô tả vị trí từ `position.label` | Có | Câu chung "Vị trí ước tính theo mốc" | Thêm |
| Tự làm mới 60 giây, dừng khi ẩn app | Có | Không | Thêm |
| Tài xế: cắt đoạn đã đi theo điểm chiếu GPS | Có | Không | Thêm |
| Tài xế: lệch tuyến hơn 300 m thì hiện vệt GPS | Có | Không | Thêm |
| Tài xế: vị trí của chính mình cập nhật ngay | Có, khoảng 5 giây | Không | Thêm |
| Tài xế: chế độ bám xe, nút "Về giữa" | Có | Không | Thêm |
| Tài xế: 3 số liệu (chặng tiếp, tốc độ, đã chạy) | Có | Chỉ có điểm dừng và km còn lại | Thêm |
| Góc nhìn mặc định Việt Nam, bỏ tọa độ (0, 0) | Có | Không | Thêm |
| Không tải được bản đồ vẫn dùng được | Có `MapFallback` | Không cần | Thêm, dùng sơ đồ SVG |
| GPS nền khi tắt màn hình | Không, phải mở trang | **Có** | Giữ của mobile |
| Giữ bản lưu khi mất sóng | Không | **Có** (`useResource`) | Giữ của mobile |
| Nút mở Google Maps | Không | **Có** | Giữ của mobile |
| Không có nút ghi mốc trên bản đồ | | **Có** (quyết định 30/10) | Giữ của mobile |

Chế độ bám xe của web **không chỉ đường từng ngã rẽ**: chỉ xoay camera theo xe và hiện "về phía ...". Google Maps vẫn là nút chỉ đường chính.

## 3. Chọn cách vẽ bản đồ

Đã chốt: **WebView chạy MapLibre GL JS, nền bản đồ từ OpenFreeMap**. Web tạm giữ Mapbox.

| | WebView + MapLibre + OpenFreeMap (đã chốt) | WebView + Mapbox GL JS | `@rnmapbox/maps` (native) |
| --- | --- | --- | --- |
| Token | **Không cần** | Cần token `pk` | Cần token, thêm token bí mật khi build |
| Chi phí | Miễn phí, trang chủ OpenFreeMap ghi không giới hạn lượt xem | 50.000 lượt/tháng, vượt thì tính tiền | Theo gói Mapbox |
| Chạy trong Expo Go | Dự kiến có, kiểm tra ở bước 0 | Dự kiến có | Không, phải build riêng |
| Giống web | Cách vẽ gần như giữ nguyên, màu nền phải chỉnh | Giống nhất | Viết lại layer |
| Cam kết dịch vụ | Dịch vụ cộng đồng, không cam kết luôn hoạt động | Dịch vụ thương mại | Dịch vụ thương mại |
| Độ mượt, pin | Kém hơn native | Kém hơn native | Tốt nhất |

Lý do chọn: Long lo token hỏng hoặc hết lượt khi demo trước hội đồng, và token của nhóm từng trả lỗi 401 ngày 29/10. Không có token thì không còn rủi ro này. Nếu OpenFreeMap lỗi thì app về sơ đồ SVG.

Để không bị khóa vào lựa chọn này:

- Màn hình chỉ dùng component `TripMapView`. Sau này cần native thì chỉ thay phần bên trong.
- Địa chỉ style đặt trong `EXPO_PUBLIC_MAP_STYLE_URL`, có giá trị mặc định. Đổi nhà cung cấp nền bản đồ không cần sửa code.

**Màu nền bản đồ:** web đang dùng nền sáng, nhạt `light-v11`. Mobile tải style Liberty của OpenFreeMap rồi chỉnh màu đất, nước, đường ngay lúc chạy để gần với web, có thêm bản tối (`tune` trong `map-html.ts`). Không giữ bản sao style trong app, vì địa chỉ biểu tượng trong style có gắn phiên bản nên bản sao có thể bị hỏng khi OpenFreeMap cập nhật. Màu tuyến và xe lấy từ `MapTokens`.

**Tải thư viện:** nhúng `maplibre-gl` phiên bản cố định vào app, không tải từ CDN, để demo không phụ thuộc thêm một dịch vụ nữa. Nền bản đồ thì vẫn cần mạng.

## 4. Thiết kế kỹ thuật

```text
apps/mobile/src/map/
  TripMapView.tsx   Component duy nhất màn hình dùng; chọn WebView hoặc sơ đồ SVG
  map-html.ts       HTML nạp maplibre-gl và vẽ layer; không chứa dữ liệu
  map-bridge.ts     Kiểu tin nhắn giữa app và WebView
  map-scene.ts      Hàm thuần: chuyển ITripMap thành dữ liệu vẽ
  trip-stats.ts     Hàm thuần: 3 số liệu của tài xế
  useLiveTripMap.ts Làm mới định kỳ, vệt GPS, GPS trên máy (useOwnFix)
  vendor.generated.ts maplibre-gl nhúng sẵn, sinh bằng npm run map:vendor
packages/shared/src/map/
  map-view-plan.ts, route-progress.ts  Chuyển từ web sang, cả hai cùng dùng
```

**Trao đổi với WebView.** App gửi `{map, track, ownFix, mode, navigating, theme}` xuống; WebView báo lại `ready`, `failed(lý do)`, `userMoved`. Web chỉ gửi vị trí mới khi có thay đổi, không dựng lại bản đồ, để góc nhìn người dùng đang xem không bị nhảy.

**Hai chế độ của `TripMapView`:**

- `customer`: giống `CustomerRouteMap`. Không có vệt GPS, không có chế độ bám xe.
- `crew`: giống `DriverRouteMap`. Có đoạn đã đi theo điểm chiếu, vệt lệch tuyến, chế độ bám xe zoom 16, nghiêng 55 độ.

**Làm mới (`useLiveTripMap`):**

- 60 giây một lần, chỉ khi màn đang hiện và app đang mở. Quay lại app sau hơn 60 giây thì tải ngay.
- Tải lại ngay sau khi ghi mốc (giống `refreshKey` của web).
- Lỗi thì giữ dữ liệu cũ, hiện dòng "Không tải được dữ liệu bản đồ" kèm nút thử lại.
- `/map` và `/positions` giới hạn 60 lượt/phút mỗi tài khoản. Cách trên dùng khoảng 2 lượt/phút, cần đảm bảo màn nằm dưới trong ngăn xếp không tải song song.
- Vệt GPS: nối dần bằng `since`, giữ tối đa 500 điểm như web. Chỉ tải cho `crew` khi chuyến đang chạy.

**Vị trí của tài xế (`useOwnFix`):**

- `gps.ts` đang gửi nền 30 giây một lần và **không đổi**.
- Thêm `watchPositionAsync` khoảng 5 giây, chỉ chạy khi đang mở bản đồ, tắt ngay khi rời màn. Dữ liệu này chỉ để vẽ, không gửi lên máy chủ.
- Chế độ bám xe bật `expo-keep-awake` để màn hình không tắt.

**Khi không vẽ được bản đồ:** quay về sơ đồ SVG `RouteMap` hiện có kèm lý do, giống `MapFallback` của web. Các lý do: tắt bản đồ, máy không hỗ trợ WebGL, không tải được, quá 15 giây, mất sóng. Dữ liệu tuyến đã lưu vẫn hiện được nên tài xế không bị mất thông tin.

**Bảo mật:**

- Mobile không chứa token bản đồ nào. Không dùng `MAPBOX_ACCESS_TOKEN` của API.
- Tên điểm dừng là dữ liệu người nhập: đưa vào bằng `textContent`, không dùng `innerHTML`.
- Chặn WebView điều hướng sang trang khác (`onShouldStartLoadWithRequest`), chỉ cho tải nền bản đồ từ `tiles.openfreemap.org`.
- Giữ dòng ghi công bản đồ (OpenFreeMap, OpenStreetMap) như điều khoản yêu cầu. Thanh tab dạng viên thuốc nổi không được che phần này.

**Phần vẫn phụ thuộc Mapbox ở máy chủ:** đổi nền bản đồ trên mobile không gỡ được phần này. API dùng `MAPBOX_ACCESS_TOKEN` để tìm địa chỉ (`trips/trip-map-provider.ts`) và tính tuyến đường (`trips/trip-map-provider.ts`, `tracking/trackmap.routes-provider.ts`). Khi thiếu token, lập tuyến và tìm địa chỉ của điều phối báo lỗi, còn các chặng chưa lưu tuyến thì không lấy được đường từ Mapbox. Các chặng đã lưu tuyến vẫn hiện bình thường vì tọa độ nằm trong dữ liệu.

## 5. Thiết kế màn hình

Theo [00-context.md](00-context.md): một nút chính cố định đáy, vùng chạm của tài xế từ 56pt, tiếng Việt đủ dấu, có đủ giao diện sáng và tối. Màu tuyến lấy từ `MapTokens` đã có (R-52).

### CUS-05 Theo dõi (khách)

Giữ bố cục đã duyệt: thẻ trạng thái, thẻ bản đồ 160pt, rồi timeline. Thẻ bản đồ chỉ để xem, không nhận thao tác để không tranh cử chỉ cuộn trang; chạm vào thì mở toàn màn.

### Bản đồ toàn màn (khách)

```text
+--------------------------------------+
| ←  Bản đồ hành trình                 |
|                                      |
|          [ bản đồ kéo, phóng to ]    |
|     ●━━━━━━━━🚚┄┄┄┄┄┄┄┄┄┄┄┄●         |
|                              [ Vừa ] |  đưa về toàn tuyến
|--------------------------------------|
| Đã xuất phát từ Kho HCM lúc 06:12,   |  position.label
| đang trên đường đến Cửa khẩu Mộc Bài |
| Còn khoảng 120 km · Cập nhật 10:35   |
+--------------------------------------+
```

Không hiện tốc độ, GPS hay cảnh báo kỹ thuật. Đơn chưa có lộ trình (API trả 404) thì hiện trạng thái trống "Chưa có lộ trình được duyệt", không hiện như lỗi.

### DRV-05 Bản đồ chuyến (tài xế)

```text
+--------------------------------------+
| ←  Bản đồ chuyến                     |
| [Đang gửi vị trí]                    |  trạng thái GPS đã có
| ↑ về phía Cửa khẩu Mộc Bài           |  khi bám xe
|                                      |
|          [ bản đồ, bám theo xe ]     |
|                          [ Về giữa ] |  khi đã kéo bản đồ
|--------------------------------------|
| Chặng tiếp    | Tốc độ    | Đã chạy  |
| Mộc Bài       | 62 km/h   | 2 giờ 10 |
| còn 48 km     | giới hạn  | trễ 5 ph |
|--------------------------------------|
| [ Chỉ đường đến Mộc Bài ]            |  nút chính, mở Google Maps
+--------------------------------------+
```

- Chuyến đang chạy thì mặc định bám xe; chuyến chưa chạy hoặc đã giao thì xem toàn tuyến, và xe không hiện sau khi đã giao.
- Thao tác bằng tay thì ngừng bám và hiện "Về giữa". Lần sau mở lại vẫn nhớ người dùng đã tắt bám xe trong chuyến đó.
- Tốc độ vượt `speedLimitKmh` thì tô cảnh báo **kèm chữ**. GPS cũ thì ghi "GPS cũ n phút", không giữ con số cũ.
- Điểm chưa có tọa độ: giữ câu nhắc nhờ Specialist ghim vị trí như web.
- Vẫn không có nút ghi mốc trên bản đồ.

## 6. Trạng thái phải có

| Trạng thái | Khách | Tài xế |
| --- | --- | --- |
| Đang tải | Skeleton `map` đã có | Như khách |
| Chưa có lộ trình | Trạng thái trống | Bản đồ ở góc nhìn Việt Nam kèm thông báo |
| Thiếu tọa độ | Sơ đồ, ghi "xem tiến độ theo mốc" | Kèm tên điểm cần ghim |
| Mất sóng | Sơ đồ từ bản lưu, ghi giờ cập nhật | Như khách, GPS vẫn gom để gửi bù |
| Chặng bay | Nét đứt, xe ước tính | Nét đứt, GPS tự dừng như hiện tại |
| GPS bị từ chối | Không áp dụng | Vẫn xem được tuyến, banner hiện có |
| Đã giao | Tuyến đậm toàn bộ | Không hiện xe |

## 7. Thứ tự làm

| Bước | Việc | Xong khi | Cỡ |
| --- | --- | --- | --- |
| 0 | Thử nghiệm: thêm `react-native-webview`, `maplibre-gl`, vẽ một tuyến mẫu trên nền OpenFreeMap, đã chỉnh màu | Chạy được trên Expo Go ở máy ảo Android **và** iPhone thật; tên địa danh tiếng Việt hiện đúng dấu; Long xem và duyệt màu so với web. Không đạt thì quay lại mục 3 | Nhỏ |
| 1 | Chuyển `map-view-plan`, `route-progress` sang `packages/shared`, sửa import của web | Test web cũ (`test/map-view-plan.cjs`, `test/route-progress.cjs`) vẫn qua, thêm test phía mobile | Nhỏ |
| 2 | `TripMapView`, `map-html`, cầu nối, chuyển về sơ đồ khi lỗi, giao diện tối | Vẽ đúng các mẫu dữ liệu ở mục 8 | Lớn |
| 3 | `useLiveTripMap`; gắn vào CUS-05 và bản đồ toàn màn của khách | Tài xế ghi mốc thì khách thấy xe nhảy trong vòng 60 giây | Vừa |
| 4 | Gắn vào DRV-05: đoạn đã đi, vệt lệch tuyến, `useOwnFix`, bám xe, "Về giữa", 3 số liệu | Giả lập GPS di chuyển thấy xe và đoạn đã đi đổi theo | Lớn |
| 5 | Cập nhật `02-screens`, `03-user-flows`, `changelog`, gỡ câu "App không tự dẫn đường" nếu cần | Tài liệu khớp code | Nhỏ |

**Lưu ý khi thêm thư viện:** `react-native-webview` và `maplibre-gl` làm đổi `apps/mobile/package.json`, nên phải cập nhật **cả** `package-lock.json` của mobile **và** `pnpm-lock.yaml` ở gốc. Thiếu `pnpm-lock.yaml` thì CI lại hỏng ở bước `--frozen-lockfile` như vừa sửa ở commit `a2d078e`.

**Lưu ý về file chung:** bước 1 có sửa import ở web. `00-context.md` quy định không sửa code web, nhưng file 11 đã làm tương tự khi chuyển dữ liệu tỉnh xã sang `shared`. Chỉ đổi đường dẫn, không đổi hành vi.

## 8. Kiểm thử

**Test tự động:**

- `planView`: 0 điểm, 1 điểm, nhiều điểm trùng, tọa độ (0, 0).
- `travelledRoute`: chặng hoàn thành, `AT_STOP`, `MOVING`, xe lệch tuyến, chưa có vị trí.
- Làm mới: dừng khi app ẩn, tải ngay khi quay lại sau hơn 60 giây, lỗi vẫn giữ dữ liệu cũ.
- Quyền riêng tư: chế độ `customer` không tải `/positions`, không hiện tốc độ.

**Test trên máy**, dùng API và MySQL riêng như các lần trước, **không dùng DB chung**:

1. Khách: đơn `READY`, `IN_TRANSIT`, `DELIVERED`; tài xế ghi mốc thì xe của khách đổi vị trí.
2. Tài xế: giả lập GPS chạy dọc tuyến, rồi lệch tuyến hơn 300 m.
3. Tuyến có chặng bay, tuyến thiếu tọa độ, tuyến nhiều điểm nghỉ.
4. Tắt mạng giữa chừng, bật lại. Thu app xuống nửa phút rồi mở lại.
5. Giao diện tối, cỡ chữ hệ thống lớn, TalkBack đọc được thông tin chính khi không nhìn bản đồ.
6. iPhone thật và Android thật. Theo dõi pin và độ nóng máy khi bật bám xe khoảng 30 phút.

**Rủi ro đã biết:**

- Máy ảo có thể không chạy được WebGL, hoặc chạy rất chậm; kết quả độ mượt phải đo trên máy thật. Máy ảo `Pixel_9a` cũng đang gần đầy ổ đĩa.
- OpenFreeMap là dịch vụ cộng đồng, không cam kết luôn hoạt động. Nếu lỗi đúng lúc dùng, app về sơ đồ SVG.
- Màu nền sẽ không giống hệt `light-v11` của web, và app sẽ khác web cho tới khi web cũng đổi.
- Chưa kiểm tra font của OpenFreeMap có hiển thị đủ dấu tiếng Việt không. Xem ở bước 0.

**Chuẩn bị trước ngày demo:**

1. Mở trước các chuyến demo một ngày, kiểm tra bản đồ và tuyến trên đúng máy sẽ dùng.
2. Kiểm tra `MAPBOX_ACCESS_TOKEN` của API còn dùng được, vì lập tuyến mới vẫn cần nó.
3. Dùng chuyến đã lưu sẵn tuyến để không phụ thuộc vào việc gọi Mapbox lúc demo.
4. Mang theo điện thoại phát 4G và quay sẵn một video dự phòng.

## 9. Đã chốt

1. **Cách vẽ bản đồ:** WebView, MapLibre và OpenFreeMap (Long chốt).
2. **Token:** mobile không cần token bản đồ.
3. **Hộ tống:** theo đề xuất, giống web, chỉ xem timeline; có thể mở sau.
4. **Khách:** theo đề xuất, chỉ theo mốc, không thấy GPS. Đổi sang GPS là thay đổi quy tắc riêng tư và phải sửa API, nên làm thành việc riêng nếu cần.
5. **Trang chủ của khách:** theo đề xuất, chưa thêm bản đồ, để trang chủ tải nhanh.

Long có nói muốn đổi vài mục nhưng chỉ nêu mục 1 và 2. Mục 3, 4, 5 đang giữ theo đề xuất, Long muốn đổi thì báo trước khi làm tới phần đó.

## 10. Ngoài phạm vi

- Chỉ đường từng ngã rẽ trong app: vẫn dùng Google Maps.
- Tải sẵn bản đồ để dùng khi mất sóng: khi mất sóng dùng sơ đồ SVG.
- Vị trí realtime qua socket: API chưa phát sự kiện này.
- Màn bản đồ của điều phối, quản lý, chuyên viên.
- Thông báo đẩy khi xe đến gần.
- Đổi bản đồ web sang MapLibre, và thay Mapbox trong phần tìm địa chỉ, tính tuyến của API.

## 11. Tiến độ

Mọi thay đổi nằm trong worktree `test-sua-loi-file-09-d56b37`, **chưa commit** vì Long chưa yêu cầu.

**Cách chạy lại:** `apps/mobile/src/map/vendor.generated.ts` không nằm trong git, sinh bằng `npm run map:vendor` trong `apps/mobile`. Không dùng cổng 8081 và 3000 vì Long đang chạy Metro và API ở đó; Metro thử nghiệm dùng 8090.

### Bước 1: xong

`map-view-plan.ts`, `route-progress.ts` chuyển sang `packages/shared/src/map/`. Hai file cũ ở web chỉ còn dòng re-export nên import và test web không đổi; `apps/web/test/map-view-plan.cjs`, `route-progress.cjs` vẫn qua.

### Bước 2 đến 4: xong

File mới trong `apps/mobile/src/map/`: `map-scene.ts`, `trip-stats.ts`, `map-html.ts`, `TripMapView.tsx`, `useLiveTripMap.ts`, `vendor.generated.ts`; test `apps/mobile/tests/map.test.ts`. Đã gắn vào `TrackingScreen`, `TrackingMapScreen` (khách) và `TripMapScreen` (tài xế). Màn thử của bước 0 đã xóa.

Quyết định khi làm:

- `vendor.generated.ts` (khoảng 1,1 MB) được commit để clone về là chạy được. Đổi phiên bản `maplibre-gl` thì chạy `npm run map:vendor`; có test báo lỗi nếu quên.
- Có `Content-Security-Policy`: trang bản đồ chỉ kết nối được tới máy chủ nền bản đồ.
- Mất mạng về sơ đồ SVG, các nút nổi được ẩn để không che nút thử lại, có mạng thì tự tải lại.

### Bước 5: xong

Đã cập nhật `02-screens`, `03-user-flows`, `changelog`, `apps/mobile/.env.example`. Mockup HTML trong `ui/` chưa vẽ lại theo bản đồ thật.

### Kết quả kiểm thử

**Tự động:** `tsc` sạch, `npm test` của mobile 57/57. Trên bản clone sạch: `pnpm install --frozen-lockfile`, build `shared`, `api`, `web` (0 lỗi kiểu), test API 179/179, test web `map-view-plan` và `route-progress` đều qua. Clone này chạy trước khi đổi `.gitignore` và phần sơ đồ dự phòng, các thay đổi đó chỉ nằm ở mobile.

**Trên máy ảo Android, Expo Go, API và MySQL riêng:**

| Kiểm tra | Kết quả |
| --- | --- |
| Khách: xe theo mốc, không có GPS, câu mô tả vị trí, thẻ 160pt, bản đồ toàn màn | Đạt |
| Tài xế: bám xe, kéo tay hiện "Về giữa", xem toàn tuyến | Đạt |
| GPS trên máy: xe đi theo điểm mới, tốc độ đổi theo (37, 74, 111 km/h), vượt giới hạn có cảnh báo kèm chữ | Đạt |
| Lệch tuyến: hiện vệt GPS mảnh | Đạt |
| Tuyến đường bộ thật: nét liền, đoạn đã đi đậm, chưa đi nhạt | Đạt |
| Đường thẳng ước lượng: nét đứt, gộp cảnh báo một dòng | Đạt |
| Mất mạng: về sơ đồ, có nút thử lại; có mạng tự về bản đồ | Đạt |
| Giao diện sáng và tối | Đạt |

Mẹo giả lập GPS: dùng `adb emu geo fix <lng> <lat> 10 8 <knot>`. `cmd location providers` không tới được `expo-location`. Expo Go có quyền vị trí riêng theo từng dự án, `pm grant` không đủ.

**Chưa kiểm tra:**

- **Long tự kiểm tra:** iPhone thật, Android thật, độ mượt, pin và độ nóng máy khi bật bám xe khoảng 30 phút, màu so với web.
- Đổi sáng/tối ngay khi bản đồ đang mở: code có xử lý, nhưng trong app hiện chỉ đổi được ở màn Tài khoản nên bản đồ luôn dựng lại.
- TalkBack, cỡ chữ hệ thống lớn, chặng bay trên máy thật.
- GPS nền khi tắt màn hình: `gps.ts` không đổi; Expo Go không chạy được, cần bản build riêng.

**Việc khác còn lại:** kiểu của `react-native-webview` 14 chưa khớp RN 0.88, đang ép kiểu một chỗ trong `TripMapView.tsx`. CI trên `main` vẫn đỏ vì 32 ca flow3 và 5 ca flow4 chưa sửa, không liên quan kế hoạch này.

### Bước 0: xong trên Android, còn iPhone

- Chạy trong Expo Go trên máy ảo `Pixel_9a`, Android System WebView 156: có WebGL2, bản đồ sẵn sàng sau 2 đến 4 giây.
- Chọn `maplibre-gl` **5.24.0** thay vì 6.x. Bản 6 tách worker ra file ESM riêng, khó nhúng vào một trang HTML; bản 5 có file đóng gói một khối khoảng 1,1 MB.
- Tên tiếng Việt đúng dấu nhờ `coalesce(name:vi, name:latin, name)`, và font của OpenFreeMap có đủ dải chữ Việt.
- Style Liberty đã chỉnh màu cho nền nhạt, gần web; có bản tối. Liberty gốc có đường màu cam và tên tiếng Anh nên không dùng.
- **Chưa làm được:** chạy trên iPhone thật, độ mượt trên máy thật, và Long xem màu so với web. Cần Long kiểm tra khi có thể.

**Đã phát hiện ở bước 0, nay đã xử lý xong:**

1. Đổi sáng/tối bằng `setStyle` làm mất tuyến: phải vẽ lại trong sự kiện `style.load`.
2. Dòng ghi công mở sẵn che đáy bản đồ: thu gọn lúc đầu, vẫn giữ nút (i).
3. Nhãn điểm đầu, điểm cuối bị cắt ở mép: cần đổi bên như `updateFlips` của web.
4. CSS của marker không được đặt `position`, vì sẽ đè định vị của MapLibre làm chấm lệch khỏi tuyến.
5. Kiểu của `react-native-webview` 14 không khớp RN 0.88 (props thành `never`).
6. Thêm `maplibre-gl` làm `react-map-gl` của web nhận thêm peer trong `pnpm-lock.yaml`: phải chạy lại build web để chắc chắn không ảnh hưởng.
