# Kế hoạch xây dựng frontend mới tại `apps/FE`

Ngày lập: 18/10/2026. Trạng thái: **kế hoạch, chưa triển khai frontend mới**.

## 1. Mục tiêu và giới hạn

Xây frontend độc lập tại `/home/minhcup/Documents/WDP/HorseRoute/apps/FE`, dựa trên cách chia module của `mock-project-ojt`, bảo toàn hành vi nghiệp vụ đang có của HorseRoute.

### Quy tắc bắt buộc

- Giữ nguyên toàn bộ `apps/web`, đặc biệt `apps/web/src`: không di chuyển, đổi tên, xóa, format hoặc sửa import của source cũ.
- `apps/FE` là thư mục cùng cấp với `apps/web`, viết hoa đúng `FE`. Tên package dự kiến là `@horseroute/fe` để tránh trùng package `web`.
- Chỉ đọc source cũ làm tham chiếu; nếu sao chép logic thì tạo file mới trong `apps/FE` và tổ chức lại tại đó.
- Không import trực tiếp từ `apps/web/src`, không tạo symlink tới frontend cũ.
- Tiếp tục sử dụng `apps/api` và `packages/shared`; không sao chép backend vào frontend mới.
- Không thay đổi API contract, cơ chế xác thực hoặc quy tắc nghiệp vụ chỉ để thuận tiện cho frontend mới.
- Mục tiêu đầu tiên là tương đương chức năng frontend cũ. Những chức năng chưa có UI như lập kế hoạch chuyến đi không tự động thuộc phạm vi tái cấu trúc.
- Không chuyển deployment đang dùng sang frontend mới trong các phần xây dựng. Chuyển đổi môi trường sử dụng là mốc riêng cuối kế hoạch.
- Không gỡ dependency khỏi package `web`. Dependency mới được khai báo riêng cho `apps/FE`.

### Các file ngoài `apps/FE` có thể cần cập nhật khi triển khai

| Vị trí | Thay đổi dự kiến | Điều kiện |
|---|---|---|
| `package.json` gốc | Thêm `dev:fe`, `build:fe`, `check:fe` | Giữ nguyên lệnh phục vụ web cũ |
| `pnpm-lock.yaml` | Thêm importer/dependency của package mới | Rà soát diff, tránh nâng cấp package cũ ngoài ý muốn |
| `pnpm-workspace.yaml` | Thường không cần sửa | Glob `apps/*` hiện đã bao phủ `apps/FE` |
| `.github/workflows/` | Bổ sung job kiểm tra FE | Giữ kiểm tra API và web hiện hữu |
| `docker/` | Thêm Dockerfile/config riêng nếu cần | Không thay thế `docker/web.Dockerfile` |
| File compose bổ sung | Chạy thử FE mới độc lập | Không đổi service web đang dùng |
| `docs/` | Checklist, kết quả kiểm tra, hướng dẫn chạy | Không chứa thông tin bí mật |

Lưu ý: lệnh build/lint đệ quy ở root sẽ nhìn thấy package mới ngay khi package được thêm vào workspace. Cần kiểm tra ảnh hưởng này từ Phần 1.

## 2. Cách quản lý tiến độ

Mỗi phần là một đơn vị review độc lập, có đầu vào, checklist, đầu ra và điều kiện nghiệm thu. Có thể chia thành nhiều commit nhỏ; không đánh dấu xong chỉ vì đã tạo đủ thư mục.

Trạng thái sử dụng: `Chưa làm` → `Đang làm` → `Chờ kiểm tra` → `Hoàn tất`; dùng `Bị chặn` kèm lý do cụ thể khi cần.

| Mã | Phần công việc | Phụ thuộc | Trạng thái |
|---|---|---|---|
| P00 | Chụp hiện trạng và lập bảng đối chiếu | — | Chưa làm |
| P01 | Khởi tạo workspace FE độc lập | P00 | Chưa làm |
| P02 | Hạ tầng API, state, UI và kiểm thử | P01 | Chưa làm |
| P03 | Xác thực và khôi phục phiên | P02 | Chưa làm |
| P04 | Router, phân quyền và dashboard layout | P03 | Chưa làm |
| P05 | Landing, tổng quan, tài khoản | P04 | Chưa làm |
| P06 | Thông báo | P04 | Chưa làm |
| P07 | Đơn hàng: danh sách và chi tiết | P04 | Chưa làm |
| P08 | Đơn hàng: tạo, sửa, lưu nháp, gửi duyệt | P07 | Chưa làm |
| P09 | Đơn hàng: xét duyệt | P08, P06 | Chưa làm |
| P10 | Hồ sơ: danh sách, checklist, upload/download | P07 | Chưa làm |
| P11 | Hồ sơ: thẩm định và kết quả cơ quan | P10, P06 | Chưa làm |
| P12 | Kiểm tra tương đương và ổn định toàn ứng dụng | P05–P11 | Chưa làm |
| P13 | Build/deploy riêng, bàn giao và kế hoạch chuyển đổi | P12 | Chưa làm |

