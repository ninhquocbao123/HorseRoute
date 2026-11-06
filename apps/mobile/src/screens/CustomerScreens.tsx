/**
 * Màn khách hàng theo 02-screens mục 2 và 06-ui phần Khách hàng:
 * CUS-01 Hành trình, CUS-02 Đơn hàng, CUS-03 Chi tiết đơn, CUS-04 Báo giá, CUS-05 Theo dõi,
 * CUS-06 Báo cáo sức khỏe, CUS-08/09/10 Ngựa, CUS-11 đến CUS-15 Yêu cầu vận chuyển, CUS-16 Giấy tờ.
 * Mỗi màn một nút vàng (nút chính ở thanh đáy); trạng thái luôn có icon + chữ.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  FileText,
  HeartPulse,
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
import {
  Banner,
  Button,
  Card,
  Chip,
  DateField,
  Field,
  InfoLine,
  Row,
  ScreenBody,
  Section,
  FilterBar,
  StatusBadge,
  StepBar,
  Txt,
  s,
  useTheme,
} from "../ui";
import { Sheet, useOverlay } from "../overlay";
import { useResource, useSession } from "../session";
import { TripMapView, type TripMapHandle } from "../map/TripMapView";
import { customerPositionText } from "../map/map-scene";
import { useAutoRefresh, useLiveTripMap } from "../map/useLiveTripMap";
import {
  Empty,
  PhotoPicker,
  PrivateImage,
  ResourceState,
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
  Profile,
  ProfileInput,
  Quote,
  Workspace,
} from "../api/types";
import {
  asId,
  paymentAction,
  dateTime,
  day,
  emptyProfile,
  fromYmd,
  label,
  money,
  profilePayload,
  ymd,
  validDate,
} from "../live-domain";
import {
  appetiteLabel,
  horseCondition,
  orderStatus,
  vitalsNormal,
  type StatusSpec,
} from "../theme";
import { ApiError, messageOf } from "../api/http";

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
    ...all.flatMap((o) => {
      if (o.quote_total == null || o.quote_deposit == null) return [];
      const action = paymentAction(
        { status: o.status, arrivedAtDelivery: o.arrived_at_delivery },
        {
          total: o.quote_total,
          deposit: o.quote_deposit,
          paid: o.paid,
          expires_at: o.quote_expires_at,
        },
      );
      if (action.kind !== "pay") return [];
      return [
        {
          key: `pay-${o.id}`,
          title:
            action.type === "DEPOSIT"
              ? `Đặt cọc cho ${o.order_code}`
              : `Thanh toán ${o.order_code}`,
          detail: `${money(action.amount)}. ${action.note}`,
          icon: Wallet,
          onPress: () => go("quote", { id: String(o.id) }),
        },
      ];
    }),
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
        <Txt size={12} bold numberOfLines={1} style={{ flexShrink: 0 }}>
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
          onPress={() => go("booking")}
        />
      }
    >
      <ResourceState resource={resource} what="danh sách đơn">
        <FilterBar
          options={FILTERS.map(([name]) => name)}
          selected={filter}
          onSelect={setFilter}
        />
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
  const [web, setWeb] = useState(false);
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
          onPress={() => setWeb(true)}
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
          disabled={writing}
          onPress={() => go("booking", { id })}
        />
      </>
    );
  else if (order.status === "NEED_INFO")
    footer = (
      <Button title="Sửa và gửi lại" onPress={() => go("booking", { id })} />
    );
  else if (missing.length && uploadable)
    footer = (
      <Button
        title={`Bổ sung ${missing.length} giấy tờ`}
        icon={Upload}
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
        <Txt size={15} bold numberOfLines={1} style={{ flexShrink: 0 }}>
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
        visible={web}
        onClose={() => setWeb(false)}
        orderId={id}
        documents
        title="Tải giấy tờ trên website"
        body="Tải ảnh hoặc bản quét giấy tờ trên website. Trạng thái cập nhật lại ở đây sau khi quản lý kiểm tra."
      />
    </ScreenBody>
  );
}

/** CUS-04 Báo giá: bảng như hóa đơn, số canh phải, hạn đếm ngược khi còn dưới 48 giờ. */
export function QuoteScreen({ id, go }: { id: string; go: Navigate }) {
  const resource = useResource<Quote | null>(`/orders/${asId(id)}/quote`);
  const quote = resource.data;
  const { colors: c } = useTheme();
  const action = quote
    ? paymentAction(
        {
          status: quote.order_status,
          arrivedAtDelivery: quote.arrived_at_delivery,
        },
        quote,
      )
    : null;
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
        action?.kind === "pay" ? (
          <Button
            title={
              action.type === "DEPOSIT"
                ? `Đặt cọc ${money(action.amount)}`
                : `Thanh toán ${money(action.amount)}`
            }
            icon={Wallet}
            onPress={() => go("payment", { id, paymentType: action.type })}
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
                    ? action?.kind === "none" && action.expired
                      ? action.note
                      : `Hạn báo giá: ${dateTime(quote.expires_at)}`
                    : left < 48 * 3600000
                      ? `Còn ${Math.floor(left / 3600000)} giờ ${Math.floor((left % 3600000) / 60000)} phút để đặt cọc`
                      : `Hạn báo giá: ${dateTime(quote.expires_at)}`}
                </Txt>
              ) : null}
              {action?.note && !(action.kind === "none" && action.expired) ? (
                <Txt
                  size={15}
                  bold={action.kind === "pay" && action.urgent}
                  color={
                    action.kind === "pay" && action.urgent
                      ? c.warningFg
                      : c.textSecondary
                  }
                >
                  {action.note}
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
    </ScreenBody>
  );
}

