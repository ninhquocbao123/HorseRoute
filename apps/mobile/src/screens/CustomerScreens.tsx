/**
 * Màn khách hàng theo 02-screens mục 2 và 06-ui phần Khách hàng:
 * CUS-01 Hành trình, CUS-02 Đơn hàng, CUS-03 Chi tiết đơn, CUS-04 Báo giá, CUS-05 Theo dõi,
 * CUS-06 Báo cáo sức khỏe, CUS-08/09/10 Ngựa, CUS-11 đến CUS-15 Yêu cầu vận chuyển, CUS-16 Giấy tờ.
 * Mỗi màn một nút vàng (nút chính ở thanh đáy); trạng thái luôn có icon + chữ.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Linking, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import {
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  FileText,
  HeartPulse,
  Lock,
  MapPin,
  MapPinned,
  Package,
  PawPrint,
  Plus,
  ReceiptText,
  Route,
  SearchX,
  Thermometer,
  Truck,
  Upload,
  Wallet,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { uuid } from "expo";
import {
  Banner,
  Button,
  Card,
  CheckRow,
  Chip,
  DateField,
  Field,
  InfoLine,
  Row,
  ScreenBody,
  Section,
  StatusBadge,
  StepBar,
  Txt,
  s,
  useTheme,
} from "../ui";
import { Sheet, useOverlay } from "../overlay";
import { useResource, useSession } from "../session";
import {
  Empty,
  PhotoPicker,
  PrivateImage,
  ResourceState,
  RouteMap,
  appendPhoto,
  webUrl,
  NotFound,
} from "../live-ui";
import { SkeletonLines } from "../skeleton";
import type {
  IOrderTimeline,
  IHorseReport,
  ITripMap,
  Navigate,
  Order,
  OrderDetail,
  OrderPayload,
  Page,
  Profile,
  ProfileInput,
  Quote,
  Workspace,
} from "../api/types";
import {
  asId,
  canResumeDraft,
  quoteExpiredForPayment,
  recipientError,
  dateTime,
  emptyProfile,
  fromOrder,
  label,
  money,
  orderPayload,
  profilePayload,
  validDate,
} from "../live-domain";
import {
  appetiteLabel,
  horseCondition,
  motion,
  orderStatus,
  vitalsNormal,
  type StatusSpec,
} from "../theme";
import { ApiError, messageOf } from "../api/http";
import { API_URL } from "../config";
import { isCountryCode } from "../../../../packages/shared/src/countries";

/** Ngày theo giờ máy, dạng YYYY-MM-DD mà API nhận. */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromYmd = (value: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
/** Ngày không kèm giờ, kiểu 05/11/2026. */
const day = (value: string | null | undefined) => {
  const d = value ? fromYmd(value.slice(0, 10)) : null;
  return d ? d.toLocaleDateString("vi-VN") : "Chưa chọn ngày";
};
const clock = (value: string | null | undefined) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";
const statusSpec = (status: string): StatusSpec =>
  orderStatus[status] ?? {
    label: label(status),
    tone: "neutral",
    icon: "clock",
  };
const owing = (o: {
  quote_total?: number | string | null;
  paid?: number | string;
}) =>
  o.quote_total != null
    ? Math.max(0, Number(o.quote_total) - Number(o.paid ?? 0))
    : 0;
const nearCountries = [
  ["VN", "Việt Nam"],
  ["KH", "Campuchia"],
  ["LA", "Lào"],
  ["TH", "Thái Lan"],
  ["CN", "Trung Quốc"],
] as const;

/** Chọn quốc gia bằng chip; nước khác thì gõ mã 2 chữ. */
function CountryPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const { colors: c } = useTheme();
  const near = nearCountries.some(([code]) => code === value);
  const [other, setOther] = useState(!near && !!value);
  return (
    <View style={{ gap: 8 }}>
      <Txt size={15} bold>
        {label}
      </Txt>
      <View style={s.wrap}>
        {nearCountries.map(([code, name]) => (
          <Chip
            key={code}
            label={name}
            selected={!other && value === code}
            onPress={() => {
              setOther(false);
              onChange(code);
            }}
          />
        ))}
        <Chip
          label="Khác"
          selected={other}
          onPress={() => {
            setOther(true);
            if (near) onChange("");
          }}
        />
      </View>
      {other ? (
        <Field
          label="Mã quốc gia 2 chữ (ví dụ SG, MY)"
          value={value}
          autoCapitalize="characters"
          onChangeText={(v) => onChange(v.toUpperCase())}
          maxLength={2}
        />
      ) : null}
      {other && value.length === 2 && !isCountryCode(value) ? (
        <Txt size={12} color={c.dangerFg}>
          Không có mã quốc gia {value}.
        </Txt>
      ) : null}
    </View>
  );
}

/**
 * Chuyển sang website (thanh toán, giấy tờ). Nói trước rằng web có phiên đăng nhập riêng
 * để khách không bất ngờ khi bị hỏi đăng nhập lại.
 */
function WebHandoffSheet({
  visible,
  onClose,
  title,
  body,
  orderId,
  documents = false,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
  orderId?: string;
  documents?: boolean;
}) {
  const { user } = useSession();
  const { colors: c } = useTheme();
  const [error, setError] = useState("");
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button title="Để sau" kind="secondary" onPress={onClose} />
          <Button
            title="Mở website"
            onPress={() => {
              setError("");
              void Linking.openURL(webUrl(orderId, documents))
                .then(onClose)
                .catch(() =>
                  setError(
                    "Không mở được website. Kiểm tra trình duyệt trên máy.",
                  ),
                );
            }}
          />
        </>
      }
    >
      <Txt>{body}</Txt>
      <Txt size={15} color={c.textSecondary}>
        {`Website có phiên đăng nhập riêng. Nếu được hỏi, đăng nhập bằng ${user?.email ?? "cùng email"}.`}
      </Txt>
      {error ? <Banner warning text={error} /> : null}
    </Sheet>
  );
}