Sau mỗi phần, điền bản ghi:

```markdown
### Pxx — Tên phần
- Trạng thái:
- Người thực hiện / ngày:
- Commit hoặc danh sách file:
- Checklist đã hoàn thành:
- Lệnh kiểm tra và kết quả:
- Kiểm tra thủ công / ảnh minh chứng:
- Khác biệt với frontend cũ:
- Vấn đề còn lại:
- Kết luận nghiệm thu:
```

## 3. Kiến trúc đích

```text
apps/
├── api/                         # Backend hiện có
├── web/                         # Frontend cũ, giữ nguyên
└── FE/                          # Frontend mới
    ├── package.json
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    ├── eslint.config.js
    ├── .env.example
    ├── README.md
    ├── public/
    ├── test/
    │   ├── fixtures/
    │   ├── integration/
    │   └── e2e/
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── app/providers/
        │   ├── AppProviders.tsx
        │   └── AuthProvider.tsx
        ├── routes/
        │   ├── AppRouter.tsx
        │   ├── router.const.ts
        │   ├── public.routes.tsx
        │   ├── workspace.routes.tsx
        │   └── guards/
        │       ├── AuthGuard.tsx
        │       └── RoleGuard.tsx
        ├── layouts/DashboardLayout/
        │   ├── DashboardLayout.tsx
        │   ├── DashboardLayout.module.css
        │   ├── components/
        │   └── hooks/
        ├── apis/axios.config.ts
        ├── config/
        │   ├── env.config.ts
        │   ├── query-client.config.ts
        │   ├── permissions.config.ts
        │   └── navigation.config.ts
        ├── components/
        │   ├── ui/
        │   └── workflow/
        ├── hooks/use-unsaved-changes.ts
        ├── modules/
        │   ├── landing/
        │   ├── auth/
        │   ├── dashboard/
        │   ├── account/
        │   ├── notifications/
        │   ├── orders/
        │   └── documents/
        ├── types/api.types.ts
        ├── utils/
        │   ├── api-error.utils.ts
        │   ├── date.utils.ts
        │   └── file.utils.ts
        └── styles/
            ├── index.css
            ├── tokens.css
            └── global.css
```

Module được tạo theo nhu cầu thực tế:

```text
modules/<nghiep-vu>/
├── api/          # Request/response và endpoint
├── pages/        # Ghép giao diện, đọc route params
├── components/   # UI riêng của nghiệp vụ; CSS Modules đặt cạnh component
├── hooks/        # Query, mutation, điều phối state/form
├── schemas/      # Validation
├── types/        # Kiểu dữ liệu riêng frontend
├── constants/    # Query keys, nhãn, giá trị cố định
├── utils/        # Hàm thuần chuyển đổi dữ liệu
└── index.ts      # Chỉ export API công khai của module khi cần
```

### Quy tắc kiến trúc

1. Page gọi hook và ghép component; component trình bày không gọi Axios trực tiếp.
2. API layer dùng Axios chung, giữ nguyên shape response thực tế; không tự giả định backend luôn trả `{ data: ... }`.
3. Dữ liệu backend dùng React Query; form dùng React Hook Form/Zod; state UI dùng React state; auth giữ Context.
4. Query key chứa đủ ID, bộ lọc, phân trang và scope dữ liệu cần thiết. Hủy/clear dữ liệu đang chờ khi chuyển phiên để tránh dữ liệu tài khoản cũ quay lại cache.
5. Không thêm Zustand nếu chưa có nhu cầu cụ thể. Không thêm đủ ba lớp API/service/usecase cho một request đơn giản.
6. Nghiệp vụ nhiều bước có thể thêm usecase nếu cần; frontend không giả định nhiều request là một transaction.
7. Layout không chứa logic tạo/duyệt đơn hoặc thẩm định hồ sơ.
8. Module không import sâu vào nội bộ module khác; chia sẻ qua API công khai hoặc phần dùng chung có trách nhiệm rõ ràng.
9. Kiểu dùng chung FE/BE tiếp tục lấy từ `@my-project/shared`; không sửa shared ngoài phạm vi khi chưa cần.
10. Dùng alias `@/` cho `apps/FE/src`. Đồng bộ alias giữa TypeScript, Vite và công cụ test.
11. Tên component PascalCase; hook `use-*.ts`; API `*.api.ts`; schema `*.schema.ts`; type `*.types.ts`; thống nhất `components`, `services` nếu có.
12. Tạo cấu trúc theo nghiệp vụ, không nhân bản orders/documents cho từng role.