const PAY_METHODS = [
  { value: "BANK_TRANSFER", label: "Chuyển khoản" },
  { value: "E_WALLET", label: "Ví điện tử" },
  { value: "CARD", label: "Thẻ" },
] as const;

/**
 * CUS-17, CUS-18 Thanh toán MÔ PHỎNG, cùng API với web, không thu tiền thật.
 * Tạm thời cho tới khi có VNPay Sandbox; khi đó thay màn này theo kế hoạch 10 mục 4.
 * Số tiền lấy lại từ máy chủ lúc tạo phiên, không tin số đang hiện trên máy.
 */
export function PaymentScreen({
  id,
  type,
  back,
}: {
  id: string;
  type: "DEPOSIT" | "BALANCE";
  back: () => void;
}) {
  const { request, refresh } = useSession();
  const { colors: c } = useTheme();
  const resource = useResource<Quote | null>(`/orders/${asId(id)}/quote`);
  const quote = resource.data;
  const [method, setMethod] =
    useState<(typeof PAY_METHODS)[number]["value"]>("BANK_TRANSFER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    status: "SUCCESS" | "FAILED" | "CANCELLED";
    amount: number;
  } | null>(null);
  const action = quote
    ? paymentAction(
        {
          status: quote.order_status,
          arrivedAtDelivery: quote.arrived_at_delivery,
        },
        quote,
      )
    : null;
  const finish = async (status: "SUCCESS" | "FAILED" | "CANCELLED") => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const session = await request<{ sessionCode: string; amount: number }>(
        "/payments/sessions",
        {
          method: "POST",
          body: { orderId: id, paymentType: type, paymentMethod: method },
        },
      );
      await request(
        `/payments/sessions/${asId(session.sessionCode)}/complete`,
        { method: "POST", body: { result: status } },
      );
      setResult({ status, amount: session.amount });
      if (status === "SUCCESS") {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        refresh();
      }
    } catch (e) {
      setError(messageOf(e));
      resource.reload();
    } finally {
      setBusy(false);
    }
  };
  if (result)
    return (
      <ScreenBody
        footer={
          result.status === "SUCCESS" ? (
            <Button title="Xong" onPress={back} />
          ) : (
            <>
              <Button title="Thử lại" onPress={() => setResult(null)} />
              <Button title="Để sau" kind="secondary" onPress={back} />
            </>
          )
        }
      >
        <Card>
          {result.status === "SUCCESS" ? (
            <CircleCheck size={32} color={c.successFg} />
          ) : (
            <CircleAlert
              size={32}
              color={result.status === "FAILED" ? c.dangerFg : c.warningFg}
            />
          )}
          <Txt size={24} bold>
            {result.status === "SUCCESS"
              ? "Đã ghi nhận thanh toán"
              : result.status === "FAILED"
                ? "Thanh toán không thành công"
                : "Đã hủy giao dịch"}
          </Txt>
          <Txt color={c.textSecondary}>
            {result.status === "SUCCESS"
              ? `${money(result.amount)} đã được ghi vào đơn. Đây là giao dịch mô phỏng.`
              : "Chưa có khoản tiền nào được ghi nhận."}
          </Txt>
        </Card>
      </ScreenBody>
    );
  const payable = action?.kind === "pay" && action.type === type;
  return (
    <ScreenBody
      onRefresh={resource.reload}
      footer={
        payable ? (
          <>
            <Button
              title={`Xác nhận thanh toán ${money(action.amount)}`}
              large
              icon={Wallet}
              disabled={busy}
              onPress={() => void finish("SUCCESS")}
            />
            <Button
              title="Thử thanh toán thất bại"
              kind="secondary"
              disabled={busy}
              onPress={() => void finish("FAILED")}
            />
            <Button
              title="Hủy giao dịch"
              kind="tertiary"
              disabled={busy}
              onPress={() => void finish("CANCELLED")}
            />
          </>
        ) : null
      }
    >
      <ResourceState resource={resource} what="thanh toán" skeleton="detail">
        <Banner warning text="Thanh toán mô phỏng, không thu tiền thật." />
        {payable ? (
          <>
            <Card>
              <Txt size={12} bold color={c.textSecondary}>
                {type === "DEPOSIT" ? "ĐẶT CỌC" : "PHẦN CÒN LẠI"}
              </Txt>
              <Txt size={24} bold style={{ fontVariant: ["tabular-nums"] }}>
                {money(action.amount)}
              </Txt>
              <Txt size={15} color={c.textSecondary}>
                {action.note}
              </Txt>
            </Card>
            <Section title="Phương thức" />
            <View style={s.wrap}>
              {PAY_METHODS.map((m) => (
                <Chip
                  key={m.value}
                  label={m.label}
                  selected={method === m.value}
                  onPress={() => setMethod(m.value)}
                />
              ))}
            </View>
          </>
        ) : (
          <Empty
            icon={ReceiptText}
            title="Không còn khoản cần trả ở bước này"
            detail={
              (action?.kind === "none" && action.note) ||
              "Quay lại báo giá để xem số tiền mới nhất."
            }
          />
        )}
        {error ? (
          <Txt size={15} color={c.dangerFg}>
            {error}
          </Txt>
        ) : null}
      </ResourceState>
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
  const map = useLiveTripMap(`/tracking/orders/${asId(id)}/map`);
  const reports = useResource<IHorseReport[]>(
    `/tracking/orders/${asId(id)}/horse-reports`,
  );
  useAutoRefresh(() => {
    timeline.reload();
    reports.reload();
  });
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
          style={{ borderRadius: 16, overflow: "hidden", gap: 4 }}
        >
          <TripMapView
            map={map.data}
            mode="customer"
            compact
            height={160}
            accessibilityLabel={`Bản đồ ${map.data.stops.map((stop) => stop.name).join(" đến ")}`}
          />
          {customerPositionText(map.data) ? (
            <Txt
              size={12}
              color={c.textSecondary}
              style={{ paddingHorizontal: 4 }}
            >
              {customerPositionText(map.data)}
            </Txt>
          ) : null}
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

/** Bản đồ toàn màn của CUS-05: không có tốc độ, GPS hay cảnh báo kỹ thuật. */
export function TrackingMapScreen({ id }: { id: string }) {
  const { colors: c } = useTheme();
  const map = useLiveTripMap(`/tracking/orders/${asId(id)}/map`);
  const view = useRef<TripMapHandle>(null);
  const [fallback, setFallback] = useState(false);
  const data = map.data;
  return (
    <ResourceState resource={map} what="bản đồ" skeleton="map">
      {data ? (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <TripMapView
              ref={view}
              map={data}
              mode="customer"
              onFallbackChange={setFallback}
              accessibilityLabel={`Bản đồ ${data.stops.map((stop) => stop.name).join(" đến ")}`}
            />
            {fallback ? null : (
              <View style={{ position: "absolute", right: 12, top: 12 }}>
                <Button
                  title="Xem toàn tuyến"
                  kind="secondary"
                  onPress={() => view.current?.fit()}
                />
              </View>
            )}
          </View>
          <View
            style={{
              padding: 16,
              gap: 4,
              backgroundColor: c.surface,
              borderTopWidth: 1,
              borderTopColor: c.border,
            }}
          >
            <Txt bold>{customerPositionText(data) ?? "Chưa có vị trí xe"}</Txt>
            <Txt size={15} color={c.textSecondary}>
              {[
                data.remainingKm !== null
                  ? `Còn khoảng ${data.remainingKm.toLocaleString("vi-VN")} km`
                  : null,
                data.position
                  ? `Cập nhật ${dateTime(data.position.asOf)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Txt>
          </View>
        </View>
      ) : null}
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
