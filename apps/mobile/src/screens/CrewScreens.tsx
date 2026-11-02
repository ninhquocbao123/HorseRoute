import React, { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ClipboardCheck, PawPrint, Plus, Truck } from "lucide-react-native";
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
} from "../ui";
import { useResource, useSession } from "../session";
import {
  appendPhoto,
  Contact,
  Empty,
  PhotoPicker,
  PrivateImage,
  ResourceState,
  RouteMap,
} from "../live-ui";
import { asId, checks, dateTime, driverAction, label } from "../live-domain";
import { messageOf } from "../api/http";
import { API_URL } from "../config";
import type {
  ICareActivityList,
  IDriverTripDetail,
  IDriverTripSummary,
  IHorseLog,
  IIncident,
  ITripMap,
  Navigate,
} from "../api/types";

export function TripList({
  trips,
  go,
}: {
  trips: IDriverTripSummary[];
  go: Navigate;
}) {
  return trips.length ? (
    <>
      {trips.map((trip) => (
        <Card key={trip.id}>
          <Badge
            label={`${label(trip.orderStatus)} · ${trip.crewRole === "DRIVER" ? "Tài xế" : "Hộ tống"}`}
            tone={trip.orderStatus === "IN_TRANSIT" ? "brand" : "info"}
          />
          <Txt size={24} bold>
            {trip.legs[0]?.fromLocationName || "Chưa có lộ trình"} →{" "}
            {trip.legs[trip.legs.length - 1]?.toLocationName ||
              "Chưa có điểm giao"}
          </Txt>
          <Txt>{trip.orderCode}</Txt>
          <Txt>Khởi hành: {dateTime(trip.plannedDepartureAt)}</Txt>
          <Button
            title="Mở chuyến"
            kind="secondary"
            icon={Truck}
            onPress={() => go("trip", { tripId: String(trip.id) })}
          />
        </Card>
      ))}
    </>
  ) : (
    <Empty
      title="Chưa có chuyến được phân công"
      detail="Chuyến sẽ xuất hiện khi điều phối phân công tài khoản này. Kéo xuống để tải lại."
    />
  );
}
export function TripScreen({
  tripId,
  go,
  mapOnly = false,
}: {
  tripId: string;
  go: Navigate;
  mapOnly?: boolean;
}) {
  const detail = useResource<IDriverTripDetail>(
    `/tracking/trips/${asId(tripId)}`,
  );
  const map = useResource<ITripMap>(`/tracking/trips/${asId(tripId)}/map`);
  const trip = detail.data;
  return (
    <ResourceState resource={detail}>
      {trip ? (
        <>
          <Badge label={label(trip.orderStatus)} />
          <Card brand>
            <Txt color="#ffffff" size={12}>
              {trip.orderCode} ·{" "}
              {trip.crewRole === "DRIVER" ? "Tài xế" : "Hộ tống"}
            </Txt>
            <Txt color="#ffffff" size={24} bold>
              {trip.legs.find((l) => l.status !== "COMPLETED")
                ?.toLocationName ||
                trip.legs[trip.legs.length - 1]?.toLocationName ||
                "Chưa có lộ trình"}
            </Txt>
            <Txt color="#ffffff">
              Dự kiến đến: {dateTime(trip.plannedArrivalAt)}
            </Txt>
            <Txt color="#ffffff">
              {trip.horses.length} ngựa ·{" "}
              {trip.vehicles.map((v) => v.code).join(", ") || "Chưa có xe"}
            </Txt>
          </Card>
          {mapOnly ? (
            <ResourceState resource={map}>
              {map.data ? <RouteMap map={map.data} /> : null}
            </ResourceState>
          ) : (
            <>
              <Button
                title="Xem tuyến và vị trí"
                kind="secondary"
                onPress={() => go("crew-map", { tripId })}
              />
              {trip.crewRole === "DRIVER" ? (
                <>
                  <Button
                    title="Checklist trước chuyến"
                    icon={ClipboardCheck}
                    kind="secondary"
                    onPress={() => go("checklist", { tripId })}
                  />
                  <DriverControl
                    trip={trip}
                    map={map.error ? null : map.data}
                    go={go}
                    unavailable={!!detail.error || detail.loading}
                  />
                  {map.error ? (
                    <Banner warning text={map.error} onPress={map.reload} />
                  ) : null}
                </>
              ) : null}
              <Section title="Ngựa trong chuyến" />
              {trip.horses.map((horse) => (
                <Row
                  key={horse.id}
                  title={horse.name}
                  detail={`${horse.breed || "Chưa rõ giống"} · ${label(horse.orderStatus)}`}
                  icon={PawPrint}
                  onPress={
                    trip.crewRole === "ESCORT"
                      ? () =>
                          go("report", { tripId, horseId: String(horse.id) })
                      : undefined
                  }
                />
              ))}
              {trip.crewRole === "ESCORT" ? (
                <Button
                  title="Ghi nhanh chăm sóc"
                  icon={Plus}
                  onPress={() => go("quick-log", { tripId })}
                />
              ) : null}
              <Button
                title="Báo sự cố"
                kind="danger"
                onPress={() => go("incident-form", { tripId })}
              />
              <Button
                title="Xem nhật ký chuyến"
                kind="secondary"
                onPress={() => go("journal", { tripId })}
              />
              <Section title="Lộ trình và mốc thực tế" />
              {trip.legs.map((leg) => (
                <Card key={leg.id}>
                  <Txt bold>
                    {leg.fromLocationName} → {leg.toLocationName}
                  </Txt>
                  <Badge label={label(leg.status)} />
                  <Txt>Dự kiến đến {dateTime(leg.plannedArrivalAt)}</Txt>
                  {leg.milestones.map((m) => (
                    <Row
                      key={m.id}
                      title={label(m.milestoneType)}
                      detail={`${dateTime(m.occurredAt)} · ${m.recordedByName}`}
                    />
                  ))}
                  {leg.waypointCheckins.map((w) => (
                    <Row
                      key={w.waypointId}
                      title={w.label}
                      detail={`Đã đến · ${dateTime(w.occurredAt)}`}
                    />
                  ))}
                </Card>
              ))}
            </>
          )}
          <Section title="Liên hệ trong chuyến" />
          {trip.recipient ? (
            <Contact
              name={`Người nhận: ${trip.recipient.name}`}
              phone={trip.recipient.phone}
            />
          ) : (
            <Txt>Chưa có thông tin người nhận.</Txt>
          )}
          {trip.coordinator ? (
            <Contact
              name={`Điều phối: ${trip.coordinator.name}`}
              phone={trip.coordinator.phone}
            />
          ) : null}
          {trip.emergencyHotline ? (
            <Contact name="Hotline cứu hộ" phone={trip.emergencyHotline} />
          ) : null}
        </>
      ) : null}
    </ResourceState>
  );
}
function DriverControl({
  trip,
  map,
  go,
  unavailable,
}: {
  trip: IDriverTripDetail;
  map?: ITripMap | null;
  go: Navigate;
  unavailable: boolean;
}) {
  const { request, write, writing, refresh, user } = useSession();
  const [error, setError] = useState("");
  const action = driverAction(trip, map);
  const send = async () => {
    if (!action) return;
    setError("");
    try {
      await write(async () => {
        if (action.needsChecklist) {
          const saved = await AsyncStorage.getItem(
            `horseroute.checklist:${API_URL}:${user!.id}:${trip.id}`,
          );
          const checked = saved ? (JSON.parse(saved) as string[]) : [];
          if (!checks.every((item) => checked.includes(item))) {
            go("checklist", { tripId: trip.id });
            return;
          }
        }
        await request(action.path, {
          method: "POST",
          body: { ...action.body, occurredAt: new Date().toISOString() },
        });
        refresh();
      });
    } catch (e) {
      setError(messageOf(e));
      refresh();
    }
  };
  return (
    <>
      {error ? <Banner warning text={error} /> : null}
      {action ? (
        <Button
          title={writing ? "Đang ghi mốc…" : action.label}
          disabled={writing || unavailable}
          onPress={() =>
            Alert.alert(
              action.label,
              "Chỉ ghi mốc khi xe đã dừng an toàn. Mốc sẽ được gửi đến hệ thống vận hành.",
              [
                { text: "Chưa ghi", style: "cancel" },
                { text: "Xác nhận", onPress: () => void send() },
              ],
            )
          }
        />
      ) : (
        <Banner
          text={
            trip.orderStatus === "DELIVERED"
              ? "Chuyến đã hoàn thành."
              : "Chưa có hành động ghi mốc phù hợp. Kiểm tra trạng thái chuyến và dữ liệu lộ trình."
          }
        />
      )}
    </>
  );
}
export function ChecklistScreen({
  tripId,
  go,
}: {
  tripId: string;
  go: Navigate;
}) {
  const { user } = useSession();
  const [checked, setChecked] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const key = `horseroute.checklist:${API_URL}:${user!.id}:${tripId}`;
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (live && raw) {
          const value = JSON.parse(raw);
          if (Array.isArray(value))
            setChecked(
              value.filter(
                (x: unknown): x is string =>
                  typeof x === "string" && checks.includes(x),
              ),
            );
        }
      })
      .catch(() =>
        setError("Không đọc được checklist. Hãy kiểm tra lại các mục."),
      )
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [key]);
  const save = async () => {
    setBusy(true);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(checked));
      go("trip", { tripId });
    } catch {
      setError("Không lưu được checklist trên thiết bị.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Txt size={24} bold>
        Kiểm tra trước chuyến
      </Txt>
      <Banner text="Checklist lưu riêng cho chuyến và tài khoản trên thiết bị này. Backend chưa có API checklist." />
      {checks.map((item) => (
        <Chip
          key={item}
          label={item}
          selected={checked.includes(item)}
          disabled={!ready || busy}
          onPress={() =>
            setChecked((previous) =>
              previous.includes(item)
                ? previous.filter((v) => v !== item)
                : [...previous, item],
            )
          }
        />
      ))}
      {error ? <Banner warning text={error} /> : null}
      <Button
        title="Lưu checklist"
        disabled={!ready || busy || checked.length !== checks.length}
        onPress={() => void save()}
      />
    </>
  );
}
export function JournalScreen({
  tripId,
  incidentsOnly = false,
  go,
}: {
  tripId: string;
  incidentsOnly?: boolean;
  go: Navigate;
}) {
  const detail = useResource<IDriverTripDetail>(
    `/tracking/trips/${asId(tripId)}`,
  );
  const incidents = useResource<IIncident[]>(
    `/tracking/trips/${asId(tripId)}/incidents`,
  );
  const logs = useResource<IHorseLog[]>(
    !incidentsOnly ? `/tracking/trips/${asId(tripId)}/horse-logs` : null,
  );
  const care = useResource<ICareActivityList>(
    !incidentsOnly ? `/tracking/trips/${asId(tripId)}/care-activities` : null,
  );
  return (
    <>
      {!incidentsOnly ? (
        <>
          <Section title="Nhật ký chăm sóc" />
          <ResourceState resource={care}>
            {care.data ? (
              <>
                <Card>
                  <Txt bold>Tổng hợp hoạt động đã ghi nhận</Txt>
                  <Txt>
                    {care.data.summary.waterLiters} L nước ·{" "}
                    {care.data.summary.meals} lần cho ăn ·{" "}
                    {care.data.summary.restMinutes} phút nghỉ
                  </Txt>
                </Card>
                {care.data.activities.length ? (
                  care.data.activities.map((item) => (
                    <Row
                      key={item.id}
                      title={`${label(item.activityType)} · ${item.horseName || "Cả đoàn"}`}
                      detail={`${item.feedDescription || (item.amountLiters !== null ? `${item.amountLiters} L` : `${item.durationMinutes} phút`)} · ${dateTime(item.performedAt)}`}
                      icon={PawPrint}
                    />
                  ))
                ) : (
                  <Empty title="Chưa có hoạt động chăm sóc" />
                )}
              </>
            ) : null}
          </ResourceState>
          <Section title="Báo cáo sức khỏe" />
          <ResourceState resource={logs}>
            {logs.data?.length ? (
              logs.data.map((log) => (
                <Card key={log.id}>
                  <Txt bold>
                    {log.horseName} · {label(log.conditionStatus)}
                  </Txt>
                  <Badge
                    label={
                      log.reportStatus ? label(log.reportStatus) : "Nhật ký"
                    }
                  />
                  <Txt>
                    {dateTime(log.loggedAt)} · {log.createdByName}
                  </Txt>
                  {log.note ? <Txt>Nội bộ: {log.note}</Txt> : null}
                  {log.customerNote ? (
                    <Txt>Gửi khách: {log.customerNote}</Txt>
                  ) : null}
                  {log.bodyTempC !== null ? (
                    <Txt>{log.bodyTempC} °C</Txt>
                  ) : null}
                  {log.customerViewedAt ? (
                    <Txt>Khách đã xem: {dateTime(log.customerViewedAt)}</Txt>
                  ) : null}
                  {log.attachments.map((photo) => (
                    <PrivateImage
                      key={photo.id}
                      path={`/tracking/attachments/${asId(photo.id)}`}
                      caption={photo.caption || log.horseName}
                    />
                  ))}
                </Card>
              ))
            ) : (
              <Empty title="Chưa có báo cáo sức khỏe" />
            )}
          </ResourceState>
          {detail.data?.crewRole === "ESCORT" ? (
            <Button
              title="Ghi nhanh chăm sóc"
              onPress={() => go("quick-log", { tripId })}
            />
          ) : null}
        </>
      ) : null}
      <Section title="Sự cố trong chuyến" />
      <ResourceState resource={incidents}>
        {incidents.data?.length ? (
          incidents.data.map((incident) => (
            <Card key={incident.id}>
              <Badge
                label={label(incident.status)}
                tone={incident.status === "CLOSED" ? "success" : "warning"}
              />
              <Txt bold>
                #{incident.id} · {label(incident.incidentType)}
              </Txt>
              <Txt>
                {label(incident.severity)} · {dateTime(incident.reportedAt)}
              </Txt>
              <Txt>{incident.description}</Txt>
              {incident.locationText ? (
                <Txt>Vị trí: {incident.locationText}</Txt>
              ) : null}
              {incident.responses?.map((response) => (
                <Row
                  key={response.id}
                  title={response.note}
                  detail={`${response.sentByName} · ${dateTime(response.sentAt)}`}
                />
              ))}
              {incident.attachments.map((photo) => (
                <PrivateImage
                  key={photo.id}
                  path={`/tracking/attachments/${asId(photo.id)}`}
                  caption={photo.caption || "Ảnh sự cố"}
                />
              ))}
            </Card>
          ))
        ) : (
          <Empty title="Chưa có sự cố" />
        )}
      </ResourceState>
      <Button
        title="Báo sự cố"
        kind="danger"
        onPress={() => go("incident-form", { tripId })}
      />
    </>
  );
}
export function CrewFormScreen({
  tripId,
  horseId,
  screen,
  go,
}: {
  tripId: string;
  horseId?: string;
  screen: string;
  go: Navigate;
}) {
  const resource = useResource<IDriverTripDetail>(
    `/tracking/trips/${asId(tripId)}`,
  );
  return (
    <ResourceState resource={resource}>
      {resource.data ? (
        <CrewForm
          trip={resource.data}
          horseId={horseId}
          screen={screen}
          go={go}
        />
      ) : null}
    </ResourceState>
  );
}
function CrewForm({
  trip,
  horseId,
  screen,
  go,
}: {
  trip: IDriverTripDetail;
  horseId?: string;
  screen: string;
  go: Navigate;
}) {
  const { request, write, writing, refresh } = useSession();
  const quick = screen === "quick-log",
    incident = screen === "incident-form";
  const [selected, setSelected] = useState<string[]>(horseId ? [horseId] : []);
  const [activity, setActivity] = useState("WATER");
  const [amount, setAmount] = useState("");
  const [feed, setFeed] = useState("");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [damage, setDamage] = useState("VEHICLE");
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState("STABLE");
  const [temperature, setTemperature] = useState("");
  const [pulse, setPulse] = useState("");
  const [appetite, setAppetite] = useState("NORMAL");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const sent = useRef(new Set<string>());
  const [partial, setPartial] = useState(false);
  const leg =
    trip.legs.find((l) => l.status === "MOVING" || l.status === "AT_STOP") ??
    trip.legs.find((l) => l.status !== "COMPLETED");
  const submit = async () => {
    setError("");
    try {
      await write(async () => {
        if (!leg)
          throw new Error("Chuyến không có chặng đang hoạt động để ghi nhận.");
        if (!incident && trip.crewRole !== "ESCORT")
          throw new Error(
            "Chỉ người hộ tống được ghi chăm sóc và báo cáo sức khỏe.",
          );
        if ((!incident || type === "HORSE_MEDICAL") && !selected.length)
          throw new Error("Chọn ngựa cần ghi nhận.");
        if (
          selected.some((id) => !trip.horses.some((h) => String(h.id) === id))
        )
          throw new Error("Ngựa không thuộc chuyến. Tải lại danh sách.");
        const when = new Date().toISOString();
        if (incident) {
          if (!type || !severity || note.trim().length < 5)
            throw new Error("Chọn loại, mức độ và nhập mô tả ít nhất 5 ký tự.");
          const form = new FormData();
          Object.entries({
            incidentType: type,
            severity,
            damageTarget: type === "HORSE_MEDICAL" ? "HORSE" : damage,
            description: note.trim(),
            locationText: location.trim(),
            legId: leg.id,
            ...(type === "HORSE_MEDICAL" ? { horseId: selected[0] } : {}),
          }).forEach(([key, value]) => {
            if (value) form.append(key, value);
          });
          appendPhoto(form, photo);
          await request(`/tracking/trips/${asId(trip.id)}/incidents`, {
            method: "POST",
            body: form,
          });
        } else if (quick) {
          const number = Number(amount.replace(",", "."));
          if (activity === "FEED" && !feed.trim())
            throw new Error("Nhập khẩu phần thức ăn.");
          if (
            activity === "WATER" &&
            (!Number.isFinite(number) ||
              number < 0.1 ||
              number > 200 ||
              Math.abs(number * 10 - Math.round(number * 10)) > 0.000001)
          )
            throw new Error(
              "Lượng nước từ 0,1 đến 200 L, tối đa một số thập phân.",
            );
          if (
            activity === "REST" &&
            (!Number.isInteger(number) || number < 1 || number > 720)
          )
            throw new Error("Thời gian nghỉ từ 1 đến 720 phút.");
          for (const id of selected) {
            if (sent.current.has(id)) continue;
            await request(`/tracking/trips/${asId(trip.id)}/care-activities`, {
              method: "POST",
              body: {
                activityType: activity,
                horseId: id,
                performedAt: when,
                ...(activity === "WATER"
                  ? { amountLiters: number }
                  : activity === "FEED"
                    ? { feedDescription: feed.trim() }
                    : { durationMinutes: number }),
                ...(note.trim() ? { note: note.trim() } : {}),
              },
            });
            sent.current.add(id);
            setPartial(true);
          }
        } else {
          const temp = temperature
            ? Number(temperature.replace(",", "."))
            : null;
          const heart = pulse ? Number(pulse) : null;
          if (
            temp !== null &&
            (!Number.isFinite(temp) || temp < 30 || temp > 45)
          )
            throw new Error("Nhiệt độ phải từ 30 đến 45 °C.");
          if (
            heart !== null &&
            (!Number.isInteger(heart) || heart < 10 || heart > 200)
          )
            throw new Error("Nhịp tim phải từ 10 đến 200 nhịp/phút.");
          if (condition !== "STABLE" && !photo)
            throw new Error("Báo cáo bất thường cần ít nhất một ảnh.");
          const form = new FormData();
          Object.entries({
            horseId: selected[0],
            conditionStatus: condition,
            loggedAt: when,
            reportStatus: "SENT",
            sendToCustomer: "true",
            appetite,
            customerNote: note.trim(),
            ...(temp !== null ? { bodyTempC: String(temp) } : {}),
            ...(heart !== null ? { heartRateBpm: String(heart) } : {}),
          }).forEach(([key, value]) => form.append(key, value));
          appendPhoto(form, photo);
          await request(`/tracking/legs/${asId(leg.id)}/horse-logs`, {
            method: "POST",
            body: form,
          });
        }
        refresh();
        go(incident ? "incidents" : "journal", { tripId: trip.id });
      });
    } catch (e) {
      setError(messageOf(e));
    }
  };
  if (!incident && trip.crewRole !== "ESCORT")
    return <Empty title="Bạn không có quyền ghi chăm sóc trong chuyến này" />;
  const locked = writing || partial;
  return (
    <>
      <Txt>{trip.orderCode}</Txt>
      {partial ? (
        <Banner
          warning
          text={`Đã lưu cho ${sent.current.size} ngựa. Nội dung được khóa; gửi tiếp chỉ áp dụng cho các ngựa còn lại. Nếu bị mất kết nối, kiểm tra nhật ký trước khi gửi lại.`}
        />
      ) : null}
      {quick ? (
        <>
          <Section title="Hoạt động" />
          <View style={s.wrap}>
            {["WATER", "FEED", "REST"].map((value) => (
              <Chip
                key={value}
                label={label(value)}
                selected={activity === value}
                disabled={locked}
                onPress={() => setActivity(value)}
              />
            ))}
          </View>
        </>
      ) : incident ? (
        <>
          <Section title="Loại sự cố *" />
          <View style={s.wrap}>
            {["VEHICLE_BREAKDOWN", "LONG_TRAFFIC_JAM", "HORSE_MEDICAL"].map(
              (value) => (
                <Chip
                  key={value}
                  label={label(value)}
                  selected={type === value}
                  disabled={locked}
                  onPress={() => setType(value)}
                />
              ),
            )}
          </View>
          <Section title="Mức độ *" />
          <View style={s.wrap}>
            {["YELLOW", "ORANGE", "RED"].map((value) => (
              <Chip
                key={value}
                label={label(value)}
                selected={severity === value}
                disabled={locked}
                onPress={() => setSeverity(value)}
              />
            ))}
          </View>
          {type !== "HORSE_MEDICAL" ? (
            <>
              <Section title="Đối tượng ảnh hưởng" />
              <View style={s.wrap}>
                {[
                  ["VEHICLE", "Xe"],
                  ["HORSE", "Ngựa"],
                  ["BOTH", "Xe và ngựa"],
                ].map(([value, text]) => (
                  <Chip
                    key={value}
                    label={text}
                    selected={damage === value}
                    disabled={locked}
                    onPress={() => setDamage(value)}
                  />
                ))}
              </View>
            </>
          ) : null}
          <Field
            label="Địa điểm xảy ra sự cố"
            value={location}
            onChangeText={setLocation}
            maxLength={255}
            editable={!locked}
          />
        </>
      ) : null}
      {!incident || type === "HORSE_MEDICAL" ? (
        <>
          <Section title="Chọn ngựa *" />
          <View style={s.wrap}>
            {trip.horses.map((h) => (
              <Chip
                key={h.id}
                label={h.name}
                selected={selected.includes(String(h.id))}
                disabled={locked}
                onPress={() =>
                  setSelected((old) =>
                    quick
                      ? old.includes(String(h.id))
                        ? old.filter((v) => v !== String(h.id))
                        : [...old, String(h.id)]
                      : [String(h.id)],
                  )
                }
              />
            ))}
          </View>
        </>
      ) : null}
      {quick ? (
        activity === "FEED" ? (
          <Field
            label="Khẩu phần *"
            value={feed}
            onChangeText={setFeed}
            maxLength={200}
            editable={!locked}
            placeholder="Ví dụ: 3 kg cỏ khô"
          />
        ) : (
          <Field
            label={
              activity === "WATER"
                ? "Lượng nước mỗi ngựa (L) *"
                : "Thời gian nghỉ (phút) *"
            }
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            editable={!locked}
          />
        )
      ) : !incident ? (
        <>
          <Section title="Tình trạng sức khỏe" />
          <View style={s.wrap}>
            {["STABLE", "OFF_FEED", "STRESSED", "CLIMATE_CHANGE"].map(
              (value) => (
                <Chip
                  key={value}
                  label={label(value)}
                  selected={condition === value}
                  disabled={locked}
                  onPress={() => setCondition(value)}
                />
              ),
            )}
          </View>
          <Field
            label="Nhiệt độ (°C), nếu đã đo"
            value={temperature}
            onChangeText={setTemperature}
            keyboardType="decimal-pad"
            editable={!locked}
          />
          <Field
            label="Nhịp tim, nếu đã đo"
            value={pulse}
            onChangeText={setPulse}
            keyboardType="number-pad"
            editable={!locked}
          />
          <Section title="Ăn uống" />
          <View style={s.wrap}>
            {["NORMAL", "REDUCED", "REFUSED"].map((value) => (
              <Chip
                key={value}
                label={label(value)}
                selected={appetite === value}
                disabled={locked}
                onPress={() => setAppetite(value)}
              />
            ))}
          </View>
          <Banner text="Báo cáo được gửi cho khách hàng. Chỉ nhập số đo và tình trạng đã kiểm tra thực tế." />
        </>
      ) : null}
      {!quick ? <PhotoPicker uri={photo} onChange={setPhoto} /> : null}
      <Field
        label={
          incident
            ? "Mô tả sự cố *"
            : quick
              ? "Ghi chú"
              : "Ghi chú gửi khách hàng"
        }
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={incident ? 2000 : quick ? 255 : 1000}
        editable={!locked}
      />
      {error ? <Banner warning text={error} /> : null}
      <Button
        title={writing ? "Đang gửi…" : quick ? "Lưu chăm sóc" : "Gửi báo cáo"}
        disabled={writing}
        onPress={() => void submit()}
      />
      {error ? (
        <Button
          title="Kiểm tra nhật ký trên máy chủ"
          kind="secondary"
          disabled={writing}
          onPress={() => {
            refresh();
            go(incident ? "incidents" : "journal", { tripId: trip.id });
          }}
        />
      ) : null}
    </>
  );
}