## 4. Các phần triển khai chi tiết

### P00 — Ghi nhận hiện trạng trước khi làm

**Mục tiêu:** có mốc so sánh cụ thể và bảo vệ source cũ, bao gồm thay đổi chưa commit.

- [ ] Ghi nhận `git status`, commit hiện tại và diff đang tồn tại; không reset hoặc ghi đè thay đổi của người dùng.
- [ ] Lập manifest đường dẫn và checksum cho toàn bộ file trong `apps/web`, loại trừ thư mục sinh tự động như `node_modules`, `dist`.
- [ ] Ghi rõ manifest lấy từ working tree, không chỉ từ HEAD vì source hiện có thay đổi chưa commit.
- [ ] Đọc lại các file nghiệp vụ đang được chỉnh sửa trước khi lấy làm tham chiếu.
- [ ] Liệt kê màn hình, thao tác, endpoint, payload, response, role, trạng thái đơn/hồ sơ và thông báo lỗi quan trọng.
- [ ] Đối chiếu với backend hiện tại và tài liệu `docs/flow1.md`, `docs/flow2.md`, `docs/implementation-status.md`.
- [ ] Lập bảng quyền thực tế cho sáu role; ghi rõ phần chưa xác minh thay vì suy đoán.
- [ ] Chụp hoặc ghi nhận giao diện desktop/mobile và các trạng thái loading, empty, error.
- [ ] Tách chức năng đã hoạt động khỏi placeholder. Backend Flow 3 phát triển thêm không đồng nghĩa FE mới phải triển khai Flow 3 trong kế hoạch này.

**Đầu ra:** `docs/fe-migration/baseline.md`, bảng đối chiếu chức năng, manifest source cũ và ma trận quyền.

**Nghiệm thu:** mỗi luồng hiện có có checklist kiểm tra; xác định được phạm vi tương đương và phần chưa triển khai.

### P01 — Tạo ứng dụng FE độc lập

**Mục tiêu:** chạy frontend mới song song với web cũ.

- [ ] Tạo `apps/FE/package.json`, `index.html`, Vite config, TS config, `src/main.tsx`, `src/App.tsx`.
- [ ] Dùng React 18, TypeScript, Vite, React Router 6, Axios, React Query, React Hook Form và Zod tương thích stack hiện hữu; tránh gộp nâng major version vào việc tổ chức lại.
- [ ] Khai báo package name `@horseroute/fe` và dependency `@my-project/shared: workspace:*`.
- [ ] Cấu hình TypeScript strict và alias `@/`.
- [ ] Chọn port dev riêng, dự kiến `5174`, bật strict port để tránh nhầm ứng dụng; web cũ giữ `5173`.
- [ ] Thêm `.env.example` chỉ chứa cấu hình mẫu; dùng `VITE_API_URL` trong frontend mới.
- [ ] Xác định API origin thực tế, CORS hoặc Vite proxy; không sửa backend chỉ vì chưa cấu hình đúng frontend.
- [ ] Thêm scripts `dev`, `build`, `typecheck`, `lint`, `format:check`, `preview`.
- [ ] Thêm ESLint và formatter có phạm vi trong FE; không chạy formatter toàn repo.
- [ ] Bổ sung scripts gốc để tiện chạy FE, giữ nguyên `dev:web`.
- [ ] Rà soát lockfile và tác động của build/lint đệ quy.

**Kiểm tra:** build shared trước FE; FE khởi động ở port riêng; build tạo `apps/FE/dist`; web cũ vẫn khởi động được; manifest source cũ không đổi.

**Nghiệm thu:** hai frontend chạy độc lập, chưa có import chéo và chưa thay deployment.

### P02 — Xây hạ tầng dùng chung

- [ ] Tạo `env.config.ts`, báo lỗi cấu hình dễ hiểu khi thiếu API URL.
- [ ] Tạo Axios instance, gắn JWT theo contract hiện tại, phân biệt lỗi mạng, 401, 403 và lỗi validation.
- [ ] Thiết kế xử lý 401 không tạo vòng lặp điều hướng; lỗi login/register phải hiển thị tại form.
- [ ] Tạo QueryClient và AppProviders; thiết lập retry phù hợp, không tự retry mutation ghi dữ liệu nếu chưa có cơ chế an toàn.
- [ ] Tạo helper lỗi API có kiểu rõ ràng; không nuốt thông báo lỗi server.
- [ ] Tạo tokens/global CSS và các UI primitive thực sự cần: Button, FormField, LoadingState, EmptyState, Pagination.
- [ ] Tách WorkflowIntro, FlowSection thành component chung của FE.
- [ ] Thiết lập test runner phù hợp cho hooks/form và browser test cho luồng chính; khai báo dependency test trong FE.
- [ ] Tạo fixtures tối thiểu, không dùng thông tin người dùng thật.
- [ ] Chạy được một kiểm tra smoke cho ứng dụng mới và kiểm tra cơ chế mock API.

