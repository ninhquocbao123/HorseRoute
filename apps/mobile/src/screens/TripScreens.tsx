import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  CircleCheck,
  ClipboardCheck,
  Clock,
  CloudCheck,
  CloudOff,
  Map as MapIcon,
  MapPin,
  PawPrint,
  Plus,
  RefreshCw,
  TriangleAlert,
  Truck,
} from "lucide-react-native";
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  DateField,
  Field,
  Row,
  ScreenBody,
  Section,
  StatusBadge,
  Timeline,
  Txt,
  s,
  useTheme,
} from "../ui";
import { horseCondition, syncStatus } from "../theme";
import { Sheet, useOverlay } from "../overlay";
import { useResource, useSession } from "../session";
import { Contact, Empty } from "../live-ui";
import { AbnormalSheet, QuickLogSheet, lastCare } from "./CrewWork";
import {
  BACKFILL_MS,
  CONTINUE_ANYWAY,
  applyPending,
  asId,
  checks,
  driverAction,
  label,
  nextStop,
  pastClock,
  tripTimeline,
  type DriverAction,
} from "../live-domain";
import {
  cancel,
  enqueue,
  retry,
  sendNow,
  timeOf,
  updateTime,
  useOnline,
  useQueue,
  useTripProgress,
  type QueueItem,
} from "../queue";
import {
  readGpsState,
  requestGps,
  startTripTracking,
  stopTripTracking,
  useGpsState,
  type GpsState,
} from "../gps";
import { API_URL } from "../config";
import type {
  ICareActivityList,
  IDriverTripDetail,
  IHorseLog,
  ITripMap,
  Navigate,
} from "../api/types";

const clock = (iso: string | null | undefined) =>
  iso && Number.isFinite(Date.parse(iso))
    ? new Date(iso).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";
