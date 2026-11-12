# Kế hoạch tự động hoá lập lộ trình cho điều phối viên (12/11/2026)

Mục tiêu: điều phối viên mở trang lập kế hoạch là đã có điểm gửi, điểm nhận, giờ xuất phát, các điểm nghỉ cho ngựa, giờ đến dự kiến, và với đơn quốc tế thì có cả cửa khẩu. Điều phối viên chỉ cần xem lại, kéo chỉnh nếu cần, rồi lưu. Không phải tự nhập tay từng điểm.

Long đã chốt H1–H6 ngày 12/11/2026 (xem mục 7).

## Tiến độ thực hiện (12/11/2026)

| Phần | Trạng thái | Đã làm |
|---|---|---|
| T1 tọa độ hai đầu | Xong, làm khác kế hoạch | Không lưu tọa độ lúc đặt đơn. Khi điều phối mở trang, máy chủ tự tra: địa chỉ đầy đủ (chỉ nhận nếu cách phường/tỉnh trong đơn ≤ 25 km), không thì tâm phường hoặc tỉnh; trả kèm độ chính xác để giao diện nhắc kéo ghim. Ưu điểm: dùng được cho cả đơn cũ, không đổi luồng đặt đơn |
| T2 giờ xuất phát | Xong | Ngày khách chọn + đầu khung giờ lấy ngựa (giờ Việt Nam), thiếu khung giờ thì 08:00; đơn thiếu ngày thì lịch để trống và nhắc nhập; ngày khách chọn đã qua thì cảnh báo |
| T3 thuật toán, ETA, API | Xong | `route-autoplan.ts` (hàm thuần), `trip-autoplan.ts`, `POST /trips/:id/route-plan/auto` (điều phối phụ trách, 10 lần/phút). Tham số đọc từ `system_parameters` (mã ≤ 10 ký tự: `REST_TGT`, `REST_MIN`, `REST_MAX`, `REST_DWELL`, `DRIVE_DAY`, `OVERNIGHT`, `TRUCK_FACT`, `ETA_BUFFER`, `LOADING`, `BORDER_DWL`, `REST_WARN`, `REST_BLOCK`, `DAY_START`), thiếu thì dùng mặc định đã chốt, **không cần migration**. Điểm nghỉ không có trạm trong danh mục thì đặt ngay trên tuyến và đặt tên theo địa danh (Photon reverse). Giới hạn điểm lộ trình nâng từ 12 lên 25 |
| B5 quy tắc nghỉ | Xong (gộp vào T3) | Gửi duyệt, duyệt và kiểm tra sẵn sàng đều chặn (409 `REST_RULE`) khi có đoạn lái liên tục quá 6 giờ không có điểm nghỉ; lịch tự lập cảnh báo khi quá 4 giờ |
| T4 giao diện điều phối | Xong | Bảng "Tự lập lộ trình" trên trang lập kế hoạch: tự chạy khi chuyến chưa có lộ trình; ô giờ xuất phát, ô hành lang cửa khẩu, nút "Lập lại tự động" và "Tính lại giờ theo các điểm hiện tại" (sau khi sửa tay); dòng thời gian từng điểm và cách tính giờ đến; giờ đi, giờ đến điền sẵn vào phần thời gian dự kiến |
| T5 danh mục cửa khẩu | Xong, làm khác kế hoạch | Danh sách 5 cửa khẩu Trung Quốc và 3 hành lang sang Thái Lan để trong code (`border-gates.ts`) thay vì bảng `border_gates`, nên **không cần migration**. Tọa độ đã thử với OSRM: tuyến Hà Nội → Nam Ninh, Hà Nội → Côn Minh, Hà Nội/Vinh/TP.HCM → Bangkok qua đủ các hành lang đều đi được. Chưa có giờ mở cửa |
| T6 chọn cửa khẩu | Xong (bản đầy đủ, không phải bản rút gọn) | Hệ thống tự chọn hành lang theo quãng đường chim bay qua cửa khẩu, ưu tiên cửa khẩu khách ghi trong đơn; điều phối đổi bằng ô chọn |
| T7 check-in cửa khẩu | Xong, làm khác kế hoạch | Mỗi cửa khẩu là **hai điểm** trên lộ trình: phía rời đi (`ARRIVED`, tài xế báo đã đến, dừng 30 phút kiểm tra giấy tờ, tính là một lần nghỉ) và phía bên kia (`CLEARED`, đã qua cửa khẩu). Dùng lại cơ chế check-in tuần tự sẵn có nên **không cần migration**. Khách (web, mobile) thấy "Xe đang ở cửa khẩu …, đang kiểm tra giấy tờ" hoặc "Đã qua cửa khẩu …"; thông báo cho khách và điều phối theo đúng giai đoạn. Chưa làm trạng thái "bị giữ lại" |
| Kiểm thử | Đạt | API đơn vị 14 ca cho phần này (tổng 213 đạt); tích hợp MySQL tạm `route-autoplan.mysql.cjs` 4 ca (ca cửa khẩu chạy qua service thật, gồm hai lượt check-in trong cùng một giây); route-acceptance, trip-fleet, resource-reservations, flow4-tracking vẫn đạt; mobile 70/70; web 10 file; E2E 23/23 |
| Thử trên giao diện với bản đồ thật (12/11 tối) | Đạt sau khi sửa | Dựng app trên MySQL tạm, bản đồ Photon/OSRM thật, 4 đơn: Hà Nội → TP.HCM, Hà Nội → Nam Ninh, Hà Nội → Bangkok (cả 3 hành lang), TP.HCM → Bình Dương. Điều phối tự lập, lưu lộ trình; tài xế check-in điểm nghỉ, tới cửa khẩu, qua cửa khẩu; khách thấy "đang kiểm tra giấy tờ" rồi "đã qua cửa khẩu". Các lỗi tìm được và đã sửa ở bảng dưới |