**Đầu ra:** hạ tầng sẵn dùng cho các module, scripts test chạy độc lập; không cần tạo sẵn component chưa dùng.

**Nghiệm thu:** request tới đúng backend, render state lỗi rõ ràng, CSS không phụ thuộc `apps/web`.

### P03 — Auth: đăng nhập, đăng ký, phiên làm việc

- [ ] Tạo `auth/api/auth.api.ts` cho login/register; đặt `getMe` ở API tài khoản và dùng chung cho khôi phục phiên.
- [ ] Tạo LoginPage và RegisterPage riêng; tách LoginForm/RegisterForm, schema và hooks.
- [ ] Giữ đủ thông tin đăng ký: email, mật khẩu, họ tên, số điện thoại, địa chỉ.
- [ ] Giữ quy tắc validation hiện có, kể cả giới hạn mật khẩu theo byte nếu backend áp dụng.
- [ ] Tạo AuthProvider và `useAuth`, xử lý pending khi khôi phục tài khoản.
- [ ] Giữ cơ chế JWT/localStorage hiện tại; chọn key và ghi rõ trong tài liệu. Không chuyển sang cookie vì dự án mẫu dùng cookie.
- [ ] Xóa/hủy cache và request thuộc phiên cũ khi login/logout; không để response cũ khôi phục account đã đăng xuất.
- [ ] Xử lý server validation trên từng field và lỗi tổng quát.
- [ ] Ghi nhận khác biệt localStorage giữa hai port: hai frontend có origin riêng nên không mặc định chia sẻ phiên.

**Kiểm tra:** đăng nhập đúng/sai, đăng ký thiếu field, reload có token, token hết hạn, mất mạng khi getMe, logout và đăng nhập bằng tài khoản khác.

**Nghiệm thu:** auth hoạt động tương đương baseline; không lộ dữ liệu tài khoản trước; nếu điều chỉnh hành vi lỗi mạng thì ghi rõ như một thay đổi hành vi riêng.

### P04 — Router, guard và layout

- [ ] Dùng React Router data router (`createBrowserRouter` + `RouterProvider`) trong FE mới nếu dùng blocker cho điều hướng nội bộ; không bọc thêm BrowserRouter.
- [ ] Chốt API blocker tương thích phiên bản Router 6 đã chọn trước khi viết hook cảnh báo mất dữ liệu.
- [ ] Tạo AuthGuard, RoleGuard, trang 404 và trạng thái không có quyền.
- [ ] Tạo DashboardLayout với Sidebar, Header, Footer, AccountMenu và Outlet.
- [ ] Tách navigation config khỏi nội dung hướng dẫn/tổng quan theo role.
- [ ] Tạo đường dẫn và hàm tạo URL có params ở `router.const.ts`.
- [ ] Tạo nested routes ngay từ đầu; gắn placeholder trong FE cho module chưa xây xong.
- [ ] Lazy-load page ở cấp route.
- [ ] Dựng menu mobile, focus bàn phím và skip link.
- [ ] Dùng cùng cấu hình quyền cho menu và route; quyền action vẫn được backend xác nhận.
- [ ] Viết hook unsaved changes hỗ trợ điều hướng SPA, back/forward và `beforeunload`. Chỉ bật khi có thay đổi thực sự.
- [ ] Thêm bộ chuyển tiếp URL legacy trong FE mới, không sửa router của web cũ.

**Nghiệm thu:** sáu role có menu đúng; gõ URL trực tiếp vẫn bị guard kiểm tra; reload deep link hoạt động; layout không gọi API nghiệp vụ orders/documents.

### P05 — Landing, dashboard và tài khoản

- [ ] Tạo module landing, tách các section có ý nghĩa; giữ nội dung và tài nguyên hiển thị hiện tại.
- [ ] Tạo DashboardOverviewPage và component hướng dẫn/công việc theo role.
- [ ] Tạo AccountPage hiển thị tài khoản; không tự thêm chỉnh sửa profile nếu baseline chưa có.
- [ ] Các mục chưa có nghiệp vụ hiển thị trạng thái chưa kết nối rõ ràng, không hiển thị dữ liệu giả như dữ liệu thật.
- [ ] Chuyển style cần thiết sang FE, tách CSS Modules và tokens.

**Kiểm tra:** desktop/mobile, link login/register/dashboard, nội dung theo role, tài khoản có/không có phone/address.

**Nghiệm thu:** đủ màn cơ bản; không còn các dashboard theo role chỉ bọc lại cùng một layout.

### P06 — Module thông báo

