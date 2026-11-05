import React, { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Lock, Navigation, PawPrint, Truck } from "lucide-react-native";
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  Field,
  Row,
  Section,
  CheckRow,
  ScreenBody,
  StatusBadge,
  Txt,
  s,
  useTheme,
} from "../ui";
import { useOverlay } from "../overlay";
import { enqueue } from "../queue";
import { DriverTrip, EscortTrip } from "./TripScreens";
import {
  HorseDetail,
  IncidentForm,
  IncidentSent,
  IncidentsTab,
  LogTab,
  QuickLogSheet,
  ReportForm,
  TripMapScreen,
} from "./CrewWork";
import { orderStatus } from "../theme";
import { useResource, useSession } from "../session";
import {
  appendPhoto,
  Contact,
  Empty,
  PhotoPicker,
  PrivateImage,
  ResourceState,
  RouteMap,
  NotFound,
} from "../live-ui";
import { CONTINUE_ANYWAY, asId, checks, dateTime, label } from "../live-domain";
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

/**
 * DRV-01 Chuyến của tôi / ESC-09 Lịch sử chuyến. Quyết định 30/10: khi đang có chuyến chạy thì
 * chuyến sắp tới khóa kèm lý do; chuyến đã giao vẫn xem lại được. Cả thẻ là vùng chạm.
 */