**Lỗi tìm được khi thử với bản đồ thật (đã sửa 12/11):**

| Lỗi | Cách sửa |
|---|---|
| OSRM công khai cho đơn Hà Nội → TP.HCM đi tắt qua Lào và Campuchia (1.492 km), điểm nghỉ rơi sang Lào | `vn-territory.ts`: biên giới phía tây xấp xỉ, có biên độ ~27 km; đoạn trong nước (cả tuyến trong nước, hoặc từ điểm gửi tới cửa khẩu phía Việt Nam) đi sang Lào/Campuchia thì tính lại qua các điểm trên Quốc lộ 1. Tuyến cuối vẫn ra ngoài thì cảnh báo. Hà Nội → TP.HCM giờ 1.680 km, toàn trong nước |
| "Nghỉ qua đêm" kết thúc lúc nửa đêm rồi xe chạy xuyên đêm, có ngày dừng nghỉ đêm lúc 10 giờ sáng | Nghỉ đêm ít nhất 8 giờ **và** không đi tiếp trước 05:00 sáng hôm sau (tham số mới `DAY_START` = 300 phút) |
| Ngày đầu dừng nghỉ đêm từ 14:49 vì chặng nghỉ kế tiếp sẽ vượt 10 giờ | Điểm nghỉ cuối ngày đặt vừa giới hạn 10 giờ lái (trừ hao 15 phút); nếu cửa khẩu kế tiếp làm vượt giới hạn ngày thì nghỉ đêm sau khi qua cửa khẩu trước, không chờ 15 tiếng ở cửa khẩu |
| Điểm nghỉ sát ngay trước điểm nhận (32 phút) | Đoạn cuối chỉ hơi quá 4 giờ thì nghỉ ở quãng giữa (không sớm hơn 2 giờ 30) |
| Nhãn "Điểm nghỉ sau 3 giờ 30 phút" lệch với lịch (3 giờ 47) | Nhãn chỉ còn "Điểm nghỉ N gần …", giờ đúng nằm trong lịch |
| Tên địa danh chữ Lào/Thái | Lấy tên tiếng Anh; phần vẫn là chữ bản địa thì bỏ |
| Tra tên địa danh song song bị Photon từ chối, nhiều điểm không có tên | Tối đa 2 yêu cầu cùng lúc |
| Tìm địa chỉ không giới hạn nước ("Bangkok" ra Indonesia) | Chỉ nhận kết quả thuộc nước của đơn |
| Không có chữ báo đang xử lý trong 10–30 giây đầu | Thêm dòng "Đang tra vị trí hai đầu, tính tuyến và đặt điểm nghỉ…" |
| Màn tài xế ghi "Thông quan cửa khẩu" cho cả hai lượt; app tài xế không hiện điểm cửa khẩu trong dòng thời gian | Hiện "Đến cửa khẩu · kiểm tra giấy tờ" và "Đã qua cửa khẩu" trên web và app |
| Thông báo gửi khách lặp chữ "– đã qua cửa khẩu" (biểu thức thiếu `\s`) | Sửa biểu thức |
| Hai lượt check-in trong cùng một giây bị báo "sớm hơn mốc trước" (DATETIME làm tròn phần lẻ giây lên) | Bỏ phần lẻ giây trước khi so và lưu |

