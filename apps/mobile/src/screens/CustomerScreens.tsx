import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import {
  CalendarDays,
  ClipboardList,
  HeartPulse,
  PawPrint,
  Plus,
  Truck,
  Wallet,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { uuid } from "expo";
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  Field,
  Row,
  Section,
  Txt,
  s,
  useTheme,
} from "../ui";
import { useResource, useSession } from "../session";
import {
  Empty,
  PrivateImage,
  ResourceState,
  RouteMap,
  WebButton,
} from "../live-ui";
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
  dateTime,
  emptyProfile,
  fromOrder,
  label,
  money,
  orderPayload,
  profilePayload,
  validDate,
} from "../live-domain";
import { messageOf } from "../api/http";
import { API_URL } from "../config";
import { isCountryCode } from "../../../../packages/shared/src/countries";

function OrderCard({ order, go }: { order: Order; go: Navigate }) {
  return (
    <Card>
      <Badge
        label={label(order.status)}
        tone={
          order.status === "IN_TRANSIT"
            ? "brand"
            : order.status === "DELIVERED"
              ? "success"
              : order.status === "NEED_INFO"
                ? "warning"
                : "info"
        }
      />
      <Txt size={24} bold>
        {order.origin_address || "Chưa có điểm đón"} →{" "}
        {order.destination_address || "Chưa có điểm giao"}
      </Txt>
      <Txt>{order.order_code}</Txt>
      <Txt>
        {order.horse_names || `${order.horse_count ?? 0} ngựa`} ·{" "}
        {dateTime(order.desired_departure_date)}
      </Txt>
      <Button
        title={
          order.status === "IN_TRANSIT"
            ? "Theo dõi hành trình"
            : "Xem chi tiết đơn"
        }
        kind="secondary"
        onPress={() =>
          go(order.status === "IN_TRANSIT" ? "tracking" : "order", {
            id: String(order.id),
          })
        }
      />
    </Card>
  );
}
export function CustomerHome({
  go,
  ordersOnly = false,
}: {
  go: Navigate;
  ordersOnly?: boolean;
}) {
  const resource = useResource<Workspace>("/orders/customer-workspace");
  const [filter, setFilter] = useState("Tất cả");
  const all = resource.data?.orders ?? [];
  const visible = all.filter(
    (o) =>
      filter === "Tất cả" ||
      (filter === "Đang chạy"
        ? o.status === "IN_TRANSIT"
        : filter === "Đã xong"
          ? ["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status)
          : !["IN_TRANSIT", "DELIVERED", "CANCELLED", "REJECTED"].includes(
              o.status,
            )),
  );
  const running = all.filter((o) => o.status === "IN_TRANSIT");
  return (
    <ResourceState resource={resource}>
      {ordersOnly ? (
        <>
          <View style={s.wrap}>
            {["Tất cả", "Đang xử lý", "Đang chạy", "Đã xong"].map((value) => (
              <Chip
                key={value}
                label={value}
                selected={value === filter}
                onPress={() => setFilter(value)}
              />
            ))}
          </View>
          {visible.length ? (
            visible.map((order) => (
              <OrderCard key={order.id} order={order} go={go} />
            ))
          ) : (
            <Empty title="Chưa có đơn trong nhóm này" />
          )}
        </>
      ) : (
        <>
          <Section title="Hành trình đang diễn ra" />
          {running.length ? (
            running.map((order) => (
              <OrderCard key={order.id} order={order} go={go} />
            ))
          ) : (
            <Empty
              title="Chưa có chuyến đang chạy"
              detail="Chuyến sẽ xuất hiện khi đơn của bạn bắt đầu vận chuyển."
            />
          )}
          <Section title="Cần bạn xử lý" />
          {all
            .filter((o) =>
              ["DRAFT", "NEED_INFO", "APPROVED"].includes(o.status),
            )
            .map((order) => (
              <Row
                key={order.id}
                icon={ClipboardList}
                title={order.order_code}
                detail={label(order.status)}
                onPress={() => go("order", { id: String(order.id) })}
              />
            ))}
          {(resource.data?.horses ?? [])
            .filter((h) => Number(h.missing_documents) > 0)
            .map((h) => (
              <Row
                key={`${h.order_id}-${h.id}`}
                icon={ClipboardList}
                danger
                title={h.name}
                detail={`${h.order_code} · ${h.missing_documents} giấy tờ cần bổ sung`}
                onPress={() => go("documents", { id: String(h.order_id) })}
              />
            ))}
          <Section
            title="Đơn gần đây"
            action="Xem tất cả"
            onPress={() => go("orders")}
          />
          {all.slice(0, 3).map((order) => (
            <Row
              key={order.id}
              title={order.order_code}
              detail={label(order.status)}
              icon={Truck}
              onPress={() => go("order", { id: String(order.id) })}
            />
          ))}
        </>
      )}
      <Button
        title="Tạo yêu cầu vận chuyển"
        icon={Plus}
        onPress={() => go("booking")}
      />
    </ResourceState>
  );
}
export function OrderScreen({
  id,
  go,
  documents = false,
}: {
  id: string;
  go: Navigate;
  documents?: boolean;
}) {
  const resource = useResource<OrderDetail>(`/orders/${asId(id)}`);
  const order = resource.data;
  return (
    <ResourceState resource={resource}>
      {order ? (
        <>
          <Badge label={label(order.status)} />
          <Txt size={24} bold>
            {order.order_code}
          </Txt>
          {order.manager_note ? (
            <Banner warning text={order.manager_note} />
          ) : null}
          {documents ? (
            <>
              {order.documents.length ? (
                order.documents.map((d) => (
                  <Row
                    key={d.id}
                    title={`${d.horse_name} · ${d.document_name}`}
                    detail={label(d.status)}
                    icon={ClipboardList}
                    danger={["INVALID", "EXPIRED", "NOT_SUBMITTED"].includes(
                      d.status,
                    )}
                  />
                ))
              ) : (
                <Empty title="Chưa có giấy tờ của đơn" />
              )}
              <WebButton orderId={id} documents />
            </>
          ) : (
            <>
              <Card>
                <Row
                  title={order.origin_address || "Chưa cập nhật"}
                  detail={`Điểm đón · ${order.origin_country || ""}`}
                />
                <Row
                  title={order.destination_address || "Chưa cập nhật"}
                  detail={`Điểm giao · ${order.destination_country || ""}`}
                />
                <Row
                  title={dateTime(order.desired_departure_date)}
                  detail="Ngày khởi hành"
                  icon={CalendarDays}
                />
              </Card>
              <Section title="Ngựa trong đơn" />
              {(order.draft?.horses ?? order.horses).map((h, i) => (
                <Row
                  key={h.id ?? i}
                  title={h.name || "Chưa nhập tên"}
                  detail={h.breed || "Chưa có giống ngựa"}
                  icon={PawPrint}
                />
              ))}
              {order.special_requirements ? (
                <Txt>{order.special_requirements}</Txt>
              ) : null}
              <Button
                title="Xem báo giá và thanh toán"
                kind="secondary"
                icon={Wallet}
                onPress={() => go("quote", { id })}
              />
              <Button
                title="Xem giấy tờ"
                kind="secondary"
                onPress={() => go("documents", { id })}
              />
              {["DRAFT", "NEED_INFO"].includes(order.status) ? (
                <Button
                  title="Sửa và gửi yêu cầu"
                  onPress={() => go("booking", { id })}
                />
              ) : (
                <Button
                  title="Theo dõi hành trình"
                  onPress={() => go("tracking", { id })}
                />
              )}
            </>
          )}
        </>
      ) : null}
    </ResourceState>
  );
}
export function QuoteScreen({ id }: { id: string }) {
  const resource = useResource<Quote | null>(`/orders/${asId(id)}/quote`);
  const quote = resource.data;
  const { colors: c } = useTheme();
  return (
    <ResourceState resource={resource}>
      {quote ? (
        <>
          <Txt size={24} bold>
            {money(quote.total)}
          </Txt>
          <Txt>Hạn báo giá: {dateTime(quote.expires_at)}</Txt>
          <Card>
            {[
              ...quote.items.map((item) => [item.label, money(item.amount)]),
              ["Điều chỉnh", money(quote.adjustment)],
              [`VAT ${quote.vat_percent}%`, money(quote.vat_amount)],
              ["Tổng cộng", money(quote.total)],
              [`Đặt cọc ${quote.deposit_percent}%`, money(quote.deposit)],
              ["Đã thanh toán", money(quote.paid)],
              [
                "Còn lại",
                money(Math.max(0, Number(quote.total) - Number(quote.paid))),
              ],
            ].map(([title, amount], index) => (
              <View
                key={`${title}-${index}`}
                style={{
                  flexDirection: "row",
                  gap: 12,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: c.border,
                }}
              >
                <Txt style={{ flex: 1 }}>{title}</Txt>
                <Txt
                  bold
                  style={{
                    flexShrink: 1,
                    textAlign: "right",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {amount}
                </Txt>
              </View>
            ))}
          </Card>
          {quote.adjustment_reason ? (
            <Txt>{quote.adjustment_reason}</Txt>
          ) : null}
          <Section title="Giao dịch đã ghi nhận" />
          {quote.receipts.map((receipt) => (
            <Row
              key={receipt.id}
              title={money(receipt.amount)}
              detail={`${dateTime(receipt.received_at)} · ${receipt.reference || ""}`}
              icon={Wallet}
            />
          ))}
          <WebButton orderId={id} title="Thanh toán trên web" />
        </>
      ) : (
        <Empty
          title="Chưa có báo giá được duyệt"
          detail="Báo giá sẽ xuất hiện khi người quản lý phê duyệt."
        />
      )}
    </ResourceState>
  );
}
export function TrackingScreen({ id, go }: { id: string; go: Navigate }) {
  const timeline = useResource<IOrderTimeline>(
    `/tracking/orders/${asId(id)}/timeline`,
  );
  const map = useResource<ITripMap>(`/tracking/orders/${asId(id)}/map`);
  const reports = useResource<IHorseReport[]>(
    `/tracking/orders/${asId(id)}/horse-reports`,
  );
  return (
    <>
      <ResourceState resource={timeline}>
        {timeline.data ? (
          <>
            <Badge label={label(timeline.data.orderStatus)} />
            <Txt size={24} bold>
              {timeline.data.orderCode}
            </Txt>
            {!timeline.data.legs.length ? (
              <Empty title="Chưa có lộ trình được duyệt" />
            ) : (
              timeline.data.legs.map((leg) => (
                <Card key={leg.seqNo}>
                  <Txt bold>
                    {leg.fromLocationName} → {leg.toLocationName}
                  </Txt>
                  <Badge
                    label={label(leg.status)}
                    tone={leg.isOverdue ? "warning" : "info"}
                  />
                  <Txt>Dự kiến đến: {dateTime(leg.plannedArrivalAt)}</Txt>
                  {leg.isOverdue ? (
                    <Banner warning text="Chặng đã quá giờ đến dự kiến." />
                  ) : null}
                  {leg.milestones.map((m, i) => (
                    <Row
                      key={i}
                      title={label(m.milestoneType)}
                      detail={dateTime(m.occurredAt)}
                    />
                  ))}
                  {leg.waypointCheckins.map((check) => (
                    <Row
                      key={check.waypointId}
                      title={check.label}
                      detail={`Đã đến · ${dateTime(check.occurredAt)}`}
                    />
                  ))}
                </Card>
              ))
            )}
          </>
        ) : null}
      </ResourceState>
      <ResourceState resource={map}>
        {map.data ? <RouteMap map={map.data} /> : null}
      </ResourceState>
      <Section title="Báo cáo sức khỏe" />
      <ResourceState resource={reports}>
        {reports.data?.length ? (
          reports.data.map((report) => (
            <Row
              key={report.id}
              title={`${report.horseName} · ${label(report.conditionStatus)}`}
              detail={dateTime(report.sentAt)}
              icon={HeartPulse}
              onPress={() => go("health", { id: report.id, orderId: id })}
            />
          ))
        ) : (
          <Empty title="Chưa có báo cáo gửi cho bạn" />
        )}
      </ResourceState>
    </>
  );
}
export function HealthScreen({ id, orderId }: { id: string; orderId: string }) {
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
  return (
    <ResourceState resource={resource}>
      {report ? (
        <>
          <Txt size={24} bold>
            {report.horseName}
          </Txt>
          <Badge
            label={label(report.conditionStatus)}
            tone={report.conditionStatus === "STABLE" ? "success" : "warning"}
          />
          <Txt>
            {report.escortName} · {dateTime(report.sentAt)}
          </Txt>
          <Card>
            <Row
              title={
                report.bodyTempC !== null ? `${report.bodyTempC} °C` : "Chưa đo"
              }
              detail="Nhiệt độ"
              icon={HeartPulse}
            />
            <Row
              title={
                report.heartRateBpm !== null
                  ? `${report.heartRateBpm} nhịp/phút`
                  : "Chưa đo"
              }
              detail="Nhịp tim"
              icon={HeartPulse}
            />
            <Row
              title={label(report.appetite)}
              detail="Ăn uống"
              icon={PawPrint}
            />
          </Card>
          {report.customerNote ? <Txt>{report.customerNote}</Txt> : null}
          {report.photos.map((photo) => (
            <PrivateImage
              key={photo.id}
              path={`/tracking/attachments/${asId(photo.id)}`}
              caption={photo.caption || report.horseName}
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
        <Empty title="Không tìm thấy báo cáo" />
      )}
    </ResourceState>
  );
}
export function ProfilesScreen({ go, id }: { go: Navigate; id?: string }) {
  const resource = useResource<Profile[]>("/customer/profiles");
  const { colors: c } = useTheme();
  const horse = id
    ? resource.data?.find((h) => String(h.id) === id)
    : undefined;
  return (
    <ResourceState resource={resource}>
      {id ? (
        horse ? (
          <>
            <Txt size={32} bold>
              {horse.name}
            </Txt>
            <Txt>{horse.breed || "Chưa cập nhật giống"}</Txt>
            <Badge
              label={
                horse.activeOrderId
                  ? `Đang trên đơn ${horse.activeOrderCode}`
                  : "Có thể đặt vận chuyển"
              }
              tone={horse.activeOrderId ? "info" : "success"}
            />
            {horse.files
              .filter((f) => f.kind === "PHOTO")
              .map((f) => (
                <PrivateImage
                  key={f.id}
                  path={`/customer/files/${asId(f.id)}`}
                  caption={horse.name}
                />
              ))}
            <Card>
              <Row
                title={horse.passportNo || "Chưa cập nhật"}
                detail="Số hộ chiếu"
                icon={ClipboardList}
              />
              <Row
                title={horse.sex || "Chưa rõ"}
                detail="Giới tính"
                icon={PawPrint}
              />
              <Row
                title={horse.birthDate || "Chưa cập nhật"}
                detail="Ngày sinh"
                icon={CalendarDays}
              />
              <Row
                title={
                  horse.weightKg === null
                    ? "Chưa cập nhật"
                    : `${horse.weightKg} kg`
                }
                detail="Cân nặng"
                icon={PawPrint}
              />
            </Card>
            {horse.feed ? <Txt>Khẩu phần: {horse.feed}</Txt> : null}
            {horse.note ? <Txt>{horse.note}</Txt> : null}
            <Button
              title="Chỉnh sửa hồ sơ"
              kind="secondary"
              onPress={() => go("horse-form", { id })}
            />
            <Button
              title={
                horse.activeOrderId
                  ? "Ngựa đang trên đơn khác"
                  : "Đặt vận chuyển"
              }
              disabled={!!horse.activeOrderId}
              onPress={() => go("booking", { horseId: id })}
            />
          </>
        ) : (
          <Empty
            title="Hồ sơ không có trong danh sách hiện tại"
            detail="Ngựa đang vận chuyển có thể được ẩn khỏi danh sách hồ sơ. Xem ngựa trong chi tiết đơn."
          />
        )
      ) : (
        <>
          <Txt color={c.textSecondary}>
            {resource.data?.length ?? 0} hồ sơ ngựa
          </Txt>
          {resource.data?.length ? (
            resource.data.map((h) => (
              <Row
                key={h.id}
                title={h.name}
                detail={`${h.breed || "Chưa rõ giống"}${h.activeOrderId ? ` · Đơn ${h.activeOrderCode}` : ""}`}
                icon={PawPrint}
                onPress={() => go("horse", { id: String(h.id) })}
              />
            ))
          ) : (
            <Empty title="Bạn chưa có hồ sơ ngựa" />
          )}
          <Button
            title="Thêm hồ sơ ngựa"
            icon={Plus}
            onPress={() => go("horse-form")}
          />
        </>
      )}
    </ResourceState>
  );
}
export function ProfileFormScreen({ id, go }: { id?: string; go: Navigate }) {
  const resource = useResource<Profile[]>(id ? "/customer/profiles" : null);
  if (!id) return <ProfileForm go={go} />;
  const profile = resource.data?.find((h) => String(h.id) === id);
  return (
    <ResourceState resource={resource}>
      {profile ? (
        <ProfileForm key={profile.id} initial={profile} go={go} />
      ) : (
        <Empty title="Không tìm thấy hồ sơ để chỉnh sửa" />
      )}
    </ResourceState>
  );
}
function ProfileForm({ initial, go }: { initial?: Profile; go: Navigate }) {
  const { request, user, write, writing, refresh } = useSession();
  const [form, setForm] = useState<ProfileInput>(() =>
    initial
      ? profilePayload(initial)
      : { ...emptyProfile, ownerName: user?.fullName || "" },
  );
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
        refresh();
        go("horse", { id: String(result.id) });
      });
    } catch (e) {
      setError(messageOf(e));
    }
  };
  return (
    <>
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
      />
      <Txt size={12}>
        Hộ chiếu không bắt buộc khi lưu hồ sơ nhưng cần có trước khi gửi yêu cầu
        vận chuyển.
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
      <Field
        label="Ngày sinh (YYYY-MM-DD)"
        value={form.birthDate}
        onChangeText={(birthDate) => patch({ birthDate })}
        maxLength={10}
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
    </>
  );
}

type StoredOrderDraft = {
  requestId: string;
  savedId?: string;
  selected: string[];
  payload: OrderPayload;
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
export function BookingScreen({ page, go }: { page: Page; go: Navigate }) {
  const profiles = useResource<Profile[]>("/customer/profiles");
  const order = useResource<OrderDetail>(
    page.id ? `/orders/${asId(page.id)}` : null,
  );
  return (
    <ResourceState resource={profiles}>
      {page.id ? (
        <ResourceState resource={order}>
          {order.data ? (
            <BookingForm
              go={go}
              profiles={profiles.data ?? []}
              initialOrder={order.data}
            />
          ) : null}
        </ResourceState>
      ) : (
        <BookingForm
          go={go}
          profiles={profiles.data ?? []}
          selectedHorse={page.horseId}
        />
      )}
    </ResourceState>
  );
}
function BookingForm({
  profiles,
  initialOrder,
  selectedHorse,
  go,
}: {
  profiles: Profile[];
  initialOrder?: OrderDetail;
  selectedHorse?: string;
  go: Navigate;
}) {
  const { user, request, write, writing, refresh } = useSession();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<StoredOrderDraft>(() => ({
    requestId: uuid.v4(),
    savedId: initialOrder?.id,
    selected: selectedHorse ? [selectedHorse] : [],
    payload: initialOrder ? fromOrder(initialOrder) : blankPayload,
    step: 1,
  }));
  const key = `horseroute.booking.v2:${API_URL}:${user!.id}:${initialOrder?.id ?? "new"}`;
  const chain = useRef(Promise.resolve());
  const finished = useRef(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!active || !raw) return;
        const data = JSON.parse(raw) as StoredOrderDraft;
        if (!data.requestId || !data.payload || !Array.isArray(data.selected))
          throw new Error("Nháp không hợp lệ.");
        setDraft({
          ...data,
          selected: selectedHorse ? [selectedHorse] : data.selected,
        });
      })
      .catch(() => {
        if (active)
          setError(
            "Không đọc được nháp trên thiết bị. Đang dùng nội dung từ máy chủ hoặc biểu mẫu trống.",
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
          "Không lưu được nháp trên thiết bị. Giữ ứng dụng mở trước khi gửi.",
        ),
      );
  }, [draft, key, ready]);
  const patch = (value: Partial<OrderPayload>) =>
    setDraft((d) => ({ ...d, payload: { ...d.payload, ...value } }));
  const validate = (step: number) => {
    if (
      step === 1 &&
      (initialOrder ? !draft.payload.horses.length : !draft.selected.length)
    )
      throw new Error("Chọn ít nhất một ngựa.");
    if (step === 2) {
      const p = draft.payload;
      if (!p.originAddress.trim() || !p.destinationAddress.trim())
        throw new Error("Nhập điểm đón và điểm giao.");
      if (
        !isCountryCode(p.originCountry) ||
        !isCountryCode(p.destinationCountry)
      )
        throw new Error("Nhập mã quốc gia ISO hợp lệ, ví dụ VN, KH, TH.");
      if (
        !validDate(p.desiredDepartureDate) ||
        p.desiredDepartureDate < new Date().toISOString().slice(0, 10)
      )
        throw new Error("Ngày khởi hành không hợp lệ hoặc ở quá khứ.");
    }
  };
  const submit = async () => {
    setError("");
    try {
      await write(async () => {
        validate(1);
        validate(2);
        await chain.current;
        const payload = initialOrder
          ? draft.payload
          : orderPayload(draft.payload, draft.selected, profiles);
        // Persist the idempotency key before the first write; never manufacture a local order ID.
        await AsyncStorage.setItem(key, JSON.stringify(draft));
        let savedId = draft.savedId;
        if (!savedId) {
          const result = await request<{ id: string }>("/orders", {
            method: "POST",
            body: { ...payload, requestId: draft.requestId },
          });
          savedId = String(result.id);
        }
        const checkpoint = { ...draft, savedId };
        await AsyncStorage.setItem(key, JSON.stringify(checkpoint));
        setDraft(checkpoint);
        const current = await request<OrderDetail>(`/orders/${asId(savedId)}`);
        if (["DRAFT", "NEED_INFO"].includes(current.status)) {
          await request(`/orders/${asId(savedId)}`, {
            method: "PUT",
            body: payload,
          });
          await request(`/orders/${asId(savedId)}/submit`, { method: "POST" });
        } else if (current.status !== "PENDING")
          throw new Error(
            `Đơn đã chuyển sang ${label(current.status)}. Mở danh sách đơn để kiểm tra.`,
          );
        finished.current = true;
        await chain.current;
        await AsyncStorage.removeItem(key);
        refresh();
        go("order", { id: savedId });
      });
    } catch (e) {
      setError(messageOf(e));
    }
  };
  if (!ready) return <Txt>Đang khôi phục nháp…</Txt>;
  const step = draft.step;
  return (
    <>
      <Txt size={12} bold>
        BƯỚC {step}/4 · NHÁP LƯU RIÊNG CHO TÀI KHOẢN
      </Txt>
      <View style={s.wrap}>
        {[1, 2, 3, 4].map((n) => (
          <Chip
            key={n}
            label={String(n)}
            selected={step === n}
            disabled={writing}
            onPress={() => {
              try {
                if (n > step) validate(step);
                setError("");
                setDraft((d) => ({ ...d, step: n }));
              } catch (e) {
                setError(messageOf(e));
              }
            }}
          />
        ))}
      </View>
      <Txt size={24} bold>
        {["Chọn ngựa", "Tuyến và ngày", "Ghi chú", "Xem lại yêu cầu"][step - 1]}
      </Txt>
      {step === 1 ? (
        initialOrder ? (
          <>
            {draft.payload.horses.map((h, i) => (
              <Row
                key={h.id ?? i}
                title={h.name}
                detail={h.passportNo}
                icon={PawPrint}
              />
            ))}
            <Txt>
              Danh sách ngựa được giữ từ đơn hiện tại. Đổi ngựa trong đơn trên
              website.
            </Txt>
          </>
        ) : (
          <>
            {[...profiles]
              .sort(
                (a, b) => Number(!!a.activeOrderId) - Number(!!b.activeOrderId),
              )
              .map((h) => (
                <View key={h.id} style={{ gap: 4 }}>
                  <Chip
                    label={h.name}
                    selected={draft.selected.includes(String(h.id))}
                    disabled={!!h.activeOrderId || writing}
                    onPress={() =>
                      setDraft((d) => ({
                        ...d,
                        selected: d.selected.includes(String(h.id))
                          ? d.selected.filter((v) => v !== String(h.id))
                          : [...d.selected, String(h.id)],
                      }))
                    }
                  />
                  <Txt size={12}>
                    {h.activeOrderId
                      ? `Đang trên đơn ${h.activeOrderCode}`
                      : h.passportNo
                        ? `Hộ chiếu ${h.passportNo}`
                        : "Cần bổ sung hộ chiếu trước khi gửi đơn"}
                  </Txt>
                </View>
              ))}
            {!profiles.length ? (
              <Empty
                title="Chưa có ngựa có thể chọn"
                detail="Thêm hồ sơ ngựa trước khi đặt vận chuyển."
              />
            ) : null}
          </>
        )
      ) : null}
      {step === 2 ? (
        <>
          <Field
            label="Điểm đón *"
            value={draft.payload.originAddress}
            onChangeText={(originAddress) => patch({ originAddress })}
            maxLength={255}
          />
          <Field
            label="Quốc gia đón (VN, KH, TH…) *"
            value={draft.payload.originCountry}
            autoCapitalize="characters"
            onChangeText={(v) => patch({ originCountry: v.toUpperCase() })}
            maxLength={2}
          />
          <Field
            label="Điểm giao *"
            value={draft.payload.destinationAddress}
            onChangeText={(destinationAddress) => patch({ destinationAddress })}
            maxLength={255}
          />
          <Field
            label="Quốc gia giao *"
            value={draft.payload.destinationCountry}
            autoCapitalize="characters"
            onChangeText={(v) => patch({ destinationCountry: v.toUpperCase() })}
            maxLength={2}
          />
          <Field
            label="Ngày khởi hành (YYYY-MM-DD) *"
            value={draft.payload.desiredDepartureDate}
            onChangeText={(desiredDepartureDate) =>
              patch({ desiredDepartureDate })
            }
            maxLength={10}
          />
        </>
      ) : null}
      {step === 3 ? (
        <Field
          label="Yêu cầu đặc biệt (không bắt buộc)"
          multiline
          maxLength={5000}
          value={draft.payload.specialRequirements}
          onChangeText={(specialRequirements) => patch({ specialRequirements })}
        />
      ) : null}
      {step === 4 ? (
        <Card>
          <Row
            title={draft.payload.originAddress}
            detail={draft.payload.originCountry}
          />
          <Row
            title={draft.payload.destinationAddress}
            detail={draft.payload.destinationCountry}
          />
          <Row
            title={draft.payload.desiredDepartureDate}
            detail="Ngày khởi hành"
            icon={CalendarDays}
          />
          <Row
            title={
              initialOrder
                ? draft.payload.horses.map((h) => h.name).join(", ")
                : profiles
                    .filter((h) => draft.selected.includes(String(h.id)))
                    .map((h) => h.name)
                    .join(", ")
            }
            detail="Ngựa vận chuyển"
            icon={PawPrint}
          />
          <Txt>
            {draft.payload.specialRequirements || "Không có yêu cầu đặc biệt."}
          </Txt>
        </Card>
      ) : null}
      {draft.savedId ? (
        <Banner
          text={`Đơn nháp đã có trên máy chủ: #${draft.savedId}. Gửi lại sẽ dùng đúng đơn này.`}
        />
      ) : null}
      {error ? <Banner warning text={error} /> : null}
      <Button
        title={
          writing
            ? "Đang gửi…"
            : step === 4
              ? "Gửi yêu cầu vận chuyển"
              : "Tiếp tục"
        }
        disabled={writing}
        onPress={() => {
          if (step === 4) void submit();
          else {
            try {
              validate(step);
              setError("");
              setDraft((d) => ({ ...d, step: Math.min(4, step + 1) }));
            } catch (e) {
              setError(messageOf(e));
            }
          }
        }}
      />
    </>
  );
}