- [ ] Tách `notifications.api.ts`, type, query keys, query/mutation hooks.
- [ ] Tạo NotificationsPage, NotificationList, NotificationItem và bộ lọc chưa đọc.
- [ ] Hỗ trợ loading, empty, error, làm mới và đánh dấu đã đọc.
- [ ] Sau mutation cập nhật/invalidate cache liên quan; tránh bấm ghi trùng khi đang xử lý.
- [ ] Thiết lập cách refresh thông báo sau nghiệp vụ khác thông qua query invalidation, không truyền callback xuyên layout.

**Kiểm tra:** danh sách rỗng, lỗi mạng, đánh dấu thất bại/thành công, lọc chưa đọc, đổi account.

**Nghiệm thu:** thông báo vận hành độc lập, layout không sở hữu danh sách và state thao tác thông báo.

### P07 — Đơn hàng: đọc dữ liệu

- [ ] Tách type response, type form, status labels và query keys.
- [ ] Tạo API danh sách, chi tiết và review options dựa trên contract thực tế.
- [ ] Tạo useOrdersQuery/useOrderDetailQuery với đủ ID và pagination/filter trong query key.
- [ ] Tạo OrderListPage, OrderDetailPage, OrderList, OrderSummary, HorseSummary, OrderHistory, OrderStatusBadge.
- [ ] Giữ các hành vi lọc/phân trang đang có; không tự thêm yêu cầu tìm kiếm backend.
- [ ] Xử lý ID không tồn tại, 403, lỗi tải chi tiết và chuyển nhanh giữa hai đơn.
- [ ] Type-only file không chứa default factory hoặc mapper; chuyển chúng sang utils/constants phù hợp.

**Nghiệm thu:** dữ liệu, nhãn trạng thái, lịch sử và scope theo tài khoản tương đương baseline; không hiển thị chi tiết đơn trước khi đổi ID.

### P08 — Đơn hàng: tạo, chỉnh sửa và gửi duyệt

- [ ] Tạo OrderCreatePage, OrderForm, HorseForm và hook quản lý form.
- [ ] Tạo schema lưu nháp và schema gửi duyệt hoặc cơ chế validation theo action; không bắt buộc hoàn chỉnh khi lưu nháp.
- [ ] Chuyển mapper `draftFrom`, `emptyDraft`, `emptyHorse` sang utils/constants riêng.
- [ ] Giữ ID ngựa khi sửa; kiểm tra thêm/xóa nhiều ngựa và field lỗi theo index.
- [ ] Tạo mutation create/update/submit, giữ request ID chống tạo trùng nếu contract hiện hành dùng nó.
- [ ] Với chuỗi lưu → gửi duyệt, xử lý trường hợp lưu thành công nhưng submit thất bại: giữ ID đã tạo, không tạo thêm đơn khi thử lại.
- [ ] Giữ dữ liệu form khi mất mạng hoặc server từ chối; reset dirty state chỉ sau khi lưu thành công tương ứng.
- [ ] Gắn unsaved-changes cho link, menu, logout, back/forward và đóng/reload tab.
- [ ] Invalidate danh sách/chi tiết sau thao tác; không refetch rồi ghi đè form đang sửa.

**Kiểm tra:** nháp rỗng, dữ liệu gửi duyệt thiếu, lỗi field từ server, nhiều ngựa, double-click, mất mạng, lưu thành công/submit thất bại, rời form và quay lại.

**Nghiệm thu:** không mất input khi lỗi; không tạo đơn trùng do retry thông thường; customer chỉ sửa trạng thái được phép.

### P09 — Đơn hàng: Manager xét duyệt

- [ ] Tách OrderReviewForm và hook review mutation.
- [ ] Tải lựa chọn coordinator/rules đúng đơn; giữ payload đúng contract.
- [ ] Giữ các quyết định duyệt, yêu cầu bổ sung, từ chối và yêu cầu lý do tương ứng.
- [ ] Khóa nút khi đang submit; xử lý đơn đã đổi trạng thái từ phiên khác.
- [ ] Invalidate danh sách, chi tiết, thông báo và dữ liệu liên quan khi duyệt thành công.
- [ ] Không giả lập thành công sinh checklist/dossier/trip ở client; kiểm tra kết quả backend trong môi trường test.

**Nghiệm thu:** customer và manager thực hiện được chuỗi tạo → gửi → bổ sung hoặc duyệt/từ chối; thao tác sai role bị backend chặn.

### P10 — Hồ sơ: đọc dữ liệu, upload và download