**Còn lại, không thuộc phần này:** ô "nghỉ tiếp sau" trên màn tài xế vẫn đếm tới giờ giao của cả chặng (ví dụ "71 giờ 59") thay vì tới điểm nghỉ kế tiếp: đây là việc B4 (`trip-stats` trên app và phần tương ứng trên web). Quy tắc cũ "ngày giao phải khác ngày đi" vẫn áp dụng nên chuyến ngắn trong ngày (Hà Nội → Nam Ninh, TP.HCM → Bình Dương) có cảnh báo và điều phối phải sửa giờ đến.

**Chưa làm:** giờ mở cửa của cửa khẩu, trạng thái "bị giữ lại" ở cửa khẩu, xác minh cửa khẩu nhận ngựa sống (để khi mở rộng dự án theo H4, H5).

## 1. Hiện trạng (đọc code ngày 12/11)

| Phần | Đang làm thế nào | File |
|---|---|---|
| Điểm gửi, điểm nhận | Ô tìm kiếm đã điền sẵn chữ địa chỉ của khách, nhưng điều phối viên phải bấm "Tìm" và chọn kết quả thì mới có tọa độ | `apps/web/src/modules/coordinator/maps/TripRoutePlanner.tsx` |
| Tọa độ lúc đặt đơn | `route-distance.ts` tra phường, tỉnh qua Photon để tính `distanceKm`, rồi **bỏ tọa độ đi**, không lưu | `apps/api/src/features/customer/route-distance.ts` |
| Điểm nghỉ | Điều phối viên bấm "Thêm điểm nghỉ" rồi tự tìm từng điểm, tối đa 12 điểm cả tuyến | `TripRoutePlanner.tsx`, `apps/api/src/features/trips/trip-route-plan.ts` |
| Tuyến đường | OSRM trả tối đa 3 phương án (chỉ có phương án khác khi tuyến có đúng 2 điểm), kèm `distanceM`, `durationS`, đường vẽ | `apps/api/src/features/trips/trip-map-provider.ts` (`previewRoutes`) |
| Lưu lộ trình | `trips.route_plan` (JSON phiên bản 1), có mã ký để chống sửa tay; điểm thuộc 3 loại ORIGIN, REST_STOP, DESTINATION | `trips.service.ts` (`saveRoutePlan`) |
| Ngày đi | Khách nhập `orders.desired_departure_date` (chỉ ngày) và khung giờ lấy ngựa `pickupTime` (ví dụ "08:00 – 10:00") | bảng `orders`, `booking_details` |
| Giờ đi, giờ đến của chuyến | Điều phối viên tự nhập `plannedDepartureAt`, `plannedArrivalAt` | `savePlan` |
| Tài xế check-in | Mỗi điểm của lộ trình có một lượt check-in | bảng `leg_waypoint_checkins` |
| Danh mục địa điểm | Bảng `locations` đã có loại BORDER, REST_STOP, FUEL_STOP, QUARANTINE_STATION, AIRPORT | `apps/api/src/features/locations/*` |
| Thông tin quốc tế | `booking_details` đã có `border`, `customsCode`, `importPermit` nhưng chưa màn nào dùng (việc B13) | |

**Trả lời câu hỏi "ngày xuất phát là dữ liệu của ai":** của **khách hàng**. Khách nhập `desired_departure_date` lúc đặt đơn, còn giờ thì lấy được từ đầu khung `pickupTime`. Điều phối viên chỉ phải tự nhập khi đơn thiếu ngày, hoặc khi muốn đổi.

## 2. Ràng buộc phải khớp

