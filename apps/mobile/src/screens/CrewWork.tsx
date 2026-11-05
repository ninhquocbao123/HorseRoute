/**
 * Màn làm việc của tài xế và hộ tống ngoài màn chuyến:
 * DRV-05 bản đồ, DRV-06/07 báo sự cố, DRV-08 đã gửi, DRV-09 tab Sự cố,
 * ESC-03 Ghi nhanh, ESC-04 báo cáo sức khỏe, ESC-05 chi tiết ngựa, ESC-06 tab Nhật ký, ESC-07 báo bất thường.
 * Mọi thao tác ghi đi qua hàng chờ: có sóng thì gửi ngay, mất sóng thì tự gửi lại.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, Switch, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
  Car,
  ClipboardList,
  Droplet,
  FileHeart,
  HeartPulse,
  MapPin,
  Navigation,
  NotebookPen,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  Siren,
  Timer,
  TrafficCone,
  TriangleAlert,
  Wheat,
} from "lucide-react-native";
import {
  Banner,
  Button,
  Card,
  CheckRow,
  Chip,
  DateField,
  Field,
  InfoLine,
  ScreenBody,
  Section,
  SeverityBars,
  StatusBadge,
  Stepper,
  Txt,
  s,
  useTheme,
} from "../ui";
import { Sheet, useOverlay } from "../overlay";
import { useResource, useSession } from "../session";
import {
  Empty,
  PhotoPicker,
  ResourceState,
  RouteMap,
  NotFound,
} from "../live-ui";
import {
  applyPending,
  asId,
  customerNoteError,
  label,
  nextStop,
  shortName,
} from "../live-domain";
import { messageOf } from "../api/http";
import { currentPosition } from "../gps";
import { enqueue, useOnline, useQueue, useTripProgress } from "../queue";
import {
  appetiteLabel,
  healthReportStatus,
  horseCondition,
  incidentSeverity,
  incidentStatus,
  syncStatus,
  vitalsNormal,
} from "../theme";
import {
  HORSE_CONDITION_META,
  HORSE_VITALS_RANGE,
} from "../../../../packages/shared/src/constants/horse.constants";
import { INCIDENT_SUB_TYPES } from "../../../../packages/shared/src/constants/incident.constants";
import type {
  ICareActivityList,
  IDriverTripDetail,
  IHorseLog,
  IIncident,
  ITripMap,
  Navigate,
} from "../api/types";

export const clock = (iso: string | Date | null | undefined) => {
  if (!iso) return "--:--";
  const d = iso instanceof Date ? iso : new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : "--:--";
};
const dayClock = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? clock(d)
    : `${clock(d)} ${d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`;
};
const withUnit = (n: number, unit: string) =>
  `${String(n).replace(".", ",")} ${unit}`;
const dial = (phone: string) => phone.replace(/[^+\d]/g, "");
const currentLeg = (trip: IDriverTripDetail) => {
  const legs = [...trip.legs].sort((a, b) => a.seqNo - b.seqNo);
  return (
    legs.find((l) => l.status === "MOVING" || l.status === "AT_STOP") ??
    legs.find((l) => l.status !== "COMPLETED") ??
    legs[legs.length - 1] ??
    null
  );
};

export const INCIDENT_TYPE_LABEL: Record<string, string> = {
  VEHICLE_BREAKDOWN: "Hỏng xe",
  LONG_TRAFFIC_JAM: "Tắc đường",
  HORSE_MEDICAL: "Y tế ngựa",
};
type Sev = "RED" | "ORANGE" | "YELLOW";

/* ---------------- DRV-09 Sự cố của chuyến (tab) ---------------- */

export function IncidentsTab({
  trip,
  go,
}: {
  trip: IDriverTripDetail;
  go: Navigate;
}) {
  const { colors: c } = useTheme();
  const { refresh } = useSession();
  const incidents = useResource<IIncident[]>(
    `/tracking/trips/${asId(trip.id)}/incidents`,
  );
  const pending = useQueue(trip.id).filter((i) => i.kind === "incident");
  const list = incidents.data ?? [];
  const open = list.filter((i) => i.status !== "CLOSED");
  const closed = list.filter((i) => i.status === "CLOSED");
  return (
    <ScreenBody
      onRefresh={() => {
        incidents.reload();
        refresh();
      }}
      footer={
        <Button
          title="Báo sự cố mới"
          kind="danger"
          icon={Plus}
          onPress={() => go("incident-form", { tripId: trip.id })}
        />
      }
    >
      <Txt size={15} color={c.textSecondary}>
        {trip.orderCode}
      </Txt>
      {pending.map((p) => (
        <Card key={p.id}>
          <StatusBadge spec={syncStatus[p.status]} />
          <Txt bold>{p.label}</Txt>
          <Txt size={15} color={p.error ? c.dangerFg : c.textSecondary}>
            {p.error ?? "Tự gửi khi có sóng."}
          </Txt>
        </Card>
      ))}
      <ResourceState
        resource={incidents}
        what="danh sách sự cố"
        skeleton="rows"
      >
        {!list.length && !pending.length ? (
          <Empty
            icon={ShieldCheck}
            title="Chưa có sự cố nào"
            detail="Gặp hỏng xe, tắc đường lâu hoặc ngựa có dấu hiệu lạ, bấm Báo sự cố mới. Điều phối nhận ngay."
          />
        ) : (
          <>
            {open.length ? <Section title="Đang xử lý" /> : null}
            {open.map((i) => (
              <IncidentCard key={i.id} incident={i} />
            ))}
            {closed.length ? <Section title="Đã xử lý xong" /> : null}
            {closed.map((i) => (
              <IncidentCard key={i.id} incident={i} />
            ))}
          </>
        )}
      </ResourceState>
    </ScreenBody>
  );
}