- [ ] Tách documents API/types/query keys và constants.
- [ ] Tạo DocumentOrdersPage, DocumentOrderDetailPage, DocumentOrderList và DocumentChecklist.
- [ ] Tách DocumentCard, DocumentUploadForm, DocumentVersionHistory, DocumentAuditHistory.
- [ ] Đổi type ngắn thành tên rõ nghĩa: HorseDocument, DocumentVersion, AuthorityDossier, DocumentOrderDetail.
- [ ] Upload bằng FormData; không dùng JSON interceptor làm hỏng multipart boundary.
- [ ] Kiểm tra định dạng PDF/JPG/PNG và giới hạn 5 MB theo contract xác minh; vẫn hiển thị lỗi validation backend.
- [ ] Download bằng blob, bảo toàn tên file phù hợp, giải phóng object URL.
- [ ] Invalidate detail sau upload; lịch sử phiên bản cũ vẫn hiển thị.
- [ ] Giữ ràng buộc thay thế file khi hồ sơ đang bị khóa; lỗi thao tác phải rõ ràng.

**Kiểm tra:** file hợp lệ, quá dung lượng, sai định dạng, lỗi upload, tải file không có quyền, danh sách chưa có checklist.

**Nghiệm thu:** customer nộp được giấy tờ, xem lịch sử và tải bản được phép; manager/specialist có đúng quyền baseline.

### P11 — Hồ sơ: thẩm định và cơ quan

- [ ] Tạo DocumentReviewForm cho hợp lệ/không hợp lệ/yêu cầu bổ sung.
- [ ] Gửi đúng version ID; xử lý trường hợp version đã thay đổi ở phiên khác.
- [ ] Tạo DossierCard và DossierStatusForm; tách bảng nhãn và chuyển trạng thái.
- [ ] Giữ điều kiện về lý do, ngày, mã biên nhận và giấy phép đính kèm theo từng action.
- [ ] Phân biệt ngày chỉ có lịch với timestamp; giữ quy ước UTC đang áp dụng, tránh lệch ngày do chuyển timezone.
- [ ] Hiển thị audit history và kết quả thẩm định sau mutation.
- [ ] Cập nhật cache hồ sơ, danh sách liên quan và thông báo.
- [ ] Gắn cảnh báo thay đổi chưa lưu cho form đang nhập lý do/ngày/chọn file nếu rời trang làm mất dữ liệu.
- [ ] Giữ thông điệp nghiệp vụ: frontend không tự kết luận đủ điều kiện kiểm dịch thay cơ quan.

**Kiểm tra:** thẩm định thiếu lý do, giấy tờ có expiry, version cũ, yêu cầu bổ sung, nộp cơ quan, cần bổ sung/từ chối/nộp lại, approved thiếu giấy phép, role không được thao tác.

**Nghiệm thu:** chuỗi Flow 2 chạy được với dữ liệu test và khớp backend, không bỏ qua điều kiện chuyển trạng thái.

### P12 — Kiểm tra tương đương và hoàn thiện

- [ ] Chạy toàn bộ checklist baseline, ghi đạt/chưa đạt cho từng role và từng luồng.
- [ ] Adapt browser test cũ sang FE mới bằng bản sao/viết test mới trong `apps/FE/test`; giữ file test cũ nguyên vẹn.
- [ ] Tách rõ test mock API và test tích hợp backend. Test mock không chứng minh toàn bộ hệ thống hoạt động.
- [ ] Chạy smoke tích hợp bằng tài khoản/dữ liệu test trên môi trường phù hợp, không dùng dữ liệu production.
- [ ] Kiểm tra loading, empty, error, 401/403/404, mạng chậm và đổi account.
- [ ] Kiểm tra URL sâu, reload, back/forward, legacy query và cảnh báo dirty form.
- [ ] Kiểm tra layout desktop/mobile, keyboard, focus, label và thông báo lỗi có thể đọc được.
- [ ] Rà soát dependency thừa trong FE; không chỉnh package web cũ.
- [ ] Rà soát import xuyên module, gọi API trong component trình bày, kiểu `any` và CSS global quá rộng.
- [ ] Chạy typecheck/lint/build và các test có ý nghĩa; không tạo test chỉ để kiểm tra tên folder.
- [ ] So sánh manifest của web cũ với P00. Nếu có thay đổi do công việc khác, ghi nhận nguồn thay đổi và thống nhất lại baseline, không tự rollback.

**Nghiệm thu:** mọi khác biệt hành vi đều có ghi nhận; không còn lỗi chặn luồng chính; không tuyên bố hoàn tất nếu chỉ build thành công.

### P13 — Đóng gói riêng và bàn giao

