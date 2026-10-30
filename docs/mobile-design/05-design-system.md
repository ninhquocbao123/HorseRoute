# 05 — Design system

Trạng thái: bản 1, Long duyệt 29/10/2026 (chốt theo đề xuất, xem mục 7).

| File | Nội dung |
| --- | --- |
| `docs/mobile-design/05-design-system.md` | Tài liệu này: token, spec component, nguyên tắc |
| `docs/mobile-design/tokens/theme.ts` | Token TypeScript, copy thẳng vào app Expo. `strict`, không `any`, không import `react-native` |
| `docs/mobile-design/design-system.html` | Xem trực quan, có nút Sáng / Tối / Theo máy. Link xem: https://claude.ai/artifact/EjYUZ4wGKUeYHoMyC9Mjv7 |

Nguồn màu: `apps/web/src/features/home/landing-page.css` (`:root`), `apps/web/src/features/tracking/driver/driver-shell.css` (`--drs-*`). Màu, font và logo đã chốt ở 00-context mục 5b. Tài liệu này không thêm màu mới: chỉ sinh thang từ các màu đó và đổi một màu ngữ nghĩa không đạt tương phản (warning, xem mục 1.3).

## 1. Màu

### 1.1 Thang màu

Cách sinh: lấy các màu web làm điểm neo, nội suy tuyến tính trong không gian OKLCH (L, C, H) giữa hai điểm neo kề nhau. Bậc 950 thêm vào để chứa nền tối của web và chữ trên nút vàng.

Điểm neo:

- Teal: 100 = `--soft` #e7f1f1, 700 = `--navy2` #14606a, 900 = `--navy` #0b3b42, 950 = nền tối #061416.
- Vàng: 500 = `--gold` #f4b942, 700 = `--gold-d` #a86a00, 950 = chữ trên nút #2b1a00.
- Xám ngả teal: 50 = `--bg` #f6faf9, 200 = `--line` #d8e6e6, 600 = `--muted` #546d71, 900 = `--ink` #0d2a2e, 950 = #061416.

| Bậc | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Teal | `#f2f8f8` | `#e7f1f1` | `#c5d8d8` | `#a3bfc1` | `#81a6aa` | `#608f94` | `#3e777e` | `#14606a` | `#104d56` | `#0b3b42` | `#061416` |
| Vàng | `#fef9ec` | `#fbedce` | `#f8e1af` | `#f7d58f` | `#f5c76d` | `#f4b942` | `#ce9025` | `#a86a00` | `#7b4e00` | `#513300` | `#2b1a00` |
| Xám ngả teal | `#f6faf9` | `#e7f0f0` | `#d8e6e6` | `#b5c6c7` | `#94a8a9` | `#738a8d` | `#546d71` | `#3c565a` | `#243f43` | `#0d2a2e` | `#061416` |

Code không dùng thang trực tiếp. Thang chỉ để dựng token vai trò ở 1.2 và cho các trường hợp hiếm (biểu đồ, ảnh giữ chỗ).

### 1.2 Token theo vai trò

| Token | Sáng | Tối | Dùng cho |
| --- | --- | --- | --- |
| `bg` | `#f6faf9` | `#061416` |  |
| `surface` | `#ffffff` | `#0c2326` |  |
| `surfaceMuted` | `#e7f1f1` | `#08191b` |  |
| `surfaceElevated` | `#ffffff` | `#133034` |  |
| `surfaceBrand` | `#0b3b42` | `#104d56` |  |
| `surfaceBrandAlt` | `#14606a` | `#14606a` |  |
| `onBrand` | `#ffffff` | `#ffffff` |  |
| `onBrandMuted` | `#b9d3d6` | `#b9d3d6` |  |
| `textPrimary` | `#0d2a2e` | `#e8f4f4` |  |
| `textSecondary` | `#546d71` | `#96b4b7` |  |
| `textDisabled` | `#94a8a9` | `#55716f` |  |
| `border` | `#d8e6e6` | `#1a3a3e` |  |
| `borderInput` | `#738a8d` | `#56777a` |  |
| `borderStrong` | `#0b3b42` | `#96b4b7` |  |
| `accent` | `#f4b942` | `#f4b942` |  |
| `accentPressed` | `#ce9025` | `#f5c76d` |  |
| `onAccent` | `#2b1a00` | `#2b1a00` |  |
| `accentText` | `#7b4e00` | `#f5c76d` |  |
| `accentSubtle` | `#fef9ec` | `#2a2410` |  |
| `link` | `#14606a` | `#7cc7cf` |  |
| `focusRing` | `#14606a` | `#7cc7cf` |  |
| `tabActive` | `#0b3b42` | `#e8f4f4` |  |
| `tabInactive` | `#546d71` | `#96b4b7` |  |
| `successFg` | `#166534` | `#6fd39a` |  |
| `successBg` | `#eaf6ee` | `#0f2a1e` |  |
| `successSolid` | `#166534` | `#17753f` |  |
| `warningFg` | `#a24a05` | `#f3a35c` |  |
| `warningBg` | `#fdf1e4` | `#2e1f0f` |  |
| `warningSolid` | `#b45309` | `#b45309` |  |
| `dangerFg` | `#b42318` | `#ff8a80` |  |
| `dangerBg` | `#fdeceb` | `#341514` |  |
| `dangerSolid` | `#dc2626` | `#dc2626` |  |
| `infoFg` | `#14606a` | `#7cc7cf` |  |
| `infoBg` | `#f2f8f8` | `#0f2e33` |  |
| `infoSolid` | `#14606a` | `#14606a` |  |
| `neutralFg` | `#546d71` | `#96b4b7` |  |
| `neutralBg` | `#e7f0f0` | `#12302f` |  |
| `overlay` | `rgba(6,20,22,0.48)` | `rgba(0,0,0,0.6)` |  |

