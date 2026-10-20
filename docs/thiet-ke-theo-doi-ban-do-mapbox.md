# Thiết kế: Theo dõi đơn vận chuyển trên bản đồ (Mapbox)

Trạng thái: **đã chốt quyết định, chưa triển khai**. Kế hoạch thực hiện chi tiết: [ke-hoach-ban-do-gps.md](ke-hoach-ban-do-gps.md).

> **Quyết định đã chốt (20/10/2026).** Một số điểm khác đề xuất ban đầu trong tài liệu này; khi mâu thuẫn, bảng dưới đây được ưu tiên.
>
> | # | Quyết định |
> |---|---|
> | 1 | Customer: Option A, chỉ thấy tuyến, điểm dừng và vị trí **ước tính** theo mốc; không nhận GPS |
> | 2 | **Làm GPS thời gian thực** từ tài xế (giai đoạn 2 nằm trong phạm vi) |
> | 3 | **Specialist quản lý danh mục địa điểm** (thêm/sửa/xóa, đặt tọa độ bằng ghim trên bản đồ). Chặng vẫn do Coordinator lập, mốc vẫn do Driver ghi |
> | 4 | **Specialist và Manager xem bản đồ và GPS thời gian thực** của mọi chuyến (khác đề xuất ở mục 4.2); Coordinator xem chuyến mình lập |
> | 5 | Không làm link theo dõi công khai |
> | 6 | Dùng token Mapbox của bạn (gói miễn phí) |
> | 7 | Thử Mapbox; không ổn thì chuyển MapLibre |
> | + | Chặng máy bay: vị trí ước tính, không nhận GPS |
> | + | Làm trên desktop trước (GPS mô phỏng); giao diện mobile để nhóm thiết kế sau |

Tài liệu trả lời ba câu hỏi:
1. Ai được xem bản đồ và xem được gì?
2. Bản đồ lấy dữ liệu từ đâu, thiết kế dữ liệu và API ra sao?
3. Đưa Mapbox vào dự án theo thứ tự nào để vừa kịp tiến độ vừa không phải làm lại?

---

## 1. Tóm tắt đề xuất

| Nội dung | Đề xuất |
|---|---|
| Cách làm | Chia 3 giai đoạn. **Giai đoạn 1 (bản đồ theo mốc, không cần GPS)** làm trước, vì dữ liệu đã có sẵn từ Flow 4. **Giai đoạn 2 (vị trí trực tiếp từ điện thoại tài xế)** làm sau, là tuỳ chọn |
| Nền tảng bản đồ | `mapbox-gl` + `react-map-gl`, tải lười (lazy) để không làm nặng trang chính |
| Việc phải làm trước tiên | **Bảng `locations` chưa có tọa độ.** Phải thêm cột vĩ độ/kinh độ và nhập tọa độ cho 20 địa điểm hiện có |
| Ai xem | Customer (đơn của mình), Coordinator (chuyến mình lập), Manager (tất cả), Specialist (chỉ đọc, phạm vi hẹp), Driver/Escort (chuyến được phân công). Admin không có quyền vận hành nên không có bản đồ |
| Vị trí trực tiếp cho Customer | **Không** ở giai đoạn đầu. Customer thấy tuyến, điểm dừng và tiến độ theo mốc. Lý do ở mục 4.2 |
| Quyền truy cập | Dùng lại đúng ma trận quyền của Flow 4 (ngoài phạm vi trả 404, sai vai trò trả 403) |

---

## 2. Hiện trạng dự án

Những gì **đã có** và dùng lại được:

- **Tuyến và chặng:** `trips`, `legs` (điểm đi, điểm đến, xe, giờ dự kiến, trạng thái, giờ thực tế) và `leg_milestones` (mốc kèm giờ) của Flow 3 và 4.
- **Phân quyền theo chuyến:** hàm kiểm tra phạm vi (`authorizeTrip`) và các API timeline (`/tracking/orders/:id/timeline`, `/tracking/trips/:id/timeline`, `/tracking/operations/active-trips`).
- **Sự cố và cảnh báo:** có thể ghim lên bản đồ.
- **Redis** đã được dùng trong dự án, có thể cache vị trí mới nhất.
- **Token Mapbox:** `apps/web/.env` đã có `VITE_MAPBOX_TOKEN` (loại `pk.`, public). File này nằm trong `.gitignore` nên không bị đẩy lên git.

Những gì **chưa có**:

| Thiếu | Hệ quả |
|---|---|
| **`locations` không có vĩ độ/kinh độ** (chỉ có tên, loại, quốc gia, múi giờ, địa chỉ) | Chưa vẽ được điểm nào. Đây là việc chặn đầu tiên |
| Không có dữ liệu vị trí xe | Chưa có "xe đang ở đâu" thật. Chỉ có "chặng đang ở trạng thái nào" |
| Thư viện bản đồ | Đã bị gỡ khỏi `package.json` ở bước dọn nền Flow 4 (`mapbox-gl`, `react-map-gl`) |
| Kênh thời gian thực | Không có WebSocket/SSE. Hiện chỉ có REST |
| Biến môi trường phía server cho Mapbox | Chưa có |