function IncidentCard({ incident: i }: { incident: IIncident }) {
  const { colors: c } = useTheme();
  const sev = i.severity ? incidentSeverity[i.severity as Sev] : null;
  const sub = i.subType
    ? INCIDENT_SUB_TYPES[i.incidentType]?.find((x) => x.code === i.subType)
        ?.label
    : null;
  return (
    <Card>
      <View style={[s.wrap, { alignItems: "center" }]}>
        <StatusBadge spec={incidentStatus[i.status] ?? incidentStatus.NEW} />
        <Txt size={12} color={c.textSecondary}>
          {`#${i.id} · ${clock(i.reportedAt)}`}
        </Txt>
      </View>
      <Txt bold>
        {[INCIDENT_TYPE_LABEL[i.incidentType], sub, i.horseName]
          .filter(Boolean)
          .join(" · ")}
      </Txt>
      {sev ? (
        <SeverityBars level={sev.level} label={sev.label} tone={sev.tone} />
      ) : null}
      <Txt size={15} color={c.textSecondary}>
        {i.description}
      </Txt>
      {/* R-21: phản hồi của điều phối là đoạn có vạch trái */}
      {(i.responses ?? []).map((r) => (
        <View
          key={r.id}
          style={{
            borderLeftWidth: 3,
            borderLeftColor:
              r.kind === "RESOLVED" ? c.successFg : c.surfaceBrandAlt,
            paddingLeft: 12,
            gap: 2,
          }}
        >
          <Txt size={15} bold>
            {`${r.kind === "RESOLVED" ? "Đã xử lý xong" : "Hướng xử lý"} · ${r.sentByName} · ${clock(r.sentAt)}`}
          </Txt>
          <Txt>{r.note}</Txt>
          {r.expectedAt ? (
            <Txt size={15} color={c.textSecondary}>
              {`Dự kiến xong lúc ${clock(r.expectedAt)}`}
            </Txt>
          ) : null}
        </View>
      ))}
      {!(i.responses ?? []).length && i.handlingNote ? (
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: c.surfaceBrandAlt,
            paddingLeft: 12,
          }}
        >
          <Txt>{i.handlingNote}</Txt>
        </View>
      ) : null}
      {!(i.responses ?? []).length && i.status === "NEW" ? (
        <Txt size={15} color={c.textSecondary}>
          Điều phối chưa tiếp nhận. Mức Nghiêm trọng mà 5 phút chưa ai nhận, hãy
          gọi điều phối.
        </Txt>
      ) : null}
    </Card>
  );
}

/* ---------------- DRV-06/07 Báo sự cố ---------------- */

const TYPES = [
  { value: "VEHICLE_BREAKDOWN", icon: Car },
  { value: "LONG_TRAFFIC_JAM", icon: TrafficCone },
  { value: "HORSE_MEDICAL", icon: HeartPulse },
] as const;
/** Câu mẫu: không có số điện thoại hay tên thật (R-16). */
const TEMPLATES: Record<string, string[]> = {
  VEHICLE_BREAKDOWN: [
    "Xe dừng an toàn bên đường",
    "Cần xe cứu hộ",
    "Ngựa vẫn ổn định",
  ],
  LONG_TRAFFIC_JAM: [
    "Đứng yên hơn 30 phút",
    "Có thể trễ giờ đến",
    "Đã cho ngựa uống nước",
  ],
  HORSE_MEDICAL: [
    "Ngựa đứng không vững",
    "Có vết thương chảy máu",
    "Ngựa bỏ ăn, vã mồ hôi",
  ],
};

/** R-37: ảnh ngay dưới loại và mức độ, vị trí tự lấy ngay dưới ảnh. Ảnh bắt buộc. */
export function IncidentForm({
  trip,
  incidentType,
  horseId: initialHorse,
  go,
  replace,
}: {
  trip: IDriverTripDetail;
  incidentType?: string;
  horseId?: string;
  go: Navigate;
  replace: Navigate;
}) {
  const { colors: c } = useTheme();
  const [type, setType] = useState<string | null>(incidentType ?? null);
  const [subType, setSubType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<Sev | null>(
    incidentType === "HORSE_MEDICAL" ? "RED" : null,
  );
  const [horseId, setHorseId] = useState<string | null>(initialHorse ?? null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [pos, setPos] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locating, setLocating] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    void currentPosition()
      .then((p) => {
        if (!live || !p) return;
        const [latitude, longitude] = p.split(",").map(Number);
        if (Number.isFinite(latitude) && Number.isFinite(longitude))
          setPos({ latitude, longitude });
      })
      .finally(() => {
        if (live) setLocating(false);
      });
    return () => {
      live = false;
    };
  }, []);
  const leg = currentLeg(trip);
  const submit = () => {
    const e: Record<string, string> = {};
    if (!type) e.type = "Chọn loại sự cố.";
    if (!severity) e.severity = "Chọn mức độ.";
    if (type === "HORSE_MEDICAL" && !horseId)
      e.horse = "Chọn con ngựa gặp vấn đề.";
    if (!photos.length)
      e.photos =
        "Cần ít nhất 1 ảnh để gửi. Chụp rõ chỗ hỏng hoặc vùng bị thương.";
    if (description.trim().length < 5)
      e.description = "Mô tả ít nhất 5 ký tự: chuyện gì, ngựa thế nào, cần gì.";
    setErrors(e);
    if (Object.keys(e).length || !type || !severity) return;
    const queueId = enqueue({
      tripId: trip.id,
      kind: "incident",
      label: `Sự cố ${INCIDENT_TYPE_LABEL[type].toLowerCase()} · ${clock(new Date())}`,
      path: `/tracking/trips/${asId(trip.id)}/incidents`,
      body: {
        incidentType: type,
        severity,
        damageTarget: type === "HORSE_MEDICAL" ? "HORSE" : "VEHICLE",
        description: description.trim(),
        ...(subType ? { subType } : {}),
        ...(leg ? { legId: leg.id } : {}),
        ...(type === "HORSE_MEDICAL" && horseId ? { horseId } : {}),
        ...(pos
          ? {
              latitude: pos.latitude.toFixed(6),
              longitude: pos.longitude.toFixed(6),
            }
          : {}),
      },
      photos,
      timeField: null,
    });
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
    replace("incident-sent", {
      tripId: trip.id,
      incidentType: `${type}|${severity}`,
      id: queueId,
    });
  };
  return (
    <ScreenBody
      footer={<Button title="Gửi cho điều phối" large onPress={submit} />}
    >
      <Section title="Loại sự cố" />
      <View style={s.wrap}>
        {TYPES.map((t) => (
          <Chip
            key={t.value}
            label={INCIDENT_TYPE_LABEL[t.value]}
            selected={type === t.value}
            onPress={() => {
              setType(t.value);
              setSubType(null);
              if (t.value === "HORSE_MEDICAL" && !severity) setSeverity("RED");
            }}
          />
        ))}
      </View>
      {errors.type ? (
        <Txt size={15} color={c.dangerFg}>
          {errors.type}
        </Txt>
      ) : null}
      {type ? (
        <View style={s.wrap}>
          {INCIDENT_SUB_TYPES[type as keyof typeof INCIDENT_SUB_TYPES].map(
            (x) => (
              <Chip
                key={x.code}
                label={x.label}
                selected={subType === x.code}
                onPress={() => setSubType(subType === x.code ? null : x.code)}
              />
            ),
          )}
        </View>
      ) : null}
      <Section title="Mức độ" />
      <View style={{ gap: 8 }}>
        {(["RED", "ORANGE", "YELLOW"] as const).map((k) => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ checked: severity === k }}
            onPress={() => setSeverity(k)}
            style={{
              minHeight: 56,
              borderRadius: 12,
              borderWidth: 1.5,
              paddingHorizontal: 16,
              justifyContent: "center",
              borderColor: severity === k ? c.chipSelectedBg : c.chipBorder,
              backgroundColor: severity === k ? c.surfaceMuted : c.surface,
            }}
          >
            <SeverityBars
              level={incidentSeverity[k].level}
              label={incidentSeverity[k].label}
              tone={incidentSeverity[k].tone}
            />
          </Pressable>
        ))}
      </View>
      {errors.severity ? (
        <Txt size={15} color={c.dangerFg}>
          {errors.severity}
        </Txt>
      ) : null}
      {type === "HORSE_MEDICAL" ? (
        <>
          <Section title="Ngựa gặp vấn đề" />
          <View style={s.wrap}>
            {trip.horses.map((h) => (
              <Chip
                key={h.id}
                label={h.name}
                selected={horseId === String(h.id)}
                onPress={() => setHorseId(String(h.id))}
              />
            ))}
          </View>
          {errors.horse ? (
            <Txt size={15} color={c.dangerFg}>
              {errors.horse}
            </Txt>
          ) : null}
        </>
      ) : null}
      <PhotoPicker
        photos={photos}
        onChange={setPhotos}
        required
        error={errors.photos}
        label="Ảnh hiện trường"
      />
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <MapPin size={18} color={c.textSecondary} />
        <Txt size={15} color={c.textSecondary} style={{ flex: 1 }}>
          {locating
            ? "Đang lấy vị trí…"
            : pos
              ? `Vị trí tự lấy: ${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`
              : "Chưa lấy được vị trí. Ghi rõ đang ở đâu trong mô tả."}
        </Txt>
      </View>
      <Field
        label="Mô tả"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        autoCapitalize="sentences"
        placeholder="Chuyện gì, ngựa thế nào, cần gì"
        error={errors.description}
      />
      {type ? (
        <View style={s.wrap}>
          {TEMPLATES[type].map((t) => (
            <Chip
              key={t}
              label={t}
              selected={false}
              onPress={() =>
                setDescription((d) => (d.trim() ? `${d.trim()}. ${t}` : t))
              }
            />
          ))}
        </View>
      ) : null}
    </ScreenBody>
  );
}

