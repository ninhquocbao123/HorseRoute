import {
  ArrowLeftOutlined,
  CarOutlined,
  TeamOutlined,
  SendOutlined,
  EnvironmentOutlined,
  PlusOutlined,
  CheckOutlined,
  UserOutlined,
  SaveOutlined,
  StopOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  TimePicker,
  Empty,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Select,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useTripDetailQuery } from "../../trips/hooks/use-trip-detail-query";
import { useTripPlanOptionsQuery } from "../../trips/hooks/use-trip-plan-options-query";
import { useTripAssignmentsQuery } from "../../trips/hooks/use-trip-assignments-query";
import {
  saveTripPlan,
  saveTripAssignments,
  submitTripPlan,
} from "../../trips/api/trips.api";
import { inputToUtc, utcToInput } from "../../trips/utils/trip-time.utils";
import { tripPlanSchema } from "../../trips/schemas/trip-plan.schema";
import { tripQueryKeys } from "../../trips/constants/trip-query-keys";
import type {
  TripPlanLegInput,
  TripAssignmentsInput,
} from "../../trips/types/trip.types";
import { useAuth } from "../../../features/auth/hooks/useAuth";
import { errorMessage } from "../../../features/tracking/tracking.api";
import TripRoutePlanner from "../maps/TripRoutePlanner";
import { tripLoadError } from "./trip-error";
import { isValidTripId } from "../../trips/utils/trip-detail.utils";
import TripOrderSidebar from "./TripOrderSidebar";
export default function CoordinatorTripPage() {
  const { tripId = "" } = useParams();
  return isValidTripId(tripId) ? (
    <TripWorkspace key={tripId} id={tripId} />
  ) : (
    <Alert type="error" message="ID chuyến không hợp lệ" />
  );
}
function TripWorkspace({ id }: { id: string }) {
  const detail = useTripDetailQuery(id),
    options = useTripPlanOptionsQuery(id),
    crew = useTripAssignmentsQuery(id);
  const { account } = useAuth();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { setDirty, go } = useOutletContext<{
    setDirty: (v: boolean) => void;
    go: (p: string) => void;
  }>();
  const [legs, setLegs] = useState<TripPlanLegInput[]>([]);
  const [roster, setRoster] = useState<TripAssignmentsInput["assignments"]>([]);
  const [changed, setChanged] = useState(false),
    [crewChanged, setCrewChanged] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [vehicleLeg, setVehicleLeg] = useState<number | null>(null),
    [crewOpen, setCrewOpen] = useState(false),
    [search, setSearch] = useState("");
  const [pendingVehicle, setPendingVehicle] = useState("");
  const [pendingRoster, setPendingRoster] = useState<
    TripAssignmentsInput["assignments"]
  >([]);
  const [vehiclePage, setVehiclePage] = useState(1);
  const [vehiclePageSize, setVehiclePageSize] = useState(12);
  const [vehicleStatus, setVehicleStatus] = useState("AVAILABLE");
  const [vehicleType, setVehicleType] = useState("ALL");
  const [vehicleCapacity, setVehicleCapacity] = useState<number | null>(null);
  const [crewPages, setCrewPages] = useState({ DRIVER: 1, ESCORT: 1 });
  const [activeCrewRole, setActiveCrewRole] = useState<"DRIVER" | "ESCORT">(
    "DRIVER",
  );
  const [crewStatus, setCrewStatus] = useState("AVAILABLE");
  const [crewPageSize, setCrewPageSize] = useState(12);
  const dirty = changed || crewChanged;
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  useEffect(() => {
    if (detail.data && !changed)
      setLegs(
        detail.data.legs.length
          ? detail.data.legs.map((l) => ({
              id: l.id,
              fromLocationId: l.fromLocationId,
              toLocationId: l.toLocationId,
              vehicleId: l.vehicleId || "",
              plannedDepartureAt: utcToInput(l.plannedDepartureAt),
              plannedArrivalAt: utcToInput(l.plannedArrivalAt),
            }))
          : [
              {
                fromLocationId: "",
                toLocationId: "",
                vehicleId: "",
                plannedDepartureAt: "",
                plannedArrivalAt: "",
              },
            ],
      );
  }, [detail.data, changed]);
  useEffect(() => {
    if (crew.assignments.data && !crewChanged)
      setRoster(
        crew.assignments.data.items.map((a) => ({
          userId: a.userId,
          role: a.role,
        })),
      );
  }, [crew.assignments.data, crewChanged]);
  const crewEditable =
    !!detail.data &&
    ["APPROVED", "PREPARING"].includes(detail.data.orderStatus) &&
    detail.data.legs.every((l) => l.status === "NOT_STARTED");
  const editable =
    detail.data?.planStatus === "DRAFT" &&
    ["APPROVED", "PREPARING"].includes(detail.data.orderStatus) &&
    detail.data.legs.every((leg) => leg.status === "NOT_STARTED");
  function update(index: number, patch: Partial<TripPlanLegInput>) {
    setLegs((v) => v.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    setChanged(true);
  }
  async function save(send: boolean) {
    if (!editable || busy) return;
    setError("");
    if (!legs.length) {
      setError("Vui lòng thêm ít nhất một chặng vận chuyển.");
      return;
    }
    const incompleteLeg = legs.findIndex(
      (l) => !l.fromLocationId || !l.toLocationId || !l.vehicleId,
    );
    if (incompleteLeg !== -1) {
      setError(
        `Chặng ${incompleteLeg + 1}: vui lòng chọn đủ điểm đi, điểm đến và phương tiện.`,
      );
      return;
    }
    if (
      legs.some(
        (l) =>
          !Number.isFinite(Date.parse(l.plannedDepartureAt)) ||
          !Number.isFinite(Date.parse(l.plannedArrivalAt)),
      )
    ) {
      setError("Vui lòng nhập đầy đủ ngày giờ hợp lệ cho từng chặng.");
      return;
    }
    const result = tripPlanSchema.safeParse({ legs });
    if (!result.success) {
      setError(result.error.issues.map((i) => i.message).join(" "));
      return;
    }
    if (
      crewChanged &&
      (roster.length < 2 ||
        new Set(roster.map((r) => r.userId)).size !== roster.length ||
        !roster.some((r) => r.role === "DRIVER") ||
        !roster.some((r) => r.role === "ESCORT"))
    ) {
      setError("Cần tài xế và hộ tống khác người.");
      return;
    }
    setBusy(true);
    let planSaved = false;
    try {
      const saved = await saveTripPlan(id, {
        legs: legs.map((l) => ({
          ...l,
          plannedDepartureAt: inputToUtc(l.plannedDepartureAt),
          plannedArrivalAt: inputToUtc(l.plannedArrivalAt),
        })),
      });
      planSaved = true;
      qc.setQueryData(tripQueryKeys.detail(account?.id, id), saved);
      setChanged(false);
      if (crewChanged) {
        const savedCrew = await saveTripAssignments(id, {
          assignments: roster,
        });
        qc.setQueryData(tripQueryKeys.assignments(account?.id, id), savedCrew);
        setCrewChanged(false);
      }
      if (send) {
        const submitted = await submitTripPlan(id);
        qc.setQueryData(tripQueryKeys.detail(account?.id, id), submitted);
      }
      void message.success(
        send ? "Đã lưu và gửi duyệt kế hoạch." : "Đã lưu kế hoạch.",
      );
    } catch (e) {
      setError(
        `${planSaved ? "Kế hoạch đã lưu; bước tiếp theo chưa được xác nhận. " : ""}${errorMessage(e)}`,
      );
      if (send) void detail.refetch();
    } finally {
      setBusy(false);
      void qc.invalidateQueries({ queryKey: ["trips", account?.id, "list"] });
      void detail.refetch();
    }
  }

  async function saveCrewOnly() {
    if (!crewEditable || busy || !crewChanged) return;
    if (
      roster.length < 2 ||
      !roster.some((r) => r.role === "DRIVER") ||
      !roster.some((r) => r.role === "ESCORT") ||
      new Set(roster.map((r) => r.userId)).size !== roster.length
    ) {
      setError("Cần tài xế và hộ tống khác người.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await saveTripAssignments(id, { assignments: roster });
      qc.setQueryData(tripQueryKeys.assignments(account?.id, id), saved);
      setCrewChanged(false);
      await detail.refetch();
      void message.success("Đã lưu phân công nhân sự.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      void qc.invalidateQueries({ queryKey: ["trips", account?.id, "list"] });
    }
  }
  if (detail.isPending) return <Spin />;
  if (detail.isError || !detail.data)
    return (
      <Alert
        type="error"
        message="Không tải được chuyến"
        description={
          <>
            <p>{tripLoadError(detail.error)}</p>
            <Button onClick={() => go("/coordinator/trips")}>
              Về danh sách chuyến
            </Button>
          </>
        }
        action={<Button onClick={() => void detail.refetch()}>Thử lại</Button>}
      />
    );
  const trip = detail.data;
  const resourcesLoading =
    options.isPending || crew.assignments.isPending || crew.options.isPending;
  const personName = (key: string) =>
    crew.options.data?.items.find((p) => p.id === key)?.fullName ||
    crew.assignments.data?.items.find((p) => p.userId === key)?.fullName ||
    key;
  const vehicleName = (key: string) =>
    options.data?.vehicles.find((v) => v.id === key)?.plateOrCode ||
    trip.legs.find((l) => l.vehicleId === key)?.vehicleCode ||
    key;
  const locations = options.data?.locations || [];
  const vehicles = options.data?.vehicles || [];
  const normalizedSearch = search.trim().toLocaleLowerCase("vi");
  const filteredVehicles = vehicles.filter(
    (vehicle) =>
      vehicle.plateOrCode.toLocaleLowerCase("vi").includes(normalizedSearch) &&
      (vehicleStatus === "ALL" || vehicle.status === vehicleStatus) &&
      (vehicleType === "ALL" || vehicle.vehicleType === vehicleType) &&
      (vehicleCapacity === null || vehicle.capacityStalls >= vehicleCapacity),
  );
  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === pendingVehicle,
  );
  const knownCrew = [...(crew.options.data?.items ?? [])];
  for (const assigned of crew.assignments.data?.items ?? []) {
    if (!knownCrew.some((person) => person.id === assigned.userId))
      knownCrew.push({
        id: assigned.userId,
        fullName: assigned.fullName,
        crewType: assigned.crewType,
        workStatus: assigned.workStatus,
        selectable: false,
        scheduleEvaluation: "NOT_EVALUATED",
        blockingReasons: [
          {
            code: "PERSISTED_INVALID_ASSIGNMENT",
            message: "Phân công cũ không còn hợp lệ; cần thay thế.",
          },
        ],
      });
  }
  const filteredCrew = knownCrew.filter((person) =>
    person.fullName.toLocaleLowerCase("vi").includes(normalizedSearch),
  );
  const visibleCrew = filteredCrew.filter(
    (person) =>
      person.crewType === activeCrewRole &&
      (crewStatus === "ALL" || person.workStatus === crewStatus),
  );
  const crewSelectionComplete =
    pendingRoster.some((item) => item.role === "DRIVER") &&
    pendingRoster.some((item) => item.role === "ESCORT") &&
    new Set(pendingRoster.map((item) => item.userId)).size ===
      pendingRoster.length;
  const assignedVehicleCount = legs.filter((leg) => leg.vehicleId).length;
  const vehiclesComplete =
    legs.length > 0 && assignedVehicleCount === legs.length;
  const assignedVehicleNames = [
    ...new Set(
      legs
        .filter((leg) => leg.vehicleId)
        .map((leg) => vehicleName(leg.vehicleId)),
    ),
  ];
  const rosterNames = (role: "DRIVER" | "ESCORT") =>
    roster
      .filter((item) => item.role === role)
      .map((item) => personName(item.userId));
  const driverNames = rosterNames("DRIVER");
  const escortNames = rosterNames("ESCORT");
  const crewComplete = driverNames.length > 0 && escortNames.length > 0;

  const serverBlockers = crewChanged
    ? []
    : (crew.assignments.data?.crewReadiness.blockers ?? []);
  const readinessIssues = [
    ...serverBlockers.map((b) => ({
      key: b.code + (b.userId || ""),
      text: b.message,
    })),
    ...(crewChanged && !crewComplete
      ? [
          {
            key: "LOCAL_CREW_INCOMPLETE",
            text: "Cần chọn đủ tài xế và hộ tống.",
          },
        ]
      : []),
  ];
  const submitBlocked = readinessIssues.length > 0;

  return (
    <div className="trip-detail-page trip-detail-professional">
      <div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => go("/coordinator/trips")}
        >
          Danh sách chuyến
        </Button>
      </div>
      {!editable && (
        <Alert
          type="info"
          showIcon
          message="Kế hoạch đang ở chế độ chỉ xem"
          description="Chỉ sửa lộ trình khi kế hoạch nháp. Nhân sự có thể được cập nhật riêng khi đơn còn ở trạng thái cho phép."
        />
      )}
      {error && <Alert showIcon type="error" message={error} />}
      {trip.returnReason && (
        <Alert type="warning" message={`Lý do trả lại: ${trip.returnReason}`} />
      )}
      {(options.isError ||
        crew.assignments.isError ||
        crew.options.isError) && (
        <Alert
          type="error"
          message="Không tải đủ danh mục hoặc phân công"
          action={
            <Button
              onClick={() => {
                void options.refetch();
                void crew.assignments.refetch();
                void crew.options.refetch();
              }}
            >
              Thử lại
            </Button>
          }
        />
      )}
      <div className="planning-workspace">
        <main className="route-workspace">
          <Card className="route-planner-card">
            <div className="section-heading">
              <div>
                <Typography.Title level={3}>Lộ trình đề xuất</Typography.Title>
                <Typography.Text type="secondary">
                  Xác định điểm gửi, điểm nhận và chọn tuyến trên bản đồ.
                </Typography.Text>
              </div>
            </div>
            {legs.map((leg, i) => (
              <section
                className="coordinator-route-leg"
                key={leg.id || `new-${i}`}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 16,
                  }}
                >
                  <strong>
                    <EnvironmentOutlined /> Chặng {i + 1}
                  </strong>
                  {editable && !leg.id && (
                    <Button
                      danger
                      size="small"
                      disabled={busy}
                      onClick={() => {
                        setLegs((v) => v.filter((_, n) => n !== i));
                        setChanged(true);
                      }}
                    >
                      Xóa chặng
                    </Button>
                  )}
                </div>
                <div className="coordinator-leg-grid coordinator-waypoint-fields">
                  <label>
                    Điểm gửi
                    <Select
                      showSearch
                      optionFilterProp="label"
                      disabled={!editable || busy}
                      value={leg.fromLocationId || undefined}
                      placeholder="Chọn điểm đi"
                      options={locations.map((l) => ({
                        value: l.id,
                        label: l.address ? l.name + " · " + l.address : l.name,
                      }))}
                      onChange={(v) => update(i, { fromLocationId: v })}
                    />
                  </label>
                  <label>
                    Điểm nhận
                    <Select
                      showSearch
                      optionFilterProp="label"
                      disabled={!editable || busy}
                      value={leg.toLocationId || undefined}
                      placeholder="Chọn điểm đến"
                      options={locations.map((l) => ({
                        value: l.id,
                        label: l.address ? l.name + " · " + l.address : l.name,
                      }))}
                      onChange={(v) => update(i, { toLocationId: v })}
                    />
                  </label>
                </div>
              </section>
            ))}
            {!legs.length && <Empty description="Chưa lập chặng" />}
            {editable && (
              <Button
                icon={<PlusOutlined />}
                disabled={busy || legs.length >= 50}
                onClick={() => {
                  setLegs((v) => [
                    ...v,
                    {
                      fromLocationId: v.at(-1)?.toLocationId || "",
                      toLocationId: "",
                      vehicleId: "",
                      plannedDepartureAt: v.at(-1)?.plannedArrivalAt || "",
                      plannedArrivalAt: "",
                    },
                  ]);
                  setChanged(true);
                }}
              >
                Thêm chặng
              </Button>
            )}
            <TripRoutePlanner
              legs={legs}
              locations={locations}
              readOnly={!editable}
            />
            <Alert
              style={{ marginTop: 18 }}
              type="info"
              message="Kế hoạch lưu địa điểm trong danh mục, xe và giờ từng chặng. Chặng đã lưu không thể xóa hoặc đổi thứ tự. Địa chỉ tự do chưa có API lưu tương ứng."
            />
          </Card>

          <Card className="assignment-panel">
            <div className="section-heading">
              <div>
                <Typography.Title level={3}>
                  Phân công phương tiện & nhân sự
                </Typography.Title>
                <Typography.Text type="secondary">
                  Chọn xe, tài xế và hộ tống phù hợp cho chuyến vận chuyển.
                </Typography.Text>
              </div>
            </div>
            <div className="assignment-panel-grid">
              <section className="assignment-resource">
                <div className="assignment-resource-heading">
                  <span className="assignment-resource-icon">
                    <CarOutlined />
                  </span>
                  <h4>Phương tiện</h4>
                  <Tag
                    className={
                      vehiclesComplete
                        ? "assignment-status is-ready"
                        : "assignment-status is-pending"
                    }
                  >
                    {vehiclesComplete
                      ? "Đã chọn"
                      : assignedVehicleCount
                        ? "Chưa chọn đủ"
                        : "Chưa chọn"}
                  </Tag>
                </div>
                <div className="assignment-resource-body assignment-vehicle-summary">
                  <strong
                    className={vehiclesComplete ? "" : "assignment-placeholder"}
                  >
                    {assignedVehicleNames.length
                      ? assignedVehicleNames.join(", ")
                      : "Chưa chọn phương tiện"}
                  </strong>
                  <p>
                    {vehiclesComplete
                      ? `${assignedVehicleCount} chặng đã được bố trí phương tiện.`
                      : "Chọn phương tiện đang rảnh để bố trí cho chuyến đi."}
                  </p>
                </div>
                <Button
                  type={vehiclesComplete ? "default" : "primary"}
                  className={
                    vehiclesComplete ? "assignment-update-button" : undefined
                  }
                  block
                  disabled={
                    !editable ||
                    busy ||
                    options.isPending ||
                    options.isError ||
                    !legs.length
                  }
                  onClick={() => {
                    const index = legs.findIndex((leg) => !leg.vehicleId);
                    const target = index >= 0 ? index : 0;
                    setSearch("");
                    setVehiclePage(1);
                    setVehiclePageSize(12);
                    setVehicleStatus("AVAILABLE");
                    setVehicleType("ALL");
                    setVehicleCapacity(null);
                    setPendingVehicle(legs[target]?.vehicleId || "");
                    setVehicleLeg(target);
                  }}
                >
                  {vehiclesComplete
                    ? "Cập nhật phương tiện"
                    : "Chọn phương tiện"}
                </Button>
              </section>
              <section className="assignment-resource">
                <div className="assignment-resource-heading">
                  <span className="assignment-resource-icon">
                    <TeamOutlined />
                  </span>
                  <h4>Nhân sự</h4>
                  <Tag
                    className={
                      crewComplete
                        ? "assignment-status is-ready"
                        : "assignment-status is-pending"
                    }
                  >
                    {crewComplete ? "Đã chọn đủ" : "Chưa chọn đủ"}
                  </Tag>
                </div>
                <div className="assignment-resource-body assignment-personnel-list">
                  <div>
                    <span>Tài xế</span>
                    <strong
                      className={
                        driverNames.length ? "" : "assignment-placeholder"
                      }
                    >
                      {driverNames.join(", ") || "Chưa chọn tài xế"}
                    </strong>
                  </div>
                  <div>
                    <span>Hộ tống</span>
                    <strong
                      className={
                        escortNames.length ? "" : "assignment-placeholder"
                      }
                    >
                      {escortNames.join(", ") || "Chưa chọn hộ tống"}
                    </strong>
                  </div>
                </div>
                <Button
                  type={crewComplete ? "default" : "primary"}
                  className={
                    crewComplete ? "assignment-update-button" : undefined
                  }
                  block
                  disabled={
                    !crewEditable ||
                    busy ||
                    resourcesLoading ||
                    crew.assignments.isError ||
                    crew.options.isError
                  }
                  onClick={() => {
                    setSearch("");
                    setCrewPages({ DRIVER: 1, ESCORT: 1 });
                    setActiveCrewRole("DRIVER");
                    setCrewStatus("AVAILABLE");
                    setCrewPageSize(12);
                    setPendingRoster(roster.map((r) => ({ ...r })));
                    setCrewOpen(true);
                  }}
                >
                  {crewComplete ? "Cập nhật nhân sự" : "Chọn nhân sự"}
                </Button>
              </section>
            </div>
          </Card>
          <Card className="departure-panel">
            <div className="section-heading">
              <div>
                <Typography.Title level={3}>Khởi hành</Typography.Title>
                <Typography.Text type="secondary">
                  Sắp xếp thời gian từng chặng · giờ Việt Nam (UTC+7).
                </Typography.Text>
              </div>
            </div>
            {legs.length === 0 && (
              <Empty description="Thêm chặng để đặt lịch khởi hành" />
            )}
            {legs.map((leg, i) => (
              <div className="coordinator-leg-grid" key={leg.id || i}>
                <label>
                  Chặng {i + 1} · Ngày khởi hành
                  <DatePicker
                    format="DD/MM/YYYY"
                    value={
                      leg.plannedDepartureAt
                        ? dayjs(leg.plannedDepartureAt)
                        : null
                    }
                    disabled={!editable || busy}
                    onChange={(v) =>
                      update(i, {
                        plannedDepartureAt: v
                          ? v.format("YYYY-MM-DD") +
                            "T" +
                            (leg.plannedDepartureAt.split("T")[1] || "00:00")
                          : "",
                      })
                    }
                  />
                </label>
                <label>
                  Giờ khởi hành
                  <TimePicker
                    format="HH:mm"
                    minuteStep={15}
                    value={
                      leg.plannedDepartureAt
                        ? dayjs(leg.plannedDepartureAt)
                        : null
                    }
                    disabled={!editable || busy || !leg.plannedDepartureAt}
                    onChange={(v) =>
                      update(i, {
                        plannedDepartureAt: v
                          ? leg.plannedDepartureAt.split("T")[0] +
                            "T" +
                            v.format("HH:mm")
                          : "",
                      })
                    }
                  />
                </label>
                <label>
                  Trạm nghỉ qua đêm
                  <Select
                    disabled
                    placeholder="Chưa có API lưu trạm nghỉ riêng"
                  />
                </label>
                <label className="coordinator-arrival-field">
                  Đến dự kiến
                  <DatePicker
                    showTime={{ format: "HH:mm" }}
                    format="DD/MM/YYYY HH:mm"
                    value={
                      leg.plannedArrivalAt ? dayjs(leg.plannedArrivalAt) : null
                    }
                    disabled={!editable || busy}
                    onChange={(v) =>
                      update(i, {
                        plannedArrivalAt: v ? v.format("YYYY-MM-DDTHH:mm") : "",
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </Card>
        </main>
        <aside className="planning-sidebar planning-context-column">
          <TripOrderSidebar orderId={trip.orderId} />
        </aside>
      </div>
      <div className="trip-action-bar">
        {/* Dải trạng thái */}
        {editable &&
          (() => {
            const showOk = !submitBlocked && !resourcesLoading;
            const hasIssues = readinessIssues.length > 0;
            if (!showOk && !hasIssues) return null;
            return (
              <div className="trip-action-bar__status">
                {readinessIssues.map((issue) => (
                  <span key={issue.key} className="trip-action-chip is-warning">
                    <WarningOutlined /> {issue.text}
                  </span>
                ))}
                {showOk && (
                  <span className="trip-action-chip is-ok">
                    <CheckCircleOutlined /> Đủ điều kiện
                  </span>
                )}
              </div>
            );
          })()}

        {/* Hàng nút */}
        <div className="trip-action-bar__row">
          {editable && (
            <span title="Chưa có API từ chối đơn dành cho Coordinator">
              <Button type="text" danger disabled icon={<StopOutlined />}>
                Từ chối đơn
              </Button>
            </span>
          )}

          <span className="trip-action-bar__spacer" />

          <Button
            type="text"
            onClick={() => go("/coordinator/trips")}
            disabled={busy}
          >
            Hủy
          </Button>

          {editable && (
            <Button
              icon={<SaveOutlined />}
              loading={busy}
              disabled={
                resourcesLoading ||
                crew.assignments.isError ||
                options.isError ||
                crew.options.isError
              }
              onClick={() => void save(false)}
            >
              Lưu nháp
            </Button>
          )}

          {!editable && crewEditable && (
            <Button
              icon={<SaveOutlined />}
              loading={busy}
              disabled={
                !crewChanged ||
                crew.assignments.isPending ||
                crew.assignments.isError
              }
              onClick={() => void saveCrewOnly()}
            >
              Lưu phân công
            </Button>
          )}

          {editable && (
            <span
              title={
                submitBlocked
                  ? "Hoàn tất các điều kiện phía trên để gửi duyệt"
                  : undefined
              }
            >
              <Button
                className="trip-action-submit"
                icon={<SendOutlined />}
                type="primary"
                loading={busy}
                disabled={
                  resourcesLoading ||
                  crew.assignments.isError ||
                  options.isError ||
                  crew.options.isError ||
                  submitBlocked
                }
                onClick={() => void save(true)}
              >
                Gửi duyệt
              </Button>
            </span>
          )}
        </div>
      </div>
      <Modal
        open={vehicleLeg !== null}
        rootClassName="coordinator-scope"
        className="assignment-picker vehicle-picker"
        width={1200}
        title={`Chọn phương tiện · ${filteredVehicles.length} kết quả`}
        onCancel={() => setVehicleLeg(null)}
        footer={
          <div className="vehicle-picker-footer">
            <div className="vehicle-picker-summary">
              <span>Phương tiện đang chọn</span>
              <strong>
                {selectedVehicle?.plateOrCode || "Chưa chọn phương tiện"}
              </strong>
            </div>
            <div className="vehicle-picker-actions">
              <Button danger type="primary" onClick={() => setVehicleLeg(null)}>
                Hủy
              </Button>
              <Button
                type="primary"
                disabled={!pendingVehicle}
                onClick={() => {
                  if (vehicleLeg !== null)
                    update(vehicleLeg, { vehicleId: pendingVehicle });
                  setVehicleLeg(null);
                }}
              >
                Xác nhận chọn
              </Button>
            </div>
          </div>
        }
      >
        <p className="ap-hint">
          Nhấn vào thẻ xe để chọn phương tiện. Mỗi chuyến chỉ chọn một xe.
        </p>
        <div className="vehicle-picker-filters">
          <label className="vehicle-filter-search">
            <span>Biển số</span>
            <Input
              placeholder="Tìm theo biển số..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVehiclePage(1);
              }}
            />
          </label>
          <label>
            <span>Trạng thái</span>
            <Select
              value={vehicleStatus}
              options={[
                { value: "AVAILABLE", label: "Đang rảnh" },
                { value: "RESERVED", label: "Đã giữ chỗ" },
                { value: "IN_TRANSIT", label: "Đang vận chuyển" },
                { value: "ALL", label: "Tất cả trạng thái" },
              ]}
              onChange={(value) => {
                setVehicleStatus(value);
                setVehiclePage(1);
              }}
            />
          </label>
          <label>
            <span>Loại xe</span>
            <Select
              value={vehicleType}
              options={[
                { value: "ALL", label: "Tất cả loại xe" },
                { value: "LIGHT", label: "Xe Light" },
                { value: "MEDIUM", label: "Xe Medium" },
                { value: "HEAVY", label: "Xe Heavy" },
              ]}
              onChange={(value) => {
                setVehicleType(value);
                setVehiclePage(1);
              }}
            />
          </label>
          <label>
            <span>Sức chứa tối thiểu</span>
            <InputNumber
              min={1}
              placeholder="Số ngựa"
              value={vehicleCapacity}
              onChange={(value) => {
                setVehicleCapacity(value);
                setVehiclePage(1);
              }}
            />
          </label>
        </div>
        <div className="vehicle-picker-results">
          <div className="resource-grid">
            {!filteredVehicles.length && (
              <Empty description="Không tìm thấy phương tiện" />
            )}
            {filteredVehicles
              .slice(
                (vehiclePage - 1) * vehiclePageSize,
                vehiclePage * vehiclePageSize,
              )
              .map((v) => {
                const selected = pendingVehicle === v.id;
                const currentForLeg =
                  vehicleLeg !== null && legs[vehicleLeg]?.vehicleId === v.id;
                const disabled = v.selectable === false && !currentForLeg;
                return (
                  <button
                    type="button"
                    key={v.id}
                    disabled={disabled}
                    aria-pressed={selected}
                    className={`resource-card ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
                    onClick={() => setPendingVehicle(v.id)}
                  >
                    <span className="resource-card-top">
                      <span className="resource-card-icon">
                        <CarOutlined />
                      </span>
                      <Tag
                        color={
                          v.status === "AVAILABLE"
                            ? "success"
                            : v.status === "RESERVED"
                              ? "warning"
                              : "processing"
                        }
                      >
                        {v.status === "AVAILABLE"
                          ? "Đang rảnh"
                          : v.status === "RESERVED"
                            ? "Đã giữ chỗ"
                            : "Đang vận chuyển"}
                      </Tag>
                    </span>
                    <span className="resource-card-heading">
                      <strong>{v.plateOrCode}</strong>
                      <span>
                        Xe{" "}
                        {v.vehicleType.charAt(0) +
                          v.vehicleType.slice(1).toLowerCase()}
                      </span>
                    </span>
                    <span className="resource-card-info">
                      <span className="resource-card-field">
                        <span>Sức chứa</span>
                        <strong>{v.capacityStalls} ngựa</strong>
                      </span>
                    </span>
                    {v.blockingReasons.map((reason) => (
                      <span
                        className="resource-card-busy"
                        role="alert"
                        key={reason.code}
                      >
                        {reason.message}
                      </span>
                    ))}
                    {v.scheduleEvaluation === "NOT_EVALUATED" &&
                      v.selectable !== false && (
                        <span className="resource-card-busy">
                          Chưa kiểm tra lịch nháp; máy chủ sẽ kiểm tra khi lưu.
                        </span>
                      )}
                    <span className="resource-card-choice">
                      <span className="resource-card-check">
                        {selected && <CheckOutlined />}
                      </span>
                      {disabled ? "Không thể chọn" : "Chọn phương tiện"}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
        <div className="vehicle-picker-pagination">
          <span>{filteredVehicles.length} xe</span>
          <Pagination
            current={vehiclePage}
            pageSize={vehiclePageSize}
            total={filteredVehicles.length}
            showSizeChanger
            pageSizeOptions={[12, 24, 48]}
            locale={{ items_per_page: "/ trang" }}
            onChange={(page, pageSize) => {
              setVehiclePage(pageSize === vehiclePageSize ? page : 1);
              setVehiclePageSize(pageSize);
            }}
          />
        </div>
      </Modal>
      <Modal
        open={crewOpen}
        rootClassName="coordinator-scope"
        className="assignment-picker crew-picker"
        width={1200}
        title="Chọn nhân sự"
        onCancel={() => setCrewOpen(false)}
        footer={
          <div className="crew-picker-footer">
            <strong>Đã chọn {pendingRoster.length}/2 vị trí</strong>
            <div className="crew-picker-actions">
              <Button danger type="primary" onClick={() => setCrewOpen(false)}>
                Hủy
              </Button>
              <Button
                type="primary"
                disabled={!crewSelectionComplete}
                onClick={() => {
                  setRoster(pendingRoster);
                  setCrewChanged(true);
                  setCrewOpen(false);
                }}
              >
                Xác nhận phân công
              </Button>
            </div>
          </div>
        }
      >
        <p className="ap-hint">
          Chọn một tài xế và một hộ tống đang rảnh. Xác nhận để lưu cả hai vị
          trí.
        </p>
        <div className="crew-picker-summary" aria-live="polite">
          <div>
            <span>Tài xế đã chọn</span>
            <strong>
              {pendingRoster
                .filter((item) => item.role === "DRIVER")
                .map((item) => personName(item.userId))
                .join(", ") || "Chưa chọn tài xế"}
            </strong>
          </div>
          <div>
            <span>Hộ tống đã chọn</span>
            <strong>
              {pendingRoster
                .filter((item) => item.role === "ESCORT")
                .map((item) => personName(item.userId))
                .join(", ") || "Chưa chọn hộ tống"}
            </strong>
          </div>
        </div>
        <div className="crew-picker-tabs" role="tablist">
          {(["DRIVER", "ESCORT"] as const).map((role) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeCrewRole === role}
              className={activeCrewRole === role ? "is-active" : ""}
              key={role}
              onClick={() => {
                setActiveCrewRole(role);
                setSearch("");
              }}
            >
              {role === "DRIVER" ? "Tài xế" : "Hộ tống"}
            </button>
          ))}
        </div>
        <div className="crew-picker-filters">
          <label>
            <span>Họ tên</span>
            <Input
              placeholder="Tìm theo tên, có hoặc không dấu..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCrewPages({ DRIVER: 1, ESCORT: 1 });
              }}
              allowClear
            />
          </label>
          <label>
            <span>Trạng thái</span>
            <Select
              value={crewStatus}
              options={[
                { value: "AVAILABLE", label: "Đang rảnh" },
                { value: "ALL", label: "Tất cả trạng thái" },
              ]}
              onChange={(value) => {
                setCrewStatus(value);
                setCrewPages({ DRIVER: 1, ESCORT: 1 });
              }}
            />
          </label>
        </div>
        <div className="crew-picker-results">
          <div className="resource-grid">
            {!visibleCrew.length && (
              <Empty description="Không tìm thấy nhân sự" />
            )}
            {visibleCrew
              .slice(
                (crewPages[activeCrewRole] - 1) * crewPageSize,
                crewPages[activeCrewRole] * crewPageSize,
              )
              .map((p) => {
                const selected = pendingRoster.some(
                  (r) => r.userId === p.id && r.role === activeCrewRole,
                );
                const used = pendingRoster.some(
                  (r) => r.userId === p.id && r.role !== activeCrewRole,
                );
                const roleMismatch = p.crewType !== activeCrewRole;
                const unavailable = p.selectable === false;
                const disabled =
                  !selected && (used || roleMismatch || unavailable);
                const reasons = [
                  ...p.blockingReasons.map((reason) => reason.message),
                  ...(roleMismatch
                    ? [
                        p.crewType
                          ? `Hồ sơ chỉ cho phép vai trò ${p.crewType === "DRIVER" ? "Tài xế" : "Hộ tống"}.`
                          : "Chưa có hồ sơ nhân sự.",
                      ]
                    : []),
                  ...(p.scheduleEvaluation === "NOT_EVALUATED" &&
                  p.selectable !== false
                    ? ["Chưa kiểm tra lịch nháp; máy chủ sẽ kiểm tra khi lưu."]
                    : []),
                ];
                return (
                  <button
                    type="button"
                    key={p.id}
                    disabled={disabled}
                    aria-pressed={selected}
                    className={`resource-card ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
                    onClick={() => {
                      setPendingRoster((v) =>
                        selected
                          ? v.filter((r) => r.userId !== p.id)
                          : [
                              ...v.filter((r) => r.role !== activeCrewRole),
                              { userId: p.id, role: activeCrewRole },
                            ],
                      );
                    }}
                  >
                    <span className="resource-card-top">
                      <span className="resource-card-icon">
                        <UserOutlined />
                      </span>
                      <Tag
                        color={
                          p.workStatus === "AVAILABLE" ? "success" : "default"
                        }
                      >
                        {p.workStatus === "AVAILABLE"
                          ? "Đang rảnh"
                          : "Không rảnh"}
                      </Tag>
                    </span>
                    <span className="resource-card-heading">
                      <strong>{p.fullName}</strong>
                      <span>
                        {p.crewType === "DRIVER"
                          ? "Tài xế"
                          : p.crewType === "ESCORT"
                            ? "Hộ tống"
                            : "Chưa có hồ sơ"}
                      </span>
                    </span>
                    {reasons.map((reason) => (
                      <span
                        className="resource-card-busy"
                        role="alert"
                        key={reason}
                      >
                        {reason}
                      </span>
                    ))}
                    <span className="resource-card-choice">
                      <span className="resource-card-check">
                        {selected && <CheckOutlined />}
                      </span>
                      {disabled ? "Không thể chọn" : "Chọn nhân sự"}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
        <div className="crew-picker-pagination">
          <span>{visibleCrew.length} người</span>
          <Pagination
            current={crewPages[activeCrewRole]}
            pageSize={crewPageSize}
            total={visibleCrew.length}
            showSizeChanger
            pageSizeOptions={[12, 24, 48]}
            locale={{ items_per_page: "/ trang" }}
            onChange={(page, pageSize) => {
              setCrewPages((pages) => ({
                ...pages,
                [activeCrewRole]: pageSize === crewPageSize ? page : 1,
              }));
              setCrewPageSize(pageSize);
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