/** Thẻ chuyến đang chạy: nơi duy nhất dùng gradient teal (06-ui, Khách hàng mục 2). */
function RunningCard({ order, go }: { order: Order; go: Navigate }) {
  const { colors: c } = useTheme();
  const timeline = useResource<IOrderTimeline>(
    `/tracking/orders/${asId(order.id)}/timeline`,
  );
  const legs = timeline.data?.legs ?? [];
  const leg =
    legs.find((l) => l.status === "MOVING" || l.status === "AT_STOP") ??
    legs.find((l) => l.status !== "COMPLETED");
  const late = legs.some((l) => l.isOverdue);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Theo dõi ${order.order_code}`}
      onPress={() => go("tracking", { id: String(order.id) })}
      style={({ pressed }) => ({
        borderRadius: 20,
        overflow: "hidden",
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="running" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.surfaceBrand} />
            <Stop offset="1" stopColor={c.surfaceBrandAlt} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#running)" />
      </Svg>
      <View style={{ padding: 20, gap: 8 }}>
        <Txt size={12} bold color={c.onBrandMuted}>
          {`ĐANG VẬN CHUYỂN · ${order.order_code}`}
        </Txt>
        <Txt size={24} bold color={c.onBrand}>
          {leg
            ? leg.status === "AT_STOP"
              ? `Đang dừng tại ${leg.toLocationName}`
              : leg.status === "NOT_STARTED"
                ? `Chuẩn bị rời ${leg.fromLocationName}`
                : `Đang đến ${leg.toLocationName}`
            : order.destination_address || "Đang vận chuyển"}
        </Txt>
        {leg ? (
          <Txt size={15} color={c.onBrandMuted}>
            {`Dự kiến ${clock(leg.plannedArrivalAt)}${late ? " · đang trễ so với kế hoạch" : ""}`}
          </Txt>
        ) : null}
        <Txt size={15} color={c.onBrand}>
          {order.horse_names || `${order.horse_count ?? 0} ngựa`}
        </Txt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Txt size={15} bold color={c.onBrand}>
            Xem hành trình
          </Txt>
          <ChevronRight size={18} color={c.onBrand} />
        </View>
      </View>
    </Pressable>
  );
}

/** CUS-01 Hành trình: chuyến đang chạy + "Cần bạn xử lý". Không chào hỏi, không quảng cáo. */
export function CustomerHome({ go }: { go: Navigate }) {
  const resource = useResource<Workspace>("/orders/customer-workspace");
  const all = resource.data?.orders ?? [];
  const running = all.filter((o) => o.status === "IN_TRANSIT");
  const todo: {
    key: string;
    title: string;
    detail: string;
    icon: typeof ClipboardList;
    onPress: () => void;
  }[] = [
    ...all
      .filter((o) => o.status === "NEED_INFO")
      .map((o) => ({
        key: `info-${o.id}`,
        title: `Bổ sung thông tin cho ${o.order_code}`,
        detail: o.manager_note || "Quản lý cần thêm thông tin để duyệt.",
        icon: CircleAlert,
        onPress: () => go("order", { id: String(o.id) }),
      })),
    ...all
      .filter(
        (o) =>
          ["APPROVED", "AWAITING_DEPOSIT"].includes(o.status) &&
          o.quote_total != null &&
          Number(o.paid ?? 0) === 0,
      )
      .map((o) => ({
        key: `deposit-${o.id}`,
        title: `Đặt cọc cho ${o.order_code}`,
        detail: `Báo giá ${money(o.quote_total)}`,
        icon: Wallet,
        onPress: () => go("quote", { id: String(o.id) }),
      })),
    ...(resource.data?.horses ?? [])
      .filter((h) => Number(h.missing_documents) > 0)
      .map((h) => ({
        key: `docs-${h.order_id}-${h.id}`,
        title: `Giấy tờ của ${h.name}`,
        detail: `${h.order_code} · thiếu ${h.missing_documents} giấy tờ`,
        icon: FileText,
        onPress: () => go("documents", { id: String(h.order_id) }),
      })),
    ...all
      .filter((o) => o.status === "DRAFT")
      .map((o) => ({
        key: `draft-${o.id}`,
        title: `Yêu cầu nháp ${o.order_code}`,
        detail: "Chưa gửi. Chạm để điền tiếp.",
        icon: ClipboardList,
        onPress: () => go("booking", { id: String(o.id) }),
      })),
  ];
  return (
    <ResourceState resource={resource} what="hành trình">
      {running.length ? (
        running.map((order) => (
          <RunningCard key={order.id} order={order} go={go} />
        ))
      ) : (
        <Empty
          icon={Route}
          title="Chưa có chuyến đang chạy"
          detail="Chuyến hiện ở đây khi đơn của bạn bắt đầu vận chuyển."
        />
      )}
      <Section title="Cần bạn xử lý" />
      {todo.length ? (
        <Card>
          {todo.map((item) => (
            <Row
              key={item.key}
              icon={item.icon}
              danger
              title={item.title}
              detail={item.detail}
              onPress={item.onPress}
            />
          ))}
        </Card>
      ) : (
        <Txt size={15}>Không có việc nào cần bạn làm lúc này.</Txt>
      )}
      {all.length ? (
        <>
          <Section
            title="Đơn gần đây"
            action="Xem tất cả"
            onPress={() => go("orders")}
          />
          {all
            .filter((o) => o.status !== "IN_TRANSIT")
            .slice(0, 3)
            .map((order) => (
              <OrderCard key={order.id} order={order} go={go} />
            ))}
        </>
      ) : (
        <Button
          title="Tạo yêu cầu vận chuyển"
          kind="secondary"
          icon={Plus}
          onPress={() => go("booking")}
        />
      )}
    </ResourceState>
  );
}

function OrderCard({ order, go }: { order: Order; go: Navigate }) {
  const { colors: c } = useTheme();
  return (
    <Card
      label={`${order.order_code}, ${statusSpec(order.status).label}`}
      onPress={() =>
        go(order.status === "IN_TRANSIT" ? "tracking" : "order", {
          id: String(order.id),
        })
      }
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Txt size={15} bold color={c.textSecondary}>
          {order.order_code}
        </Txt>
        <StatusBadge spec={statusSpec(order.status)} />
      </View>
      <Txt size={17} bold>
        {`${order.origin_address || "Chưa có điểm đón"} → ${order.destination_address || "Chưa có điểm giao"}`}
      </Txt>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Txt size={15} color={c.textSecondary} style={{ flex: 1 }}>
          {`${order.horse_count ?? 0} ngựa · ${day(order.desired_departure_date)}`}
        </Txt>
        {order.quote_total != null ? (
          <Txt size={15} bold style={{ fontVariant: ["tabular-nums"] }}>
            {money(order.quote_total)}
          </Txt>
        ) : null}
      </View>
    </Card>
  );
}

const FILTERS: [string, (o: Order) => boolean][] = [
  ["Tất cả", () => true],
  [
    "Đang xử lý",
    (o) =>
      !["IN_TRANSIT", "DELIVERED", "CANCELLED", "REJECTED"].includes(o.status),
  ],
  ["Đang chạy", (o) => o.status === "IN_TRANSIT"],
  ["Đã xong", (o) => o.status === "DELIVERED"],
  ["Đã đóng", (o) => ["CANCELLED", "REJECTED"].includes(o.status)],
];
/** CUS-02 Đơn hàng: lọc theo nhóm, nút vàng Tạo yêu cầu ở đáy. */
export function OrdersScreen({ go }: { go: Navigate }) {
  const resource = useResource<Workspace>("/orders/customer-workspace");
  const [filter, setFilter] = useState(0);
  const all = resource.data?.orders ?? [];
  const visible = all.filter(FILTERS[filter][1]);
  return (
    <ScreenBody
      onRefresh={resource.reload}
      footer={
        <Button
          title="Tạo yêu cầu vận chuyển"
          icon={Plus}
          large
          onPress={() => go("booking")}
        />
      }
    >
      <ResourceState resource={resource} what="danh sách đơn">
        <View style={s.wrap}>
          {FILTERS.map(([name], i) => (
            <Chip
              key={name}
              label={name}
              selected={i === filter}
              onPress={() => setFilter(i)}
            />
          ))}
        </View>
        {visible.length ? (
          visible.map((order) => (
            <OrderCard key={order.id} order={order} go={go} />
          ))
        ) : (
          <Empty
            icon={Package}
            title={all.length ? "Không có đơn trong nhóm này" : "Chưa có đơn"}
            detail={
              all.length
                ? undefined
                : "Tạo yêu cầu vận chuyển cho ngựa đã có hồ sơ."
            }
          />
        )}
      </ResourceState>
    </ScreenBody>
  );
}

const NEEDS_UPLOAD = ["INVALID", "EXPIRED", "NOT_SUBMITTED"];
/** CUS-16: bổ sung một giấy tờ bằng ảnh chụp (JPG), gửi `/documents/orders/:id/items/:docId/upload`. */
function DocumentUploadSheet({
  orderId,
  doc,
  onClose,
  onDone,
}: {
  orderId: string;
  doc: OrderDetail["documents"][number] | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { request, write, writing, refresh } = useSession();
  const { notify } = useOverlay();
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setPhotos([]);
    setError("");
  }, [doc]);
  const send = async () => {
    if (!doc) return;
    if (!photos[0])
      return setError("Chụp hoặc chọn ảnh giấy tờ trước khi gửi.");
    setError("");
    try {
      await write(async () => {
        const body = new FormData();
        appendPhoto(body, photos[0], "file");
        await request(
          `/documents/orders/${asId(orderId)}/items/${asId(doc.id)}/upload`,
          { method: "POST", body },
        );
        refresh();
        notify(
          `Đã gửi ${doc.document_name}`,
          `${doc.horse_name} · chờ chuyên viên kiểm tra`,
        );
        onDone();
      });
    } catch (e) {
      // Mất phản hồi giữa chừng: hỏi lại máy chủ xem giấy tờ đã được nhận chưa, tránh gửi trùng.
      if (e instanceof ApiError && e.status === 0) {
        const fresh = await request<OrderDetail>(
          `/orders/${asId(orderId)}`,
        ).catch(() => null);
        const now = fresh?.documents.find(
          (d) => String(d.id) === String(doc.id),
        );
        if (now && !NEEDS_UPLOAD.includes(now.status)) {
          refresh();
          notify(
            `Đã gửi ${doc.document_name}`,
            `${doc.horse_name} · chờ chuyên viên kiểm tra`,
          );
          onDone();
          return;
        }
        setError(
          fresh
            ? "Máy chủ chưa nhận được giấy tờ. Kiểm tra mạng rồi bấm Gửi lại."
            : messageOf(e),
        );
        return;
      }
      setError(messageOf(e));
    }
  };
  return (
    <Sheet
      visible={!!doc}
      onClose={onClose}
      title={doc ? `${doc.document_name} · ${doc.horse_name}` : ""}
      footer={
        <Button
          title={writing ? "Đang gửi…" : "Gửi giấy tờ"}
          disabled={writing}
          onPress={() => void send()}
        />
      }
    >
      {doc?.invalid_reason ? (
        <Banner warning text={`Lý do cần nộp lại: ${doc.invalid_reason}`} />
      ) : null}
      <PhotoPicker
        photos={photos}
        onChange={setPhotos}
        max={1}
        required
        label="Ảnh giấy tờ"
      />
      {error ? <Banner warning text={error} /> : null}
    </Sheet>
  );
}

const PROGRESS = [
  "Gửi yêu cầu",
  "Duyệt",
  "Đặt cọc",
  "Chuẩn bị",
  "Vận chuyển",
  "Đã giao",
];
const progressOf = (status: string) =>
  ({
    DRAFT: 0,
    PENDING: 1,
    NEED_INFO: 1,
    APPROVED: 2,
    AWAITING_DEPOSIT: 2,
    PREPARING: 3,
    READY: 3,
    IN_TRANSIT: 4,
    DELIVERED: 5,
  })[status] ?? -1;

/** CUS-03 Chi tiết đơn / CUS-16 Giấy tờ. Nút chính ở đáy đổi theo trạng thái. */
export function OrderScreen({
  id,
  go,
  documents = false,
}: {
  id: string;
  go: Navigate;
  documents?: boolean;
}) {
  const { colors: c } = useTheme();
  const { request, write, writing, refresh } = useSession();
  const { confirm, notify } = useOverlay();
  const resource = useResource<OrderDetail>(`/orders/${asId(id)}`);
  const order = resource.data;
  const quoted =
    !!order &&
    !["DRAFT", "PENDING", "NEED_INFO", "REJECTED"].includes(order.status);
  const quote = useResource<Quote | null>(
    quoted ? `/orders/${asId(id)}/quote` : null,
  );
  const [web, setWeb] = useState<"docs" | "pay" | null>(null);
  const [error, setError] = useState("");
  const [upload, setUpload] = useState<OrderDetail["documents"][number] | null>(
    null,
  );
  if (!order)
    return (
      <ScreenBody onRefresh={resource.reload}>
        <ResourceState resource={resource} what="đơn hàng" skeleton="detail">
          {null}
        </ResourceState>
      </ScreenBody>
    );
  const missing = order.documents.filter((d) =>
    NEEDS_UPLOAD.includes(d.status),
  );
  // Backend chỉ nhận giấy tờ khi đơn đã duyệt và chưa vận chuyển.
  const uploadable = ["APPROVED", "PREPARING", "READY"].includes(order.status);
  const due = quote.data
    ? Math.max(0, Number(quote.data.total) - Number(quote.data.paid))
    : 0;
  const remove = async () => {
    const ok = await confirm({
      title: "Xóa đơn nháp?",
      body: "Đơn nháp và nội dung đã điền sẽ bị xóa, không khôi phục được.",
      confirmLabel: "Xóa đơn nháp",
      destructive: true,
    });
    if (!ok) return;
    setError("");
    try {
      await write(async () => {
        await request(`/orders/${asId(id)}`, { method: "DELETE" });
        refresh();
        notify(`Đã xóa đơn nháp ${order.order_code}`);
        go("orders");
      });
    } catch (e) {
      setError(messageOf(e));
    }
  };
  let footer: React.ReactNode = null;
  if (documents)
    footer =
      missing.length && uploadable ? (
        <Button
          title="Tải bản PDF trên website"
          kind="tertiary"
          onPress={() => setWeb("docs")}
        />
      ) : null;
  else if (order.status === "DRAFT")
    footer = (
      <>
        <Button
          title="Xóa đơn nháp"
          kind="destructive"
          disabled={writing}
          onPress={() => void remove()}
        />
        <Button
          title="Tiếp tục điền"
          large
          disabled={writing}
          onPress={() => go("booking", { id })}
        />
      </>
    );
  else if (order.status === "NEED_INFO")
    footer = (
      <Button
        title="Sửa và gửi lại"
        large
        onPress={() => go("booking", { id })}
      />
    );
  else if (missing.length && uploadable)
    footer = (
      <Button
        title={`Bổ sung ${missing.length} giấy tờ`}
        icon={Upload}
        large
        onPress={() => go("documents", { id })}
      />
    );
  else if (order.status === "IN_TRANSIT" || order.status === "DELIVERED")
    footer = (
      <Button
        title={
          order.status === "IN_TRANSIT"
            ? "Theo dõi hành trình"
            : "Xem lại hành trình"
        }
        icon={Truck}
        large
        onPress={() => go("tracking", { id })}
      />
    );
  else if (due > 0 && quote.data)
    footer = (
      <Button
        title={
          Number(quote.data.paid) > 0
            ? "Xem báo giá và thanh toán"
            : "Xem báo giá và đặt cọc"
        }
        icon={Wallet}
        large
        onPress={() => go("quote", { id })}
      />
    );
  const byHorse = new Map<string, OrderDetail["documents"]>();
  for (const d of order.documents)
    byHorse.set(d.horse_name, [...(byHorse.get(d.horse_name) ?? []), d]);
  const step = progressOf(order.status);
  return (
    <ScreenBody
      onRefresh={() => {
        resource.reload();
        quote.reload();
      }}
      footer={footer}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Txt size={24} bold>
          {order.order_code}
        </Txt>
        <StatusBadge spec={statusSpec(order.status)} />
      </View>
      {order.manager_note &&
      ["NEED_INFO", "REJECTED"].includes(order.status) ? (
        <View
          style={{
            borderWidth: 1.5,
            borderRadius: 16,
            padding: 16,
            gap: 4,
            borderColor: order.status === "REJECTED" ? c.dangerFg : c.warningFg,
            backgroundColor:
              order.status === "REJECTED" ? c.dangerBg : c.warningBg,
          }}
        >
          <Txt size={12} bold>
            {order.status === "REJECTED" ? "LÝ DO TỪ CHỐI" : "CẦN BỔ SUNG"}
          </Txt>
          <Txt>{order.manager_note}</Txt>
        </View>
      ) : null}
      {documents ? (
        <>
          <Section title="Giấy tờ theo ngựa" />
          {order.documents.length ? (
            [...byHorse.entries()].map(([horse, docs]) => (
              <Card key={horse}>
                <Txt bold>{horse}</Txt>
                {docs.map((d) => {
                  const need = NEEDS_UPLOAD.includes(d.status);
                  return (
                    <View key={d.id} style={{ gap: 8 }}>
                      <Row
                        title={d.document_name}
                        detail={`${label(d.status)}${d.invalid_reason ? ` · ${d.invalid_reason}` : ""}`}
                        icon={FileText}
                        danger={need}
                      />
                      {need && uploadable ? (
                        <Button
                          title="Chụp hoặc chọn ảnh giấy tờ"
                          kind="secondary"
                          icon={Upload}
                          onPress={() => setUpload(d)}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </Card>
            ))
          ) : (
            <Empty
              icon={FileText}
              title="Đơn này chưa có danh sách giấy tờ"
              detail="Danh sách hiện ở đây khi điều phối xác định giấy tờ cần nộp."
            />
          )}
          <Txt size={15} color={c.textSecondary}>
            {uploadable
              ? "Chụp rõ cả trang, đủ sáng. Bản PDF thì tải trên website."
              : missing.length
                ? "Giấy tờ bổ sung được khi đơn đã duyệt và chưa vận chuyển."
                : "Giấy tờ đã nộp đủ. Trạng thái cập nhật khi chuyên viên kiểm tra."}
          </Txt>
        </>
      ) : (
        <>
          {step >= 0 ? (
            <Card>
              <StepBar
                step={Math.min(step, PROGRESS.length - 1)}
                steps={PROGRESS}
              />
              <Txt size={15} color={c.textSecondary}>
                {order.status === "DELIVERED"
                  ? "Đã giao xong."
                  : `Bước hiện tại: ${PROGRESS[step]}`}
              </Txt>
            </Card>
          ) : null}
          <Card>
            <InfoLine
              label="Điểm đón"
              value={`${order.origin_address || "Chưa cập nhật"}${order.origin_country ? ` · ${order.origin_country}` : ""}`}
            />
            <InfoLine
              label="Điểm giao"
              value={`${order.destination_address || "Chưa cập nhật"}${order.destination_country ? ` · ${order.destination_country}` : ""}`}
            />
            <InfoLine
              label="Ngày khởi hành"
              value={day(order.desired_departure_date)}
            />
          </Card>
          <Section
            title={`Ngựa trong đơn · ${(order.draft?.horses ?? order.horses).length}`}
          />
          <Card>
            {(order.draft?.horses ?? order.horses).map((h, i) => {
              const docs = byHorse.get(h.name) ?? [];
              const lacking = docs.filter((d) =>
                ["INVALID", "EXPIRED", "NOT_SUBMITTED"].includes(d.status),
              ).length;
              return (
                <Row
                  key={h.id ?? i}
                  title={h.name || "Chưa nhập tên"}
                  detail={
                    lacking
                      ? `Thiếu ${lacking} giấy tờ`
                      : docs.length
                        ? "Giấy tờ đã đủ"
                        : h.breed || "Chưa có giống ngựa"
                  }
                  icon={PawPrint}
                  danger={lacking > 0}
                />
              );
            })}
          </Card>
          {quoted ? (
            <Card label="Xem báo giá" onPress={() => go("quote", { id })}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Txt bold>Báo giá</Txt>
                <ChevronRight size={20} color={c.textSecondary} />
              </View>
              {quote.data ? (
                <>
                  <InfoLine
                    label="Tổng cộng"
                    value={money(quote.data.total)}
                    strong
                  />
                  <Txt size={15} color={c.textSecondary}>
                    {due > 0
                      ? `Đã thanh toán ${money(quote.data.paid)} · còn ${money(due)}`
                      : "Đã thanh toán đủ"}
                  </Txt>
                </>
              ) : quote.loading ? (
                <SkeletonLines label="Đang tải báo giá" />
              ) : (
                <Txt size={15} color={c.textSecondary}>
                  Chưa có báo giá được duyệt.
                </Txt>
              )}
            </Card>
          ) : null}
          {order.documents.length ? (
            <Row
              title="Giấy tờ của đơn"
              detail={
                missing.length
                  ? `${missing.length} giấy tờ cần bổ sung`
                  : "Đã đủ giấy tờ"
              }
              icon={FileText}
              danger={missing.length > 0}
              onPress={() => go("documents", { id })}
            />
          ) : null}
          {order.special_requirements ? (
            <Card>
              <InfoLine
                label="Yêu cầu đặc biệt"
                value={order.special_requirements}
              />
            </Card>
          ) : null}
          {order.status === "PENDING" ? (
            <Txt size={15} color={c.textSecondary}>
              Quản lý đang xem yêu cầu. Bạn nhận thông báo khi có báo giá.
            </Txt>
          ) : null}
        </>
      )}
      {error ? <Banner warning text={error} /> : null}
      <DocumentUploadSheet
        orderId={id}
        doc={upload}
        onClose={() => setUpload(null)}
        onDone={() => {
          setUpload(null);
          resource.reload();
        }}
      />
      <WebHandoffSheet
        visible={web !== null}
        onClose={() => setWeb(null)}
        orderId={id}
        documents={web === "docs"}
        title={
          web === "docs"
            ? "Tải giấy tờ trên website"
            : "Thanh toán trên website"
        }
        body={
          web === "docs"
            ? "Tải ảnh hoặc bản quét giấy tờ trên website. Trạng thái cập nhật lại ở đây sau khi quản lý kiểm tra."
            : "Thanh toán thực hiện trên website. Ứng dụng cập nhật số đã trả khi giao dịch được ghi nhận."
        }
      />
    </ScreenBody>
  );
}

/** CUS-04 Báo giá: bảng như hóa đơn, số canh phải, hạn đếm ngược khi còn dưới 48 giờ. */
export function QuoteScreen({ id }: { id: string }) {
  const resource = useResource<Quote | null>(`/orders/${asId(id)}/quote`);
  const quote = resource.data;
  const { colors: c } = useTheme();
  const [web, setWeb] = useState(false);
  const due = quote ? Math.max(0, Number(quote.total) - Number(quote.paid)) : 0;
  const left = quote?.expires_at
    ? Date.parse(quote.expires_at) - Date.now()
    : null;
  const line = (
    title: string,
    amount: string,
    strong = false,
    key?: string,
  ) => (
    <View
      key={key ?? title}
      style={{
        flexDirection: "row",
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
      }}
    >
      <Txt bold={strong} style={{ flex: 1 }}>
        {title}
      </Txt>
      <Txt
        bold={strong}
        style={{ textAlign: "right", fontVariant: ["tabular-nums"] }}
      >
        {amount}
      </Txt>
    </View>
  );
  return (
    <ScreenBody
      onRefresh={resource.reload}
      footer={
        quote && due > 0 && !quoteExpiredForPayment(quote) ? (
          <Button
            title={
              Number(quote.paid) > 0
                ? `Thanh toán ${money(due)} trên web`
                : `Đặt cọc ${money(quote.deposit)} trên web`
            }
            icon={Wallet}
            large
            onPress={() => setWeb(true)}
          />
        ) : null
      }
    >
      <ResourceState resource={resource} what="báo giá" skeleton="detail">
        {quote ? (
          <>
            <Card>
              <Txt size={12} bold color={c.textSecondary}>
                TỔNG CỘNG
              </Txt>
              <Txt size={24} bold style={{ fontVariant: ["tabular-nums"] }}>
                {money(quote.total)}
              </Txt>
              {left !== null ? (
                <Txt
                  size={15}
                  bold={left < 48 * 3600000}
                  color={
                    left <= 0
                      ? c.dangerFg
                      : left < 48 * 3600000
                        ? c.warningFg
                        : c.textSecondary
                  }
                >
                  {left <= 0
                    ? "Báo giá đã hết hạn. Liên hệ quản lý để báo giá lại."
                    : left < 48 * 3600000
                      ? `Còn ${Math.floor(left / 3600000)} giờ ${Math.floor((left % 3600000) / 60000)} phút để đặt cọc`
                      : `Hạn báo giá: ${dateTime(quote.expires_at)}`}
                </Txt>
              ) : null}
            </Card>
            <Card>
              {quote.items.map((item, i) =>
                line(
                  item.quantity > 1
                    ? `${item.label} × ${item.quantity}`
                    : item.label,
                  money(item.amount),
                  false,
                  `${item.code}-${i}`,
                ),
              )}
              {Number(quote.adjustment)
                ? line("Điều chỉnh", money(quote.adjustment))
                : null}
              {quote.adjustment_reason ? (
                <Txt size={15} color={c.textSecondary}>
                  {`Lý do điều chỉnh: ${quote.adjustment_reason}`}
                </Txt>
              ) : null}
              {line(`VAT ${quote.vat_percent}%`, money(quote.vat_amount))}
              {line("Tổng cộng", money(quote.total), true)}
              {line(`Đặt cọc ${quote.deposit_percent}%`, money(quote.deposit))}
              {line("Đã thanh toán", money(quote.paid), true)}
              {line("Còn lại", money(due), true)}
            </Card>
            <Section title="Giao dịch đã ghi nhận" />
            {quote.receipts.length ? (
              <Card>
                {quote.receipts.map((receipt) => (
                  <Row
                    key={receipt.id}
                    title={money(receipt.amount)}
                    detail={`${dateTime(receipt.received_at)}${receipt.reference ? ` · ${receipt.reference}` : ""}`}
                    icon={Wallet}
                  />
                ))}
              </Card>
            ) : (
              <Txt size={15} color={c.textSecondary}>
                Chưa có giao dịch.
              </Txt>
            )}
          </>
        ) : (
          <Empty
            icon={ReceiptText}
            title="Chưa có báo giá được duyệt"
            detail="Báo giá hiện ở đây khi quản lý phê duyệt. Bạn sẽ nhận thông báo."
          />
        )}
      </ResourceState>
      <WebHandoffSheet
        visible={web}
        onClose={() => setWeb(false)}
        orderId={id}
        title="Thanh toán trên website"
        body="Thanh toán thực hiện trên website. Số đã trả cập nhật ở đây khi giao dịch được ghi nhận."
      />
    </ScreenBody>
  );
}

type TrackEvent =
  | {
      kind: "stop";
      key: string;
      name: string;
      note: string;
      time: string | null;
      done: boolean;
      current: boolean;
    }
  | { kind: "report"; key: string; report: IHorseReport; time: string };

/**
 * CUS-05 Theo dõi (hướng B): thẻ trạng thái lớn, timeline điểm dừng có báo cáo sức khỏe xen đúng giờ,
 * bản đồ là thẻ nhỏ 160pt, chạm để mở toàn màn. Không hiện số điều phối (Long, 30/10).
 */
export function TrackingScreen({ id, go }: { id: string; go: Navigate }) {
  const { colors: c } = useTheme();
  const timeline = useResource<IOrderTimeline>(
    `/tracking/orders/${asId(id)}/timeline`,
  );
  const map = useResource<ITripMap>(`/tracking/orders/${asId(id)}/map`);
  const reports = useResource<IHorseReport[]>(
    `/tracking/orders/${asId(id)}/horse-reports`,
  );
  const t = timeline.data;
  const legs = useMemo(
    () => [...(t?.legs ?? [])].sort((a, b) => a.seqNo - b.seqNo),
    [t],
  );
  const leg =
    legs.find((l) => l.status === "MOVING" || l.status === "AT_STOP") ??
    legs.find((l) => l.status !== "COMPLETED");
  const late = legs.find((l) => l.isOverdue);
  const events = useMemo(() => {
    const list: TrackEvent[] = [];
    if (legs.length) {
      const first = legs[0];
      list.push({
        kind: "stop",
        key: "start",
        name: first.fromLocationName,
        note: first.actualDepartureAt
          ? `Đã rời ${clock(first.actualDepartureAt)}`
          : `Dự kiến rời ${clock(first.plannedDepartureAt)}`,
        time: first.actualDepartureAt ?? first.plannedDepartureAt,
        done: !!first.actualDepartureAt,
        current: first.status === "NOT_STARTED",
      });
    }
    for (const l of legs) {
      for (const w of l.waypointCheckins)
        list.push({
          kind: "stop",
          key: `w-${l.seqNo}-${w.waypointId}`,
          name: w.label,
          note: `Đã qua ${clock(w.occurredAt)}`,
          time: w.occurredAt,
          done: true,
          current: false,
        });
      const arrived = l.status === "AT_STOP" || l.status === "COMPLETED";
      list.push({
        kind: "stop",
        key: `l-${l.seqNo}`,
        name: l.toLocationName,
        note: arrived
          ? `Đã đến ${clock(l.actualArrivalAt)}${l.status === "COMPLETED" && l.actualDepartureAt ? ` · rời ${clock(l.actualDepartureAt)}` : ""}`
          : `Dự kiến ${clock(l.plannedArrivalAt)}${l.isOverdue ? " · đang trễ" : ""}`,
        time: l.actualArrivalAt ?? l.plannedArrivalAt,
        done: arrived,
        current: l === leg,
      });
    }
    for (const r of reports.data ?? [])
      list.push({
        kind: "report",
        key: `r-${r.id}`,
        report: r,
        time: r.sentAt,
      });
    const at = (e: TrackEvent) => Date.parse(e.time ?? "") || 0;
    return list.sort((a, b) => at(a) - at(b));
  }, [legs, leg, reports.data]);
  return (
    <ScreenBody
      onRefresh={() => {
        timeline.reload();
        map.reload();
        reports.reload();
      }}
    >
      <ResourceState resource={timeline} what="lộ trình" skeleton="detail">
        {t ? (
          <Card brand>
            <Txt size={12} bold color={c.onBrandMuted}>
              {`${t.orderCode} · ${statusSpec(t.orderStatus).label.toUpperCase()}`}
            </Txt>
            <Txt size={24} bold color={c.onBrand}>
              {t.orderStatus === "DELIVERED"
                ? "Đã giao xong"
                : !leg
                  ? "Chưa có lộ trình được duyệt"
                  : leg.status === "AT_STOP"
                    ? `Đang dừng tại ${leg.toLocationName}`
                    : leg.status === "NOT_STARTED"
                      ? `Chuẩn bị rời ${leg.fromLocationName}`
                      : `Đang trên đường đến ${leg.toLocationName}`}
            </Txt>
            {leg && t.orderStatus !== "DELIVERED" ? (
              <Txt size={15} color={c.onBrandMuted}>
                {`Dự kiến ${clock(leg.status === "NOT_STARTED" ? leg.plannedDepartureAt : leg.plannedArrivalAt)}`}
              </Txt>
            ) : null}
            {late && t.orderStatus !== "DELIVERED" ? (
              <View style={s.wrap}>
                <StatusBadge
                  spec={{
                    label: "Trễ so với kế hoạch",
                    tone: "warning",
                    icon: "clock",
                  }}
                />
              </View>
            ) : null}
            {t.lastUpdatedAt ? (
              <Txt size={12} color={c.onBrandMuted}>
                {`Cập nhật ${dateTime(t.lastUpdatedAt)}${t.lastUpdatedByName ? ` · ${t.lastUpdatedByName}` : ""}`}
              </Txt>
            ) : null}
          </Card>
        ) : null}
      </ResourceState>
      {map.data ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở bản đồ toàn màn hình"
          onPress={() => go("tracking-map", { id })}
        >
          <RouteMap map={map.data} compact />
        </Pressable>
      ) : null}
      <Section title="Hành trình" />
      {events.length ? (
        <View>
          {events.map((e, i) =>
            e.kind === "stop" ? (
              <View key={e.key} style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ width: 24, alignItems: "center" }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: e.current ? 3 : 1,
                      borderColor: e.current ? c.accent : c.borderInput,
                      backgroundColor: e.done ? c.surfaceBrand : c.surface,
                    }}
                  >
                    {e.done ? (
                      <CircleCheck size={14} color={c.onBrand} />
                    ) : (
                      <MapPin size={14} color={c.textPrimary} />
                    )}
                  </View>
                  {i < events.length - 1 ? (
                    <View
                      style={{ width: 2, flex: 1, backgroundColor: c.border }}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, paddingBottom: 20, gap: 2 }}>
                  <Txt bold={e.current}>{e.name}</Txt>
                  <Txt size={15} color={e.current ? c.link : c.textSecondary}>
                    {e.note}
                  </Txt>
                </View>
              </View>
            ) : (
              <View key={e.key} style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ width: 24, alignItems: "center" }}>
                  <View
                    style={{ width: 2, flex: 1, backgroundColor: c.border }}
                  />
                </View>
                <View style={{ flex: 1, paddingBottom: 16 }}>
                  <Card
                    label={`Báo cáo sức khỏe ${e.report.horseName}`}
                    onPress={() =>
                      go("health", { id: e.report.id, orderId: id })
                    }
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <HeartPulse size={20} color={c.link} />
                      <Txt bold style={{ flex: 1 }}>
                        {e.report.horseName}
                      </Txt>
                      {!e.report.viewedAt ? (
                        <Txt size={12} bold color={c.link}>
                          MỚI
                        </Txt>
                      ) : null}
                    </View>
                    <View style={s.wrap}>
                      <StatusBadge
                        spec={
                          horseCondition[e.report.conditionStatus] ??
                          horseCondition.STABLE
                        }
                      />
                    </View>
                    <Txt size={12} color={c.textSecondary}>
                      {`${e.report.escortName} · ${clock(e.report.sentAt)}`}
                    </Txt>
                  </Card>
                </View>
              </View>
            ),
          )}
        </View>
      ) : t ? (
        <Empty
          icon={MapPinned}
          title="Chưa có lộ trình được duyệt"
          detail="Các điểm dừng hiện ở đây khi điều phối lập xong kế hoạch."
        />
      ) : null}
      {reports.error && !reports.data ? (
        <Banner warning text="Chưa tải được báo cáo sức khỏe." />
      ) : null}
    </ScreenBody>
  );
}

/** Bản đồ toàn màn của CUS-05. */
export function TrackingMapScreen({ id }: { id: string }) {
  const map = useResource<ITripMap>(`/tracking/orders/${asId(id)}/map`);
  return (
    <ResourceState resource={map} what="bản đồ" skeleton="map">
      {map.data ? <RouteMap map={map.data} /> : null}
    </ResourceState>
  );
}

function StatTile({
  title,
  value,
  warn,
}: {
  title: string;
  value: string;
  warn?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 96,
        padding: 12,
        borderRadius: 12,
        gap: 4,
        backgroundColor: warn ? c.warningBg : c.surfaceMuted,
      }}
    >
      <Txt size={12} color={c.textSecondary}>
        {title}
      </Txt>
      <Txt
        size={17}
        bold
        color={warn ? c.warningFg : c.textPrimary}
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Txt>
    </View>
  );
}

/** CUS-06 Báo cáo sức khỏe: mở là tự đánh dấu đã xem; chỉ số ngoài ngưỡng tô cam kèm lời giải thích. */
export function HealthScreen({ id, orderId }: { id: string; orderId: string }) {
  const { colors: c } = useTheme();
  const resource = useResource<IHorseReport[]>(
    `/tracking/orders/${asId(orderId)}/horse-reports`,
  );
  const { request, refresh } = useSession();
  const report = resource.data?.find((item) => String(item.id) === id);
  const marked = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!report || report.viewedAt || marked.current) return;
    marked.current = true;
    void request(
      `/tracking/orders/${asId(orderId)}/horse-reports/${asId(id)}/view`,
      { method: "POST" },
    )
      .then(refresh)
      .catch((e) => {
        setError(messageOf(e));
      });
  }, [report, request, refresh, orderId, id]);
  const temp = report?.bodyTempC ?? null;
  const heart = report?.heartRateBpm ?? null;
  const tempWarn =
    temp !== null &&
    (temp < vitalsNormal.bodyTempC.min || temp > vitalsNormal.bodyTempC.max);
  const heartWarn =
    heart !== null &&
    (heart < vitalsNormal.heartRateBpm.min ||
      heart > vitalsNormal.heartRateBpm.max);
  return (
    <ResourceState
      resource={resource}
      what="báo cáo sức khỏe"
      skeleton="detail"
    >
      {report ? (
        <>
          <Txt size={24} bold>
            {report.horseName}
          </Txt>
          <View style={s.wrap}>
            <StatusBadge
              spec={
                horseCondition[report.conditionStatus] ?? horseCondition.STABLE
              }
            />
          </View>
          <Txt size={15} color={c.textSecondary}>
            {`${report.escortName} · ${dateTime(report.sentAt)}`}
          </Txt>
          <View style={[s.wrap, { gap: 8 }]}>
            <StatTile
              title="Nhiệt độ"
              value={
                temp !== null ? `${temp.toLocaleString("vi-VN")} °C` : "Chưa đo"
              }
              warn={tempWarn}
            />
            <StatTile
              title="Nhịp tim"
              value={heart !== null ? `${heart} lần/phút` : "Chưa đo"}
              warn={heartWarn}
            />
            <StatTile
              title="Ăn uống"
              value={
                report.appetite
                  ? (appetiteLabel[report.appetite] ?? label(report.appetite))
                  : "Chưa ghi"
              }
              warn={!!report.appetite && report.appetite !== "NORMAL"}
            />
          </View>
          {tempWarn || heartWarn ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Thermometer size={18} color={c.warningFg} />
              <Txt size={15} color={c.warningFg} style={{ flex: 1 }}>
                {`Ngoài mức thường gặp ở ngựa trưởng thành khi nghỉ (${vitalsNormal.bodyTempC.min.toLocaleString("vi-VN")}–${vitalsNormal.bodyTempC.max.toLocaleString("vi-VN")} °C, ${vitalsNormal.heartRateBpm.min}–${vitalsNormal.heartRateBpm.max} lần/phút). Người hộ tống và điều phối đang theo dõi.`}
              </Txt>
            </View>
          ) : null}
          {report.customerNote ? (
            <Card>
              <InfoLine label="Ghi chú cho bạn" value={report.customerNote} />
            </Card>
          ) : null}
          {report.photos.map((photo) => (
            <PrivateImage
              key={photo.id}
              path={`/tracking/attachments/${asId(photo.id)}`}
              caption={photo.caption || undefined}
            />
          ))}
          {error ? (
            <Banner
              warning
              text={`Đã mở báo cáo nhưng chưa đánh dấu đã xem: ${error}`}
            />
          ) : null}
        </>
      ) : (
        <NotFound
          title="Không tìm thấy báo cáo"
          detail="Báo cáo có thể đã bị thu hồi. Xem các báo cáo khác trong hành trình."
        />
      )}
    </ResourceState>
  );
}

const age = (birthDate: string) => {
  const d = fromYmd(birthDate);
  if (!d) return "";
  const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000));
  return years >= 1 ? `${years} tuổi` : "Dưới 1 tuổi";
};
const photoOf = (h: Profile) => h.files.find((f) => f.kind === "PHOTO");

/** CUS-08 Ngựa / CUS-09 Hồ sơ ngựa. */
export function ProfilesScreen({ go, id }: { go: Navigate; id?: string }) {
  const resource = useResource<Profile[]>("/customer/profiles");
  const { colors: c } = useTheme();
  const horse = id
    ? resource.data?.find((h) => String(h.id) === id)
    : undefined;
  if (id) {
    const photo = horse ? photoOf(horse) : undefined;
    return (
      <ScreenBody
        onRefresh={resource.reload}
        footer={
          horse ? (
            <>
              <Button
                title="Chỉnh sửa hồ sơ"
                kind="secondary"
                onPress={() => go("horse-form", { id })}
              />
              <Button
                title={
                  horse.activeOrderId
                    ? `Đang trên đơn ${horse.activeOrderCode ?? ""}`
                    : !horse.passportNo
                      ? "Cần số hộ chiếu để đặt vận chuyển"
                      : "Đặt vận chuyển cho ngựa này"
                }
                large
                disabled={!!horse.activeOrderId || !horse.passportNo}
                onPress={() => go("booking", { horseId: id })}
              />
            </>
          ) : null
        }
      >
        <ResourceState resource={resource} what="hồ sơ ngựa" skeleton="detail">
          {horse ? (
            <>
              {photo ? (
                <PrivateImage
                  path={`/customer/files/${asId(photo.id)}`}
                  caption={undefined}
                />
              ) : null}
              <Txt size={24} bold>
                {horse.name}
              </Txt>
              <Txt size={15} color={c.textSecondary}>
                {[
                  horse.breed,
                  horse.sex,
                  horse.birthDate && age(horse.birthDate),
                ]
                  .filter(Boolean)
                  .join(" · ") || "Chưa cập nhật giống"}
              </Txt>
              {horse.activeOrderId ? (
                <Row
                  title={`Đang trên đơn ${horse.activeOrderCode ?? ""}`}
                  detail="Mở đơn"
                  icon={Truck}
                  onPress={() =>
                    go("order", { id: String(horse.activeOrderId) })
                  }
                />
              ) : null}
              <Card>
                <InfoLine
                  label="Số hộ chiếu"
                  value={horse.passportNo || "Chưa cập nhật"}
                />
                <InfoLine
                  label="Ngày sinh"
                  value={
                    horse.birthDate ? day(horse.birthDate) : "Chưa cập nhật"
                  }
                />
                <InfoLine
                  label="Màu lông"
                  value={horse.coatColor || "Chưa cập nhật"}
                />
                <InfoLine
                  label="Microchip"
                  value={horse.microchip || "Chưa cập nhật"}
                />
                <InfoLine
                  label="Cân nặng · chiều cao"
                  value={`${horse.weightKg === null ? "–" : `${horse.weightKg} kg`} · ${horse.heightCm === null ? "–" : `${horse.heightCm} cm`}`}
                />
                {horse.feed ? (
                  <InfoLine label="Khẩu phần" value={horse.feed} />
                ) : null}
                {horse.note ? (
                  <InfoLine label="Ghi chú" value={horse.note} />
                ) : null}
              </Card>
              {horse.files.some((f) => f.kind === "DOCUMENT") ? (
                <>
                  <Section title="Giấy tờ đã gắn" />
                  <Card>
                    {horse.files
                      .filter((f) => f.kind === "DOCUMENT")
                      .map((f) => (
                        <Row
                          key={f.id}
                          title={f.original_name}
                          icon={FileText}
                        />
                      ))}
                  </Card>
                </>
              ) : null}
            </>
          ) : (
            <Empty
              icon={SearchX}
              title="Hồ sơ không có trong danh sách hiện tại"
              detail="Ngựa đang vận chuyển có thể được ẩn khỏi danh sách hồ sơ. Xem ngựa trong chi tiết đơn."
            />
          )}
        </ResourceState>
      </ScreenBody>
    );
  }
  return (
    <ScreenBody
      onRefresh={resource.reload}
      footer={
        <Button
          title="Thêm ngựa"
          icon={Plus}
          large
          onPress={() => go("horse-form")}
        />
      }
    >
      <ResourceState resource={resource} what="danh sách ngựa">
        {resource.data?.length ? (
          <Card>
            {resource.data.map((h) => {
              const photo = photoOf(h);
              return (
                <Pressable
                  key={h.id}
                  accessibilityRole="button"
                  accessibilityLabel={h.name}
                  onPress={() => go("horse", { id: String(h.id) })}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                    paddingVertical: 8,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  {photo ? (
                    <PrivateImage
                      path={`/customer/files/${asId(photo.id)}`}
                      caption={h.name}
                      size={56}
                    />
                  ) : (
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: c.surfaceMuted,
                      }}
                    >
                      <PawPrint size={24} color={c.link} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt bold>{h.name}</Txt>
                    <Txt size={15} color={c.textSecondary}>
                      {[h.breed, h.birthDate && age(h.birthDate), h.sex]
                        .filter(Boolean)
                        .join(" · ") || "Chưa rõ giống"}
                    </Txt>
                    {h.activeOrderId ? (
                      <Txt size={12} bold color={c.link}>
                        {`Đang trên đơn ${h.activeOrderCode ?? ""}`}
                      </Txt>
                    ) : null}
                  </View>
                  <ChevronRight size={20} color={c.textSecondary} />
                </Pressable>
              );
            })}
          </Card>
        ) : (
          <Empty
            icon={PawPrint}
            title="Bạn chưa có hồ sơ ngựa"
            detail="Thêm hồ sơ một lần, lần sau đặt vận chuyển không phải nhập lại."
          />
        )}
      </ResourceState>
    </ScreenBody>
  );
}
export function ProfileFormScreen({
  id,
  go,
  replace,
}: {
  id?: string;
  go: Navigate;
  replace: Navigate;
}) {
  const resource = useResource<Profile[]>(id ? "/customer/profiles" : null);
  if (!id) return <ProfileForm go={go} replace={replace} />;
  const profile = resource.data?.find((h) => String(h.id) === id);
  return (
    <ResourceState resource={resource} what="hồ sơ ngựa" skeleton="detail">
      {profile ? (
        <ProfileForm
          key={profile.id}
          initial={profile}
          go={go}
          replace={replace}
        />
      ) : (
        <NotFound
          title="Không tìm thấy hồ sơ để chỉnh sửa"
          detail="Hồ sơ có thể đã bị xóa. Quay lại danh sách ngựa."
        />
      )}
    </ResourceState>
  );
}
/** CUS-10 Thêm/sửa hồ sơ ngựa, có ảnh ngựa (F-K1). */
function ProfileForm({
  initial,
  go,
  replace,
}: {
  initial?: Profile;
  go: Navigate;
  replace: Navigate;
}) {
  const { request, user, write, writing, refresh } = useSession();
  const { notify } = useOverlay();
  const { colors: c } = useTheme();
  const [form, setForm] = useState<ProfileInput>(() =>
    initial
      ? profilePayload(initial)
      : { ...emptyProfile, ownerName: user?.fullName || "" },
  );
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState("");
  const patch = (p: Partial<ProfileInput>) =>
    setForm((old) => ({ ...old, ...p }));
  const save = async () => {
    setError("");
    try {
      await write(async () => {
        if (!form.name.trim()) throw new Error("Nhập tên ngựa.");
        for (const [value, max] of [
          [form.weightKg, 2000],
          [form.heightCm, 300],
        ]) {
          if (
            value != null &&
            (!Number.isFinite(value) || value < 0 || value > max!)
          )
            throw new Error("Cân nặng hoặc chiều cao không hợp lệ.");
        }
        if (
          form.birthDate &&
          (!validDate(form.birthDate) ||
            form.birthDate > new Date().toISOString().slice(0, 10))
        )
          throw new Error("Ngày sinh không hợp lệ hoặc ở tương lai.");
        const result = await request<{ id: string }>(
          initial
            ? `/customer/profiles/${asId(initial.id)}`
            : "/customer/profiles",
          { method: initial ? "PUT" : "POST", body: profilePayload(form) },
        );
        const savedId = String(result.id ?? initial?.id);
        let photoError = "";
        if (photos[0]) {
          const body = new FormData();
          body.append("kind", "PHOTO");
          body.append("slot", "other");
          appendPhoto(body, photos[0], "file");
          await request(`/customer/profiles/${asId(savedId)}/files`, {
            method: "POST",
            body,
          }).catch((e) => {
            photoError = messageOf(e);
          });
        }
        refresh();
        notify(
          `Đã lưu hồ sơ ${form.name.trim()}`,
          photoError ? `Chưa tải được ảnh: ${photoError}` : undefined,
        );
        // Lưu xong không quay lại form đã gửi: sửa thì về màn hồ sơ đang mở, thêm mới thì thay form bằng hồ sơ vừa tạo.
        if (initial) go("back");
        else replace("horse", { id: savedId });
      });
    } catch (e) {
      setError(messageOf(e));
    }
  };
  return (
    <>
      <PhotoPicker
        photos={photos}
        onChange={setPhotos}
        max={1}
        label={initial && photoOf(initial) ? "Đổi ảnh ngựa" : "Ảnh ngựa"}
      />
      <Field
        label="Tên ngựa *"
        value={form.name}
        onChangeText={(name) => patch({ name })}
        maxLength={100}
      />
      <Field
        label="Giống ngựa"
        value={form.breed}
        onChangeText={(breed) => patch({ breed })}
        maxLength={50}
      />
      <Field
        label="Số hộ chiếu"
        value={form.passportNo}
        onChangeText={(passportNo) => patch({ passportNo })}
        maxLength={50}
        editable={!initial?.passportNo}
        hint={
          initial?.passportNo
            ? "Số hộ chiếu đã lưu không sửa được trên app."
            : "Không bắt buộc khi lưu, nhưng cần có trước khi đặt vận chuyển."
        }
      />
      <View style={{ gap: 8 }}>
        <Txt size={15} bold>
          Giới tính
        </Txt>
        <View style={s.wrap}>
          {(["", "Đực", "Cái"] as const).map((sex) => (
            <Chip
              key={sex}
              label={sex || "Chưa rõ"}
              selected={form.sex === sex}
              onPress={() => patch({ sex })}
            />
          ))}
        </View>
      </View>
      <DateField
        label="Ngày sinh"
        value={fromYmd(form.birthDate || "")}
        maximumDate={new Date()}
        onChange={(d) => patch({ birthDate: ymd(d) })}
      />
      <Field
        label="Cân nặng (kg)"
        keyboardType="decimal-pad"
        value={form.weightKg === null ? "" : String(form.weightKg)}
        onChangeText={(v) =>
          patch({ weightKg: v ? Number(v.replace(",", ".")) : null })
        }
      />
      <Field
        label="Chiều cao (cm)"
        keyboardType="decimal-pad"
        value={form.heightCm === null ? "" : String(form.heightCm)}
        onChangeText={(v) =>
          patch({ heightCm: v ? Number(v.replace(",", ".")) : null })
        }
      />
      <Field
        label="Màu lông"
        value={form.coatColor}
        onChangeText={(coatColor) => patch({ coatColor })}
        maxLength={30}
      />
      <Field
        label="Microchip"
        value={form.microchip}
        onChangeText={(microchip) => patch({ microchip })}
        maxLength={50}
      />
      <Field
        label="Khẩu phần"
        value={form.feed}
        onChangeText={(feed) => patch({ feed })}
        maxLength={120}
      />
      <Field
        label="Ghi chú"
        value={form.note}
        onChangeText={(note) => patch({ note })}
        multiline
        maxLength={255}
      />
      {error ? <Banner warning text={error} /> : null}
      <Button
        title={writing ? "Đang lưu…" : "Lưu hồ sơ"}
        disabled={writing}
        onPress={() => void save()}
      />
      <Txt size={12} color={c.textSecondary}>
        Cần mạng để lưu: máy chủ kiểm tra trùng số hộ chiếu.
      </Txt>
    </>
  );
}

/* ---------------- CUS-11 đến CUS-15 Yêu cầu vận chuyển ---------------- */

type StoredOrderDraft = {
  requestId: string;
  savedId?: string;
  selected: string[];
  payload: OrderPayload;
  recipientName: string;
  recipientPhone: string;
  terms: boolean;
  step: number;
};
const blankPayload: OrderPayload = {
  originAddress: "",
  originCountry: "VN",
  destinationAddress: "",
  destinationCountry: "VN",
  desiredDepartureDate: "",
  specialRequirements: "",
  horses: [],
};
const STEPS = ["Chọn ngựa", "Tuyến và ngày", "Người nhận", "Xác nhận và gửi"];
const STEP_TITLES = [
  "Chọn ngựa",
  "Tuyến và ngày",
  "Người nhận, ghi chú",
  "Xem lại và gửi",
];
/**
 * Hàng chọn ngựa (CUS-11). Ngựa bận vẫn chạm được để giải thích: hàng rung,
 * viền vàng sáng lên trong lúc thông báo hiện rồi tắt cùng thông báo (Long, 02/11).
 */
function HorseRow({
  horse: h,
  reason,
  selected,
  disabled,
  flash,
  onPress,
}: {
  horse: Profile;
  reason?: string;
  selected: boolean;
  disabled: boolean;
  flash: boolean;
  onPress: () => void;
}) {
  const { colors: c } = useTheme();
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!flash) return;
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 8, -8, 4, -4, 0].map((toValue) =>
        Animated.timing(shake, {
          toValue,
          duration: 50,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [flash, shake]);
  return (
    <Animated.View style={{ transform: [{ translateX: shake }] }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected, disabled: !!reason }}
        accessibilityLabel={`${h.name}${reason ? `, ${reason}` : ""}`}
        accessibilityHint={reason ? "Không chọn được ngựa này" : undefined}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 12,
          minHeight: 64,
          borderRadius: 12,
          borderWidth: flash || selected ? 2 : 1,
          borderColor: flash ? c.accent : selected ? c.link : c.border,
          backgroundColor: selected
            ? c.infoBg
            : pressed
              ? c.surfaceMuted
              : c.surface,
        })}
      >
        {reason ? (
          <Lock size={22} color={c.textSecondary} />
        ) : (
          <PawPrint size={22} color={c.link} />
        )}
        <View style={{ flex: 1, gap: 2, opacity: reason ? 0.6 : 1 }}>
          <Txt bold>{h.name}</Txt>
          <Txt size={15} color={c.textSecondary}>
            {reason ??
              ([h.breed, h.passportNo && `Hộ chiếu ${h.passportNo}`]
                .filter(Boolean)
                .join(" · ") ||
                "Hồ sơ ngựa")}
          </Txt>
        </View>
        {reason ? null : (
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: selected ? c.link : c.borderInput,
              backgroundColor: selected ? c.link : "transparent",
            }}
          >
            {selected ? (
              <Check size={16} color={c.surface} strokeWidth={3} />
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
export function BookingScreen({
  page,
  go,
  replace,
}: {
  page: Page;
  go: Navigate;
  replace: Navigate;
}) {
  const profiles = useResource<Profile[]>("/customer/profiles");
  const order = useResource<OrderDetail>(
    page.id ? `/orders/${asId(page.id)}` : null,
  );
  if (!profiles.data || (page.id && !order.data))
    return (
      <ScreenBody>
        <ResourceState
          resource={page.id && profiles.data ? order : profiles}
          what="thông tin đặt chuyến"
          skeleton="detail"
        >
          {null}
        </ResourceState>
      </ScreenBody>
    );
  return (
    <BookingForm
      go={go}
      replace={replace}
      profiles={profiles.data}
      initialOrder={order.data}
      selectedHorse={page.horseId}
    />
  );
}
function BookingForm({
  profiles,
  initialOrder,
  selectedHorse,
  go,
  replace,
}: {
  profiles: Profile[];
  initialOrder?: OrderDetail;
  selectedHorse?: string;
  go: Navigate;
  replace: Navigate;
}) {
  const { colors: c } = useTheme();
  const { user, request, write, writing, refresh } = useSession();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [km, setKm] = useState<number | null>(null);
  const [sent, setSent] = useState<{ id: string; code: string } | null>(null);
  const { notify } = useOverlay();
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );
  // Đơn nháp (DRAFT) đổi được ngựa; đơn Cần bổ sung giữ nguyên danh sách ngựa.
  const lockedHorses = !!initialOrder && initialOrder.status !== "DRAFT";
  const [draft, setDraft] = useState<StoredOrderDraft>(() => ({
    requestId: uuid.v4(),
    savedId: initialOrder?.id,
    selected: selectedHorse
      ? [selectedHorse]
      : initialOrder
        ? fromOrder(initialOrder)
            .horses.map((h) => h.profileId)
            .filter((v): v is string => !!v)
        : [],
    payload: initialOrder ? fromOrder(initialOrder) : blankPayload,
    recipientName: "",
    recipientPhone: "",
    terms: false,
    step: 0,
  }));
  const key = `horseroute.booking.v3:${API_URL}:${user!.id}:${initialOrder?.id ?? "new"}`;
  const chain = useRef(Promise.resolve());
  const finished = useRef(false);
  /** Đã bấm Gửi trong lần mở này: gặp đơn Chờ duyệt nghĩa là lần gửi trước đã tới máy chủ. */
  const submitted = useRef(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key)
      .then(async (raw) => {
        if (!active || !raw) return;
        const data = JSON.parse(raw) as StoredOrderDraft;
        if (!data.requestId || !data.payload || !Array.isArray(data.selected))
          throw new Error("Nháp không hợp lệ.");
        if (!initialOrder && data.savedId) {
          // Nháp có thể đã được gửi hoặc xóa từ màn khác: không dùng lại cho yêu cầu mới.
          const server = await request<OrderDetail>(
            `/orders/${asId(data.savedId)}`,
          ).catch((e) =>
            e instanceof ApiError && e.status === 404 ? null : undefined,
          );
          if (server === null || (server && !canResumeDraft(server.status))) {
            await AsyncStorage.removeItem(key);
            return;
          }
          if (!active) return;
        }
        setDraft({
          ...data,
          selected: selectedHorse ? [selectedHorse] : data.selected,
        });
      })
      .catch(() => {
        if (active)
          setError(
            "Không đọc được nháp trên máy. Đang dùng nội dung từ máy chủ hoặc biểu mẫu trống.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [key, selectedHorse]);
  useEffect(() => {
    if (!ready || finished.current) return;
    chain.current = chain.current
      .then(() => AsyncStorage.setItem(key, JSON.stringify(draft)))
      .catch(() =>
        setError(
          "Không lưu được nháp trên máy. Giữ ứng dụng mở trước khi gửi.",
        ),
      );
  }, [draft, key, ready]);
  const patch = (value: Partial<OrderPayload>) =>
    setDraft((d) => ({ ...d, payload: { ...d.payload, ...value } }));
  const chosen = profiles.filter((h) => draft.selected.includes(String(h.id)));
  const payloadNow = (): OrderPayload =>
    lockedHorses
      ? draft.payload
      : orderPayload(draft.payload, draft.selected, profiles, draft.savedId);
  const validate = (step: number) => {
    if (
      step === 0 &&
      (lockedHorses ? !draft.payload.horses.length : !draft.selected.length)
    )
      throw new Error("Chọn ít nhất 1 ngựa để tiếp tục.");
    if (step === 1) {
      const p = draft.payload;
      if (!p.originAddress.trim() || !p.destinationAddress.trim())
        throw new Error("Nhập điểm đón và điểm giao.");
      if (
        !isCountryCode(p.originCountry) ||
        !isCountryCode(p.destinationCountry)
      )
        throw new Error("Chọn quốc gia hợp lệ cho điểm đón và điểm giao.");
      if (
        !validDate(p.desiredDepartureDate) ||
        p.desiredDepartureDate < ymd(new Date())
      )
        throw new Error("Chọn ngày khởi hành từ hôm nay trở đi.");
    }
    if (step === 2) {
      const problem = recipientError(draft.recipientName, draft.recipientPhone);
      if (problem) throw new Error(problem);
    }
  };
  /** Ước khoảng cách (chỉ hỗ trợ VN, CN, TH). Không ước được thì để quản lý tính khi báo giá. */
  const estimate = async () => {
    const p = draft.payload;
    const ok = ["VN", "CN", "TH"];
    if (!ok.includes(p.originCountry) || !ok.includes(p.destinationCountry))
      return null;
    const city = (a: string) => a.split(",").slice(-1)[0].trim();
    try {
      const r = await request<{ distanceKm: number }>(
        "/customer/route-distance",
        {
          method: "POST",
          body: {
            from: {
              country: p.originCountry,
              city: city(p.originAddress),
              ward: "",
            },
            to: {
              country: p.destinationCountry,
              city: city(p.destinationAddress),
              ward: "",
            },
          },
        },
      );
      const value = Math.min(10000, Math.max(1, Math.round(r.distanceKm)));
      setKm(value);
      return value;
    } catch {
      setKm(null);
      return null;
    }
  };
  /** Người nhận chỉ gửi được qua `booking` (02-screens, ghi chú CUS-14). */
  const buildBooking = (distanceKm: number | null) => {
    const name = draft.recipientName.trim();
    const n = lockedHorses
      ? draft.payload.horses.length
      : draft.selected.length;
    if (!name || n > 9) return undefined;
    const p = draft.payload;
    const contact = (
      who: string,
      phone: string,
      address: string,
      country: string,
    ) => ({
      name: who,
      phone,
      address,
      city: "",
      ward: "",
      identityNumber: "",
      country,
    });
    const dist = distanceKm ?? 1;
    return {
      sender: contact(
        user!.fullName,
        user!.phone ?? "",
        user!.address || p.originAddress,
        p.originCountry,
      ),
      recipient: contact(
        name,
        draft.recipientPhone.replace(/[\s.]/g, ""),
        p.destinationAddress.trim(),
        p.destinationCountry,
      ),
      pickupTime: "",
      vehicleClass: n <= 2 ? "LIGHT" : n <= 6 ? "MEDIUM" : "HEAVY",
      distanceKm: dist,
      durationDays: Math.max(1, Math.ceil(dist / 500)),
      insurance: "NONE",
      feed: "STANDARD",
      extraStall: false,
      water: "EVERY_2_HOURS",
      waterRounds: 0,
      border:
        p.originCountry !== p.destinationCountry
          ? `${p.originCountry}-${p.destinationCountry}`
          : "",
      documentLanguage: "",
      customsCode: "",
      importPermit: "",
      paymentMethod: "BANK",
      termsAccepted: draft.terms,
    };
  };
  /** Lưu nháp lên máy chủ sau mỗi bước để mở lại được trên web (02-screens 2.6). Lỗi mạng thì giữ nháp trên máy. */
  const saveServerDraft = async (next: StoredOrderDraft) => {
    if (initialOrder && initialOrder.status !== "DRAFT") return next;
    try {
      const body = {
        ...(lockedHorses
          ? draft.payload
          : orderPayload(
              draft.payload,
              draft.selected,
              profiles,
              draft.savedId,
            )),
      };
      if (next.savedId) {
        await request(`/orders/${asId(next.savedId)}`, { method: "PUT", body });
        return next;
      }
      const r = await request<{ id: string }>("/orders", {
        method: "POST",
        body: { ...body, requestId: next.requestId },
      });
      return { ...next, savedId: String(r.id) };
    } catch {
      return next;
    }
  };
  const forward = async () => {
    setError("");
    try {
      validate(draft.step);
    } catch (e) {
      setError(messageOf(e));
      return;
    }
    let next = { ...draft, step: draft.step + 1 };
    if (draft.step === 1) void estimate();
    await write(async () => {
      next = await saveServerDraft(next);
    }).catch(() => {});
    setDraft(next);
  };
  const submit = async () => {
    setError("");
    try {
      await write(async () => {
        validate(0);
        validate(1);
        validate(2);
        if (!draft.terms)
          throw new Error("Đánh dấu đồng ý điều khoản vận chuyển để gửi.");
        await chain.current;
        const payload = payloadNow();
        const booking = buildBooking(km ?? (await estimate()));
        const body = booking ? { ...payload, booking } : payload;
        await AsyncStorage.setItem(key, JSON.stringify(draft));
        let savedId = draft.savedId;
        if (!savedId) {
          const result = await request<{ id: string }>("/orders", {
            method: "POST",
            body: { ...body, requestId: draft.requestId },
          });
          savedId = String(result.id);
          const checkpoint = { ...draft, savedId };
          await AsyncStorage.setItem(key, JSON.stringify(checkpoint));
          setDraft(checkpoint);
        }
        const current = await request<OrderDetail>(`/orders/${asId(savedId)}`);
        if (canResumeDraft(current.status)) {
          await request(`/orders/${asId(savedId)}`, { method: "PUT", body });
          submitted.current = true;
          await request(`/orders/${asId(savedId)}/submit`, { method: "POST" });
        } else if (current.status !== "PENDING" || !submitted.current) {
          // Không báo "Đã gửi" với đơn cũ: yêu cầu đang nhập chưa hề được gửi.
          await AsyncStorage.removeItem(key);
          throw new Error(
            `Nháp này thuộc đơn ${current.order_code}, đơn đã ở trạng thái ${label(current.status)}. Yêu cầu vừa nhập chưa được gửi. Thoát màn này và tạo yêu cầu mới.`,
          );
        }
        finished.current = true;
        await chain.current;
        await AsyncStorage.removeItem(key);
        refresh();
        setSent({ id: savedId, code: current.order_code });
      });
    } catch (e) {
      setError(messageOf(e));
    }
  };

  if (sent)
    // CUS-15 Đã gửi yêu cầu
    return (
      <ScreenBody
        footer={
          <Button
            title="Xem đơn"
            large
            onPress={() => replace("order", { id: sent.id })}
          />
        }
      >
        <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
          <CircleCheck size={56} color={c.successFg} />
          <Txt size={24} bold style={{ textAlign: "center" }}>
            Đã gửi yêu cầu
          </Txt>
          <Txt style={{ textAlign: "center" }}>
            {`${sent.code} · ${draft.selected.length || draft.payload.horses.length} ngựa · khởi hành ${day(draft.payload.desiredDepartureDate)}`}
          </Txt>
          <StatusBadge spec={statusSpec("PENDING")} />
        </View>
        <Section title="Bước tiếp theo" />
        <Card>
          {[
            ["Đã gửi yêu cầu", true],
            ["Quản lý duyệt và gửi báo giá", false],
            ["Bạn đặt cọc trên website", false],
            ["Điều phối lập chuyến, bạn theo dõi trên app", false],
          ].map(([text, done], i) => (
            <View
              key={String(text)}
              style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
            >
              {done ? (
                <CircleCheck size={22} color={c.successFg} />
              ) : (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 1.5,
                    borderColor: c.borderInput,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt size={12}>{String(i + 1)}</Txt>
                </View>
              )}
              <Txt style={{ flex: 1 }}>{String(text)}</Txt>
            </View>
          ))}
        </Card>
        <Txt size={15} color={c.textSecondary}>
          Bạn nhận thông báo khi quản lý duyệt hoặc cần bổ sung.
        </Txt>
      </ScreenBody>
    );

  if (!ready)
    return (
      <ScreenBody>
        <Txt>Đang khôi phục nháp…</Txt>
      </ScreenBody>
    );
  const step = draft.step;
  const locked = (h: Profile) =>
    h.activeOrderId && String(h.activeOrderId) !== draft.savedId
      ? `Đang trên đơn ${h.activeOrderCode ?? ""}`
      : !h.passportNo.trim()
        ? "Thiếu số hộ chiếu"
        : null;
  const free = profiles.filter((h) => !locked(h));
  const busy = profiles.filter((h) => locked(h));
  const toggle = (h: Profile) =>
    setDraft((d) => ({
      ...d,
      selected: d.selected.includes(String(h.id))
        ? d.selected.filter((v) => v !== String(h.id))
        : [...d.selected, String(h.id)],
    }));
  /** Chạm ngựa không chọn được: rung, viền vàng và thông báo trên cùng trong cùng 3 giây. */
  const refuse = (h: Profile, reason: string) => {
    setFlash(String(h.id));
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), motion.topNoticeMs);
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
    notify(
      h.activeOrderId
        ? `${h.name} đang trong chuyến khác`
        : `${h.name} chưa có số hộ chiếu`,
      h.activeOrderId
        ? `${reason}. Vui lòng chọn ngựa khác.`
        : "Cập nhật hồ sơ ngựa trước, hoặc chọn ngựa khác.",
    );
  };
  return (
    <ScreenBody
      footer={
        <>
          {step > 0 ? (
            <Button
              title="Quay lại"
              kind="secondary"
              disabled={writing}
              onPress={() => {
                setError("");
                setDraft((d) => ({ ...d, step: d.step - 1 }));
              }}
            />
          ) : null}
          <Button
            title={
              writing
                ? step === 3
                  ? "Đang gửi…"
                  : "Đang lưu…"
                : step === 3
                  ? "Gửi yêu cầu"
                  : "Tiếp tục"
            }
            large
            disabled={writing}
            onPress={() => void (step === 3 ? submit() : forward())}
          />
        </>
      }
    >
      <StepBar step={step} steps={STEPS} />
      <Txt size={24} bold>
        {STEP_TITLES[step]}
      </Txt>
      {step === 0 ? (
        lockedHorses ? (
          <>
            <Card>
              {draft.payload.horses.map((h, i) => (
                <Row
                  key={h.id ?? i}
                  title={h.name}
                  detail={h.passportNo ? `Hộ chiếu ${h.passportNo}` : undefined}
                  icon={PawPrint}
                />
              ))}
            </Card>
            <Txt size={15} color={c.textSecondary}>
              Đơn cần bổ sung giữ nguyên danh sách ngựa. Muốn đổi ngựa, sửa đơn
              trên website.
            </Txt>
          </>
        ) : (
          <>
            {free.map((h) => (
              <HorseRow
                key={h.id}
                horse={h}
                selected={draft.selected.includes(String(h.id))}
                disabled={writing}
                flash={false}
                onPress={() => toggle(h)}
              />
            ))}
            {busy.length ? (
              <>
                <Section title="Chưa chọn được" />
                {busy.map((h) => (
                  <HorseRow
                    key={h.id}
                    horse={h}
                    reason={locked(h)!}
                    selected={false}
                    disabled={writing}
                    flash={flash === String(h.id)}
                    onPress={() => refuse(h, locked(h)!)}
                  />
                ))}
              </>
            ) : null}
            {!profiles.length ? (
              <Empty
                icon={PawPrint}
                title="Chưa có hồ sơ ngựa"
                detail="Thêm hồ sơ ngựa trước khi đặt vận chuyển."
              />
            ) : null}
            <Button
              title="Thêm hồ sơ ngựa"
              kind="tertiary"
              icon={Plus}
              onPress={() => go("horse-form")}
            />
          </>
        )
      ) : null}
      {step === 1 ? (
        <>
          <Field
            label="Điểm đón *"
            value={draft.payload.originAddress}
            onChangeText={(originAddress) => patch({ originAddress })}
            maxLength={255}
            placeholder="Địa chỉ, tỉnh hoặc thành phố"
          />
          <CountryPicker
            label="Nước đón *"
            value={draft.payload.originCountry}
            onChange={(originCountry) => patch({ originCountry })}
          />
          <Field
            label="Điểm giao *"
            value={draft.payload.destinationAddress}
            onChangeText={(destinationAddress) => patch({ destinationAddress })}
            maxLength={255}
            placeholder="Địa chỉ, tỉnh hoặc thành phố"
          />
          <CountryPicker
            label="Nước đến *"
            value={draft.payload.destinationCountry}
            onChange={(destinationCountry) => patch({ destinationCountry })}
          />
          <DateField
            label="Ngày khởi hành *"
            value={fromYmd(draft.payload.desiredDepartureDate)}
            minimumDate={new Date()}
            onChange={(d) => patch({ desiredDepartureDate: ymd(d) })}
          />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Field
            label="Tên người nhận"
            value={draft.recipientName}
            onChangeText={(recipientName) =>
              setDraft((d) => ({ ...d, recipientName }))
            }
            maxLength={100}
            hint="Tài xế gọi người này khi giao ngựa."
          />
          <Field
            label="Số điện thoại người nhận"
            value={draft.recipientPhone}
            onChangeText={(recipientPhone) =>
              setDraft((d) => ({ ...d, recipientPhone }))
            }
            keyboardType="phone-pad"
            maxLength={20}
            hint="Bắt buộc khi đã nhập tên người nhận."
          />
          <Field
            label="Yêu cầu đặc biệt (không bắt buộc)"
            multiline
            maxLength={5000}
            value={draft.payload.specialRequirements}
            onChangeText={(specialRequirements) =>
              patch({ specialRequirements })
            }
            placeholder="Ví dụ: ngựa sợ tiếng ồn, cần dừng cho uống nước mỗi 2 giờ"
          />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Card>
            <InfoLine
              label="Ngựa"
              value={
                lockedHorses
                  ? draft.payload.horses.map((h) => h.name).join(", ")
                  : chosen.map((h) => h.name).join(", ")
              }
            />
            <InfoLine
              label="Điểm đón"
              value={`${draft.payload.originAddress} · ${draft.payload.originCountry}`}
            />
            <InfoLine
              label="Điểm giao"
              value={`${draft.payload.destinationAddress} · ${draft.payload.destinationCountry}`}
            />
            <InfoLine
              label="Ngày khởi hành"
              value={day(draft.payload.desiredDepartureDate)}
            />
            {km ? (
              <InfoLine
                label="Quãng đường ước tính"
                value={`Khoảng ${km.toLocaleString("vi-VN")} km`}
              />
            ) : null}
            <InfoLine
              label="Người nhận"
              value={
                draft.recipientName.trim()
                  ? `${draft.recipientName.trim()}${draft.recipientPhone ? ` · ${draft.recipientPhone}` : ""}`
                  : "Chưa nhập, bổ sung sau với quản lý"
              }
            />
            <InfoLine
              label="Yêu cầu đặc biệt"
              value={draft.payload.specialRequirements || "Không có"}
            />
          </Card>
          <CheckRow
            label="Tôi đồng ý điều khoản vận chuyển của HorseRoute"
            checked={draft.terms}
            onPress={() => setDraft((d) => ({ ...d, terms: !d.terms }))}
          />
          <Txt size={15} color={c.textSecondary}>
            Gửi xong, quản lý duyệt và gửi báo giá. Chưa phải thanh toán lúc
            này.
          </Txt>
        </>
      ) : null}
      {draft.savedId && step > 0 ? (
        <Txt size={12} color={c.textSecondary}>
          Nháp đã lưu, mở lại được từ danh sách đơn.
        </Txt>
      ) : null}
      {error ? <Banner warning text={error} /> : null}
    </ScreenBody>
  );
}