- **Luật:** Điều 64 Luật Trật tự, an toàn giao thông đường bộ 2024 (hiệu lực 1/1/2025) quy định tài xế xe kinh doanh vận tải không được lái liên tục quá **4 giờ**, không quá **10 giờ/ngày**, không quá 48 giờ/tuần. Vì vậy mốc "4–5 tiếng nghỉ một lần" mà anh đề xuất phải hạ xuống **không quá 4 giờ**, nếu không thì chính hệ thống lại xếp lịch phạm luật.
- **Quy tắc Q5 đã chốt:** cảnh báo khi chạy liên tục quá 3 giờ không nghỉ, chặn gửi kế hoạch khi quá 6 giờ, mỗi lần nghỉ ít nhất 30 phút. Tất cả là tham số hệ thống.
- **Đã chốt (H1):** thuật toán nhắm nghỉ sau khoảng **3 giờ 30 phút** chạy, không bao giờ quá 4 giờ. Cảnh báo của Q5 dời từ 3 giờ lên **4 giờ** (đúng giới hạn của luật), để kế hoạch tự sinh không bị báo động ở mọi chặng. Ngưỡng chặn 6 giờ giữ nguyên. Cả hai vẫn là tham số hệ thống.
- **Tổ lái (H2):** mỗi xe có **1 tài xế và 1 lơ xe**. Lơ xe không lái, nên giới hạn 10 giờ lái mỗi ngày tính cho một người duy nhất.
- **Giới hạn 12 điểm:** tuyến Hà Nội – Cà Mau khoảng 30 giờ chạy sẽ có khoảng 9 điểm nghỉ, cộng điểm gửi và điểm nhận là 11 điểm, vừa đủ. Tuyến quốc tế cộng thêm 2–4 điểm cửa khẩu sẽ vượt mức, nên phải nâng giới hạn lên khoảng 20 điểm.

## 3. Luồng trong nước

### 3.1 Điểm gửi, điểm nhận tự có tọa độ

1. Lúc khách đặt đơn: `route-distance.ts` vốn đã tra tọa độ phường, tỉnh, nên lưu luôn kết quả vào `booking_details` (`originGeo`, `destinationGeo`: lat, lng, độ chính xác `ADDRESS` hoặc `WARD`).
2. Lúc mở trang lập kế hoạch: nếu chưa có tọa độ (đơn cũ), máy chủ tự tra theo thứ tự: địa chỉ đầy đủ, rồi phường + tỉnh, rồi tỉnh. Kết quả kèm độ chính xác.
3. Bản đồ hiện sẵn 2 ghim. Ghim nào chỉ chính xác đến mức phường thì có nhãn "Vị trí gần đúng, kéo ghim cho đúng chỗ lấy ngựa". Điều phối viên vẫn kéo ghim hoặc tìm lại được như hiện nay.

### 3.2 Giờ xuất phát

- Có `desired_departure_date` thì giờ xuất phát = ngày đó + giờ đầu khung `pickupTime` + thời gian bốc ngựa lên xe (tham số, mặc định 30 phút).
- Không có ngày: ô "Giờ xuất phát" trống và bắt buộc nhập ngay trên trang lập kế hoạch. Chưa nhập thì chưa sinh lộ trình.
- Điều phối viên đổi giờ thì lịch dừng và giờ đến tính lại ngay.

### 3.3 Thuật toán đặt điểm nghỉ

Đầu vào: tuyến OSRM (đường vẽ và thời gian từng đoạn), giờ xuất phát, các tham số.

1. Gọi OSRM với `annotations=duration` để biết thời gian của từng đoạn nhỏ trên tuyến.
2. Cộng dồn thời gian chạy. Đến mốc **mục tiêu** (3h30) thì xét vùng tìm kiếm từ mốc **sớm nhất** (2h30) đến mốc **trễ nhất** (4h00).
3. Trong vùng đó, tìm trong danh mục `locations` các điểm REST_STOP hoặc FUEL_STOP nằm cách tuyến không quá 3 km. Chọn điểm gần mốc mục tiêu nhất, ưu tiên điểm được đánh dấu là có chuồng hoặc chỗ cho ngựa xuống.
4. Không có điểm nào trong danh mục thì lấy chính điểm trên tuyến ở mốc mục tiêu, tra ngược ra tên địa danh (ví dụ "Điểm nghỉ gần Phủ Lý, Hà Nam"), và gắn nhãn "Điểm tự sinh, chưa xác minh".
5. Cộng thời gian nghỉ (mặc định 30 phút), đặt lại bộ đếm, rồi lặp lại cho đến khi đoạn còn lại ngắn hơn mốc trễ nhất.
6. Quá 10 giờ lái trong ngày (mỗi xe chỉ có 1 tài xế, lơ xe không thay lái) thì đổi điểm nghỉ kế tiếp thành **nghỉ qua đêm** (tham số, mặc định 8 giờ).
7. Gọi lại OSRM với đủ các điểm để có tuyến cuối cùng, vì đi vòng vào trạm sẽ làm tuyến dài thêm một chút.