/* ---------------- DRV-08 Đã gửi sự cố ---------------- */

export function IncidentSent({
  trip,
  value,
  queueId,
  go,
}: {
  trip: IDriverTripDetail;
  /** "LOẠI|MỨC" */
  value?: string;
  /** Mục hàng chờ của sự cố; hết trong hàng chờ = máy chủ đã nhận. */
  queueId?: string;
  go: Navigate;
}) {
  const { colors: c } = useTheme();
  const online = useOnline();
  const [type, severity] = (value ?? "").split("|");
  const sev = incidentSeverity[severity as Sev] ?? incidentSeverity.YELLOW;
  const phone = trip.coordinator?.phone ?? trip.emergencyHotline ?? null;
  const item = useQueue(trip.id).find((i) => i.id === queueId);
  // Lấy trạng thái thật của mục trong hàng chờ, không suy ra từ việc máy đang có mạng.
  const state: "sent" | "sending" | "waiting" | "rejected" = !item
    ? "sent"
    : item.status === "REJECTED"
      ? "rejected"
      : online && item.status === "SENDING"
        ? "sending"
        : online && item.notBefore <= Date.now()
          ? "sending"
          : "waiting";
  const stateText = {
    sent: "Đã gửi, chờ tiếp nhận",
    sending: "Đang gửi…",
    waiting: online
      ? "Chưa gửi được, app đang thử lại"
      : "Chờ gửi, tự gửi khi có sóng",
    rejected: "Máy chủ không nhận",
  }[state];
  return (
    <ScreenBody
      footer={
        <>
          {state === "rejected" ? (
            <Button
              title="Mở hàng chờ gửi"
              kind="secondary"
              onPress={() => go("queue")}
            />
          ) : null}
          {phone && (severity === "RED" || state === "rejected") ? (
            <Button
              title="Gọi điều phối ngay"
              kind="danger"
              icon={Phone}
              onPress={() => void Linking.openURL(`tel:${dial(phone)}`)}
            />
          ) : null}
          <Button title="Xong" large onPress={() => go("back")} />
        </>
      }
    >
      <Txt size={24} bold>
        {`${INCIDENT_TYPE_LABEL[type] ?? "Sự cố"} lúc ${clock(new Date())}`}
      </Txt>
      <SeverityBars level={sev.level} label={sev.label} tone={sev.tone} />
      <Card>
        <InfoLine label="Chuyến" value={trip.orderCode} />
        <InfoLine label="Điều phối" value={trip.coordinator?.name ?? "—"} />
        <InfoLine label="Trạng thái" value={stateText} />
      </Card>
      {state === "rejected" ? (
        <Banner
          warning
          text={`Sự cố chưa đến được điều phối. ${item?.error ?? ""} Gọi điều phối, rồi mở Hàng chờ gửi để gửi lại.`}
          onPress={() => go("queue")}
        />
      ) : state === "waiting" && severity === "RED" ? (
        <Banner
          warning
          text="Sự cố nghiêm trọng chưa gửi được. Gọi điều phối ngay, app vẫn tự gửi khi có sóng."
        />
      ) : null}
      <Txt color={c.textSecondary}>
        Phản hồi của điều phối hiện ở tab Sự cố và trong Thông báo. Mức Nghiêm
        trọng mà 5 phút chưa ai nhận, hãy gọi điện.
      </Txt>
    </ScreenBody>
  );
}

/* ---------------- ESC-06 Nhật ký (tab) ---------------- */

type LogRow = {
  key: string;
  at: string;
  title: string;
  detail?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  onPress?: () => void;
  kind: "report" | "care";
};