Phân bổ 60-30-10 giữ như 00-context: nền sáng 60%, teal 30% (header đậm, tab đang chọn, một thẻ nổi bật), vàng 10% (một nút chính mỗi màn).

Dark mode:

- Nền #061416, thẻ #0c2326 lấy từ web. Lớp nổi (sheet, dialog) là `surfaceElevated` #133034, sáng hơn thẻ một bậc. Không dùng bóng.
- Thẻ brand chuyển sang teal 800 #104d56 để vẫn tách khỏi nền tối.
- Vàng giữ nguyên #f4b942 cho nút. Chữ vàng dùng vàng 400 #f5c76d.
- Liên kết đổi sang teal sáng #7cc7cf để đạt tương phản trên nền tối.

### 1.3 Màu ngữ nghĩa

Mỗi ngữ nghĩa có ba token: `Fg` (chữ, icon), `Bg` (nền nhạt của badge, banner), `Solid` (khối đặc chữ trắng, ví dụ nút destructive).

| Ngữ nghĩa | Sáng Fg / Bg / Solid | Tối Fg / Bg / Solid | Ghi chú |
| --- | --- | --- | --- |
| success | #166534 / #eaf6ee / #166534 | #6fd39a / #0f2a1e / #17753f | Giữ màu web |
| warning | #a24a05 / #fdf1e4 / #b45309 | #f3a35c / #2e1f0f / #b45309 | **Đổi** so với web (#ca8a04, xem dưới) |
| danger | #b42318 / #fdeceb / #dc2626 | #ff8a80 / #341514 / #dc2626 | #dc2626 của web làm khối đặc; chữ đậm hơn |
| info | #14606a / #f2f8f8 / #14606a | #7cc7cf / #0f2e33 / #14606a | Chính là teal, không thêm xanh dương |
| neutral | #546d71 / #e7f0f0 | #96b4b7 / #12302f | Nháp, đã hủy |

Vì sao đổi warning: #ca8a04 của web chỉ đạt 2.9:1 trên nền trắng nên không dùng làm chữ được. Ngoài ra nó gần vàng nút chính, người dùng dễ hiểu nhầm cảnh báo là hành động. Cam đất #a24a05 tách rõ khỏi vàng, đạt 5,4:1 trên nền nhạt và 6:1 trên nền trắng.

### 1.4 Tương phản đã đo

Công thức WCAG 2.1. Chữ cần ≥ 4.5:1, viền ô nhập và vòng focus (thành phần UI) cần ≥ 3:1. Tất cả các cặp dưới đây đều đạt.

| Chữ / nền | Sáng | Tối | Yêu cầu |
| --- | --- | --- | --- |
| `textPrimary` / `bg` | 14.38:1 | 16.69:1 | ≥ 4.5:1 |
| `textPrimary` / `surface` | 15.13:1 | 14.55:1 | ≥ 4.5:1 |
| `textPrimary` / `surfaceMuted` | 13.15:1 | 16.03:1 | ≥ 4.5:1 |
| `textPrimary` / `surfaceElevated` | 15.13:1 | 12.45:1 | ≥ 4.5:1 |
| `textSecondary` / `bg` | 5.25:1 | 8.49:1 | ≥ 4.5:1 |
| `textSecondary` / `surface` | 5.52:1 | 7.41:1 | ≥ 4.5:1 |
| `textSecondary` / `surfaceMuted` | 4.80:1 | 8.16:1 | ≥ 4.5:1 |
| `onBrand` / `surfaceBrand` | 12.22:1 | 9.47:1 | ≥ 4.5:1 |
| `onBrandMuted` / `surfaceBrand` | 7.77:1 | 6.02:1 | ≥ 4.5:1 |
| `onBrand` / `surfaceBrandAlt` | 7.21:1 | 7.21:1 | ≥ 4.5:1 |
| `onAccent` / `accent` | 9.49:1 | 9.49:1 | ≥ 4.5:1 |
| `onAccent` / `accentPressed` | 6.11:1 | 10.61:1 | ≥ 4.5:1 |
| `accentText` / `surface` | 7.16:1 | 10.34:1 | ≥ 4.5:1 |
| `accentText` / `accentSubtle` | 6.81:1 | 9.77:1 | ≥ 4.5:1 |
| `link` / `surface` | 7.21:1 | 8.51:1 | ≥ 4.5:1 |
| `link` / `bg` | 6.86:1 | 9.76:1 | ≥ 4.5:1 |
| `tabActive` / `surface` | 12.22:1 | 14.55:1 | ≥ 4.5:1 |
| `tabInactive` / `surface` | 5.52:1 | 7.41:1 | ≥ 4.5:1 |
| `borderInput` / `surface` | 3.65:1 | 3.36:1 | ≥ 3:1 |
| `focusRing` / `surface` | 7.21:1 | 8.51:1 | ≥ 3:1 |
| `successFg` / `successBg` | 6.42:1 | 8.36:1 | ≥ 4.5:1 |
| `successFg` / `surface` | 7.13:1 | 8.93:1 | ≥ 4.5:1 |
| `warningFg` / `warningBg` | 5.37:1 | 7.74:1 | ≥ 4.5:1 |
| `warningFg` / `surface` | 5.97:1 | 7.95:1 | ≥ 4.5:1 |
| `dangerFg` / `dangerBg` | 5.75:1 | 7.28:1 | ≥ 4.5:1 |
| `dangerFg` / `surface` | 6.57:1 | 7.16:1 | ≥ 4.5:1 |
| `infoFg` / `infoBg` | 6.72:1 | 7.49:1 | ≥ 4.5:1 |
| `neutralFg` / `neutralBg` | 4.76:1 | 6.38:1 | ≥ 4.5:1 |
| `onBrand` / `successSolid` | 7.13:1 | 5.75:1 | ≥ 4.5:1 |
| `onBrand` / `dangerSolid` | 4.83:1 | 4.83:1 | ≥ 4.5:1 |
| `onBrand` / `warningSolid` | 5.02:1 | 5.02:1 | ≥ 4.5:1 |
| `onBrand` / `infoSolid` | 7.21:1 | 7.21:1 | ≥ 4.5:1 |