Đầu ra: danh sách điểm nghỉ, giờ đến và giờ rời từng điểm, thời gian chạy dài nhất giữa hai lần nghỉ (để kiểm tra quy tắc Q5).

Thuật toán đặt trong một module mới ở API, `apps/api/src/features/trips/route-autoplan.ts`, viết dạng hàm thuần (nhận tuyến và danh mục, trả kết quả) để test không cần mạng.

### 3.4 Giờ đến dự kiến (ETA)

```
ETA = giờ xuất phát
    + thời gian OSRM × hệ số xe tải chở ngựa (tham số, mặc định 1,25 vì OSRM tính theo xe con)
    + tổng thời gian nghỉ (kể cả nghỉ qua đêm)
    + thời gian ở cửa khẩu (chỉ đơn quốc tế, mục 4)
    + thời gian dự phòng (tham số, mặc định 1 giờ)
```

- Hệ thống tự điền `plannedArrivalAt`, và hiện bảng "vì sao ra giờ này" gồm từng khoản cộng ở trên.
- Điều phối viên được sửa giờ đến, nhưng không được sớm hơn giờ tính thô (chưa cộng dự phòng). Sửa thì hệ thống ghi lại ai sửa và giờ gốc là bao nhiêu.

### 3.5 Giao diện điều phối

- Mở trang thì hệ thống tự sinh lộ trình và hiện lên bản đồ: ghim gửi, ghim nhận, các ghim nghỉ đánh số, đường đi, và dòng thời gian bên cạnh.
- Có nút "Sinh lại lộ trình". Điều phối viên vẫn được kéo, xoá, thêm điểm nghỉ. Mỗi lần sửa thì hệ thống chạy lại kiểm tra Q5 và tính lại ETA.
- Nút "Lưu lộ trình" giữ nguyên cơ chế mã ký hiện có.

## 4. Luồng quốc tế (Thái Lan, Trung Quốc)

### 4.1 Cửa khẩu: tìm hiểu được gì