export function LogTab({
  trip,
  go,
  onQuickLog,
}: {
  trip: IDriverTripDetail;
  go: Navigate;
  onQuickLog: () => void;
}) {
  const { colors: c } = useTheme();
  const { request, refresh } = useSession();
  const { notify } = useOverlay();
  const logs = useResource<IHorseLog[]>(
    `/tracking/trips/${asId(trip.id)}/horse-logs`,
  );
  const care = useResource<ICareActivityList>(
    `/tracking/trips/${asId(trip.id)}/care-activities`,
  );
  const queue = useQueue(trip.id);
  const [filter, setFilter] = useState<"all" | "report" | "care">("all");
  const [sending, setSending] = useState<string | null>(null);
  const sendDraft = async (id: string) => {
    setSending(id);
    try {
      await request(`/tracking/horse-logs/${asId(id)}/send`, {
        method: "POST",
        body: {},
      });
      logs.reload();
      notify("Đã gửi báo cáo cho khách");
    } catch (e) {
      notify("Chưa gửi được", messageOf(e));
    } finally {
      setSending(null);
    }
  };
  // Việc chăm sóc ghi cho nhiều ngựa cùng lúc gộp thành một dòng.
  const careRows = useMemo(() => {
    const groups = new Map<string, LogRow & { names: string[] }>();
    for (const a of care.data?.activities ?? []) {
      const amount =
        a.amountLiters != null
          ? withUnit(a.amountLiters, "L")
          : a.durationMinutes != null
            ? withUnit(a.durationMinutes, "phút")
            : (a.feedDescription ?? "");
      const key = `${a.activityType}|${a.performedAt}|${amount}`;
      const g = groups.get(key);
      if (g) g.names.push(a.horseName ?? "Cả đoàn");
      else
        groups.set(key, {
          key: `c${a.id}`,
          at: a.performedAt,
          title: label(a.activityType),
          detail: amount,
          kind: "care",
          names: [a.horseName ?? "Cả đoàn"],
        });
    }
    return [...groups.values()].map((g) => ({
      ...g,
      title: `${g.title} · ${g.names.join(", ")}`,
    }));
  }, [care.data]);
  const rows: LogRow[] = [
    ...queue
      .filter((i) => i.kind === "horseLog" || i.kind === "care")
      .map((i) => ({
        key: i.id,
        at: new Date(i.createdAt).toISOString(),
        title: i.label,
        detail: i.error,
        badge: <StatusBadge spec={syncStatus[i.status]} />,
        onPress: () => go("queue"),
        kind: (i.kind === "care" ? "care" : "report") as LogRow["kind"],
      })),
    ...(logs.data ?? []).map((l) => ({
      key: `l${l.id}`,
      at: l.loggedAt,
      title: `${l.horseName} · ${label(l.conditionStatus)}`,
      detail:
        [
          l.bodyTempC != null ? withUnit(l.bodyTempC, "°C") : null,
          l.heartRateBpm != null ? withUnit(l.heartRateBpm, "nhịp/phút") : null,
          l.customerNote,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      badge: (
        <>
          {l.reportStatus ? (
            <StatusBadge
              spec={
                healthReportStatus[
                  l.customerViewedAt ? "VIEWED" : l.reportStatus
                ]
              }
            />
          ) : null}
          {l.correctsLogId ? (
            <StatusBadge
              spec={{
                label: "Đính chính",
                tone: "neutral",
                icon: "file-pen-line",
              }}
            />
          ) : null}
        </>
      ),
      action:
        l.reportStatus === "DRAFT" ? (
          <Button
            title={sending === l.id ? "Đang gửi…" : "Gửi cho khách"}
            kind="secondary"
            disabled={sending === l.id}
            onPress={() => void sendDraft(l.id)}
          />
        ) : undefined,
      onPress: () => go("crew-horse", { tripId: trip.id, horseId: l.horseId }),
      kind: "report" as const,
    })),
    ...careRows,
  ]
    .filter((r) => filter === "all" || r.kind === filter)
    .sort((a, b) => b.at.localeCompare(a.at));
  return (
    <ScreenBody
      onRefresh={() => {
        logs.reload();
        care.reload();
        refresh();
      }}
      footer={
        trip.crewRole === "ESCORT" ? (
          <Button title="Ghi nhanh" icon={Plus} large onPress={onQuickLog} />
        ) : undefined
      }
    >
      <Txt size={15} color={c.textSecondary}>
        {trip.orderCode}
      </Txt>
      <View style={s.wrap}>
        <Chip
          label="Tất cả"
          selected={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <Chip
          label="Báo cáo sức khỏe"
          selected={filter === "report"}
          onPress={() => setFilter("report")}
        />
        <Chip
          label="Ăn uống, nghỉ"
          selected={filter === "care"}
          onPress={() => setFilter("care")}
        />
      </View>
      {logs.data === undefined && care.data === undefined ? (
        <ResourceState resource={logs} what="nhật ký" skeleton="rows">
          {null}
        </ResourceState>
      ) : !rows.length ? (
        <Empty
          icon={NotebookPen}
          title="Chưa có gì trong nhật ký"
          detail="Báo cáo sức khỏe và ghi nhanh ăn uống hiện ở đây theo thời gian."
        />
      ) : (
        rows.map((r) => (
          <Card key={r.key} onPress={r.onPress}>
            <View style={[s.wrap, { alignItems: "center" }]}>
              <Txt size={15} bold>
                {dayClock(r.at)}
              </Txt>
              {r.badge}
            </View>
            <Txt>{r.title}</Txt>
            {r.detail ? (
              <Txt size={15} color={c.textSecondary}>
                {r.detail}
              </Txt>
            ) : null}
            {r.action}
          </Card>
        ))
      )}
    </ScreenBody>
  );
}

/* ---------------- ESC-03 Ghi nhanh ---------------- */

const CARE = [
  { value: "WATER", label: "Uống nước", icon: Droplet },
  { value: "FEED", label: "Cho ăn", icon: Wheat },
  { value: "REST", label: "Nghỉ chân", icon: Timer },
] as const;
const FEEDS = ["Cỏ khô", "Cám viên", "Cỏ khô và cám"];

/** Mặc định cả đoàn, Uống nước, 12 L: việc thường gặp nhất xong trong 2 chạm. */
export function QuickLogSheet({
  visible,
  onClose,
  trip,
}: {
  visible: boolean;
  onClose: () => void;
  trip: IDriverTripDetail;
}) {
  const { colors: c } = useTheme();
  const { notify } = useOverlay();
  const horses = trip.horses;
  const [type, setType] = useState<"WATER" | "FEED" | "REST">("WATER");
  const [selected, setSelected] = useState<string[]>([]);
  const [liters, setLiters] = useState(12);
  const [feed, setFeed] = useState(FEEDS[0]);
  const [minutes, setMinutes] = useState(30);
  const [when, setWhen] = useState(new Date());
  const [error, setError] = useState("");
  useEffect(() => {
    if (visible) {
      setSelected(horses.map((h) => String(h.id)));
      setWhen(new Date());
      setError("");
    }
  }, [visible, horses]);
  const all = selected.length === horses.length;
  const save = () => {
    if (type !== "REST" && !selected.length)
      return setError("Chọn ít nhất 1 con ngựa để lưu.");
    if (type === "FEED" && !feed.trim()) return setError("Nhập khẩu phần.");
    if (Date.now() - when.getTime() > 120 * 60000)
      return setError("Chỉ ghi lùi tối đa 2 giờ.");
    const performedAt = (
      when.getTime() > Date.now() ? new Date() : when
    ).toISOString();
    const name = (id: string) =>
      horses.find((h) => String(h.id) === id)?.name ?? "";
    const title = CARE.find((x) => x.value === type)!.label;
    const path = `/tracking/trips/${asId(trip.id)}/care-activities`;
    if (type === "REST") {
      // Nghỉ chân cả đoàn là một bản ghi không gắn ngựa.
      const targets = all || !selected.length ? [null] : selected;
      for (const horseId of targets)
        enqueue({
          tripId: trip.id,
          kind: "care",
          label: `${title} ${withUnit(minutes, "phút")} · ${horseId ? name(horseId) : "Cả đoàn"} · ${clock(performedAt)}`,
          path,
          body: {
            activityType: "REST",
            ...(horseId ? { horseId } : {}),
            durationMinutes: minutes,
            performedAt,
          },
          timeField: "performedAt",
          horseIds: horseId ? [horseId] : horses.map((h) => String(h.id)),
        });
    } else
      for (const horseId of selected)
        enqueue({
          tripId: trip.id,
          kind: "care",
          label: `${title} · ${name(horseId)} · ${clock(performedAt)}`,
          path,
          body:
            type === "WATER"
              ? {
                  activityType: type,
                  horseId,
                  amountLiters: liters,
                  performedAt,
                }
              : {
                  activityType: type,
                  horseId,
                  feedDescription: feed.trim(),
                  performedAt,
                },
          timeField: "performedAt",
          horseIds: [horseId],
        });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => {},
    );
    onClose();
    notify(
      `Đã ghi ${title.toLowerCase()}`,
      type === "REST"
        ? withUnit(minutes, "phút")
        : `${all ? "Cả đoàn" : selected.map(name).join(", ")}${type === "WATER" ? ` · ${withUnit(liters, "L")} mỗi con` : ""}`,
    );
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Ghi nhanh"
      footer={<Button title="Lưu" onPress={save} />}
    >
      <View style={s.wrap}>
        {CARE.map((x) => (
          <Chip
            key={x.value}
            label={x.label}
            selected={type === x.value}
            onPress={() => setType(x.value)}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Txt bold style={{ flex: 1 }}>
          {type === "REST" ? "Ngựa (bỏ trống là cả đoàn)" : "Ngựa"}
        </Txt>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            setSelected(all ? [] : horses.map((h) => String(h.id)))
          }
          style={{ minHeight: 56, justifyContent: "center", paddingLeft: 12 }}
        >
          <Txt bold color={c.link}>
            {all ? "Bỏ chọn" : "Chọn tất cả"}
          </Txt>
        </Pressable>
      </View>
      <View style={s.wrap}>
        {horses.map((h) => (
          <Chip
            key={h.id}
            label={h.name}
            selected={selected.includes(String(h.id))}
            onPress={() =>
              setSelected((x) =>
                x.includes(String(h.id))
                  ? x.filter((v) => v !== String(h.id))
                  : [...x, String(h.id)],
              )
            }
          />
        ))}
      </View>
      {type === "WATER" ? (
        <Stepper
          label="Lượng nước mỗi con"
          value={liters}
          onChange={setLiters}
          step={1}
          min={0.5}
          max={200}
          unit="L"
        />
      ) : null}
      {type === "FEED" ? (
        <>
          <View style={s.wrap}>
            {FEEDS.map((f) => (
              <Chip
                key={f}
                label={f}
                selected={feed === f}
                onPress={() => setFeed(f)}
              />
            ))}
          </View>
          <Field
            label="Khẩu phần"
            value={feed}
            onChangeText={setFeed}
            maxLength={200}
          />
        </>
      ) : null}
      {type === "REST" ? (
        <Stepper
          label="Thời gian nghỉ"
          value={minutes}
          onChange={setMinutes}
          step={5}
          min={5}
          max={720}
          unit="phút"
        />
      ) : null}
      <DateField
        label="Lúc"
        mode="time"
        value={when}
        onChange={(d) => {
          const next = new Date(when);
          next.setHours(d.getHours(), d.getMinutes(), 0, 0);
          setWhen(next);
        }}
        hint="Mặc định là bây giờ. Ghi lùi tối đa 2 giờ."
      />
      {error ? (
        <Txt size={15} color={c.dangerFg}>
          {error}
        </Txt>
      ) : null}
    </Sheet>
  );
}

/* ---------------- ESC-07 Báo bất thường ---------------- */

export function AbnormalSheet({
  trip,
  visible,
  horseId: initialHorse,
  onClose,
  go,
}: {
  trip: IDriverTripDetail;
  visible: boolean;
  horseId: string | null;
  onClose: () => void;
  go: Navigate;
}) {
  const { colors: c } = useTheme();
  const { notify } = useOverlay();
  const [horseId, setHorseId] = useState<string | null>(null);
  const [condition, setCondition] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  // F-E3: báo bất thường mặc định chỉ gửi điều phối; hộ tống tự bật nếu muốn khách xem.
  const [toCustomer, setToCustomer] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (visible) {
      setHorseId(
        initialHorse ??
          (trip.horses.length === 1 ? String(trip.horses[0].id) : null),
      );
      setCondition(null);
      setPhotos([]);
      setNote("");
      setToCustomer(false);
      setErrors({});
    }
  }, [visible, initialHorse, trip.horses]);
  const leg = currentLeg(trip);
  const send = () => {
    const e: Record<string, string> = {};
    if (!horseId) e.horse = "Chọn con ngựa.";
    if (!condition) e.condition = "Chọn dấu hiệu.";
    if (!photos.length) e.photos = "Cần 1 ảnh để gửi. Chụp rõ vùng bất thường.";
    const noteError = customerNoteError(toCustomer, note);
    if (noteError) e.note = noteError;
    if (!leg) e.leg = "Chuyến chưa có chặng để ghi.";
    setErrors(e);
    if (Object.keys(e).length || !horseId || !condition || !leg) return;
    const name = trip.horses.find((h) => String(h.id) === horseId)?.name ?? "";
    const loggedAt = new Date().toISOString();
    enqueue({
      tripId: trip.id,
      kind: "horseLog",
      label: `${label(condition)} · ${name} · ${clock(loggedAt)}`,
      path: `/tracking/legs/${asId(leg.id)}/horse-logs`,
      body: {
        horseId,
        conditionStatus: condition,
        loggedAt,
        reportStatus: "SENT",
        sendToCustomer: toCustomer ? "true" : "false",
        ...(note.trim()
          ? toCustomer
            ? { customerNote: note.trim(), note: note.trim() }
            : { note: note.trim() }
          : {}),
      },
      photos,
      timeField: "loggedAt",
      horseIds: [horseId],
    });
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
    onClose();
    notify(
      `Đã ghi: ${name} ${label(condition).toLowerCase()}`,
      toCustomer
        ? "App tự gửi điều phối và khách, kèm ảnh."
        : "App tự gửi điều phối, kèm ảnh.",
    );
  };
  const conditions = Object.keys(HORSE_CONDITION_META).filter(
    (k) =>
      HORSE_CONDITION_META[k as keyof typeof HORSE_CONDITION_META].attention,
  );
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Báo bất thường"
      footer={<Button title="Gửi ngay" onPress={send} />}
    >
      <Txt bold>Ngựa</Txt>
      <View style={s.wrap}>
        {trip.horses.map((h) => (
          <Chip
            key={h.id}
            label={h.name}
            selected={horseId === String(h.id)}
            onPress={() => setHorseId(String(h.id))}
          />
        ))}
      </View>
      {errors.horse ? (
        <Txt size={15} color={c.dangerFg}>
          {errors.horse}
        </Txt>
      ) : null}
      <Txt bold>Dấu hiệu</Txt>
      <View style={s.wrap}>
        {conditions.map((k) => (
          <Chip
            key={k}
            label={label(k)}
            selected={condition === k}
            onPress={() => setCondition(k)}
          />
        ))}
      </View>
      {condition ? (
        <Txt size={15} color={c.textSecondary}>
          {
            HORSE_CONDITION_META[condition as keyof typeof HORSE_CONDITION_META]
              .hint
          }
        </Txt>
      ) : null}
      {errors.condition ? (
        <Txt size={15} color={c.dangerFg}>
          {errors.condition}
        </Txt>
      ) : null}
      <PhotoPicker
        photos={photos}
        onChange={setPhotos}
        required
        error={errors.photos}
      />
      <Field
        label={toCustomer ? "Ghi chú gửi khách *" : "Ghi chú (không bắt buộc)"}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={1000}
        placeholder="Ví dụ: đã cho nghỉ 20 phút, đang theo dõi"
        error={errors.note}
      />
      <CheckRow
        label="Gửi cho khách xem"
        checked={toCustomer}
        onPress={() => setToCustomer((v) => !v)}
      />
      {errors.leg ? (
        <Txt size={15} color={c.dangerFg}>
          {errors.leg}
        </Txt>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onClose();
          go("incident-form", {
            tripId: trip.id,
            horseId: horseId ?? undefined,
            incidentType: "HORSE_MEDICAL",
          });
        }}
        style={({ pressed }) => ({
          borderWidth: 1.5,
          borderColor: c.dangerFg,
          borderRadius: 12,
          padding: 16,
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
          backgroundColor: pressed ? c.dangerBg : c.surface,
          minHeight: 56,
        })}
      >
        <Siren color={c.dangerFg} size={24} />
        <Txt bold color={c.dangerFg} style={{ flex: 1 }}>
          Y tế khẩn: báo sự cố cho điều phối
        </Txt>
      </Pressable>
    </Sheet>
  );
}