Ràng buộc từ Flow 4 cần nhớ: giao diện timeline vẫn là **nguồn sự thật**; bản đồ chỉ là cách nhìn bổ sung, không thay thế danh sách mốc.

---

## 3. Mục tiêu và ngoài phạm vi

**Mục tiêu**
- Xem **toàn bộ tuyến** của một đơn: các điểm dừng, các chặng nối nhau, màu theo trạng thái chặng.
- Thấy **tiến độ hiện tại** của chuyến: đang ở đâu hoặc đang đi giữa hai điểm nào.
- Điều phối viên và quản lý thấy **mọi chuyến đang chạy trên một bản đồ chung**.
- Tài xế thấy tuyến và điểm dừng kế tiếp; (giai đoạn 2) tài xế chia sẻ vị trí.

**Ngoài phạm vi (làm sau hoặc không làm)**
- Chỉ đường rẽ từng ngã (turn-by-turn). Tài xế dùng Google Maps/Waze riêng.
- Tối ưu lộ trình tự động, tính phí đường.
- Link theo dõi công khai không cần đăng nhập (xem câu hỏi 5 ở mục 15).
- Ứng dụng di động riêng.

---

## 4. Ai được xem bản đồ? (phần cần thảo luận)

### 4.1. Ma trận đề xuất

| Vai trò | Bản đồ tuyến + mốc (GĐ1) | Vị trí trực tiếp (GĐ2) | Bản đồ tất cả chuyến | Ghi chú |
|---|---|---|---|---|
| **Customer** | Chỉ đơn của mình | **Không** (Option A) hoặc trễ vài phút (Option B) | Không | Không thấy sự cố, nhật ký ngựa |
| **Coordinator** | Chuyến mình lập (`planned_by`) | Có | Chuyến mình lập | Thấy sự cố, cảnh báo, hiệu chỉnh trên bản đồ |
| **Manager** | Tất cả chuyến | Có | **Tất cả chuyến đang chạy** | Chỉ xem, không sửa mốc ở bản đồ |
| **Specialist** | Tất cả chuyến, **chỉ điểm dừng thủ tục** (cửa khẩu, trạm kiểm dịch, sân bay) và mốc | Không | Không | Chỉ đọc, khớp với quy tắc Flow 4 |
| **Driver / Escort** | Chuyến được phân công | **Gửi** vị trí của chính mình | Không | Tự xem vị trí của mình |
| **Admin** | Không | Không | Không | Admin không có quyền vận hành |

Cách thực thi quyền: dùng lại đúng cơ chế của Flow 4. Người không thuộc phạm vi nhận 404 (không để lộ chuyến có tồn tại), sai vai trò nhận 403.

### 4.2. Bàn luận từng vai trò

**Customer: có nên cho xem vị trí xe trực tiếp?**
Đây là quyết định quan trọng nhất. Ngựa đua có giá trị rất cao; vị trí xe theo thời gian thực của một chuyến chở ngựa quý là thông tin nhạy cảm. Nếu tài khoản Customer bị lộ hoặc người dùng chia sẻ màn hình, kẻ xấu biết chính xác xe đang ở đâu.

| Option | Customer thấy gì | Ưu | Nhược |
|---|---|---|---|
| **A (đề xuất cho MVP)** | Tuyến, các điểm dừng, chặng đã hoàn thành, **vị trí ước tính theo mốc** (ví dụ "đang trên đường từ Củ Chi đến Mộc Bài"), không hiển thị tọa độ chính xác | An toàn; làm nhanh; đúng dữ liệu đã có | Ít "sinh động" hơn so với kỳ vọng "xe chạy trên bản đồ" |
| **B** | Như A, thêm vị trí GPS **trễ 3–5 phút** và làm tròn khoảng 500 m, chỉ khi đơn đang vận chuyển | Có cảm giác theo dõi trực tiếp; vẫn giảm rủi ro | Phải làm GĐ2; phải giải thích rõ vì sao có độ trễ |
| C (không khuyên dùng) | GPS chính xác theo thời gian thực | Trải nghiệm tốt nhất | Rủi ro an ninh cao nhất |

Đề xuất: **Option A cho MVP**, để ngỏ Option B làm cấu hình (một tham số trong `system_parameters`, ví dụ `MAP_CUSTOMER_DELAY_MIN`).

**Coordinator.** Người điều hành thực tế, cần nhìn chính xác để xử lý sự cố. Được xem vị trí chính xác của chuyến mình lập, kèm biểu tượng sự cố mở và cảnh báo đã gửi.

**Manager.** Cần cái nhìn toàn cảnh: bản đồ chung với mọi chuyến đang chạy, chấm màu theo tình trạng (bình thường, có sự cố, trễ hạn).

**Specialist.** Công việc là thủ tục thông quan và kiểm dịch, không phải điều hành xe. Chỉ cần biết chuyến đang ở đâu so với cửa khẩu hoặc trạm kiểm dịch. Đề xuất chỉ hiện các điểm dừng loại `BORDER`, `QUARANTINE_STATION`, `AIRPORT` và mốc, không hiện vị trí xe trực tiếp.