**Trung Quốc.** Hai nước có chung đường biên giới đất liền. Theo quy hoạch, đến năm 2030 tuyến biên giới Việt – Trung có 26 cửa khẩu ([Tạp chí Công Thương](https://tapchicongthuong.vn/den-nam-2030--tuyen-bien-gioi-viet-nam-trung-quoc-co-26-cua-khau-112606.htm)). Tuy vậy, chỉ một số ít là cửa khẩu quốc tế đường bộ phù hợp cho xe tải ([Thư Viện Pháp Luật](https://thuvienphapluat.vn/hoi-dap-phap-luat/danh-sach-nhung-cua-khau-quoc-te-quan-trong-cua-nuoc-ta-hien-nay-138014822.html), [Vietnamtourism](https://www.vietnamtourism.com/vi/ban-do/cua-khau-quoc-te-viet-nam), [Luật Minh Khuê](https://luatminhkhue.vn/quy-che-quan-ly-cua-khau-bien-gioi-dat-lien-viet-nam-trung-quoc.aspx)). Đề xuất nạp sẵn 5 cửa khẩu:

| Cửa khẩu phía Việt Nam | Phía Trung Quốc | Tỉnh | Ghi chú |
|---|---|---|---|
| Hữu Nghị | Hữu Nghị Quan (Bằng Tường, Quảng Tây) | Lạng Sơn | Cửa ngõ chính Hà Nội – Nam Ninh |
| Móng Cái | Đông Hưng (Quảng Tây) | Quảng Ninh | Cầu Bắc Luân |
| Lào Cai (Kim Thành) | Hà Khẩu (Vân Nam) | Lào Cai | Hướng Côn Minh |
| Tà Lùng | Thủy Khẩu (Quảng Tây) | Cao Bằng | |
| Thanh Thủy | Thiên Bảo (Vân Nam) | Hà Giang (cũ) | Một nguồn ghi là song phương, giờ làm việc 7h–17h |

**Thái Lan.** Việt Nam **không có biên giới chung** với Thái Lan, nên xe phải đi qua Lào hoặc Campuchia, tức là **qua 2 cặp cửa khẩu**: ra khỏi Việt Nam, rồi vào Thái Lan. Hiệp định GMS (CBTA) và thỏa thuận ba bên Việt – Lào – Thái cho phép xe chạy thẳng mà không phải chuyển hàng sang xe khác ở Lào ([VnEconomy](https://vneconomy.vn/viet-nam-lao-thai-lan-cung-mo-cua-van-tai-duong-bo.htm), [Vietnam Briefing](https://vietnam-briefing.com/news/thailand-vietnam-direct-overland-trade.html), [Lao Trade Portal: CBTA](https://ftp.laotradeportal.gov.la/site/display/596), [ALS](https://als.com.vn/en/cross-border-transportation-vietnam-laos-thailand)).

| Hành lang | Cửa khẩu Việt Nam ra | Cửa khẩu vào Thái Lan | Ghi chú |
|---|---|---|---|
| Đường 9 (Hành lang Đông – Tây) | Lao Bảo (Quảng Trị) – Đen Sa Vẳn (Lào) | Savannakhet – Mukdahan (cầu Hữu Nghị 2) | Tuyến chính, có trong thỏa thuận ba bên |
| Đường 8 | Cầu Treo (Hà Tĩnh) – Nam Phao (Lào) | Thakhek – Nakhon Phanom (cầu Hữu Nghị 3) | Hợp cho hàng từ miền Bắc |
| Phía Nam qua Campuchia | Mộc Bài (Tây Ninh) – Bavet | Poipet – Aranyaprathet | Hợp cho hàng từ TP.HCM. Chưa thấy nguồn xác nhận cho xe chở động vật, cần kiểm tra |

**Đã chốt (H4, H5):** trong phạm vi đề tài, coi **mọi cửa khẩu trong danh sách đều nhận ngựa sống**, kể cả hành lang Campuchia. Giao diện không ghi "dữ liệu thử". Lý do: theo quy tắc nghiệp vụ, đơn phải đủ giấy tờ mới được vận chuyển, nên ở cửa khẩu chỉ còn bước kiểm tra giấy tờ.

Các văn bản kiểm dịch hiện hành (Thông tư 25/2016, sửa bởi Thông tư 09/2022, 04/2024, hợp nhất 2025) không kèm danh sách cửa khẩu được nhận động vật sống. Khi mở rộng dự án thì hỏi Cục Thú y, xác minh từng cửa khẩu, rồi mới thêm cờ lọc.

### 4.2 Dữ liệu cửa khẩu

Dùng bảng `locations` sẵn có (loại BORDER), thêm một bảng phụ `border_gates`:

| Cột | Ý nghĩa |
|---|---|
| `location_id` | Liên kết tới `locations`, giữ tọa độ phía Việt Nam |
| `country_from`, `country_to` | Ví dụ VN→CN, VN→LA, LA→TH, KH→TH |
| `paired_name`, `paired_lat`, `paired_lng` | Cửa khẩu đối diện bên kia biên giới |
| `open_time`, `close_time`, `timezone` | Giờ làm việc, để lộ trình không đến lúc cửa khẩu đã đóng |
| `expected_dwell_minutes` | Thời gian dừng để kiểm tra giấy tờ (mặc định 30 phút; kẹt xe thì có thể tới 60 phút, phần này nằm trong 1 giờ dự phòng của ETA) |
| `corridor` | Tên hành lang để ghép các cặp cửa khẩu thành tuyến (ví dụ `EWEC-R9`) |

Danh sách cửa khẩu ở mục 4.1 được nạp sẵn bằng migration dữ liệu. Tọa độ lấy từ OpenStreetMap và phải kiểm tra lại từng điểm.

### 4.3 Thuật toán chọn cửa khẩu

1. Đọc nước nhận từ đơn (`recipient.country`).
2. **CN:** lấy các cửa khẩu VN→CN. Với mỗi cửa khẩu, gọi OSRM cho tuyến gửi → cửa khẩu → nhận và chọn tuyến tổng thời gian ngắn nhất. Nếu khách đã chọn cửa khẩu dự kiến (trường `border`, việc B13) thì ưu tiên cửa khẩu đó.
3. **TH:** mỗi hành lang là một chuỗi 2 cặp cửa khẩu. Thử cả 3 hành lang theo cùng cách trên rồi chọn hành lang nhanh nhất. Kết quả gợi ý các phương án còn lại để điều phối viên đổi bằng một cú bấm.
4. Mỗi cửa khẩu trở thành một điểm loại **BORDER** trên lộ trình. Thời gian ở cửa khẩu được cộng vào ETA như thời gian nghỉ, và **tính luôn là một lần nghỉ cho ngựa** nên bộ đếm chạy liên tục được đặt lại.
5. Đến cửa khẩu ngoài giờ làm việc thì hệ thống chèn nghỉ chờ trước cửa khẩu cho đến giờ mở, và ghi rõ trong bảng ETA.
6. Điểm nghỉ ở phía nước ngoài lấy theo mục 3.3. Danh mục REST_STOP ở nước ngoài lúc đầu sẽ trống, nên các điểm này sẽ là "điểm tự sinh, chưa xác minh". Đổi múi giờ cũng phải đúng: Việt Nam, Lào, Campuchia, Thái Lan đều UTC+7, Trung Quốc UTC+8.

### 4.4 Check-in ở cửa khẩu

Điểm BORDER cần **hai lượt check-in** thay vì một:

| Lượt | Tài xế bấm | Khách thấy |
|---|---|---|
| `ARRIVED` | "Đã đến cửa khẩu" | "Xe đang ở cửa khẩu Hữu Nghị, đang làm thủ tục" |
| `CLEARED` | "Đã thông quan" (bắt buộc ghi chú hoặc ảnh tờ khai nếu có) | "Đã qua cửa khẩu Hữu Nghị lúc 14:20" |
| `HELD` (không bắt buộc) | "Bị giữ lại hoặc kiểm tra thêm" kèm lý do | "Đang chờ kiểm tra thêm ở cửa khẩu"; quản lý nhận thông báo |

- Bảng `leg_waypoint_checkins` thêm cột `stage` (mặc định `ARRIVED`, giữ đúng cho các điểm cũ), và khoá duy nhất đổi thành (`leg_id`, `waypoint_id`, `stage`).
- Không được bấm `CLEARED` khi chưa có `ARRIVED`.
- Khách hàng chỉ thấy **trạng thái cửa khẩu**, không thấy GPS trực tiếp (đúng Q4). Trang chi tiết đơn có một dải mốc: Xuất phát → … → Cửa khẩu Hữu Nghị (đã thông quan) → … → Đến nơi.
- Khi tài xế đến điểm BORDER, màn chuyến của tài xế hiện mã thông quan, giấy phép nhập khẩu và giấy tờ ngựa. Phần này nối với việc B13.

## 5. Thay đổi dữ liệu và API

| Thay đổi | Loại |
|---|---|
| `route_plan` lên **phiên bản 2**: thêm loại điểm BORDER, `plannedArrivalAt` và `dwellMinutes` cho từng điểm, `source` (AUTO, MANUAL), khối `eta` (từng khoản cộng), `autoplanParams` (tham số đã dùng). Vẫn đọc được phiên bản 1 | Code |
| Giới hạn điểm từ 12 lên 20 | Code |
| `booking_details`: thêm `originGeo`, `destinationGeo` | JSON, không cần migration |
| Bảng `border_gates` và dữ liệu nạp sẵn | Migration (cần Long đồng ý trước khi chạy trên WDP) |
| `leg_waypoint_checkins.stage` | Migration (cần Long đồng ý) |
| `system_parameters`: `REST_TARGET_MIN=210`, `REST_EARLIEST_MIN=150`, `REST_LATEST_MIN=240`, `REST_DWELL_MIN=30`, `DAILY_DRIVE_MAX_MIN=600`, `OVERNIGHT_MIN=480`, `TRUCK_SPEED_FACTOR=1.25`, `ETA_BUFFER_MIN=60`, `LOADING_MIN=30`, `BORDER_DWELL_DEFAULT_MIN=30`, `REST_WARN_MIN=240` (Q5 dời từ 180), `REST_BLOCK_MIN=360` | Dữ liệu |
| `POST /trips/:id/route-plan/auto`: sinh đề xuất, chưa lưu; trả lộ trình, mã ký, ETA, cảnh báo | API mới |
| `POST /trips/:id/checkins` nhận thêm `stage` | API sửa |
| Chi tiết đơn của khách trả `borderProgress[]` | API sửa |

## 6. Chia việc

| Giai đoạn | Việc | Ước lượng | Kiểm thử |
|---|---|---|---|
| T1 | Lưu tọa độ lúc đặt đơn; máy chủ tự tra tọa độ khi mở trang lập kế hoạch; ghim gần đúng | 0,5 ngày | Unit tra tọa độ có giả lập mạng; E2E mở trang thấy 2 ghim |
| T2 | Giờ xuất phát tự lấy từ đơn hoặc bắt nhập; tham số hệ thống | 0,5 ngày | Unit ghép ngày + khung giờ |
| T3 | `route-autoplan.ts`: điểm nghỉ, nghỉ qua đêm, ETA và các khoản cộng; API `/route-plan/auto`; `route_plan` v2 | 1,5 ngày | Unit với tuyến giả: 2h (không nghỉ), 8h, 30h (có nghỉ qua đêm), không có trạm trong danh mục |
| T4 | Giao diện: tự sinh khi mở trang, dòng thời gian, sinh lại, sửa ETA có ghi lại | 1 ngày | E2E đơn trong nước: mở trang, lưu không cần nhập tay |
| T5 | `border_gates`, dữ liệu 5 cửa khẩu Trung Quốc và 3 hành lang Thái Lan (Lao Bảo, Cầu Treo, Mộc Bài), giờ mở cửa | 0,5 ngày | Test MySQL trên Docker tạm |
| T6 | Chọn cửa khẩu và hành lang, điểm BORDER, giờ mở cửa, múi giờ | 1 ngày | Unit: đơn sang CN chọn cửa khẩu nhanh nhất; sang TH qua 2 cặp; đến lúc cửa khẩu đóng thì có nghỉ chờ |
| T7 | Check-in 2 lượt ở cửa khẩu (API, mobile tài xế), dải mốc cửa khẩu cho khách (web, mobile), thông báo khi `HELD` | 1 ngày | Test MySQL; E2E tài xế bấm đến và thông quan, khách thấy đúng chữ |

Tổng khoảng **6 ngày làm việc**, trong khi đến buổi bảo vệ (khoảng 18/11) chỉ còn 6 ngày và còn các việc B13, B5, B4 của ngày 5. **Đề xuất:**

- **Trước bảo vệ:** làm T1–T4 (trong nước, tự động hoàn toàn). Riêng quốc tế làm bản rút gọn của T5–T7: nạp sẵn danh sách cửa khẩu, cho điều phối viên **chọn** cửa khẩu từ danh sách (hệ thống tự chèn vào tuyến), và check-in 2 lượt. T3 thay luôn phần "tính điểm nghỉ" của việc B5, nên B5 và lịch nghỉ tự động làm cùng lúc.
- **Sau bảo vệ:** tự chọn cửa khẩu hoặc hành lang nhanh nhất, màn quản lý cửa khẩu, xác minh cửa khẩu nhận động vật sống.

## 7. Long đã chốt (12/11/2026)

| Câu | Quyết định |
|---|---|
| H1 | Theo đề xuất: nhắm nghỉ sau 3h30, trễ nhất 4h00, nghỉ 30 phút. Cảnh báo Q5 dời lên 4 giờ, chặn vẫn ở 6 giờ |
| H2 | Mỗi xe có 1 tài xế và 1 lơ xe. Giới hạn 10 giờ lái mỗi ngày tính cho một tài xế, quá mức thì nghỉ qua đêm |
| H3 | Theo đề xuất: hệ số xe tải 1,25, dự phòng 1 giờ |
| H4 | Coi mọi cửa khẩu trong danh sách đều nhận ngựa sống và kiểm tra giấy tờ, không ghi "dữ liệu thử". Khi mở rộng dự án sẽ tìm hiểu kỹ hơn |
| H5 | Giữ hành lang Campuchia (Mộc Bài – Bavet → Poipet – Aranyaprathet) để có đủ đường đi. Khi mở rộng sẽ tìm hiểu như H4 |
| H6 | Dừng ở cửa khẩu khoảng **30 phút** (chỉ kiểm tra giấy tờ, vì quy tắc nghiệp vụ là đủ giấy tờ mới được vận chuyển); kẹt xe thì tới 1 giờ, phần dư nằm trong dự phòng của ETA. Lần dừng này tính luôn là một lần nghỉ cho ngựa |