/* ---------------- ESC-04 Báo cáo sức khỏe ---------------- */

type Draft = {
  condition: string;
  temp: string;
  heart: string;
  appetite: string;
  customerNote: string;
  note: string;
  photos: string[];
  sendToCustomer: boolean;
};
const blankDraft: Draft = {
  condition: "STABLE",
  temp: "",
  heart: "",
  appetite: "NORMAL",
  customerNote: "",
  note: "",
  photos: [],
  sendToCustomer: true,
};
const num = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);

/**
 * R-38: tự lưu nháp trên máy, không có nút "Lưu nháp". Số đo ngoài khoảng thường gặp có viền cam.
 * Long chốt 29/10: mọi báo cáo sức khỏe đều cần ít nhất 1 ảnh.
 */
export function ReportForm({
  trip,
  horseId,
  go,
}: {
  trip: IDriverTripDetail;
  horseId: string;
  go: Navigate;
}) {
  const { colors: c } = useTheme();
  const { user } = useSession();
  const { notify } = useOverlay();
  const horse = trip.horses.find((h) => String(h.id) === horseId);
  const key = `horseroute.report.${user!.id}.${trip.id}.${horseId}`;
  const [d, setD] = useState<Draft>(blankDraft);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const loaded = useRef(false);
  const sent = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((v) => {
        if (v) setD({ ...blankDraft, ...(JSON.parse(v) as Draft) });
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, [key]);
  useEffect(() => {
    if (!loaded.current || sent.current) return;
    const t = setTimeout(() => {
      void AsyncStorage.setItem(key, JSON.stringify(d))
        .then(() => setSavedAt(new Date()))
        .catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [d, key]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setD((x) => ({ ...x, [k]: v }));
  const temp = num(d.temp);
  const heart = num(d.heart);
  const tempWarn =
    temp != null &&
    Number.isFinite(temp) &&
    (temp < vitalsNormal.bodyTempC.min || temp > vitalsNormal.bodyTempC.max)
      ? `Ngoài khoảng thường gặp ${String(vitalsNormal.bodyTempC.min).replace(".", ",")}–${String(vitalsNormal.bodyTempC.max).replace(".", ",")} °C. Kiểm tra lại, nếu đúng hãy ghi rõ trong ghi chú.`
      : null;
  const heartWarn =
    heart != null &&
    Number.isFinite(heart) &&
    (heart < vitalsNormal.heartRateBpm.min ||
      heart > vitalsNormal.heartRateBpm.max)
      ? `Ngoài khoảng thường gặp ${vitalsNormal.heartRateBpm.min}–${vitalsNormal.heartRateBpm.max} nhịp/phút.`
      : null;
  const leg = currentLeg(trip);
  const send = () => {
    const e: Record<string, string> = {};
    const R = HORSE_VITALS_RANGE;
    if (
      temp != null &&
      (!Number.isFinite(temp) ||
        temp < R.bodyTempC.min ||
        temp > R.bodyTempC.max ||
        Math.abs(temp * 10 - Math.round(temp * 10)) > 1e-9)
    )
      e.temp = `Nhiệt độ từ ${R.bodyTempC.min} đến ${R.bodyTempC.max} °C, tối đa 1 số lẻ.`;
    if (
      heart != null &&
      (!Number.isInteger(heart) ||
        heart < R.heartRateBpm.min ||
        heart > R.heartRateBpm.max)
    )
      e.heart = `Nhịp tim là số nguyên từ ${R.heartRateBpm.min} đến ${R.heartRateBpm.max}.`;
    if (!d.photos.length)
      e.photos = "Cần ít nhất 1 ảnh để gửi báo cáo. Chụp rõ toàn thân ngựa.";
    const noteError = customerNoteError(d.sendToCustomer, d.customerNote);
    if (noteError) e.customerNote = noteError;
    if (!leg) e.leg = "Chuyến chưa có chặng để ghi báo cáo.";
    setErrors(e);
    if (Object.keys(e).length || !leg || !horse) return;
    const loggedAt = new Date().toISOString();
    enqueue({
      tripId: trip.id,
      kind: "horseLog",
      label: `Báo cáo ${horse.name} · ${label(d.condition)} · ${clock(loggedAt)}`,
      path: `/tracking/legs/${asId(leg.id)}/horse-logs`,
      body: {
        horseId,
        conditionStatus: d.condition,
        loggedAt,
        reportStatus: "SENT",
        sendToCustomer: d.sendToCustomer ? "true" : "false",
        appetite: d.appetite,
        ...(temp != null ? { bodyTempC: String(temp) } : {}),
        ...(heart != null ? { heartRateBpm: String(heart) } : {}),
        ...(d.customerNote.trim()
          ? { customerNote: d.customerNote.trim() }
          : {}),
        ...(d.note.trim() ? { note: d.note.trim() } : {}),
      },
      photos: d.photos,
      timeField: "loggedAt",
      horseIds: [horseId],
    });
    sent.current = true;
    void AsyncStorage.removeItem(key).catch(() => {});
    notify(
      `Đã ghi báo cáo ${horse.name}`,
      d.sendToCustomer
        ? "App tự gửi điều phối và khách."
        : "App tự gửi, chỉ điều phối xem.",
    );
    go("back");
  };
  if (!horse)
    return (
      <ScreenBody>
        <NotFound
          title="Ngựa không thuộc chuyến này"
          detail="Quay lại danh sách ngựa của chuyến để chọn đúng con."
        />
      </ScreenBody>
    );
  return (
    <ScreenBody
      footer={<Button title="Gửi báo cáo" icon={Send} onPress={send} />}
    >
      <Txt size={15} color={c.textSecondary}>
        {savedAt
          ? `${horse.name} · tự lưu nháp lúc ${clock(savedAt)}`
          : `${horse.name} · ${trip.orderCode}`}
      </Txt>
      <Section title="Tình trạng" />
      <View style={s.wrap}>
        {Object.keys(HORSE_CONDITION_META).map((k) => (
          <Chip
            key={k}
            label={horseCondition[k]?.label ?? label(k)}
            selected={d.condition === k}
            onPress={() => set("condition", k)}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Nhiệt độ °C"
            value={d.temp}
            onChangeText={(v) => set("temp", v)}
            keyboardType="decimal-pad"
            placeholder="38,0"
            error={errors.temp}
            warn={tempWarn}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Nhịp tim /phút"
            value={d.heart}
            onChangeText={(v) => set("heart", v)}
            keyboardType="number-pad"
            placeholder="36"
            error={errors.heart}
            warn={heartWarn}
          />
        </View>
      </View>
      <Section title="Ăn uống" />
      <View style={s.wrap}>
        {["NORMAL", "REDUCED", "REFUSED"].map((k) => (
          <Chip
            key={k}
            label={appetiteLabel[k]}
            selected={d.appetite === k}
            onPress={() => set("appetite", k)}
          />
        ))}
      </View>
      <PhotoPicker
        photos={d.photos}
        onChange={(p) => set("photos", p)}
        required
        error={errors.photos}
      />
      <Field
        label={
          d.sendToCustomer
            ? "Ghi chú gửi khách *"
            : "Ghi chú gửi khách (không bắt buộc)"
        }
        value={d.customerNote}
        onChangeText={(v) => set("customerNote", v)}
        multiline
        maxLength={1000}
        placeholder="Ngựa ăn hết khẩu phần, đứng vững"
        error={errors.customerNote}
      />
      <Field
        label="Ghi chú nội bộ (không bắt buộc)"
        value={d.note}
        onChangeText={(v) => set("note", v)}
        multiline
        maxLength={1000}
        hint="Chỉ điều phối thấy."
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          minHeight: 56,
        }}
      >
        <Txt style={{ flex: 1 }}>Gửi cho khách xem</Txt>
        <Switch
          value={d.sendToCustomer}
          onValueChange={(v) => set("sendToCustomer", v)}
          trackColor={{ true: c.surfaceBrandAlt, false: c.borderInput }}
          thumbColor={c.surface}
          accessibilityLabel="Gửi cho khách xem"
        />
      </View>
      {errors.leg ? (
        <Txt size={15} color={c.dangerFg}>
          {errors.leg}
        </Txt>
      ) : null}
    </ScreenBody>
  );
}

/* ---------------- ESC-05 Chi tiết ngựa trong chuyến ---------------- */

export function HorseDetail({
  trip,
  horseId,
  go,
}: {
  trip: IDriverTripDetail;
  horseId: string;
  go: Navigate;
}) {
  const { colors: c } = useTheme();
  const logs = useResource<IHorseLog[]>(
    `/tracking/trips/${asId(trip.id)}/horse-logs`,
  );
  const care = useResource<ICareActivityList>(
    `/tracking/trips/${asId(trip.id)}/care-activities`,
  );
  const [abnormal, setAbnormal] = useState(false);
  const horse = trip.horses.find((h) => String(h.id) === horseId);
  const mine = (logs.data ?? [])
    .filter((l) => String(l.horseId) === horseId)
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  const acts = (care.data?.activities ?? [])
    .filter((a) => String(a.horseId) === horseId || a.horseId === null)
    .slice(0, 12);
  const latest = mine[0];
  if (!horse)
    return (
      <ScreenBody>
        <NotFound
          title="Ngựa không thuộc chuyến này"
          detail="Quay lại danh sách ngựa của chuyến để chọn đúng con."
        />
      </ScreenBody>
    );
  const escort = trip.crewRole === "ESCORT";
  return (
    <ScreenBody
      onRefresh={() => {
        logs.reload();
        care.reload();
      }}
      footer={
        escort ? (
          <>
            <Button
              title="Báo bất thường"
              kind="danger"
              icon={TriangleAlert}
              onPress={() => setAbnormal(true)}
            />
            <Button
              title="Báo cáo sức khỏe"
              icon={FileHeart}
              onPress={() => go("report", { tripId: trip.id, horseId })}
            />
          </>
        ) : undefined
      }
    >
      <Txt size={15} color={c.textSecondary}>
        {[horse.breed, horse.passportNo ? `Hộ chiếu ${horse.passportNo}` : null]
          .filter(Boolean)
          .join(" · ")}
      </Txt>
      {latest ? (
        <StatusBadge
          spec={horseCondition[latest.conditionStatus] ?? horseCondition.STABLE}
        />
      ) : null}
      {latest ? (
        <Card>
          <Txt size={12} bold color={c.textSecondary}>
            {`BÁO CÁO GẦN NHẤT · ${dayClock(latest.loggedAt)}`}
          </Txt>
          <View style={[s.wrap, { gap: 24 }]}>
            <Txt size={24} bold>
              {latest.bodyTempC != null
                ? withUnit(latest.bodyTempC, "°C")
                : "—"}
            </Txt>
            <Txt size={24} bold>
              {latest.heartRateBpm != null
                ? withUnit(latest.heartRateBpm, "nhịp/phút")
                : "—"}
            </Txt>
          </View>
          {latest.appetite ? (
            <Txt>{`Ăn uống: ${appetiteLabel[latest.appetite]}`}</Txt>
          ) : null}
          {latest.customerNote ? (
            <Txt size={15} color={c.textSecondary}>
              {latest.customerNote}
            </Txt>
          ) : null}
        </Card>
      ) : null}
      <Section title="Báo cáo" />
      <ResourceState resource={logs} what="báo cáo" skeleton="rows">
        {mine.length ? (
          <Card>
            {mine.slice(0, 10).map((l) => (
              <View key={l.id} style={{ gap: 4 }}>
                <View style={s.wrap}>
                  <StatusBadge
                    spec={
                      horseCondition[l.conditionStatus] ?? horseCondition.STABLE
                    }
                  />
                  {l.reportStatus ? (
                    <StatusBadge
                      spec={
                        healthReportStatus[
                          l.customerViewedAt ? "VIEWED" : l.reportStatus
                        ]
                      }
                    />
                  ) : null}
                </View>
                <Txt size={15} color={c.textSecondary}>
                  {`${dayClock(l.loggedAt)} · ${l.createdByName}`}
                </Txt>
              </View>
            ))}
          </Card>
        ) : (
          <Empty
            icon={ClipboardList}
            title="Chưa có báo cáo"
            detail="Gửi báo cáo đầu tiên khi lên xe để khách yên tâm."
          />
        )}
      </ResourceState>
      <Section title="Ăn uống, nghỉ" />
      <Card>
        {acts.length ? (
          acts.map((a) => (
            <Txt key={a.id} size={15}>
              {`${dayClock(a.performedAt)} · ${label(a.activityType)}${a.amountLiters != null ? ` ${withUnit(a.amountLiters, "L")}` : ""}${a.feedDescription ? ` · ${a.feedDescription}` : ""}${a.durationMinutes != null ? ` ${withUnit(a.durationMinutes, "phút")}${a.horseId ? "" : " (cả đoàn)"}` : ""}`}
            </Txt>
          ))
        ) : (
          <Txt size={15} color={c.textSecondary}>
            Chưa ghi lần nào. Dùng Ghi nhanh ở màn Ngựa.
          </Txt>
        )}
      </Card>
      <AbnormalSheet
        trip={trip}
        visible={abnormal}
        horseId={horseId}
        onClose={() => setAbnormal(false)}
        go={go}
      />
    </ScreenBody>
  );
}

/* ---------------- DRV-05 Bản đồ chuyến ---------------- */

/** Không có nút ghi mốc trên bản đồ để tránh bấm nhầm; ghi mốc vẫn ở màn chuyến. */
export function TripMapScreen({
  trip: serverTrip,
}: {
  trip: IDriverTripDetail;
}) {
  const { colors: c } = useTheme();
  const map = useResource<ITripMap>(
    `/tracking/trips/${asId(serverTrip.id)}/map`,
  );
  const progress = useTripProgress(serverTrip.id);
  const trip = useMemo(
    () => applyPending(serverTrip, progress),
    [serverTrip, progress],
  );
  const stop = nextStop(trip, map.data ?? null);
  const late = stop?.at ? Date.now() - Date.parse(stop.at) : 0;
  const directions = () => {
    const leg = map.data?.legs.find((l) => l.status !== "COMPLETED");
    const next = map.data?.stops.find(
      (x) =>
        x.locationId === leg?.toLocationId && x.lat !== null && x.lng !== null,
    );
    const q = next
      ? `${next.lat},${next.lng}`
      : encodeURIComponent(stop?.name ?? "");
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`,
    );
  };
  return (
    <ScreenBody
      onRefresh={map.reload}
      footer={
        stop ? (
          <Button
            title={`Chỉ đường đến ${shortName(stop.name)}`}
            icon={Navigation}
            large
            onPress={directions}
          />
        ) : undefined
      }
    >
      <ResourceState resource={map} what="bản đồ lộ trình" skeleton="map">
        {map.data ? <RouteMap map={map.data} /> : null}
      </ResourceState>
      {stop ? (
        <Card>
          <Txt size={12} bold color={c.textSecondary}>
            {stop.caption}
          </Txt>
          <Txt size={24} bold>
            {stop.name}
          </Txt>
          <View style={[s.wrap, { alignItems: "center" }]}>
            {stop.at ? (
              <Txt bold>{`${stop.atLabel} ${clock(stop.at)}`}</Txt>
            ) : null}
            {stop.at ? (
              <StatusBadge
                spec={
                  late > 60000
                    ? {
                        label: `Trễ ${Math.round(late / 60000)} phút`,
                        tone: "warning",
                        icon: "clock",
                      }
                    : {
                        label: "Đúng giờ",
                        tone: "success",
                        icon: "circle-check",
                      }
                }
              />
            ) : null}
          </View>
          {map.data?.remainingKm != null ? (
            <Txt color={c.textSecondary}>
              {`Còn khoảng ${map.data.remainingKm.toLocaleString("vi-VN")} km`}
            </Txt>
          ) : null}
        </Card>
      ) : null}
      <Txt size={15} color={c.textSecondary}>
        App không tự dẫn đường. Nút bên dưới mở Google Maps.
      </Txt>
    </ScreenBody>
  );
}

/** Hiển thị ngựa trong đơn cho hộ tống: dùng ở ESC-02. */
export function lastCare(
  care: ICareActivityList | undefined,
  pending: {
    kind: string;
    body: Record<string, unknown>;
    horseIds?: string[];
  }[],
  horseId: string,
  type: "WATER" | "FEED",
) {
  const q = pending.find(
    (i) =>
      i.kind === "care" &&
      i.body.activityType === type &&
      i.horseIds?.includes(horseId),
  );
  if (q) return String(q.body.performedAt);
  return (
    care?.activities.find(
      (a) => a.activityType === type && String(a.horseId) === horseId,
    )?.performedAt ?? null
  );
}
export const ClipboardIcon = ClipboardList;