Cấm:

- #f4b942 làm chữ hoặc icon trên nền sáng (1.8:1).
- `textDisabled` cho nội dung cần đọc. Nó chỉ dùng cho nội dung bị khóa, được WCAG miễn.
- Đường kẻ `border` #d8e6e6 làm viền ô nhập (1.3:1). Ô nhập dùng `borderInput`.

### 1.5 Trạng thái nghiệp vụ

Mỗi trạng thái có nhãn, tone và icon cố định (`theme.ts`: `orderStatus`, `legStatus`...). Component `StatusBadge` chỉ nhận khóa trạng thái, không nhận màu. Tone `brand` (nền teal đậm, chữ trắng) chỉ dành cho trạng thái "đang chạy". Màu chỉ giúp quét nhanh, không mang nghĩa một mình.

**Đơn hàng (`orders.status`)**

| Giá trị | Nhãn | Tone | Icon Lucide |
| --- | --- | --- | --- |
| `DRAFT` | Nháp | neutral | `file-pen-line` |
| `PENDING` | Chờ duyệt | info | `clock` |
| `NEED_INFO` | Cần bổ sung | warning | `circle-alert` |
| `REJECTED` | Từ chối | danger | `circle-x` |
| `APPROVED` | Đã duyệt | info | `badge-check` |
| `PREPARING` | Đang chuẩn bị | info | `package` |
| `READY` | Sẵn sàng vận chuyển | info | `calendar-check` |
| `IN_TRANSIT` | Đang vận chuyển | brand | `truck` |
| `DELIVERED` | Đã giao | success | `circle-check` |
| `CANCELLED` | Đã hủy | neutral | `ban` |

**Nhãn cần khách xử lý (ghép, không phải cột DB)**

| Giá trị | Nhãn | Tone | Icon Lucide |
| --- | --- | --- | --- |
| `AWAITING_DEPOSIT` | Chờ đặt cọc | warning | `wallet` |

**Chặng (`legs.status`)**

| Giá trị | Nhãn | Tone | Icon Lucide |
| --- | --- | --- | --- |
| `NOT_STARTED` | Chưa bắt đầu | neutral | `circle-dashed` |
| `MOVING` | Đang di chuyển | brand | `truck` |
| `AT_STOP` | Đang dừng | info | `map-pin` |
| `COMPLETED` | Hoàn thành | success | `circle-check` |

**Hàng chờ offline**

| Giá trị | Nhãn | Tone | Icon Lucide |
| --- | --- | --- | --- |
| `QUEUED` | Chờ gửi | warning | `cloud-off` |
| `SENDING` | Đang gửi | info | `refresh-cw` |
| `SENT` | Đã gửi | success | `check` |
| `REJECTED` | Bị từ chối | danger | `circle-x` |

**Sự cố (`incidents.status`)**

| Giá trị | Nhãn | Tone | Icon Lucide |
| --- | --- | --- | --- |
| `NEW` | Đã gửi, chờ tiếp nhận | warning | `send` |
| `ACKNOWLEDGED` | Đã tiếp nhận | info | `user-check` |
| `CLOSED` | Đã đóng | neutral | `circle-check` |

**Mức độ sự cố (kèm vạch 1-2-3)**

| Giá trị | Nhãn | Tone | Icon Lucide |
| --- | --- | --- | --- |
| `LOW` | Nhẹ | neutral | `signal-low` |
| `MEDIUM` | Trung bình | warning | `signal-medium` |
| `HIGH` | Nghiêm trọng | danger | `signal-high` |

**Sức khỏe ngựa (`condition_status`)**

| Giá trị | Nhãn | Tone | Icon Lucide |
| --- | --- | --- | --- |
| `STABLE` | Sức khỏe ổn định | success | `heart-pulse` |
| `OFF_FEED` | Bỏ ăn | warning | `utensils-crossed` |
| `STRESSED` | Căng thẳng | warning | `activity` |
| `CLIMATE_CHANGE` | Khí hậu thay đổi | info | `thermometer` |

**Báo cáo sức khỏe (`report_status`)**

| Giá trị | Nhãn | Tone | Icon Lucide |
| --- | --- | --- | --- |
| `DRAFT` | Nháp | neutral | `file-pen-line` |
| `SENT` | Đã gửi | success | `send` |
| `VIEWED` | Khách đã xem | info | `eye` |

**Giấy tờ**

| Giá trị | Nhãn | Tone | Icon Lucide |
| --- | --- | --- | --- |
| `NOT_SUBMITTED` | Chưa nộp | neutral | `file` |
| `SUBMITTED` | Chờ kiểm tra | info | `file-clock` |
| `VALID` | Hợp lệ | success | `file-check` |
| `INVALID` | Không hợp lệ | danger | `file-x` |
| `EXPIRED` | Hết hạn | danger | `calendar-x` |

**Thanh toán**

| Giá trị | Nhãn | Tone | Icon Lucide |
| --- | --- | --- | --- |
| `PENDING` | Đang chờ thanh toán | warning | `hourglass` |
| `SUCCESS` | Đã thanh toán | success | `circle-check` |
| `FAILED` | Thanh toán thất bại | danger | `circle-x` |
| `CANCELLED` | Đã hủy | neutral | `ban` |