const duration = (ms: number) => {
  const minutes = Math.round(ms / 60000);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`
    : `${minutes} phút`;
};
/** Chỉ hỏi quyền vị trí một lần mỗi chuyến trước khi xuất phát. */
const askedGps = new Set<string>();

function GpsBanner({ state, go }: { state: GpsState; go: Navigate }) {
  if (state === "background" || state === "unknown") return null;
  return (
    <Banner
      warning
      text={
        state === "services-off"
          ? "Định vị của máy đang tắt. Bật định vị để điều phối thấy xe."
          : state === "denied"
            ? "App chưa có quyền vị trí. Điều phối không thấy xe."
            : 'Vị trí chỉ gửi khi đang mở app. Chọn "Luôn cho phép" để gửi cả khi tắt màn hình.'
      }
      onPress={() => go("location")}
    />
  );
}

/** DRV-02 Chuyến của tài xế: một nút hành động theo ngữ cảnh ở đáy, mốc điểm dừng có Hoàn tác 5 giây. */
export function DriverTrip({
  trip: serverTrip,
  map,
  mapFailed = false,
  go,
  reload,
}: {
  trip: IDriverTripDetail;
  map: ITripMap | null;
  /** Chưa từng tải được bản đồ (không có bản lưu). */
  mapFailed?: boolean;
  go: Navigate;
  reload: () => void;
}) {
  const { colors: c } = useTheme();
  const { user, refresh } = useSession();
  const { undo, notify } = useOverlay();
  const queue = useQueue(serverTrip.id);
  const progress = useTripProgress(serverTrip.id);
  const trip = useMemo(
    () => applyPending(serverTrip, progress),
    [serverTrip, progress],
  );
  const running = trip.orderStatus === "IN_TRANSIT";
  const done = trip.orderStatus === "DELIVERED";
  const gps = useGpsState(running);
  const action = driverAction(trip, map);
  const stop = nextStop(trip, map);
  const [confirm, setConfirm] = useState<DriverAction | null>(null);
  const [when, setWhen] = useState(new Date());
  const [checked, setChecked] = useState<string[] | null>(null);
  const checklistKey = `horseroute.checklist:${API_URL}:${user!.id}:${trip.id}`;

  useEffect(() => {
    void AsyncStorage.getItem(checklistKey)
      .then((raw) => {
        const value: string[] = raw ? JSON.parse(raw) : [];
        // "Vẫn tiếp tục" ở checklist: coi như đã xong.
        setChecked(value.includes(CONTINUE_ANYWAY) ? [...checks] : value);
      })
      .catch(() => setChecked([]));
  }, [checklistKey, serverTrip]);
  useEffect(() => {
    if (running) void startTripTracking(trip.id).then(gps.refresh);
    if (done) void stopTripTracking(trip.id);
  }, [running, done, trip.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Màn sáng khi chuyến chạy: tài xế liếc khi dừng đèn đỏ.
    if (!running) return;
    void activateKeepAwakeAsync("trip").catch(() => {});
    return () => {
      void deactivateKeepAwake("trip");
    };
  }, [running]);

  const tooOld = Date.now() - when.getTime() > BACKFILL_MS;
  const record = (a: DriverAction, at: Date) => {
    const occurredAt = (
      at.getTime() > Date.now() ? new Date() : at
    ).toISOString();
    setConfirm(null);
    const id = enqueue({
      tripId: trip.id,
      kind: a.kind,
      label: `${a.label} · ${clock(occurredAt)}`,
      path: a.path,
      body: { ...a.body, occurredAt },
      timeField: "occurredAt",
      legId: a.legId,
      milestoneType: a.body.milestoneType,
      waypointId: a.waypointId,
      delayMs: 5500,
    });
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    undo({
      message: `Đã ghi: ${a.label}`,
      onUndo: () => {
        cancel(id);
      },
      onExpire: () => sendNow(id),
    });
    if (a.body.milestoneType === "DELIVERED") {
      void stopTripTracking(trip.id);
      notify(
        `Đã giao ${trip.horses.length} ngựa lúc ${clock(occurredAt)}`,
        "Đã tắt gửi vị trí. Cảm ơn bạn.",
      );
    }
  };
  const press = async (a: DriverAction) => {
    if (a.needsChecklist && checked && checked.length < checks.length) {
      go("checklist", { tripId: trip.id });
      return;
    }
    if (a.needsChecklist && !askedGps.has(trip.id)) {
      // F-D2: xin vị trí "Luôn cho phép" trước khi xuất phát; từ chối vẫn cho đi, banner nhắc sau.
      askedGps.add(trip.id);
      if ((await readGpsState()) !== "background") {
        go("location", { tripId: trip.id });
        return;
      }
    }
    if (a.confirm) {
      setWhen(new Date());
      setConfirm(a);
    } else record(a, new Date());
  };

  const eta = stop?.at ?? null;
  const late = eta ? Date.now() - Date.parse(eta) : 0;
  const lastLeg = [...trip.legs].sort((a, b) => b.seqNo - a.seqNo)[0];
  const atDelivery =
    lastLeg &&
    (lastLeg.status === "AT_STOP" ||
      (lastLeg.status === "MOVING" && action?.kind !== "checkin"));
  const deliveredAt = lastLeg?.milestones.find(
    (m) => m.milestoneType === "DELIVERED",
  )?.occurredAt;

  const footer = done ? undefined : (
    <>
      <Button
        title="Báo sự cố"
        kind="danger"
        icon={TriangleAlert}
        onPress={() => go("incident-form", { tripId: trip.id })}
      />
      {!action && mapFailed && running ? (
        // Chuyến một chặng cần bản đồ để biết điểm dừng tiếp theo.
        <Button
          title="Tải lại bản đồ lộ trình"
          icon={RefreshCw}
          large
          hint="Cần bản đồ để biết điểm dừng tiếp theo"
          onPress={reload}
        />
      ) : !action ? (
        <Button
          title={
            trip.orderStatus === "READY" || running
              ? "Chờ dữ liệu lộ trình"
              : "Chưa đến giờ: chờ điều phối báo sẵn sàng"
          }
          large
          disabled
          onPress={() => {}}
        />
      ) : action.needsChecklist && checked && checked.length < checks.length ? (
        <Button
          title="Kiểm tra trước khi đi"
          icon={ClipboardCheck}
          large
          onPress={() => go("checklist", { tripId: trip.id })}
        />
      ) : (
        <>
          <Button
            title={action.label}
            large
            hint={
              action.confirm
                ? "Mở hộp xác nhận giờ ghi mốc"
                : "Ghi ngay, có 5 giây để hoàn tác"
            }
            onPress={() => void press(action)}
          />
          {!action.confirm ? (
            <Button
              title="Ghi với giờ khác"
              kind="tertiary"
              icon={Clock}
              hint="Dùng khi quên ghi lúc đến hoặc rời"
              onPress={() => {
                setWhen(new Date());
                setConfirm(action);
              }}
            />
          ) : null}
        </>
      )}
    </>
  );

  const timeline = tripTimeline(trip, map, clock);
  const earlierDay = when.toDateString() !== new Date().toDateString();
  return (
    <ScreenBody
      footer={footer}
      onRefresh={() => {
        reload();
        refresh();
      }}
    >
      {running ? <GpsBanner state={gps.state} go={go} /> : null}
      {!action && mapFailed && running ? (
        <Banner
          warning
          text="Chưa tải được bản đồ lộ trình nên chưa biết điểm dừng tiếp theo. Có sóng là bấm Tải lại; trong lúc chờ, gọi điều phối nếu cần ghi mốc."
          onPress={reload}
        />
      ) : null}
      {queue.some((i) => i.status === "REJECTED") ? (
        <Banner
          warning
          text="Có mục máy chủ không nhận. Mở Hàng chờ gửi để sửa giờ hoặc bỏ."
          onPress={() => go("queue")}
        />
      ) : null}
      {done ? (
        <Card brand>
          <CircleCheck size={32} color={c.onBrand} />
          <Txt size={24} bold color={c.onBrand}>
            {`Đã giao ${trip.horses.length} ngựa${deliveredAt ? ` lúc ${clock(deliveredAt)}` : ""}`}
          </Txt>
          <Txt color={c.onBrandMuted}>
            {`${trip.orderCode} · ${lastLeg?.toLocationName ?? ""}${
              trip.recipient ? ` · Người nhận: ${trip.recipient.name}` : ""
            }`}
          </Txt>
          <Txt color={c.onBrandMuted}>
            {queue.length
              ? `Đã tắt gửi vị trí. Còn ${queue.length} mục chờ gửi, app tự gửi khi có sóng.`
              : "Đã tắt gửi vị trí. Mọi mốc đã gửi xong."}
          </Txt>
        </Card>
      ) : (
        <Card brand>
          <Txt size={12} bold color={c.onBrandMuted}>
            {`${stop?.caption ?? "CHUYẾN"} · ${trip.orderCode}`}
          </Txt>
          <Txt size={24} bold color={c.onBrand}>
            {stop?.name ?? "Chưa có lộ trình"}
          </Txt>
          {eta ? (
            <View style={[s.wrap, { alignItems: "center" }]}>
              <Txt size={24} bold color={c.onBrand}>
                {clock(eta)}
              </Txt>
              {late > 60000 ? (
                <Badge label={`Trễ ${duration(late)}`} tone="warning" />
              ) : (
                <Badge label="Đúng giờ" tone="success" />
              )}
            </View>
          ) : null}
          {eta ? (
            <Txt size={15} color={c.onBrandMuted}>
              {stop?.atLabel}
            </Txt>
          ) : null}
        </Card>
      )}
      {atDelivery && !done && trip.recipient ? (
        <Card>
          <Contact
            name={`Người nhận: ${trip.recipient.name}`}
            phone={trip.recipient.phone}
          />
        </Card>
      ) : null}
      <Button
        title="Mở bản đồ chuyến"
        kind="secondary"
        icon={MapIcon}
        onPress={() => go("crew-map", { tripId: trip.id })}
      />
      <Section title="Lộ trình" />
      <Card>
        <Timeline active={timeline.active} stops={timeline.stops} />
      </Card>
      <Section title="Liên hệ" />
      <Card>
        {trip.coordinator ? (
          <Contact
            name={`Điều phối: ${trip.coordinator.name}`}
            phone={trip.coordinator.phone}
          />
        ) : null}
        {trip.crew
          .filter((m) => m.role === "ESCORT")
          .map((m) => (
            <Contact
              key={m.userId}
              name={`Hộ tống: ${m.name}`}
              phone={m.phone}
            />
          ))}
        {trip.emergencyHotline ? (
          <Contact name="Cứu hộ 24/7" phone={trip.emergencyHotline} />
        ) : null}
      </Card>
      <Section title={`Ngựa trên xe · ${trip.horses.length}`} />
      <Card>
        {trip.horses.map((h) => (
          <Txt key={h.id}>
            {h.name}
            <Txt size={15} color={c.textSecondary}>
              {`  ${[h.breed, h.passportNo].filter(Boolean).join(" · ")}`}
            </Txt>
          </Txt>
        ))}
        {trip.vehicles.length ? (
          <Txt size={15} color={c.textSecondary}>
            {`Xe: ${trip.vehicles.map((v) => v.code).join(", ")}`}
          </Txt>
        ) : null}
      </Card>

      {/* DRV-04 Xác nhận mốc: chạm giờ để chọn lại, lùi tối đa 24 giờ. */}
      <Sheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm ? `${confirm.label}?` : ""}
        footer={
          <>
            <Button
              title="Hủy"
              kind="secondary"
              onPress={() => setConfirm(null)}
            />
            <Button
              title="Xác nhận"
              large
              disabled={tooOld}
              onPress={() => confirm && record(confirm, when)}
            />
          </>
        }
      >
        <Txt color={c.textSecondary}>{confirm?.placeName}</Txt>
        <DateField
          label="Giờ ghi"
          mode="time"
          value={when}
          onChange={(d) => setWhen(pastClock(d.getHours(), d.getMinutes()))}
          error={
            tooOld
              ? "Chỉ ghi lùi tối đa 24 giờ. Quá 24 giờ, hãy gọi điều phối để sửa."
              : undefined
          }
          hint={
            earlierDay
              ? `Giờ này là của hôm qua, ngày ${when.toLocaleDateString("vi-VN")}. Sau khi xác nhận có 5 giây để hoàn tác.`
              : "Quên ghi lúc đến? Chạm vào giờ để sửa. Sau khi xác nhận có 5 giây để hoàn tác."
          }
        />
      </Sheet>
    </ScreenBody>
  );
}

/**
 * ESC-02 Ngựa trên chuyến (hướng B): thẻ ngựa gọn, chạm mở ESC-05, chạm giữ mở Báo bất thường;
 * tóm tắt hôm nay và điểm kế tiếp của xe trên thẻ brand; một nút "Ghi nhanh" ở đáy mở ESC-03.
 */
export function EscortTrip({
  trip: serverTrip,
  go,
  reload,
}: {
  trip: IDriverTripDetail;
  go: Navigate;
  reload: () => void;
}) {
  const { colors: c } = useTheme();
  const { refresh } = useSession();
  const queue = useQueue(serverTrip.id);
  const progress = useTripProgress(serverTrip.id);
  const trip = useMemo(
    () => applyPending(serverTrip, progress),
    [serverTrip, progress],
  );
  const care = useResource<ICareActivityList>(
    `/tracking/trips/${asId(trip.id)}/care-activities`,
  );
  const logs = useResource<IHorseLog[]>(
    `/tracking/trips/${asId(trip.id)}/horse-logs`,
  );
  const [abnormal, setAbnormal] = useState<string | null | undefined>(
    undefined,
  );
  const [quickLog, setQuickLog] = useState(false);
  const delivered = trip.orderStatus === "DELIVERED";
  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const since = start.getTime();
    const sum = { water: 0, meals: 0, rests: 0 };
    const add = (type: unknown, liters: unknown, at: unknown) => {
      if (Date.parse(String(at)) < since) return;
      if (type === "WATER") sum.water += Number(liters) || 0;
      if (type === "FEED") sum.meals += 1;
      if (type === "REST") sum.rests += 1;
    };
    for (const a of care.data?.activities ?? [])
      add(a.activityType, a.amountLiters, a.performedAt);
    for (const i of queue)
      if (i.kind === "care")
        add(i.body.activityType, i.body.amountLiters, i.body.performedAt);
    return sum;
  }, [care.data, queue]);
  const stop = nextStop(trip);
  const latest = (horseId: string) =>
    logs.data?.find((l) => String(l.horseId) === horseId) ?? null;
  const pendingFor = (horseId: string) =>
    queue.some((i) => i.horseIds?.includes(horseId));
  return (
    <ScreenBody
      onRefresh={() => {
        reload();
        care.reload();
        logs.reload();
        refresh();
      }}
      footer={
        delivered ? undefined : (
          <Button
            title="Ghi nhanh"
            icon={Plus}
            large
            onPress={() => setQuickLog(true)}
          />
        )
      }
    >
      <Card brand>
        <Txt size={12} bold color={c.onBrandMuted}>
          {`${trip.orderCode} · ${label(trip.orderStatus)}`}
        </Txt>
        {stop && !delivered ? (
          <>
            <Txt size={12} bold color={c.onBrandMuted}>
              {stop.caption}
            </Txt>
            <Txt size={24} bold color={c.onBrand}>
              {stop.name}
            </Txt>
            {stop.at ? (
              <Txt size={15} color={c.onBrandMuted}>
                {`${stop.atLabel} ${clock(stop.at)}`}
              </Txt>
            ) : null}
          </>
        ) : (
          <Txt size={24} bold color={c.onBrand}>
            {delivered ? "Chuyến đã giao" : `${trip.horses.length} ngựa`}
          </Txt>
        )}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: c.onBrandMuted,
          }}
        >
          {[
            [`${Math.round(today.water * 10) / 10} L`, "nước hôm nay"],
            [String(today.meals), "bữa ăn"],
            [String(today.rests), "lần nghỉ"],
          ].map(([value, caption]) => (
            <View key={caption} style={{ flex: 1 }}>
              <Txt size={17} bold color={c.onBrand}>
                {value}
              </Txt>
              <Txt size={12} color={c.onBrandMuted}>
                {caption}
              </Txt>
            </View>
          ))}
        </View>
      </Card>
      <Section title={`${trip.horses.length} ngựa trên chuyến`} />
      {trip.horses.map((h) => {
        const id = String(h.id);
        const log = latest(id);
        const water = lastCare(care.data, queue, id, "WATER");
        const feed =
          lastCare(care.data, queue, id, "FEED") ??
          care.data?.summary.lastFeedAtByHorse[id] ??
          null;
        const thirsty =
          !delivered &&
          trip.orderStatus === "IN_TRANSIT" &&
          (!water || Date.now() - Date.parse(water) > 4 * 3600000);
        return (
          <Card
            key={h.id}
            label={`${h.name}. Chạm để xem chi tiết, chạm giữ để báo bất thường`}
            onPress={() => go("crew-horse", { tripId: trip.id, horseId: id })}
            onLongPress={delivered ? undefined : () => setAbnormal(id)}
          >
            <View
              style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: c.infoBg,
                }}
              >
                <PawPrint size={24} color={c.link} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt bold>{h.name}</Txt>
                {h.breed ? (
                  <Txt size={15} color={c.textSecondary}>
                    {h.breed}
                  </Txt>
                ) : null}
              </View>
            </View>
            <View style={s.wrap}>
              {pendingFor(id) ? <StatusBadge spec={syncStatus.QUEUED} /> : null}
              {log ? (
                <StatusBadge
                  spec={
                    horseCondition[log.conditionStatus] ?? horseCondition.STABLE
                  }
                />
              ) : null}
              {thirsty ? (
                <StatusBadge
                  spec={{
                    label: water ? "4 giờ chưa uống" : "Chưa ghi uống",
                    tone: "brand",
                    icon: "clock",
                  }}
                />
              ) : null}
            </View>
            <Txt size={15} color={c.textSecondary}>
              {`Uống ${water ? clock(water) : "chưa ghi"} · Ăn ${feed ? clock(feed) : "chưa ghi"}`}
            </Txt>
            {!delivered ? (
              <Button
                title="Báo bất thường"
                kind="tertiary"
                icon={TriangleAlert}
                onPress={() => setAbnormal(id)}
              />
            ) : null}
          </Card>
        );
      })}
      {!delivered ? (
        <Button
          title="Báo sự cố chuyến (xe, đường)"
          kind="danger"
          icon={TriangleAlert}
          onPress={() => go("incident-form", { tripId: trip.id })}
        />
      ) : null}
      <QuickLogSheet
        visible={quickLog}
        onClose={() => setQuickLog(false)}
        trip={trip}
      />
      <AbnormalSheet
        trip={trip}
        visible={abnormal !== undefined}
        horseId={abnormal ?? null}
        onClose={() => setAbnormal(undefined)}
        go={go}
      />
    </ScreenBody>
  );
}

/** COM-07 Xin quyền vị trí: câu ngắn, cách bật riêng cho Android. */
export function LocationScreen({ go }: { go: Navigate }) {
  const { colors: c } = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <ScreenBody
      footer={
        <>
          <Button
            title="Tiếp tục"
            large
            disabled={busy}
            onPress={() => {
              setBusy(true);
              void requestGps().finally(() => {
                setBusy(false);
                go("back");
              });
            }}
          />
          <Button title="Để sau" kind="tertiary" onPress={() => go("back")} />
        </>
      }
    >
      <MapPin size={32} color={c.link} />
      <Txt size={24} bold>
        Gửi vị trí xe khi chuyến đang chạy
      </Txt>
      {[
        "Điều phối thấy xe đang ở đâu để báo khách và xử lý sự cố nhanh.",
        "Chỉ gửi trong lúc chuyến đang chạy. Giao xong là tự tắt.",
        "Khách chỉ thấy vị trí gần đúng, không thấy đường đi chi tiết.",
      ].map((line) => (
        <View key={line} style={{ flexDirection: "row", gap: 12 }}>
          <Truck size={20} color={c.textSecondary} />
          <Txt style={{ flex: 1 }}>{line}</Txt>
        </View>
      ))}
      <Section title="Cách bật trên Android" />
      <Txt>Bước 1: ở hộp tiếp theo, chọn "Khi dùng ứng dụng".</Txt>
      <Txt>
        Bước 2: app mở Cài đặt. Chọn "Quyền vị trí", rồi "Luôn cho phép".
      </Txt>
    </ScreenBody>
  );
}

/** COM-12 Hàng chờ gửi: mục chờ gửi và mục bị từ chối, sửa giờ hoặc bỏ. */
export function QueueScreen() {
  const { colors: c } = useTheme();
  const { confirm, notify } = useOverlay();
  const online = useOnline();
  const items = useQueue();
  const [editing, setEditing] = useState<QueueItem | null>(null);
  const [when, setWhen] = useState(new Date());
  const discard = (item: QueueItem) =>
    void confirm({
      title: "Bỏ mục này?",
      body: `${item.label}. Mục sẽ không được gửi cho điều phối.`,
      cancelLabel: "Giữ lại",
      confirmLabel: "Bỏ mục",
      destructive: true,
    }).then((ok) => {
      if (ok) cancel(item.id);
    });
  return (
    <>
      <Txt size={15} color={c.textSecondary}>
        {online ? "Đang có mạng." : "Đang mất sóng. App tự gửi khi có sóng."}
      </Txt>
      {items.length ? (
        items.map((item) => (
          <Card key={item.id}>
            <Badge
              label={
                item.status === "REJECTED"
                  ? "Bị từ chối"
                  : item.status === "SENDING"
                    ? "Đang gửi"
                    : "Chờ gửi"
              }
              tone={item.status === "REJECTED" ? "danger" : "info"}
            />
            <Txt bold>{item.label}</Txt>
            {item.error ? (
              <Txt size={15} color={c.dangerFg}>
                {item.error}
              </Txt>
            ) : null}
            {item.status === "QUEUED" && item.lastFailure ? (
              <Txt size={12} color={c.textSecondary}>
                {`Lần thử gần nhất chưa được: ${item.lastFailure}`}
              </Txt>
            ) : null}
            {item.status === "QUEUED" && item.attempts > 0 ? (
              <>
                <Button
                  title="Thử gửi ngay"
                  kind="secondary"
                  disabled={!online}
                  onPress={() => sendNow(item.id)}
                />
                <Button
                  title="Bỏ mục này"
                  kind="tertiary"
                  onPress={() => discard(item)}
                />
              </>
            ) : null}
            {item.status === "REJECTED" ? (
              <>
                {item.timeField ? (
                  <Button
                    title="Sửa giờ rồi gửi lại"
                    kind="secondary"
                    onPress={() => {
                      setWhen(new Date(timeOf(item) ?? Date.now()));
                      setEditing(item);
                    }}
                  />
                ) : null}
                <Button
                  title="Gửi lại"
                  kind="secondary"
                  onPress={() => retry(item.id)}
                />
                <Button
                  title="Bỏ mục này"
                  kind="tertiary"
                  onPress={() => discard(item)}
                />
              </>
            ) : null}
          </Card>
        ))
      ) : (
        <Empty
          icon={CloudCheck}
          title="Không có mục chờ gửi"
          detail="Mọi thao tác đã được gửi."
        />
      )}
      <Sheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title="Sửa giờ"
        footer={
          <Button
            title="Lưu và gửi lại"
            onPress={() => {
              if (editing) updateTime(editing.id, when.toISOString());
              setEditing(null);
              notify("Đã sửa giờ", "Mục được gửi lại ngay khi có sóng.");
            }}
          />
        }
      >
        <DateField
          label="Ngày"
          value={when}
          maximumDate={new Date()}
          onChange={(d) => {
            const next = new Date(when);
            next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
            setWhen(next);
          }}
        />
        <DateField
          label="Giờ"
          mode="time"
          value={when}
          onChange={(d) => {
            const next = new Date(when);
            next.setHours(d.getHours(), d.getMinutes(), 0, 0);
            setWhen(next);
          }}
        />
      </Sheet>
    </>
  );
}