**Driver / Escort.** Cần thấy tuyến và điểm kế tiếp. Ở GĐ2 họ là **nguồn** dữ liệu vị trí, nên cần cơ chế đồng ý rõ ràng (xem mục 10).

**Tài khoản chưa đăng nhập.** Không hỗ trợ. Nếu sau này cần "link theo dõi cho người nhận ngựa", phải làm riêng với token ký, hết hạn và chỉ xem mức tối thiểu.

---

## 5. Thiết kế dữ liệu

### 5.1. Giai đoạn 1: thêm tọa độ cho địa điểm

Migration mới (theo mẫu các migration hiện có trong `apps/api/src/database/migrations`):

```sql
ALTER TABLE locations
  ADD COLUMN latitude  DECIMAL(9,6) NULL COMMENT 'Vĩ độ WGS84',
  ADD COLUMN longitude DECIMAL(9,6) NULL COMMENT 'Kinh độ WGS84',
  ADD CONSTRAINT ck_locations_lat CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
  ADD CONSTRAINT ck_locations_lng CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT ck_locations_pair CHECK ((latitude IS NULL) = (longitude IS NULL));
```

- Cho phép `NULL` để không phá dữ liệu cũ và các luồng đang chạy.
- Một script nạp tọa độ cho 20 địa điểm hiện có (Phụ lục A). Các tọa độ trong phụ lục là **xấp xỉ**, cần đối chiếu bằng Mapbox Search hoặc Google Maps trước khi dùng.
- Địa điểm thiếu tọa độ: bản đồ hiển thị cảnh báo "Chưa có tọa độ cho <tên>", phần danh sách vẫn dùng bình thường (không chặn Flow 3 và 4).
- Liên hệ với yêu cầu **FR-TRP-02** (quản lý danh mục điểm dừng, chưa làm): khi làm màn hình đó, form nhập địa điểm nên có bước chọn vị trí trên bản đồ.

### 5.2. Giai đoạn 1: hình học tuyến (cache theo cặp địa điểm)

Gọi Mapbox Directions cho mỗi lần xem sẽ tốn hạn mức và chậm. Danh mục địa điểm nhỏ và ít đổi, nên **cache theo cặp địa điểm**:

```sql
CREATE TABLE location_routes (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  from_location_id BIGINT UNSIGNED NOT NULL,
  to_location_id   BIGINT UNSIGNED NOT NULL,
  mode             ENUM('ROAD','AIR','STRAIGHT') NOT NULL,
  geometry         MEDIUMTEXT NOT NULL COMMENT 'Polyline đã mã hóa (precision 6)',
  distance_m       INT UNSIGNED NULL,
  duration_s       INT UNSIGNED NULL,
  fetched_at       DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  UNIQUE KEY uq_route_pair_mode (from_location_id, to_location_id, mode),
  FOREIGN KEY (from_location_id) REFERENCES locations(id),
  FOREIGN KEY (to_location_id)   REFERENCES locations(id)
);
```

Cách chọn `mode` cho một chặng:

| Điều kiện | Cách vẽ |
|---|---|
| Xe là `TRUCK` hoặc `CRATE`, hai điểm cùng đất liền, Directions trả được tuyến | `ROAD`: đường thật từ Mapbox Directions (profile `driving`) |
| Xe là `AIRCRAFT_HOLD` | `AIR`: cung tròn lớn (great-circle), **không** gọi API |
| Directions không trả tuyến (qua biển, quá xa, lỗi) | `STRAIGHT`: đường thẳng nét đứt, ghi "tuyến ước lượng" |

Lưu ý dữ liệu demo hiện có đặt xe tải đi tới sân bay quốc tế (ví dụ Tân Sơn Nhất đến Changi); thiết kế phải chịu được trường hợp phi thực tế này bằng cách rơi về `STRAIGHT`, không báo lỗi.

Việc điền cache: gọi lười ở lần đầu cần tuyến (server-side), hoặc điền sẵn khi Coordinator lưu kế hoạch. Đề xuất gọi lười kèm khóa chống gọi trùng đồng thời, để không phải sửa luồng lưu kế hoạch của Flow 3.

### 5.3. Giai đoạn 2: vị trí xe