- [ ] Tạo Dockerfile FE mới: build shared trước FE, serve static bằng Nginx.
- [ ] Cấu hình SPA fallback để reload nested route không 404.
- [ ] Cấu hình API URL/proxy và ghi rõ `VITE_*` được nhúng lúc build, đổi biến môi trường container sau build không tự đổi bundle.
- [ ] Thêm compose override/profile hoặc file compose riêng để chạy FE ở port riêng, giữ service web cũ.
- [ ] Thêm CI cho FE: typecheck, lint, test, build; không bỏ job hiện hữu.
- [ ] Viết `apps/FE/README.md`: yêu cầu môi trường, chạy dev, build, test, biến môi trường, cấu trúc, quyền và giới hạn còn lại.
- [ ] Hoàn thiện báo cáo nghiệm thu và hướng dẫn chạy hai frontend song song.
- [ ] Chuẩn bị phương án chuyển traffic sang FE mới ở môi trường đích khi đã quyết định sử dụng.
- [ ] Chuẩn bị rollback bằng cấu hình/image web cũ; frontend mới vẫn phải giữ API tương thích để rollback không phụ thuộc migration dữ liệu.

**Nghiệm thu xây dựng:** FE mới có thể chạy/deploy riêng và web cũ còn nguyên.

**Mốc chuyển đổi riêng:** chỉ chuyển endpoint/domain/service mặc định khi đã chốt thời điểm sử dụng; không xóa frontend cũ sau chuyển đổi trong phạm vi kế hoạch này.

## 5. Bảng đối chiếu source cũ và đích mới

Đây là bảng tham chiếu để viết bản mới, không phải danh sách file cần di chuyển.

| Source cũ dưới `apps/web/src` | Đích dưới `apps/FE/src` |
|---|---|
| `main.tsx` và providers | `main.tsx`, `app/providers` |
| `app/router/*` | `routes/*`, `routes/guards/*` |
| `lib/axios.ts` | `apis/axios.config.ts` |
| `lib/queryClient.ts` | `config/query-client.config.ts` |
| `features/auth/pages/LoginPage.tsx` | `modules/auth/pages`, `components`, `hooks`, `schemas` |
| `features/users/api/users.api.ts` | `modules/auth/api`, `modules/account/api` |
| `features/auth/pages/components/DashboardLayout.tsx` | `layouts/DashboardLayout` và modules dashboard/account/notifications |
| `features/auth/pages/components/AccountMenu.tsx` | `layouts/DashboardLayout/components/AccountMenu.tsx` |
| `features/home/HomePage.tsx`, dashboard wrappers | `modules/dashboard/pages/DashboardOverviewPage.tsx` |
| `features/home/role-workspaces.ts` | `config/navigation.config.ts`, `permissions.config.ts`, `modules/dashboard/config` |
| `features/home/LandingPage.tsx` | `modules/landing/pages`, `components` |
| `features/orders/OrdersWorkspace.tsx` | `modules/orders/*` |
| `features/orders/types.ts` | `modules/orders/types`, `constants`, `utils` |
| `features/documents/DocumentsWorkspace.tsx` | `modules/documents/*` |
| `features/workflow/*` | `components/workflow/*` |
| CSS global/workspace | `styles/*` và CSS Modules cạnh component |

## 6. Route và tương thích URL

| URL mới | Nội dung | Quyền dự kiến cần đối chiếu P00 |
|---|---|---|
| `/` | Landing | Công khai |
| `/login`, `/register` | Auth | Công khai, xử lý tài khoản đã đăng nhập |
| `/dashboard` | Tổng quan | Đã đăng nhập |
| `/dashboard/orders` | Danh sách đơn | CUSTOMER, MANAGER |
| `/dashboard/orders/new` | Tạo đơn | CUSTOMER |
| `/dashboard/orders/:orderId` | Chi tiết/sửa/xét duyệt | CUSTOMER, MANAGER; action tùy trạng thái |
| `/dashboard/documents` | Danh sách hồ sơ | CUSTOMER, SPECIALIST, MANAGER |
| `/dashboard/documents/:orderId` | Hồ sơ một đơn | CUSTOMER, SPECIALIST, MANAGER; action theo role |
| `/dashboard/notifications` | Thông báo | Đã đăng nhập |
| `/dashboard/account` | Tài khoản | Đã đăng nhập |

Không mặc định ADMIN có quyền thao tác tất cả nghiệp vụ; bám quyền backend/baseline.

Chuyển tiếp legacy trên frontend mới:

- `?view=overview` → `/dashboard`.
- `?view=orders` → `/dashboard/orders`.
- `?view=documents` → `/dashboard/documents`.
- `?view=submissions` → trang hồ sơ với tab cơ quan được chọn bằng query hợp lệ; không làm mất ý nghĩa của menu Specialist.
- `?view=notifications` và `?view=account` → route tương ứng.
- Các view placeholder → trang placeholder hoặc thông báo rõ ràng theo role, không tự chuyển thành chức năng đã hoàn tất.
- Giá trị không hợp lệ → fallback tổng quan; dùng replace khi chuyển tiếp để không tạo vòng lặp history.

Chuyển tiếp chỉ hoạt động khi truy cập origin của FE mới hoặc sau cutover cùng domain; không tự đổi bookmark đang trỏ tới origin web cũ.