**Ngựa trong đơn**

| Giá trị | Nhãn | Tone | Icon Lucide |
| --- | --- | --- | --- |
| `NORMAL` | Bình thường | neutral | `check` |
| `FLAGGED` | Bị gắn cờ | danger | `flag` |
| `REMOVED` | Đã rút khỏi đơn | neutral | `circle-minus` |


## 2. Typography

Font duy nhất: Be Vietnam Pro, nạp bằng `@expo-google-fonts/be-vietnam-pro` với 4 độ đậm 400, 500, 600, 700. Android cần tên family riêng cho từng độ đậm, nên token dùng `fontFamily` (`BeVietnamPro_600SemiBold`...) thay cho `fontWeight`.

| Token | Cỡ / dòng | Độ đậm | Letter spacing | Dùng cho |
| --- | --- | --- | --- | --- |
| largeTitle | 34 / 42 | 700 | -0.4 | Tiêu đề tab gốc |
| title1 | 28 / 36 | 700 | -0.3 | Tiêu đề màn con quan trọng |
| title2 | 22 / 30 | 600 | -0.2 | Tiêu đề khối, màn xin quyền |
| title3 | 20 / 28 | 600 | -0.1 | Tiêu đề sheet, tuyến trên thẻ |
| display | 24 / 32 | 700 | -0.2 | Chỉ tài xế: tên điểm kế tiếp (DRV-02) |
| headline | 17 / 24 | 600 | 0 | Tên dòng, tên ngựa |
| body | 17 / 26 | 400 | 0 | Nội dung |
| bodyStrong | 17 / 26 | 600 | 0 | Nội dung nhấn |
| callout | 16 / 24 | 400 | 0 | Nội dung trong thẻ |
| subhead | 15 / 22 | 400 | 0 | Mô tả phụ |
| footnote | 13 / 19 | 400 | 0 | Giờ, mã đơn, trợ giúp, lỗi dưới ô |
| caption | 12 / 18 | 500 | 0.1 | Nhãn nhỏ, nhãn viết hoa |
| buttonLarge | 18 / 24 | 600 | 0 | Nút L 56, XL 64 |
| button | 17 / 22 | 600 | 0 | Nút M 48 |
| buttonSmall | 15 / 20 | 600 | 0 | Nút S 36 |

Ghi chú:

- **Dấu tiếng Việt.** lineHeight cao hơn iOS 1–2pt để dấu chồng (ệ, ộ, ữ, Ệ, Ộ) ở dòng trên không chạm dòng dưới. Đã kiểm tra ở 12 và 13pt trong design-system.html: dấu tách rõ, không dính chữ. Không dùng cỡ dưới 12. Ngoại lệ duy nhất: nhãn tab bar 11 (theo iOS), luôn đi kèm icon.
- **Chữ hoa.** Nhãn viết hoa (ĐIỂM KẾ TIẾP) dùng caption, letterSpacing 0.06em.
- **Số.** Tiền, giờ và số đo dùng `fontVariant: ['tabular-nums']`. Tiền ghi `48.600.000 ₫`, thập phân dùng dấu phẩy `38,2 °C`.
- **Phóng to chữ hệ thống.** Bật `allowFontScaling`, giới hạn `maxFontSizeMultiplier` 1.6 cho body và 1.3 cho nút, tab bar, badge để bố cục không vỡ. Nội dung dài phải xuống dòng, không cắt chữ.
- **Số cỡ chữ.** Mỗi màn tối đa 4 cỡ.

## 3. Spacing, bo góc, bóng, kích thước

**Spacing** (lưới 8, bước nhỏ 4): `xxs 4, xs 8, sm 12, md 16, lg 20, xl 24, xxl 32, x3l 40, x4l 48, x5l 64`.

- Lề ngang màn: 16.
- Giữa các khối: 24.
- Trong thẻ: 16.
- Giữa hai vùng chạm: tối thiểu 8.

**Bo góc:**

- sm 8: badge nhỏ, chip vuông, ô ảnh nhỏ, nút S.
- md 12: nút, ô nhập, ô icon 40.
- lg 16: thẻ, khối danh sách, nút XL 64, toast.
- xl 24: bottom sheet (góc trên), dialog.
- full: badge, chip lọc, avatar, switch.

Bo đồng tâm: phần tử con bo bằng bo của cha trừ padding.