```sql
CREATE TABLE trip_positions (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id     BIGINT UNSIGNED NOT NULL,
  leg_id      BIGINT UNSIGNED NULL,
  user_id     BIGINT UNSIGNED NOT NULL COMMENT 'Người gửi vị trí',
  latitude    DECIMAL(9,6) NOT NULL,
  longitude   DECIMAL(9,6) NOT NULL,
  accuracy_m  SMALLINT UNSIGNED NULL,
  speed_mps   DECIMAL(5,2) NULL,
  heading_deg SMALLINT UNSIGNED NULL,
  recorded_at DATETIME NOT NULL COMMENT 'Giờ trên thiết bị (UTC)',
  received_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  KEY idx_trip_positions_trip_time (trip_id, recorded_at),
  FOREIGN KEY (trip_id) REFERENCES trips(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

- **Khối lượng:** mỗi 15 giây một điểm là 240 điểm/giờ/chuyến. 10 chuyến chạy 8 giờ một ngày khoảng 19.000 dòng. MySQL xử lý thoải mái.
- **Lưu giữ:** tác vụ dọn định kỳ xóa điểm cũ hơn 30 ngày (có thể cấu hình), vì đây là dữ liệu cá nhân của tài xế.
- **Vị trí mới nhất** cache ở Redis (`trip:{id}:last`, hết hạn sau 5 phút) để không truy vấn DB mỗi lần người xem làm mới.

---

## 6. Thiết kế API

Tất cả nằm dưới `/api/v1/tracking`, dùng lại xác thực và `authorizeTrip` của Flow 4.

| Phương thức và đường dẫn | Ai gọi | Trả về | Giai đoạn |
|---|---|---|---|
| `GET /orders/:orderId/map` | Customer (đơn của mình) | Điểm dừng, chặng (kèm hình học và trạng thái), mốc, vị trí **ước tính**. Không có sự cố, nhật ký ngựa, GPS | 1 |
| `GET /trips/:tripId/map` | Coordinator, Manager, Specialist, Driver/Escort | Như trên, thêm sự cố mở, cảnh báo. Specialist bị lọc (mục 4.2). GĐ2 thêm vị trí GPS mới nhất | 1, 2 |
| `GET /operations/map` | Coordinator, Manager | Mọi chuyến đang chạy trong phạm vi: vị trí hiện tại, màu tình trạng. Coordinator chỉ thấy chuyến mình lập | 1 |
| `POST /trips/:tripId/positions` | Driver/Escort được phân công | Nhận một mảng tối đa 20 điểm (để gửi bù khi mất mạng) | 2 |
| `GET /trips/:tripId/positions?since=` | Coordinator, Manager | Các điểm mới hơn mốc `since`, dùng để vẽ vệt đường đã đi | 2 |

Hình dạng phản hồi (dùng chung cho các API bản đồ, thêm kiểu vào `packages/shared`):

```jsonc
{
  "tripId": "200", "orderCode": "WDP-...", "orderStatus": "IN_TRANSIT",
  "locations": [{ "id": "1", "name": "...", "locationType": "AIRPORT", "lat": 10.8188, "lng": 106.6520 }],
  "legs": [{
    "id": "301", "seqNo": 1, "status": "MOVING",
    "fromLocationId": "1", "toLocationId": "3",
    "mode": "ROAD",                      // ROAD | AIR | STRAIGHT
    "geometry": "<polyline6>",           // có thể null nếu thiếu tọa độ
    "plannedDepartureAt": "...", "plannedArrivalAt": "...",
    "actualDepartureAt": "...", "isOverdue": false
  }],
  "position": {                          // null nếu không đủ dữ liệu hoặc vai trò không được xem
    "source": "ESTIMATED",               // ESTIMATED | GPS
    "lat": 10.95, "lng": 106.50, "asOf": "...",
    "label": "Đang trên đường từ Sân bay quốc tế Tân Sơn Nhất đến Cửa khẩu Mộc Bài"
  },
  "warnings": ["Chưa có tọa độ cho Điểm dừng nghỉ Bến Lức"]
}
```

**Quy tắc của `POST /positions`** (giai đoạn 2):
- Chỉ người được phân công vào chuyến; đơn phải `IN_TRANSIT` và có chặng đang `MOVING` hoặc `AT_STOP`.
- Kiểm tra: vĩ độ trong [-90, 90], kinh độ trong [-180, 180]; `recorded_at` không ở tương lai quá 60 giây (cùng độ lệch đồng hồ đã dùng ở Flow 4) và không cũ quá 24 giờ.
- Giới hạn tần suất theo **người dùng**, không chỉ theo IP (xem mục 11 về giới hạn 100 request/phút/IP).
- Khi đơn hoàn tất (DELIVERED) thì từ chối ghi tiếp.

---

## 7. Giao diện

Tất cả bản đồ đặt trong một module riêng `apps/web/src/features/trackmap/`, tải lười bằng `React.lazy` để mã Mapbox (khá nặng) chỉ tải khi mở bản đồ.

| Thành phần | Mô tả |
|---|---|
| `TripMap` | Bản đồ một chuyến: đường theo chặng (xám = chưa bắt đầu, xanh dương = đang đi, xanh lá = hoàn thành), điểm dừng theo loại, biểu tượng xe tại vị trí (ước tính hoặc GPS), (nội bộ) biểu tượng sự cố mở |
| `FleetMap` | Bản đồ tất cả chuyến đang chạy; mỗi chuyến một chấm màu theo tình trạng; bấm vào mở khung tóm tắt và nút "Xem chi tiết chuyến" |
| `MapLegend` | Chú giải màu và biểu tượng |
| `useTripMap`, `useFleetMap` | Lấy dữ liệu, làm mới định kỳ (15–30 giây khi tab đang hiển thị) |
| `ShareLocationToggle` (GĐ2) | Nút bật/tắt "Chia sẻ vị trí" cho tài xế |

Vị trí gắn vào các màn hình hiện có (không tạo menu mới):

| Vai trò | Màn hình | Thay đổi |
|---|---|---|
| Customer | **Theo dõi hành trình** | Thêm tab "Bản đồ" cạnh timeline |
| Coordinator, Manager | **Điều hành vận hành / Tiến độ vận hành** | Công tắc "Danh sách / Bản đồ" ở danh sách chuyến; chi tiết chuyến có thêm tab "Bản đồ" |
| Specialist | **Theo dõi thông quan** | Tab "Bản đồ" bản rút gọn |
| Driver / Escort | **Mốc hành trình** | Bản đồ nhỏ với tuyến và điểm kế tiếp; (GĐ2) nút chia sẻ vị trí |

Phác thảo màn hình Coordinator/Manager:

```
┌────────────────────────────────────────────────────────────┐
│ Chuyến đang vận hành            [ Danh sách | ● Bản đồ ]   │
├──────────────────────────────┬─────────────────────────────┤
│                              │ Chuyến #200 · WDP-…         │
│     ○────●─ ─ ─ ○            │ Chặng 1: Tân Sơn Nhất →     │
│    (chấm xanh = bình thường) │         Mộc Bài  [Đang đi] │
│    (chấm đỏ  = có sự cố)     │ Cập nhật 14:32 · ước tính   │
│    (chấm cam = trễ hạn)      │ 1 sự cố khẩn · [Xem chuyến] │
└──────────────────────────────┴─────────────────────────────┘
```

Yêu cầu chung cho mọi bản đồ:
- **Trải nghiệm di động:** bản đồ không "nuốt" thao tác cuộn trang (cần cách tắt kéo bản đồ bằng một ngón); nút phóng to/thu nhỏ đủ lớn (≥ 44 px, giống chuẩn Flow 4).
- **Dự phòng khi bản đồ không tải được:** mất mạng, hết hạn mức, thiếu WebGL hoặc thiếu token thì hiện thông báo ngắn và giữ nguyên timeline; không để trang trắng.
- **Truy cập:** các thông tin trên bản đồ luôn có bản dạng chữ (timeline và danh sách) để người dùng bàn phím/trình đọc màn hình không bị bỏ lại.
- **Ngôn ngữ:** nhãn bản đồ tiếng Việt (`language: 'vi'`), giờ theo Asia/Ho_Chi_Minh như phần còn lại.
- **Giao diện:** theo bảng màu hiện tại (xanh lục đậm), dùng Ant Design cho khung điều khiển như Tiến vừa áp dụng.

---

## 8. Vị trí ước tính (giai đoạn 1, không cần GPS)

Server tính `position` cho mỗi chuyến theo trạng thái chặng hiện tại:

| Trạng thái chặng hiện tại | Vị trí hiển thị |
|---|---|
| Chưa chặng nào bắt đầu | Tại điểm đi của chặng 1 |
| Chặng `MOVING` | Điểm nằm trên hình học chặng, theo tỉ lệ thời gian: `tiến độ = (bây giờ − giờ xuất phát thực tế) / (giờ đến dự kiến − giờ xuất phát dự kiến)`, giới hạn trong [0, 0.95] (không bao giờ "đến nơi" khi chưa có mốc đến) |
| Chặng `AT_STOP` | Tại điểm đến của chặng |
| Chặng vừa `COMPLETED`, chặng sau chưa xuất phát | Tại điểm đến của chặng vừa xong |
| Đơn `DELIVERED` | Tại điểm đến cuối, không còn theo dõi |

Mọi vị trí ước tính phải ghi nhãn **"ước tính theo kế hoạch, không phải GPS"**. Điều này tránh khách hiểu nhầm là vị trí thật. Khi đã có GPS (GĐ2) và vai trò được phép, `source` chuyển thành `GPS` và nhãn bỏ.

---

## 9. Thời gian thực (giai đoạn 2)

| Cách | Mô tả | Đánh giá |
|---|---|---|
| **Polling 15–30 giây (đề xuất)** | Giao diện gọi lại API định kỳ khi tab hiển thị | Đơn giản, dùng lại REST, đủ cho nhu cầu vài chục chuyến. Hạn chế: độ trễ vài chục giây |
| SSE (Server-Sent Events) | Server đẩy tin qua một kết nối HTTP | Mượt hơn, nhẹ hơn WebSocket; cần thêm hạ tầng và xử lý kết nối giữ lâu. Có thể dùng Redis pub/sub đã có |
| WebSocket | Hai chiều | Quá mức cần thiết khi chỉ cần luồng một chiều |

Đề xuất: bắt đầu bằng polling. Nếu cần mượt hơn thì nâng lên SSE mà không đổi định dạng dữ liệu.

**Hạn chế quan trọng của vị trí từ điện thoại tài xế:** trình duyệt trên điện thoại **không đảm bảo** gửi vị trí khi màn hình tắt hoặc tab chạy nền (đặc biệt iOS). Hệ quả: nếu tài xế khóa màn hình, vị trí ngừng cập nhật. Các hướng:

| Hướng | Ưu | Nhược |
|---|---|---|
| Web thường, nhắc tài xế **giữ màn hình sáng** (Screen Wake Lock) | Không cần cài đặt thêm | Tốn pin; vẫn có thể mất vị trí |
| PWA cài lên màn hình chính | Ổn định hơn một chút | Vẫn bị hạn chế chạy nền |
| Ứng dụng di động riêng | Theo dõi chạy nền chuẩn | Ngoài phạm vi dự án hiện tại |
| Thiết bị GPS gắn xe (hộp đen) | Chính xác, độc lập với tài xế | Cần phần cứng và tích hợp riêng |

Đề xuất cho dự án: Web + Wake Lock, hiển thị rõ "cập nhật lần cuối lúc …" để người xem tự đánh giá độ tin cậy. Khi quá 2 phút không có điểm mới, đánh dấu "mất tín hiệu".

---

## 10. Bảo mật và riêng tư

- **Token Mapbox:** token `pk.` (public) dùng ở trình duyệt, **giới hạn theo URL** trong tài khoản Mapbox. Mọi lời gọi Directions/Search từ server dùng **token riêng ở biến môi trường server** (`MAPBOX_SERVER_TOKEN`), thêm vào kiểm tra biến môi trường; không đưa vào mã nguồn hay trình duyệt. Token hiện có trong `apps/web/.env` cần được kiểm tra lại xem đã giới hạn URL chưa.
- **Quyền xem:** mọi API bản đồ qua cùng bộ kiểm tra phạm vi với Flow 4. Customer chỉ nhận dữ liệu đã lọc (mục 4.2).
- **Vị trí tài xế là dữ liệu cá nhân.** Đề xuất:
  - Chỉ thu thập khi chuyến đang chạy và tài xế bật "Chia sẻ vị trí" (có hộp thoại đồng ý rõ ràng ở lần đầu).
  - Tự dừng khi đơn DELIVERED.
  - Xóa sau 30 ngày (mục 5.3).
  - Nên xin ý kiến người phụ trách pháp lý về yêu cầu bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP) trước khi triển khai thật.
- **Chống giả mạo:** không thể chặn hoàn toàn việc giả vị trí GPS trên điện thoại. Giảm thiểu bằng kiểm tra tốc độ bất hợp lý giữa hai điểm liên tiếp và đối chiếu với mốc ghi nhận; ghi chú rõ hạn chế này cho người dùng nghiệp vụ.
- **Ghi nhật ký:** không ghi audit mỗi điểm vị trí (khối lượng lớn); ghi audit sự kiện bật/tắt chia sẻ và log kỹ thuật theo `requestId`.

---

## 11. Hiệu năng, chi phí và giới hạn

- **Tải bản đồ (billing):** Mapbox tính phí theo "lượt tải bản đồ". Có hạn mức miễn phí hằng tháng; **cần kiểm tra lại số liệu và điều khoản hiện hành trên trang giá của Mapbox** vì có thể thay đổi. Cách giảm lượt tải: chỉ khởi tạo bản đồ khi người dùng mở tab bản đồ, tái sử dụng một thực thể bản đồ khi chuyển giữa các chuyến.
- **Directions API:** nhờ cache theo cặp địa điểm (mục 5.2) nên lượng gọi rất nhỏ. Cần đặt cảnh báo ngân sách/hạn mức trong tài khoản Mapbox.
- **Giới hạn 100 yêu cầu/phút theo IP của API:** nếu cả phòng (ví dụ buổi bảo vệ trước hội đồng) cùng dùng chung một địa chỉ IP và nhiều tab bản đồ tự làm mới, có thể chạm trần. Cách xử lý: tăng giới hạn riêng cho nhóm API đọc bản đồ hoặc tính theo người dùng; giữ chu kỳ làm mới ≥ 15 giây và chỉ làm mới khi tab đang hiển thị.
- **Kích thước gói web:** `mapbox-gl` khá nặng. Tải lười bằng `React.lazy` và tách thành chunk riêng; không để nó vào gói chính.
- **WebGL:** bản đồ cần WebGL. Máy hoặc môi trường không hỗ trợ sẽ rơi về giao diện dự phòng (mục 7).

---

## 12. Kiểm thử

| Loại | Nội dung |
|---|---|
| Đơn vị | Hàm tính vị trí ước tính (các trạng thái chặng, biên 0 và 0.95, thiếu giờ thực tế); chọn `mode` cho chặng; giải mã và mã hóa polyline |
| Tích hợp MySQL (cùng khuôn `flow4-tracking.mysql.cjs`) | Phân quyền từng vai trò (Customer chỉ đơn của mình và không thấy sự cố; Specialist bị lọc; ngoài phạm vi 404, sai vai trò 403); địa điểm thiếu tọa độ trả cảnh báo; cache tuyến không gọi API hai lần; GĐ2: từ chối điểm ngoài khoảng, tương lai, đơn đã giao, người không được phân công |
| API ngoài | Giả lập Mapbox Directions (thành công, lỗi, hết hạn mức) để kiểm tra rơi về `STRAIGHT` |
| Giao diện | Playwright với **chặn mọi request ra ngoài** và giả lập token; kiểm tra khung bản đồ được dựng, chú giải, dự phòng khi không tải được, không tràn ngang trên điện thoại. Môi trường không đầu (headless) có thể thiếu WebGL nên cần cờ `--use-gl=swiftshader` hoặc chỉ kiểm tra phần logic và khung |
| Thủ công | Một buổi chạy thật bằng token thật, đối chiếu tọa độ 20 địa điểm với bản đồ |

---

## 13. Lộ trình triển khai

| Mốc | Nội dung | Điều kiện hoàn thành |
|---|---|---|
| **M0. Nền tảng** (khoảng nửa ngày) | Cài `mapbox-gl`, `react-map-gl`; thêm biến môi trường server; migration `latitude/longitude` và script nạp tọa độ cho 20 địa điểm; kiểm tra token | Có tọa độ cho mọi địa điểm đang dùng; xây dựng web thành công |
| **M1. Bản đồ theo mốc** (khoảng 2–3 ngày) | Bảng `location_routes` và dịch vụ lấy tuyến; ba API `GET .../map`; hàm vị trí ước tính; `TripMap` ở Customer, Coordinator, Manager, Specialist; `FleetMap` cho Coordinator/Manager; kiểm thử và Swagger | Mỗi vai trò thấy đúng bản đồ của mình; Customer không thấy dữ liệu nội bộ |
| **M2. Vị trí trực tiếp** (khoảng 3–4 ngày, tuỳ chọn) | Bảng `trip_positions`, `POST/GET positions`, dọn dữ liệu cũ, nút chia sẻ vị trí cho tài xế, hiển thị GPS cho vai trò được phép, trạng thái "mất tín hiệu" | Coordinator/Manager thấy xe chuyển động gần thời gian thực; Customer theo Option đã chốt |
| **M3. Nâng cao** (sau này) | ETA, tự gợi ý mốc khi tới gần điểm dừng (geofence), phát lại hành trình, gom cụm chấm trên bản đồ tổng | Theo nhu cầu |

Ước tính chỉ mang tính tham khảo, chưa tính thời gian kiểm tra trên điện thoại thật.

Đề xuất cho thời điểm sát buổi bảo vệ: **làm M0 và M1**. M1 cho thấy đủ ý nghĩa "theo dõi đơn trên bản đồ" mà không cần thu thập vị trí cá nhân.

---

## 14. Rủi ro

| Rủi ro | Mức | Cách giảm |
|---|---|---|
| Tọa độ nhập sai làm tuyến lệch | Trung bình | Đối chiếu từng địa điểm; hiển thị tên địa điểm trên bản đồ để người dùng phát hiện |
| Hết hạn mức Mapbox hoặc phát sinh phí | Trung bình | Tải bản đồ theo nhu cầu, cache tuyến, đặt cảnh báo ngân sách, có phương án dự phòng không bản đồ |
| Khách hiểu nhầm vị trí ước tính là vị trí thật | Trung bình | Nhãn "ước tính", không hiển thị tọa độ chính xác cho Customer |
| Lộ vị trí xe chở ngựa quý | Cao nếu dùng Option C | Option A cho Customer, chỉ vai trò nội bộ xem vị trí chính xác |
| Tài xế khóa màn hình làm mất vị trí | Cao (khi dùng GPS điện thoại) | Wake Lock, nhãn "cập nhật lần cuối", trạng thái "mất tín hiệu" |
| Giới hạn 100 yêu cầu/phút/IP chặn khi demo đông người | Trung bình | Chu kỳ làm mới ≥ 15 giây, tăng giới hạn nhóm API đọc |
| Token Mapbox công khai bị dùng sai | Thấp–trung bình | Giới hạn theo URL; token server riêng |
| Kiểm thử giao diện khó vì WebGL | Thấp | Tách logic khỏi hiển thị; kiểm thử khung và dự phòng |

---

## 15. Câu hỏi cần bạn chốt

1. **Customer có thấy vị trí xe trực tiếp không?** Option A (chỉ ước tính theo mốc, đề xuất), Option B (GPS trễ vài phút), hay Option C (GPS thời gian thực)?
2. **Có làm vị trí trực tiếp từ điện thoại tài xế (GĐ2) không,** hay chỉ làm bản đồ theo mốc (GĐ1) trước buổi bảo vệ?
3. **Ai nhập tọa độ địa điểm?** Tôi nạp sẵn 20 địa điểm hiện có (bạn đối chiếu lại), hay bạn muốn làm luôn màn hình quản lý địa điểm (FR-TRP-02) có chọn vị trí trên bản đồ?
4. **Specialist có cần xem bản đồ không,** và nếu có thì chỉ điểm dừng thủ tục như đề xuất (mục 4.2)?
5. **Có cần link theo dõi công khai** cho người nhận ngựa (không cần đăng nhập) không? Nếu có sẽ làm riêng với token hết hạn.
6. **Tài khoản và token Mapbox:** token trong `apps/web/.env` là của ai, đã giới hạn URL chưa, có tạo thêm token cho server được không?
7. **Thư viện:** dùng `mapbox-gl` đúng như đã nói. Nếu sau này muốn bỏ ràng buộc tài khoản và hạn mức thì có thể thay bằng `maplibre-gl`; thiết kế tách lớp hiển thị để chuyển được.

---

## Phụ lục A. Tọa độ đề xuất cho 20 địa điểm hiện có (xấp xỉ, cần đối chiếu)

| ID | Địa điểm | Loại | Vĩ độ | Kinh độ |
|---|---|---|---|---|
| 1 | Sân bay quốc tế Tân Sơn Nhất | AIRPORT | 10.8188 | 106.6520 |
| 2 | Sân bay quốc tế Nội Bài | AIRPORT | 21.2187 | 105.8072 |
| 3 | Cửa khẩu Mộc Bài | BORDER | 11.4400 | 106.1700 |
| 4 | Trạm kiểm dịch Củ Chi | QUARANTINE_STATION | 10.9733 | 106.4933 |
| 5 | Điểm dừng nghỉ Long Thành | REST_STOP | 10.7900 | 107.0100 |
| 6 | Trạm xăng Dầu Giây | FUEL_STOP | 10.9333 | 107.2333 |
| 7 | Changi Airport | AIRPORT | 1.3644 | 103.9915 |
| 8 | Tuas Checkpoint | BORDER | 1.3480 | 103.6350 |
| 9 | Hong Kong International Airport | AIRPORT | 22.3080 | 113.9185 |
| 10 | Narita International Airport | AIRPORT | 35.7720 | 140.3929 |
| 11 | Sydney Kingsford Smith Airport | AIRPORT | -33.9399 | 151.1753 |
| 12 | Melbourne Airport | AIRPORT | -37.6690 | 144.8410 |
| 13 | Incheon International Airport | AIRPORT | 37.4602 | 126.4407 |
| 14 | Kuala Lumpur International Airport | AIRPORT | 2.7456 | 101.7099 |
| 15 | Cửa khẩu Bavet | BORDER | 11.0600 | 106.1350 |
| 16 | Narita Animal Quarantine Station | QUARANTINE_STATION | 35.7600 | 140.3800 |
| 17 | Sha Tin Quarantine Stable | QUARANTINE_STATION | 22.3950 | 114.2000 |
| 18 | Điểm dừng nghỉ Bến Lức | REST_STOP | 10.6430 | 106.4870 |
| 19 | Trạm xăng Trảng Bom | FUEL_STOP | 10.9500 | 107.0100 |
| 20 | Bukit Kayu Hitam Border | BORDER | 6.4880 | 100.4270 |

Các sân bay lớn (ID 1, 2, 7, 9, 10, 11, 12, 13, 14) có tọa độ tương đối chắc; các cửa khẩu, trạm và điểm dừng (ID 3, 4, 5, 6, 8, 15, 16, 17, 18, 19, 20) chỉ ở mức khu vực và **bắt buộc đối chiếu** trước khi dùng.

## Phụ lục B. Biến môi trường dự kiến

| Biến | Nơi dùng | Ghi chú |
|---|---|---|
| `VITE_MAPBOX_TOKEN` | Web | Đã có. Token `pk.`, giới hạn theo URL |
| `MAPBOX_SERVER_TOKEN` | API | Mới. Chỉ dùng ở server cho Directions; không bao giờ gửi xuống trình duyệt |
| `MAP_CUSTOMER_DELAY_MIN` (tham số hệ thống) | API | Mới, chỉ khi chọn Option B cho Customer |
| `MAP_POSITION_RETENTION_DAYS` | API | Mới (GĐ2), mặc định 30 |

## Phụ lục C. Các tệp dự kiến tạo hoặc sửa

| Tệp | Thay đổi |
|---|---|
| `apps/api/src/database/migrations/…-LocationCoordinates.ts` | Thêm cột tọa độ, nạp dữ liệu 20 địa điểm |
| `apps/api/src/database/migrations/…-LocationRoutes.ts` | Bảng `location_routes` |
| `apps/api/src/features/trackmap/` (mới) | Dịch vụ bản đồ, lấy tuyến Mapbox, tính vị trí ước tính, routes/controller |
| `apps/api/src/shared/config/openapi.trackmap.ts` | Swagger cho các API bản đồ |
| `packages/shared/src/types/trackmap.type.ts` | Kiểu dữ liệu bản đồ dùng chung API và web |
| `apps/web/src/features/trackmap/` (mới) | `TripMap`, `FleetMap`, `MapLegend`, các hook |
| `apps/web/src/features/tracking/…` | Gắn tab/công tắc "Bản đồ" vào các màn hình hiện có |
| `apps/web/package.json` | Thêm `mapbox-gl`, `react-map-gl` |