## 7. Ma trận nghiệm thu tối thiểu

| Nhóm | Kịch bản bắt buộc | Loại kiểm tra |
|---|---|---|
| Bảo toàn | Source cũ không đổi, không import từ web | Manifest + review diff |
| Auth | Login/register, restore, expiry, logout, đổi account | Integration/browser + smoke backend |
| Quyền | Menu, URL trực tiếp, action trái quyền | Browser + backend |
| Orders đọc | Phân trang, chi tiết, lịch sử, 404/403 | Integration/browser |
| Orders ghi | Nháp, sửa, gửi, retry sau lỗi một phần, bổ sung | Browser + smoke backend |
| Review | Duyệt/từ chối/bổ sung, rules/coordinator | Browser + smoke backend |
| Files | Upload, phiên bản, file lớn, download trái quyền | Browser + smoke storage/backend |
| Hồ sơ | Thẩm định, hạn giấy tờ, trạng thái cơ quan | Browser + smoke backend |
| Thông báo | Refresh, chưa đọc, đánh dấu, đổi account | Integration/browser |
| Điều hướng | Deep link, reload, legacy URL, dirty form | Browser |
| UI | Desktop/mobile, focus, label, trạng thái lỗi | Thủ công + browser |
| Đóng gói | Build shared → FE, Nginx fallback, API config | Build + smoke container |

Lệnh dự kiến sau khi scripts được tạo ở P01/P02:

```bash
pnpm --filter @my-project/shared build
pnpm --filter @horseroute/fe dev
pnpm --filter @horseroute/fe typecheck
pnpm --filter @horseroute/fe lint
pnpm --filter @horseroute/fe format:check
pnpm --filter @horseroute/fe test
pnpm --filter @horseroute/fe test:e2e
pnpm --filter @horseroute/fe build
```

Các lệnh trên là giao diện scripts cần triển khai, chưa phải lệnh hiện đã tồn tại. Test browser cần hướng dẫn cài browser/runtime riêng, không phụ thuộc đường dẫn Playwright hoặc Edge trên một máy cá nhân.

## 8. Rủi ro cụ thể và cách kiểm soát

| Rủi ro | Cách xử lý |
|---|---|
| Source/API thay đổi trong thời gian làm FE | Ghi baseline working tree; đối chiếu lại contract trước mỗi module |
| Source cũ có sửa đổi chưa commit | Bảo toàn trạng thái thực tế, không lấy HEAD thay cho bản đang làm |
| Root build/lint tự bao gồm FE | Kiểm tra scripts ngay P01, bảo đảm package mới không làm hỏng quy trình cũ |
| Cache lẫn giữa tài khoản | Cancel/clear khi đổi phiên; test response đến muộn |
| Form bị refetch ghi đè | Tách server-state và form-state; kiểm soát lúc reset form |
| Lưu đơn thành công nhưng submit lỗi | Giữ ID, báo trạng thái từng bước và retry trên đơn đã có |
| Validation mới chặn lưu nháp | Tách validation theo action, đối chiếu backend |
| Dirty-form blocker không tương thích Router | Chọn data router và API blocker đúng version từ P04 |
| Upload/download hỏng do wrapper JSON | Kiểm tra FormData/blob riêng và lỗi trả về từ backend |
| Ngày expiry bị lệch | Phân biệt date-only và timestamp; kiểm tra ở timezone người dùng |
| Chỉ mock thành công nhưng backend lỗi | Nghiệm thu thêm smoke trên backend và storage test |
| Việc tái cấu trúc biến thành phát triển Flow 3/4 | Tách backlog mở rộng, không tính vào hoàn thành tương đương |

## 9. Điều kiện hoàn thành toàn kế hoạch

- [ ] `apps/FE` là package độc lập, không phụ thuộc source frontend cũ.
- [ ] `apps/web` được bảo toàn theo baseline và những thay đổi ngoài nhiệm vụ được ghi nhận riêng.
- [ ] Các chức năng đang có được đối chiếu và nghiệm thu theo role.
- [ ] Những khu vực chưa triển khai vẫn được thể hiện trung thực, không tuyên bố hoàn thành toàn MVP.
- [ ] Auth, cache, form, route, upload/download và quyền truy cập có kiểm tra phù hợp.
- [ ] Typecheck, lint, test và build FE đều đạt; quy trình hiện hữu không bị ảnh hưởng ngoài thay đổi đã ghi nhận.
- [ ] Có hướng dẫn chạy song song, deployment riêng và rollback.
- [ ] Có danh sách hạn chế/khác biệt còn lại, không để người kiểm tra phải suy đoán.

Hoàn thành frontend mới không đồng nghĩa phải xóa frontend cũ hoặc chuyển hệ thống đang chạy. Hai việc đó nằm ngoài phạm vi bảo toàn source của kế hoạch này.