**Bóng** (chỉ chế độ sáng, màu #0b3b42):

| Mức | Offset y / blur | Opacity | Android elevation | Dùng cho |
| --- | --- | --- | --- | --- |
| sm | 1 / 2 | 4% | 1 | Thẻ nổi trên nền, hiếm dùng |
| md | 4 / 12 | 6% | 3 | Thanh nút cố định đáy, tab bar |
| lg | 12 / 32 | 10% | 8 | Sheet, dialog, toast |

Dark mode không có bóng. Ưu tiên đường kẻ `border` trước bóng (00-context 5c).

**Kích thước:**

- `touchTarget` 44: tối thiểu cho mọi vùng chạm.
- `touchTargetLarge` 56: tài xế, hộ tống.
- `driverPrimaryButton` 64: nút chính đáy màn của tài xế.
- `inputHeight` 52. Ô nhập có nhãn trong ô: 56.
- `tabBarHeight` 56 + safe area.
- `headerHeight` 52.
- Icon 16, 20, 24, nét 2 (Lucide). Icon ngựa vẽ riêng cùng nét, viewBox 24.

## 4. Chuyển động

| Token | Giá trị | Dùng cho |
| --- | --- | --- |
| duration.fast | 150 ms | Nhấn nút, đổi màu, switch |
| duration.base | 250 ms | Đổi trạng thái, toast vào |
| duration.slow | 350 ms | Sheet mở, chuyển màn |
| easing.standard | (0.2, 0, 0, 1) | Đổi tại chỗ |
| easing.enter | (0, 0, 0, 1) | Phần tử đi vào |
| easing.exit | (0.3, 0, 1, 1) | Phần tử đi ra, nhanh hơn lúc vào |
| spring.sheet | damping 28, stiffness 280, mass 1 | Sheet mở và kéo thả (Reanimated `withSpring`) |
| spring.press | damping 20, stiffness 400, mass 1 | Nút nhấn |
| pressScale | 0.98 | Nút, thẻ bấm được |
| undoWindowMs | 5000 | Thanh Hoàn tác của tài xế |

**Reduce Motion** (`AccessibilityInfo.isReduceMotionEnabled`):

- Bỏ scale và chuyển động trượt.
- Chỉ đổi độ mờ trong 150 ms.
- Tắt ánh sáng chạy của skeleton.

**Haptic** (`expo-haptics`):

- Light: lưu ghi nhanh.
- Medium: ghi mốc.
- Warning: gửi sự cố.
- Error: lỗi gửi.

## 5. Component

Quy ước chung cho mọi component:

- Mọi phần tử bấm được có `accessibilityRole` và `accessibilityLabel`. Icon không có chữ thì bắt buộc label.
- Trạng thái nhấn đổi nền ngay (dưới 50 ms). Nút và thẻ co lại `pressScale`.
- Tên prop theo tiếng Anh, nhãn hiển thị tiếng Việt.

### 5.1 Button

Nhãn là động từ cụ thể ("Xác nhận đã giao ngựa", không phải "OK").

| Variant | Nền / chữ | Dùng cho |
| --- | --- | --- |
| primary | accent / onAccent | Hành động chính. Một nút mỗi màn |
| secondary | surface, viền 1.5 borderStrong / textPrimary | Hành động phụ: Lưu nháp, Thử lại |
| tertiary | trong suốt / link, gạch chân | Để sau, Xem các mục, hành động trong header |
| destructive | dangerSolid / trắng | Xóa, bỏ dữ liệu. Chỉ trong dialog xác nhận |

| Size | Cao | Chữ | Dùng cho |
| --- | --- | --- | --- |
| XL | 64, bo 16 | buttonLarge, icon 24 | Nút chính đáy màn tài xế |
| L | 56 | buttonLarge | Tài xế, hộ tống; nút trong sheet |
| M | 48 | button | Mặc định |
| S | 36, bo 8 | buttonSmall | Trong dòng, header |

Các trạng thái:

- **default.**
- **pressed:** primary dùng accentPressed, secondary dùng surfaceMuted, kèm co 0.98.
- **disabled:** nền surfaceMuted, chữ textDisabled.
- **loading:** spinner 20 và nhãn tiến hành ("Đang gửi..."), giữ nguyên độ rộng, không bấm lại được.
- **focus:** vòng 2 focusRing, cách 2.

Props: `variant`, `size`, `label`, `icon?`, `iconPosition?: 'leading' | 'trailing'`, `loading?`, `disabled?`, `fullWidth?` (mặc định true với M, L, XL), `onPress`, `haptic?`.

Dùng:

- Chỉ khóa nút khi người dùng không thể làm gì để mở khóa. Thiếu dữ liệu thì để nút bấm được và báo lỗi tại chỗ (quyết định ở ESC-04).

Không dùng:

- Hai nút primary trên một màn.
- Vàng cho nút phá hủy.
- Nhãn chung chung.

### 5.2 IconButton

- Vùng chạm 44 (56 cho tài xế), icon 20–24.
- Variant: `plain`, `filled` (nền surfaceMuted).
- Chấm vàng 9 khi có mục chưa đọc.
- States: default, pressed (nền border), disabled.
- Props: `icon`, `accessibilityLabel` (bắt buộc), `variant?`, `badge?: boolean`, `onPress`.

### 5.3 TextField

- Ô cao 56, bo 12, viền 1.5 borderInput. Nhãn 12 nằm trong ô, luôn hiện. Icon đầu và cuối 20 tùy chọn.
- States:
  - Trống: placeholder màu textSecondary.
  - Focus: viền focusRing và quầng 3 nhạt.
  - Đã điền.
  - Lỗi: viền dangerFg, dòng lỗi 13 kèm icon dưới ô.
  - Khóa: nền surfaceMuted, icon khóa, dòng giải thích.
  - Có gợi ý: dòng 13 textSecondary.
- Props: `label`, `value`, `onChangeText`, `placeholder?`, `helper?`, `error?`, `leadingIcon?`, `trailingIcon?`, `secureTextEntry?`, `keyboardType?`, `editable?`, `unit?`.
- Lỗi nói cách sửa. Ví dụ "Số hộ chiếu này đã có ở hồ sơ Sao Mai. Kiểm tra lại số trên giấy". Không viết "Không hợp lệ".
- Kiểm tra khi rời ô hoặc khi bấm gửi, không kiểm tra theo từng phím.

### 5.4 TextArea

- Như TextField, cao tối thiểu 120, tự giãn tới 240 rồi cuộn trong ô.
- Đếm ký tự 12 ở góc phải dưới (giới hạn 1000 theo backend).
- Tùy chọn hàng câu mẫu (chip lọc) và nút đọc giọng nói cho tài xế (DRV-07).
- Props: như TextField, thêm `maxLength`, `suggestions?: string[]`, `voiceInput?`.

### 5.5 Select / Picker

- Giao diện như TextField, icon cuối là chevron-down.
- Chạm mở BottomSheet danh sách khi ≤ 7 lựa chọn, mở màn có ô tìm kiếm khi > 7.
- Dòng lựa chọn cao 52, mục đang chọn đậm và có dấu tick màu link.
- States: đóng, chưa chọn, lỗi, mở.
- Props: `label`, `options: { value, label }[]`, `value`, `onChange`, `multiple?`, `error?`.

### 5.6 DateTimePicker

- Ô như TextField với icon calendar hoặc clock. Định dạng `29/10/2026 · 09:40`. Trong 2 ngày gần thì ghi "Hôm nay", "Hôm qua".
- Chạm mở picker gốc (`@react-native-community/datetimepicker`) trong sheet.
- Có `minimumDate` và `maximumDate`. Sửa giờ mốc chỉ trong 24 giờ (G3).
- Ra ngoài khoảng thì báo lỗi kèm giới hạn cụ thể.
- Props: `mode: 'date' | 'time' | 'datetime'`, `value`, `onChange`, `min?`, `max?`, `label`.

### 5.7 Chip / ChoiceChip

| Variant | Cao | Dùng cho |
| --- | --- | --- |
| choice | 44, bo full | Chọn loại sự cố, ngựa |
| choice L | 56, bo 16, icon 20 | Ghi nhanh của hộ tống |
| filter | 36, bo full, có số đếm | Lọc danh sách đơn |

- Đang chọn: nền surfaceBrand, chữ onBrand. Giữ nguyên độ đậm 500 và không thêm tick, để chip không đổi bề rộng khi chọn (Long góp ý 30/10: chip nhảy làm cả sheet giật). Chọn nhiều thì ghi rõ "chọn một hoặc nhiều" ở nhãn nhóm.
- Đổi nền bằng hiệu ứng màu 150 ms, không animate kích thước.
- Các state khác: pressed (nền surfaceMuted), disabled (nền surfaceMuted, chữ textDisabled).
- Props: `label`, `icon?`, `selected`, `onPress`, `size?`, `count?`, `disabled?`.

### 5.8 Stepper

- Cao 56, nút ± rộng 64, icon 24. Giá trị 22 semibold ở giữa, có đơn vị.
- Chạm vào giá trị để gõ số bằng bàn phím số.
- Ở giới hạn thì nút tương ứng bị khóa.
- Props: `value`, `onChange`, `min`, `max`, `step`, `unit`.

### 5.9 Checkbox / ChecklistItem

ChecklistItem:

- Cả dòng là vùng chạm, cao ≥ 64. Ô vuông 28 bo 8, tiêu đề 17 semibold, mô tả 13.
- States: chưa tick; đã tick (ô teal đặc có tick, dòng nền surfaceMuted); còn thiếu khi bấm tiếp (viền dangerFg, mô tả đổi thành lỗi); khóa.

Checkbox nhỏ:

- Ô 22, dùng trong form của khách. Ví dụ "Gửi báo cáo này cho khách".

Props: `title`, `description?`, `checked`, `onToggle`, `error?`, `disabled?`.

### 5.10 Switch

- Dùng `Switch` gốc của hệ điều hành, màu bật surfaceBrandAlt.
- Có hiệu lực ngay, không cần nút Lưu. Việc cần xác nhận thì dùng Checkbox.
- Đặt trong dòng 52, nhãn bên trái.

### 5.11 Card

| Variant | Kiểu | Dùng cho |
| --- | --- | --- |
| default | surface, viền border, bo 16, padding 16, không bóng | Mọi thẻ |
| brand | surfaceBrand, chữ onBrand | Một thẻ quan trọng nhất màn (điểm kế tiếp, tổng hôm nay) |
| gradient | teal #0b3b42 → #14606a | **Chỉ** thẻ chuyến đang chạy trên Hành trình của khách |

States khi bấm được: pressed (nền surfaceMuted), selected (viền 2 borderStrong).

Không lồng thẻ trong thẻ. Trong thẻ phân tách bằng đường kẻ `hr`.

### 5.12 ListItem

- Cao ≥ 60, padding 16. Các dòng gom trong khối bo 16, phân cách bằng đường kẻ.
- Icon đầu dòng trong ô 40 bo 12. Tiêu đề 16 semibold, chữ phụ 13 một dòng cắt dấu ba chấm.
- Phần cuối dòng: chevron, giá trị, hoặc chấm chưa đọc.
- States: default, pressed, disabled, unread (nền accentSubtle, chấm vàng, tiêu đề đậm).
- Props: `title`, `subtitle?`, `leadingIcon?`, `trailing?: 'chevron' | string | ReactNode`, `unread?`, `onPress?`.

### 5.13 StatusBadge

- Cao 26 (sm 22), bo full, icon 16 (sm 14) + nhãn 13 semibold.
- Props: `kind: 'order' | 'leg' | 'sync' | 'incident' | 'severity' | 'horse' | 'report' | 'document' | 'payment' | 'orderHorse'`, `value`, `size?`.
- Màu và icon lấy từ bảng ở 1.5. Không nhận prop màu.
- Mức độ sự cố hiện thêm vạch 1-2-3.

### 5.14 HorseCard

- Ảnh 56 bo 12. Chưa có ảnh thì dùng icon ngựa trên surfaceMuted.
- Tên (headline) + badge sức khỏe. Nút ⋯ 44 mở Báo bất thường và Báo cáo sức khỏe.
- Bản hộ tống: dòng giờ uống, ăn, nghỉ gần nhất. Khi quá ngưỡng có nhãn đậm "4 giờ chưa uống" (nền surfaceBrand, chữ trắng, icon clock).
- Bản khách: giống, tuổi, cân nặng, badge giấy tờ, badge đơn đang chạy.
- States: default, cảnh báo, đang tải (skeleton).

### 5.15 TripCard

- Nhãn ngày + mã chuyến (caption), badge chặng, tuyến (title3), các dòng giờ xuất phát, số ngựa, số điểm dừng.
- Chuyến hôm nay đứng đầu danh sách.

### 5.16 OrderCard

- Mã đơn (mono 13), badge đơn, tuyến + số ngựa (headline).
- Khi khách cần xử lý thì thêm dòng việc cần làm, màu warningFg, icon và chevron. Ví dụ "Bổ sung giấy sức khỏe của Hồng Vân".
- Chạm cả thẻ để mở chi tiết.

### 5.17 QuoteCard

- Trình bày như hóa đơn: các khoản bên trái, số canh phải, tabular-nums.
- Tổng và Đặt cọc in đậm, có đường kẻ trước Tổng.
- Khung trên cùng đổi theo trạng thái:
  - Chờ đặt cọc: có hạn đặt cọc và nút primary "Đặt cọc trên web".
  - Đã đặt cọc: có số Còn lại.
- Mobile không thu tiền. Nút mở web qua sheet giải thích (CUS-04).

### 5.18 Timeline mốc chặng (StopTimeline)

- Đường ray dọc 2. Mỗi dòng cao ≥ 60: tên điểm, dòng phụ, giờ kế hoạch canh phải.
- Đã qua: nút teal đặc có tick, ray teal.
- Hiện tại: nút 24 viền vàng 6, tên 17.
- Sắp tới: nút rỗng, tên màu textSecondary.
- Mốc chưa gửi có badge "Chờ gửi" trong dòng phụ.
- Dùng chung cho tài xế (DRV-02) và khách (CUS-05). Khách thấy thêm báo cáo sức khỏe xen giữa các điểm.

### 5.19 MapView container

- Thẻ cao 180 bo 16, bản đồ `react-native-maps` với kiểu nhạt.
- Tuyến teal 4. Vị trí hiện tại là chấm vàng viền teal, có quầng.
- Nhãn nguồn vị trí ở góc dưới trái. Khách luôn thấy "Vị trí ước tính theo mốc gần nhất".
- Nút toàn màn ở góc trên phải.
- States: có vị trí, đang tải, không có vị trí (giải thích và nói lộ trình vẫn cập nhật).

### 5.20 PhotoPicker / PhotoGrid

- Lưới 3 cột, ô vuông bo 12, tối đa 3 ảnh, JPG/PNG ≤ 5 MB. Nén về cạnh dài 1600 trước khi gửi.
- Ô trống là nét đứt có icon camera. Chạm để chụp; giữ để chọn từ thư viện.
- States từng ảnh:
  - Đang tải: thanh tiến độ.
  - Xong: nút xóa 24.
  - Lỗi: lớp tối, nút "Thử lại".
  - Chờ mạng: nhãn "Chờ gửi".
- Báo cáo sức khỏe bắt buộc ≥ 1 ảnh (G13). Thiếu ảnh khi bấm Gửi thì viền ô đổi đỏ và có dòng lỗi dưới lưới; không khóa nút Gửi.

### 5.21 BottomSheet

- Bo 24 phía trên, nền surfaceElevated, bóng lg, nền phía sau `overlay`.
- Thanh kéo 36×5. Tiêu đề title3 và nút đóng 44.
- Nút chính ở đáy, trên safe area.
- Snap theo nội dung, tối đa 90% chiều cao. Bàn phím mở thì sheet đẩy lên.
- Đóng bằng vuốt xuống hoặc chạm nền tối. Nếu đã nhập dữ liệu thì hỏi lại trước khi đóng.
- Thư viện đề xuất `@gorhom/bottom-sheet`.

### 5.22 Modal / Dialog xác nhận

- Chỉ dùng cho việc không đảo ngược được hoặc làm mất dữ liệu.
- Bo 24, padding 20. Tiêu đề nói hậu quả ("Còn 3 mục chưa gửi"), thân nói vì sao và cách xử lý.
- Nút xếp dọc, nút an toàn ở trên. Hành động phá hủy dùng destructive.
- Không dùng dialog để xác nhận việc đảo ngược được: dùng Toast Hoàn tác.

### 5.23 Toast và thông báo trong app

- **Thông báo xác nhận** (ví dụ "Đã ghi: Uống nước 12 L"): dạng thông báo điện thoại, trượt từ trên xuống ngay dưới thanh trạng thái (Long chốt 30/10).
  - Cách mép 8, bo 22 (Android 16), nền surfaceElevated, viền border, shadow.lg.
  - Ô icon app 38, bo 10, nền surfaceBrand, ngựa màu accent. Dòng đầu "HorseRoute" và "bây giờ" cỡ 13, nội dung cỡ 15.
  - Vào: spring từ trên xuống, khoảng 550 ms, hơi vượt nhẹ (iOS dùng withSpring damping 18, stiffness 220). Ra: trượt lên 320 ms. Giảm chuyển động thì chỉ mờ dần.
  - Tự ẩn sau 3 giây; vuốt lên để ẩn sớm. Không chạy lại hiệu ứng vào khi màn vẽ lại.
- **Toast Hoàn tác** giữ ở đáy, trên tab bar hoặc trên nút chính, vì nút Hoàn tác phải nằm trong vùng ngón cái. Bo 16, nền surfaceBrand, chữ onBrand.
- Toast Hoàn tác giữ 5 giây, có đếm ngược và nút "Hoàn tác" màu vàng (vàng trên teal đậm đạt 6,9:1 ở chế độ sáng, 5,4:1 ở chế độ tối).
- Biến thể lỗi nhẹ: nền dangerBg, chữ dangerFg.
- Mỗi lúc chỉ một toast. Lỗi cần người dùng xử lý thì dùng Banner hoặc lỗi tại chỗ.

### 5.24 Banner

- Thanh ngang ngay dưới header, cao ≥ 44, icon 18 + chữ 15. Có chevron khi chạm được.

| Biến thể | Nền | Ví dụ |
| --- | --- | --- |
| offline | surfaceBrand | Mất sóng · 3 mục chờ gửi |
| sync | surfaceBrandAlt | Đang gửi 3 mục... |
| info | infoBg | Đang chia sẻ vị trí · cập nhật 07:41 |
| warn | warningBg | GPS yếu; chưa cấp quyền vị trí nền |
| danger | dangerBg | 1 mục bị từ chối |

Mất sóng dùng teal, không dùng đỏ, vì đó là tình huống bình thường trên đường và mọi thao tác vẫn được lưu.

### 5.25 SyncIndicator

- Badge nhỏ cao 28 trong header hoặc cạnh từng mục.
- Bốn trạng thái: Đã đồng bộ, n chờ gửi, Đang gửi (icon xoay), n bị từ chối.
- Chạm mở Hàng chờ đồng bộ (COM-12).

### 5.26 EmptyState / ErrorState

- Icon 28 trong ô 64 bo 20. Tiêu đề headline, một câu giải thích 15, tối đa một nút.
- Trống thì nói khi nào sẽ có dữ liệu hoặc cách tạo. Lỗi thì nói nguyên nhân và cách khắc phục, nút "Thử lại" dùng secondary.
- Không minh họa, không câu đùa, không emoji.

### 5.27 Skeleton

- Giữ đúng hình khối nội dung thật. Nền surfaceMuted, ánh sáng chạy 1,4 giây.
- Chỉ hiện sau 300 ms để tránh nháy.
- Tắt chuyển động khi bật Reduce Motion.

### 5.28 TabBar

- Cao 56 + safe area, nền surface, đường kẻ trên, bóng md (chế độ sáng).
- 4 tab, icon 22 + nhãn 11.
- Tab đang chọn: màu tabActive, nhãn đậm, vạch vàng 3 ở trên.
- Số đếm trên nền surfaceBrand, viền surface 2.

| Vai trò | Các tab |
| --- | --- |
| Tài xế | Chuyến, Sự cố, Thông báo, Tài khoản |
| Hộ tống | Ngựa, Nhật ký, Thông báo, Tài khoản |
| Khách hàng | Hành trình, Đơn hàng, Ngựa, Tài khoản |

### 5.29 NavigationHeader

- Tab gốc: tiêu đề lớn 34 bên trái, các nút 44 bên phải. Khi cuộn thu về tiêu đề 17 ở giữa, có đường kẻ dưới.
- Màn con: nút quay lại 44 + tiêu đề 17 ở giữa. Hỗ trợ vuốt cạnh để quay lại.
- Wizard: nút đóng, "Bước 2/4 · Tên bước", nút tertiary Lưu nháp, thanh tiến độ 4.

### 5.30 SOS / IncidentButton

Tài xế:

- Nút "Sự cố" XL 64 luôn ở bên trái nút chính trong thanh đáy, 1 chạm.
- Kiểu: nền surface, viền và chữ dangerFg. Không dùng nền đỏ đặc để không tranh với nút vàng.

Hộ tống:

- "Y tế khẩn" là dòng viền 2 dangerFg với icon siren, nằm trong sheet Báo bất thường.
- Chuyển thẳng sang báo sự cố loại Y tế ngựa.

### 5.31 PermissionPrimer

- Hiện trước hộp xin quyền của hệ điều hành, đúng lúc cần: vị trí nền khi bắt đầu chuyến, camera khi chụp lần đầu, thông báo sau đăng nhập.
- Icon 32 trong vòng tròn 72, tiêu đề title2, 3 lợi ích theo vai trò (ô icon 40).
- Nút primary L "Cho phép ...", nút tertiary "Để sau". Chọn "Để sau" vẫn vào app; quyền được nhắc lại trong Tài khoản và Banner.

## 6. Nguyên tắc dùng

Nên:

- Một nút vàng mỗi màn. Chữ lớn nhất là thông tin người dùng cần nhất.
- Phân tách bằng đường kẻ và khoảng trắng trước, rồi mới tới thẻ, cuối cùng mới tới bóng.
- Trạng thái luôn có icon + chữ.
- Thiếu dữ liệu: để nút bấm được và báo lỗi tại chỗ.
- Mất sóng: dùng teal, mọi thao tác vẫn lưu được.
- Tài xế, hộ tống: vùng chạm ≥ 56, nút chính 64, chip L 56.

Không:

- Dùng #f4b942 làm chữ, hoặc dùng vàng cho cảnh báo.
- Gradient, trừ thẻ chuyến đang chạy của khách. Tím, xanh dương, glow, glassmorphism.
- Emoji, icon sparkle hay robot, minh họa 3D.
- Màu ngoài token. Màu tím "nghỉ" trong `escort.css` của web thay bằng teal nhạt + icon circle-pause.

## 7. Quyết định của Long (29/10/2026)

Long chốt theo đề xuất:

1. Warning dùng cam đất (#a24a05 chữ, #b45309 khối đặc) thay #ca8a04. Web nên đổi theo khi có dịp.
2. Info dùng teal, không thêm xanh dương; badge phân biệt bằng icon.
3. Thang teal giữ nguyên như sinh ra (bậc 200–400 hơi xám), vì các bậc này chỉ dùng cho nền và viền.
4. Dark mode: thẻ brand dùng teal 800 #104d56.
5. Danger giữ hai sắc: chữ #b42318, khối đặc #dc2626.