export function TripList({
  trips,
  go,
}: {
  trips: IDriverTripSummary[];
  go: Navigate;
}) {
  const { colors: c } = useTheme();
  if (!trips.length)
    return (
      <Empty
        icon={Truck}
        title="Chưa có chuyến được phân công"
        detail="Chuyến sẽ xuất hiện khi điều phối phân công tài khoản này. Kéo xuống để tải lại."
      />
    );
  const running = trips.find((t) => t.orderStatus === "IN_TRANSIT");
  const byTime = (a: IDriverTripSummary, b: IDriverTripSummary) =>
    Date.parse(a.plannedDepartureAt ?? "") -
    Date.parse(b.plannedDepartureAt ?? "");
  const groups: [string, IDriverTripSummary[]][] = [
    ["Đang chạy", trips.filter((t) => t.orderStatus === "IN_TRANSIT")],
    [
      "Sắp tới",
      trips
        .filter(
          (t) =>
            t.orderStatus !== "IN_TRANSIT" && t.orderStatus !== "DELIVERED",
        )
        .sort(byTime),
    ],
    [
      "Đã giao",
      trips
        .filter((t) => t.orderStatus === "DELIVERED")
        .sort((a, b) => byTime(b, a)),
    ],
  ];
  return (
    <>
      {groups.map(([title, list]) =>
        list.length ? (
          <React.Fragment key={title}>
            <Section title={title} />
            {list.map((trip) => {
              const locked =
                running && running.id !== trip.id && title === "Sắp tới"
                  ? `Mở được khi chuyến ${running.orderCode} hoàn tất.`
                  : null;
              const route = `${trip.legs[0]?.fromLocationName || "Chưa có lộ trình"} → ${
                trip.legs[trip.legs.length - 1]?.toLocationName ||
                "Chưa có điểm giao"
              }`;
              const body = (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Txt
                      size={12}
                      bold
                      numberOfLines={1}
                      style={{ flexShrink: 0 }}
                    >
                      {trip.orderCode}
                    </Txt>
                    <StatusBadge
                      spec={
                        orderStatus[trip.orderStatus] ?? {
                          label: label(trip.orderStatus),
                          tone: "neutral",
                          icon: "truck",
                        }
                      }
                    />
                  </View>
                  <Txt size={17} bold>
                    {route}
                  </Txt>
                  <Txt size={15} color={c.textSecondary}>
                    {`${trip.crewRole === "DRIVER" ? "Tài xế" : "Hộ tống"} · Khởi hành ${dateTime(trip.plannedDepartureAt)}`}
                  </Txt>
                  {locked ? (
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <Lock size={18} color={c.textSecondary} />
                      <Txt
                        size={15}
                        color={c.textSecondary}
                        style={{ flex: 1 }}
                      >
                        {locked}
                      </Txt>
                    </View>
                  ) : null}
                </>
              );
              return locked ? (
                <Card key={trip.id} style={{ opacity: 0.7 }}>
                  {body}
                </Card>
              ) : (
                <Card
                  key={trip.id}
                  label={`${trip.orderCode}, ${route}`}
                  onPress={() => go("trip", { tripId: String(trip.id) })}
                >
                  {body}
                </Card>
              );
            })}
          </React.Fragment>
        ) : null,
      )}
    </>
  );
}
export function TripScreen({ tripId, go }: { tripId: string; go: Navigate }) {
  const detail = useResource<IDriverTripDetail>(
    `/tracking/trips/${asId(tripId)}`,
  );
  const map = useResource<ITripMap>(`/tracking/trips/${asId(tripId)}/map`);
  const trip = detail.data;
  if (trip?.crewRole === "DRIVER")
    return (
      <DriverTrip
        trip={trip}
        // Mất sóng vẫn dùng bản đồ đã lưu: điểm dừng tiếp theo lấy từ đây.
        map={map.data ?? null}
        mapFailed={map.data === undefined && !!map.error}
        go={go}
        reload={() => {
          detail.reload();
          map.reload();
        }}
      />
    );
  if (trip) return <EscortTrip trip={trip} go={go} reload={detail.reload} />;
  return (
    <ScrollView contentContainerStyle={s.content}>
      <ResourceState resource={detail} what="chuyến" skeleton="detail">
        {null}
      </ResourceState>
    </ScrollView>
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
  const { colors: c } = useTheme();
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
  const { confirm } = useOverlay();
  const save = async () => {
    let value = checked;
    if (checked.length < checks.length) {
      // F-D2: còn mục chưa tick vẫn cho đi tiếp sau khi tài xế xác nhận.
      const ok = await confirm({
        title: `Còn ${checks.length - checked.length} mục chưa kiểm tra`,
        body: "Vẫn tiếp tục khởi hành?",
        cancelLabel: "Kiểm tra tiếp",
        confirmLabel: "Vẫn tiếp tục",
      });
      if (!ok) return;
      value = [...checked, CONTINUE_ANYWAY];
    }
    setBusy(true);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      go("back");
    } catch {
      setError("Không lưu được checklist trên thiết bị.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScreenBody
      footer={
        <>
          <Button
            title="Xong, sẵn sàng khởi hành"
            large
            disabled={!ready || busy}
            onPress={() => void save()}
          />
          {checked.length < checks.length ? (
            <Button
              title="Đánh dấu tất cả"
              kind="tertiary"
              disabled={!ready || busy}
              onPress={() => setChecked([...checks])}
            />
          ) : null}
        </>
      }
    >
      <Txt size={15} color={c.textSecondary}>
        {`${checked.length}/${checks.length} mục. Đi một vòng quanh xe và chạm từng mục khi đã kiểm tra. Danh sách lưu trên máy này.`}
      </Txt>
      <Card>
        {checks.map((item) => (
          <CheckRow
            key={item}
            label={item}
            checked={checked.includes(item)}
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
      </Card>
      {error ? <Banner warning text={error} /> : null}
    </ScreenBody>
  );
}
/** Các màn làm việc cần dữ liệu chuyến: tải chi tiết chuyến một lần rồi giao cho màn tương ứng. */
export function CrewRoute({
  screen,
  tripId,
  horseId,
  incidentType,
  queueId,
  go,
  replace,
}: {
  screen: string;
  tripId: string;
  horseId?: string;
  incidentType?: string;
  /** Mục hàng chờ của sự cố vừa báo (màn Đã báo sự cố). */
  queueId?: string;
  go: Navigate;
  replace: Navigate;
}) {
  const detail = useResource<IDriverTripDetail>(
    `/tracking/trips/${asId(tripId)}`,
  );
  const [quickLog, setQuickLog] = useState(false);
  const trip = detail.data;
  if (!trip)
    return (
      <ScrollView contentContainerStyle={s.content}>
        <ResourceState resource={detail} what="chuyến" skeleton="detail">
          {null}
        </ResourceState>
      </ScrollView>
    );
  if (screen === "incidents") return <IncidentsTab trip={trip} go={go} />;
  if (screen === "journal")
    return (
      <>
        <LogTab trip={trip} go={go} onQuickLog={() => setQuickLog(true)} />
        <QuickLogSheet
          visible={quickLog}
          onClose={() => setQuickLog(false)}
          trip={trip}
        />
      </>
    );
  if (screen === "incident-form")
    return (
      <IncidentForm
        trip={trip}
        incidentType={incidentType}
        horseId={horseId}
        go={go}
        replace={replace}
      />
    );
  if (screen === "incident-sent")
    return (
      <IncidentSent
        trip={trip}
        value={incidentType}
        queueId={queueId}
        go={go}
      />
    );
  if (screen === "report" && horseId)
    return <ReportForm trip={trip} horseId={horseId} go={go} />;
  if (screen === "crew-horse" && horseId)
    return <HorseDetail trip={trip} horseId={horseId} go={go} />;
  if (screen === "crew-map") return <TripMapScreen trip={trip} />;
  return (
    <ScrollView contentContainerStyle={s.content}>
      <NotFound
        title="Không tìm thấy nội dung"
        detail="Chuyến có thể đã được điều phối đổi hoặc gỡ khỏi tài khoản này."
      />
    </ScrollView>
  );
}
