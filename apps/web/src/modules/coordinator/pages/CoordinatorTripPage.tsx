import { allocateCrew, crewQuota, type SelectedCrew } from '../../trips/utils/allocate-crew';
import TripStatusBar from './TripStatusBar';
import {
  ArrowLeftOutlined,
  CarOutlined,
  TeamOutlined,
  SendOutlined,
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
import { tripScheduleSchema } from "../../trips/schemas/trip-plan.schema";
import { tripQueryKeys } from "../../trips/constants/trip-query-keys";
import type {
  TripAssignmentsInput,
  TripPlanLegInput,
} from "../../trips/types/trip.types";
import { useAuth } from "../../../features/auth/hooks/useAuth";
import { errorMessage } from "../../../features/tracking/tracking.api";
import TripRoutePlanner from "../maps/TripRoutePlanner";
import { tripLoadError } from "./trip-error";
import { isValidTripId } from "../../trips/utils/trip-detail.utils";
import TripOrderSidebar from "./TripOrderSidebar";
type FleetDraft = TripAssignmentsInput["vehicles"];
export default function CoordinatorTripPage() {
  const { tripId = "" } = useParams();
  return isValidTripId(tripId) ? (
    <TripWorkspace key={tripId} id={tripId} />
  ) : (
    <Alert type="error" message="ID chuyến không hợp lệ" />
  );
}

function validateFleetCrew(fleet: FleetDraft): string {
  if (!fleet.length) return "Chưa chọn phương tiện.";
  const people = new Set<string>();
  for (const vehicle of fleet) {
    const drivers = vehicle.crew.filter(
      (person) => person.role === "DRIVER",
    ).length;
    const escorts = vehicle.crew.filter(
      (person) => person.role === "ESCORT",
    ).length;
    if (drivers < 1 || drivers > 2) return "Mỗi xe cần từ 1 đến 2 tài xế.";
    if (escorts < 1 || escorts > 2) return "Mỗi xe cần từ 1 đến 2 lơ xe.";
    for (const person of vehicle.crew) {
      if (people.has(person.userId))
        return "Một người chỉ được phân công cho một xe trong chuyến.";
      people.add(person.userId);
    }
  }
  return "";
}

function validateVehicleSelection(
  fleet: FleetDraft,
  requiredHorseCount: number,
  options: { id: string; capacityStalls: number }[],
): string {
  if (!fleet.length) return "Chưa chọn phương tiện.";
  if (!requiredHorseCount) return "Đơn chưa có ngựa NORMAL để bố trí.";
  let total = 0;
  for (const vehicle of fleet) {
    const capacity = options.find(
      (item) => item.id === vehicle.vehicleId,
    )?.capacityStalls;
    if (!capacity) return `Không tìm thấy xe ${vehicle.vehicleId}.`;
    if (!Number.isInteger(vehicle.horseCount) || vehicle.horseCount < 1)
      return "Số ngựa trên mỗi xe phải là số nguyên dương.";
    if (vehicle.horseCount > capacity)
      return `Xe ${vehicle.vehicleId} vượt sức chứa.`;
    total += vehicle.horseCount;
  }
  return total === requiredHorseCount
    ? ""
    : `Cần bố trí đúng ${requiredHorseCount} ngựa; hiện tại đã bố trí ${total}.`;
}

function validateFleetDraft(
  fleet: FleetDraft,
  requiredHorseCount: number,
  options: { id: string; capacityStalls: number }[],
): string {
  return (
    validateVehicleSelection(fleet, requiredHorseCount, options) ||
    validateFleetCrew(fleet)
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
  const [fleet, setFleet] = useState<FleetDraft>([]);
  const [changed, setChanged] = useState(false),
    [assignmentChanged, setAssignmentChanged] = useState(false),
    [routeChanged, setRouteChanged] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [vehicleOpen, setVehicleOpen] = useState(false),
    [crewOpen, setCrewOpen] = useState(false),
    [search, setSearch] = useState("");
  const [pendingFleet, setPendingFleet] = useState<FleetDraft>([]);
  const [selectedCrew, setSelectedCrew] = useState<SelectedCrew>([]);
  const [pendingCrew, setPendingCrew] = useState<SelectedCrew>([]);
  const [vehiclePage, setVehiclePage] = useState(1);
  const [vehiclePageSize, setVehiclePageSize] = useState(12);
  const [vehicleStatus, setVehicleStatus] = useState("ALL");
  const [vehicleType, setVehicleType] = useState("ALL");
  const [vehicleCapacity, setVehicleCapacity] = useState<number | null>(null);
  const [crewPages, setCrewPages] = useState({ DRIVER: 1, ESCORT: 1 });
  const [activeCrewRole, setActiveCrewRole] = useState<"DRIVER" | "ESCORT">(
    "DRIVER",
  );
  const [crewStatus, setCrewStatus] = useState("ALL");
  const [crewPageSize, setCrewPageSize] = useState(12);
  const dirty = changed || assignmentChanged || routeChanged;
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
              plannedDepartureAt: utcToInput(l.plannedDepartureAt),
              plannedArrivalAt: utcToInput(l.plannedArrivalAt),
            }))
          : [
              {
                fromLocationId: "",
                toLocationId: "",
                plannedDepartureAt: "",
                plannedArrivalAt: "",
              },
            ],
      );
  }, [detail.data, changed]);
  useEffect(() => {
    if (crew.assignments.data && !assignmentChanged) {
      setSelectedCrew(crew.assignments.data.items.map(p=>({userId:p.userId,role:p.role})));
      setFleet(
        (crew.assignments.data.vehicles ?? []).map((vehicle) => ({
          vehicleId: vehicle.vehicleId,
          horseCount: vehicle.horseCount ?? 0,
          crew: vehicle.crew.map((person) => ({
            userId: person.userId,
            role: person.role,
          })),
        })),
      );
    }
  }, [crew.assignments.data, assignmentChanged]);
  const editable =
    detail.data?.planStatus === "DRAFT" &&
    ["APPROVED", "PREPARING"].includes(detail.data.orderStatus) &&
    detail.data.legs.every((leg) => leg.status === "NOT_STARTED");
  const crewEditable = editable;
  function update(index: number, patch: Partial<TripPlanLegInput>) {
    setLegs((v) => v.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    setChanged(true);
  }
  async function save(send: boolean) {
    if (!editable || busy) return;
    setError("");
    const currentTrip = detail.data;
    const routePlan = currentTrip?.routePlan;
    if (!routePlan) {
      setError("Hãy xác định và lưu lộ trình trước khi lưu kế hoạch.");
      return;
    }
    if (routeChanged) {
      setError("Lộ trình có thay đổi chưa lưu. Hãy lưu lộ trình trước.");
      return;
    }
    if (!routePlan.selectedRoute) {
      setError("Hãy tính, chọn và lưu một tuyến đường trước.");
      return;
    }
    const schedule = legs[0];
    if (
      !schedule ||
      !Number.isFinite(Date.parse(schedule.plannedDepartureAt)) ||
      !Number.isFinite(Date.parse(schedule.plannedArrivalAt))
    ) {
      setError("Vui lòng nhập đầy đủ Ngày khởi hành dự kiến và Ngày giao dự kiến.");
      return;
    }
    const result = tripScheduleSchema.safeParse({
      plannedDepartureAt: schedule.plannedDepartureAt,
      plannedArrivalAt: schedule.plannedArrivalAt,
      routePlanRevision: currentTrip!.routePlanRevision,
    });
    if (!result.success) {
      setError(result.error.issues.map((i) => i.message).join(" "));
      return;
    }
    let arranged = fleet;
    if (assignmentChanged || send) {
      try { arranged = allocateCrew(fleet,selectedCrew,(crew.assignments.data?.vehicles ?? []).map(v=>({...v,horseCount:v.horseCount ?? 0}))); }
      catch(e) { setError((e as Error).message); return; }
      const fleetError = validateFleetDraft(
        arranged,
        options.data?.requiredHorseCount ?? 0,
        options.data?.vehicles ?? [],
      );
      if (fleetError) {
        setError(fleetError);
        return;
      }
    }
    setBusy(true);
    let planSaved = false;
    let assignmentSaved = false;
    try {
      // Lưu phân công trước để lịch tổng được backend kiểm tra trên đúng đội xe/tổ mới nhất.
      if (assignmentChanged) {
        const savedCrew = await saveTripAssignments(id, { vehicles: arranged });
        qc.setQueryData(tripQueryKeys.assignments(account?.id, id), savedCrew);
        setAssignmentChanged(false);
        assignmentSaved = true;
      }
      const saved = await saveTripPlan(id, {
        plannedDepartureAt: inputToUtc(schedule.plannedDepartureAt),
        plannedArrivalAt: inputToUtc(schedule.plannedArrivalAt),
        routePlanRevision: currentTrip!.routePlanRevision,
      });
      planSaved = true;
      qc.setQueryData(tripQueryKeys.detail(account?.id, id), saved);
      setChanged(false);
      if (send) {
        const submitted = await submitTripPlan(id);
        qc.setQueryData(tripQueryKeys.detail(account?.id, id), submitted);
      }
      void message.success(
        send ? "Đã lưu và gửi duyệt kế hoạch." : "Đã lưu kế hoạch.",
      );
    } catch (e) {
      setError(
        `${planSaved ? "Kế hoạch đã lưu; bước gửi duyệt chưa thành công. " : assignmentSaved ? "Phân công đã lưu; thời gian kế hoạch chưa được xác nhận. " : ""}${errorMessage(e)}`,
      );
      if (send) void detail.refetch();
    } finally {
      setBusy(false);
      void qc.invalidateQueries({ queryKey: ["trips", account?.id, "list"] });
      void detail.refetch();
      void options.refetch();
      void crew.options.refetch();
    }
  }

  if (detail.isPending) return <TripStatusBar loading />;
  if (!detail.data)
    return (
      <Alert
        type="error"
        message="Không tải được chuyến"
        description={
          <>
            <p>Chưa tải được trạng thái đơn.</p>
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
    crew.assignments.data?.vehicles?.find((v) => v.vehicleId === key)
      ?.plateNumber ||
    key;
  const vehicles = options.data?.vehicles || [];
  const normalizedSearch = search.trim().toLocaleLowerCase("vi");
  const filteredVehicles = vehicles.filter(
    (vehicle) =>
      vehicle.plateOrCode.toLocaleLowerCase("vi").includes(normalizedSearch) &&
      (vehicleStatus === "ALL" || vehicle.status === vehicleStatus) &&
      (vehicleType === "ALL" || vehicle.vehicleType === vehicleType) &&
      (vehicleCapacity === null || vehicle.capacityStalls >= vehicleCapacity),
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
  const pendingRoster = pendingCrew;
  const allPendingCrew = pendingCrew;
  const assignedVehicleCount = fleet.length;
  const allocatedHorseCount = fleet.reduce(
    (total, vehicle) => total + vehicle.horseCount,
    0,
  );
  const requiredHorseCount = options.data?.requiredHorseCount ?? 0;
  const vehiclesComplete =
    assignedVehicleCount > 0 && allocatedHorseCount === requiredHorseCount;
  const assignedVehicleNames = fleet.map((vehicle) =>
    vehicleName(vehicle.vehicleId),
  );
  const roster = selectedCrew;
  const rosterNames = (role: "DRIVER" | "ESCORT") =>
    roster
      .filter((item) => item.role === role)
      .map((item) => personName(item.userId));
  const driverNames = rosterNames("DRIVER");
  const escortNames = rosterNames("ESCORT");
  const crewComplete = !crewQuota(fleet.length,selectedCrew);
  const schedule = legs[0];
  const scheduleDatesMatch = Boolean(
    schedule?.plannedDepartureAt &&
      schedule?.plannedArrivalAt &&
      schedule.plannedDepartureAt.split("T")[0] ===
        schedule.plannedArrivalAt.split("T")[0],
  );
  const scheduleComplete =
    !!schedule &&
    Number.isFinite(Date.parse(schedule.plannedDepartureAt)) &&
    Number.isFinite(Date.parse(schedule.plannedArrivalAt)) &&
    !scheduleDatesMatch &&
    Date.parse(schedule.plannedArrivalAt) >
      Date.parse(schedule.plannedDepartureAt);

  const serverBlockers = assignmentChanged
    ? []
    : (crew.assignments.data?.crewReadiness.blockers ?? []);
  const readinessIssues = [
    ...serverBlockers.map((b) => ({
      key: b.code + (b.userId || ""),
      text: b.message,
    })),
    ...(assignmentChanged && !crewComplete
      ? [
          {
            key: "LOCAL_CREW_INCOMPLETE",
            text: crewQuota(fleet.length,selectedCrew),
          },
        ]
      : []),
    ...(scheduleDatesMatch
      ? [
          {
            key: "SCHEDULE_SAME_DATE",
            text: "Ngày giao dự kiến không được trùng với Ngày khởi hành dự kiến.",
          },
        ]
      : !scheduleComplete
      ? [
          {
            key: "SCHEDULE_INCOMPLETE",
            text: "Chưa nhập đầy đủ Ngày khởi hành dự kiến và Ngày giao dự kiến.",
          },
        ]
      : []),
    ...(!trip.routePlan
      ? [{ key: "ROUTE_PLAN_MISSING", text: "Chưa lưu lộ trình." }]
      : !trip.routePlan.selectedRoute
        ? [
            {
              key: "ROUTE_NOT_SELECTED",
              text: "Chưa tính và chọn tuyến đường.",
            },
          ]
        : routeChanged
          ? [{ key: "ROUTE_UNSAVED", text: "Lộ trình có thay đổi chưa lưu." }]
          : []),
  ];
  const submitBlocked = readinessIssues.length > 0;

  return (
    <div className="trip-detail-page trip-detail-professional">
      <div className="trip-detail-toolbar">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => go("/coordinator/trips")}
        >
          Danh sách chuyến
        </Button>
        <TripStatusBar orderStatus={trip.orderStatus} planStatus={trip.planStatus} />
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
                <Typography.Text className="route-planner-eyebrow">
                  LẬP LỘ TRÌNH
                </Typography.Text>
                <Typography.Title level={3}>
                  Thiết lập lộ trình vận chuyển
                </Typography.Title>
                <Typography.Text type="secondary">
                  Xác nhận điểm gửi và điểm nhận từ đơn, thêm các điểm nghỉ, sau
                  đó tính tuyến và lưu lộ trình.
                </Typography.Text>
              </div>
            </div>
            <ol
              className="route-planner-flow"
              aria-label="Các bước lập lộ trình"
            >
              <li>Xác nhận hai đầu</li>
              <li>Thêm điểm nghỉ</li>
              <li>Chọn tuyến</li>
              <li>Lưu lộ trình</li>
            </ol>
            <TripRoutePlanner
              tripId={id}
              originAddress={trip.originAddress}
              destinationAddress={trip.destinationAddress}
              initialPlan={trip.routePlan}
              initialRevision={trip.routePlanRevision}
              readOnly={!editable}
              onDirtyChange={setRouteChanged}
              onSaved={(routePlan, routePlanRevision) => {
                qc.setQueryData(
                  tripQueryKeys.detail(account?.id, id),
                  (current: typeof trip | undefined) =>
                    current
                      ? { ...current, routePlan, routePlanRevision }
                      : current,
                );
                setChanged(true);
              }}
            />
          </Card>

          <Card className="assignment-panel">
            <div className="section-heading">
              <div>
                <Typography.Title level={3}>
                  Phân công phương tiện & nhân sự
                </Typography.Title>
                <Typography.Text type="secondary">
                  Chọn xe, tài xế và lơ xe phù hợp cho chuyến vận chuyển.
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
                      ? `${assignedVehicleCount} xe · ${allocatedHorseCount}/${requiredHorseCount} ngựa đã được bố trí.`
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
                    !requiredHorseCount
                  }
                  onClick={() => {
                    setSearch("");
                    setVehiclePage(1);
                    setVehiclePageSize(12);
                    setVehicleStatus("ALL");
                    setVehicleType("ALL");
                    setVehicleCapacity(null);
                    setPendingFleet(
                      fleet.map((vehicle) => ({
                        ...vehicle,
                        crew: vehicle.crew.map((person) => ({ ...person })),
                      })),
                    );
                    setVehicleOpen(true);
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
                    <span>Lơ xe</span>
                    <strong
                      className={
                        escortNames.length ? "" : "assignment-placeholder"
                      }
                    >
                      {escortNames.join(", ") || "Chưa chọn lơ xe"}
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
                    setCrewStatus("ALL");
                    setCrewPageSize(12);
                    setPendingFleet(
                      fleet.map((vehicle) => ({
                        ...vehicle,
                        crew: vehicle.crew.map((person) => ({ ...person })),
                      })),
                    );
                    setPendingCrew(selectedCrew.map(p=>({...p})));
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
                <Typography.Title level={3}>Thời gian dự kiến</Typography.Title>
                <Typography.Text type="secondary">
                  Giờ Việt Nam (UTC+7).
                </Typography.Text>
              </div>
            </div>
            {legs.length === 0 && (
              <Empty description="Thêm chặng để đặt lịch khởi hành" />
            )}
            {legs.map((leg, i) => (
              <div className="departure-timeline" key={leg.id || i}>
                {legs.length > 1 && (
                  <div className="departure-leg-title">Chặng {i + 1}</div>
                )}
                <section
                  className="departure-milestone departure-milestone-start"
                  aria-label={`Ngày khởi hành dự kiến chặng ${i + 1}`}
                >
                  <h4>Ngày khởi hành dự kiến</h4>
                  <div className="departure-time-fields">
                    <label>
                      Ngày
                      <DatePicker
                        aria-label={`Ngày khởi hành chặng ${i + 1}`}
                        placeholder="Chọn ngày"
                        format="DD/MM/YYYY"
                        value={
                          leg.plannedDepartureAt
                            ? dayjs(leg.plannedDepartureAt)
                            : null
                        }
                        disabled={!editable || busy}
                        disabledDate={(date) =>
                          Boolean(
                            leg.plannedArrivalAt &&
                              !date.isBefore(dayjs(leg.plannedArrivalAt), "day"),
                          )
                        }
                        onChange={(v) =>
                          update(i, {
                            plannedDepartureAt: v
                              ? v.format("YYYY-MM-DD") +
                                "T" +
                                (leg.plannedDepartureAt.split("T")[1] ||
                                  "00:00")
                              : "",
                          })
                        }
                      />
                    </label>
                    <label>
                      Giờ
                      <TimePicker
                        popupClassName="departure-time-popup"
                        aria-label={`Giờ khởi hành chặng ${i + 1}`}
                        placeholder="Chọn giờ"
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
                  </div>
                </section>
                <section
                  className="departure-milestone departure-milestone-end"
                  aria-label={`Ngày giao dự kiến chặng ${i + 1}`}
                >
                  <h4>Ngày giao dự kiến</h4>
                  <div className="departure-time-fields">
                    <label>
                      Ngày
                      <DatePicker
                        aria-label={`Ngày giao dự kiến chặng ${i + 1}`}
                        placeholder="Chọn ngày"
                        format="DD/MM/YYYY"
                        value={
                          leg.plannedArrivalAt
                            ? dayjs(leg.plannedArrivalAt)
                            : null
                        }
                        disabled={!editable || busy}
                        disabledDate={(date) =>
                          Boolean(
                            leg.plannedDepartureAt &&
                              !date.isAfter(dayjs(leg.plannedDepartureAt), "day"),
                          )
                        }
                        onChange={(v) =>
                          update(i, {
                            plannedArrivalAt: v
                              ? v.format("YYYY-MM-DD") +
                                "T" +
                                (leg.plannedArrivalAt.split("T")[1] || "00:00")
                              : "",
                          })
                        }
                      />
                    </label>
                    <label>
                      Giờ
                      <TimePicker
                        popupClassName="departure-time-popup"
                        aria-label={`Giờ giao dự kiến chặng ${i + 1}`}
                        placeholder="Chọn giờ"
                        format="HH:mm"
                        minuteStep={15}
                        value={
                          leg.plannedArrivalAt
                            ? dayjs(leg.plannedArrivalAt)
                            : null
                        }
                        disabled={!editable || busy || !leg.plannedArrivalAt}
                        onChange={(v) =>
                          update(i, {
                            plannedArrivalAt: v
                              ? leg.plannedArrivalAt.split("T")[0] +
                                "T" +
                                v.format("HH:mm")
                              : "",
                          })
                        }
                      />
                    </label>
                  </div>
                </section>
              </div>
            ))}
          </Card>
        </main>
        <aside className="planning-sidebar planning-context-column">
          <TripOrderSidebar orderId={trip.orderId} />
        </aside>
      </div>
      {trip.planStatus !== "PENDING_APPROVAL" && <div className="trip-action-bar">
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
              Lưu chặng và phân công
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
      </div>}
      <Modal
        open={vehicleOpen}
        rootClassName="coordinator-scope"
        className="assignment-picker vehicle-picker"
        width={1200}
        title={`Chọn phương tiện · ${filteredVehicles.length} kết quả`}
        onCancel={() => setVehicleOpen(false)}
        footer={
          <div className="vehicle-picker-footer">
            <div className="vehicle-picker-summary">
              <span>Phương tiện đang chọn</span>
              <strong>
                {pendingFleet.length
                  ? `${pendingFleet.length} xe · ${pendingFleet.reduce((total, vehicle) => total + vehicle.horseCount, 0)}/${requiredHorseCount} ngựa`
                  : "Chưa chọn phương tiện"}
              </strong>
            </div>
            <div className="vehicle-picker-actions">
              <Button
                danger
                type="primary"
                onClick={() => setVehicleOpen(false)}
              >
                Hủy
              </Button>
              <Button
                type="primary"
                disabled={
                  !editable || (pendingFleet.length > 0 && !!validateVehicleSelection(
                    pendingFleet,
                    requiredHorseCount,
                    vehicles,
                  ))
                }
                onClick={() => {
                  setFleet(pendingFleet);
                  setAssignmentChanged(true);
                  setVehicleOpen(false);
                }}
              >
                Xác nhận chọn
              </Button>
            </div>
          </div>
        }
      >
        <p className="ap-hint">
          Chọn một hoặc nhiều xe chạy xuyên suốt chuyến và phân bổ đủ{" "}
          {requiredHorseCount} ngựa.
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
                const selectedVehicle = pendingFleet.find(
                  (vehicle) => vehicle.vehicleId === v.id,
                );
                const selected = !!selectedVehicle;
                const disabled = !editable || v.selectable === false;
                return (
                  <button
                    type="button"
                    key={v.id}
                    disabled={disabled}
                    aria-pressed={selected}
                    className={`resource-card ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
                    onClick={() => {
                      setPendingFleet((current) => {
                        if (selected)
                          return current.filter(
                            (vehicle) => vehicle.vehicleId !== v.id,
                          );
                        const allocated = current.reduce(
                          (total, vehicle) => total + vehicle.horseCount,
                          0,
                        );
                        return [
                          ...current,
                          {
                            vehicleId: v.id,
                            horseCount: Math.min(
                              v.capacityStalls,
                              Math.max(1, requiredHorseCount - allocated),
                            ),
                            crew: [],
                          },
                        ];
                      });
                    }}
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
                      {selectedVehicle && (
                        <span
                          className="resource-card-field"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <span>Số ngựa bố trí</span>
                          <InputNumber
                            min={1}
                            max={v.capacityStalls}
                            value={selectedVehicle.horseCount}
                            onChange={(value) =>
                              setPendingFleet((current) =>
                                current.map((vehicle) =>
                                  vehicle.vehicleId === v.id
                                    ? {
                                        ...vehicle,
                                        horseCount: Number(value ?? 0),
                                      }
                                    : vehicle,
                                ),
                              )
                            }
                          />
                        </span>
                      )}
                    </span>
                    {v.status !== 'AVAILABLE' && v.currentTrips?.map(owner=><span className="resource-card-busy" key={owner.tripId}>
                      {v.status==='RESERVED'?'Chuyến đang giữ':'Đang vận chuyển chuyến'}: {owner.orderCode} · #{owner.tripId}
                    </span>)}
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
            <strong>
              Đã chọn {allPendingCrew.length} nhân sự cho {pendingFleet.length}{" "}
              xe
            </strong>
            <div className="crew-picker-actions">
              <Button danger type="primary" onClick={() => setCrewOpen(false)}>
                Hủy
              </Button>
              <Button
                type="primary"
                disabled={!crewEditable}
                onClick={() => {
                  setSelectedCrew(pendingCrew);
                  setAssignmentChanged(true);
                  setCrewOpen(false);
                }}
              >
                Xác nhận chọn
              </Button>
            </div>
          </div>
        }
      >
        <p className="ap-hint">
          Chọn nhân sự chung cho chuyến. Khi lưu, mỗi xe được bố trí 1–2 tài xế và 1–2 lơ xe.
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
            <span>Lơ xe đã chọn</span>
            <strong>
              {pendingRoster
                .filter((item) => item.role === "ESCORT")
                .map((item) => personName(item.userId))
                .join(", ") || "Chưa chọn lơ xe"}
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
              {role === "DRIVER" ? "Tài xế" : "Lơ xe"}
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
                { value: "RESERVED", label: "Đã phân công" },
                { value: "IN_TRIP", label: "Đang trong chuyến" },
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
                const used =
                  allPendingCrew.some((r) => r.userId === p.id) && !selected;
                const roleMismatch = p.crewType !== activeCrewRole;
                const unavailable = p.selectable === false;
                const disabled =
                  !crewEditable || (!selected && (used || roleMismatch || unavailable));
                return (
                  <button
                    type="button"
                    key={p.id}
                    disabled={disabled}
                    aria-pressed={selected}
                    className={`resource-card ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
                    onClick={() => {
                      setPendingCrew(current => selected ? current.filter(person=>person.userId!==p.id) : [...current,{userId:p.id,role:activeCrewRole}]);
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
                          : p.workStatus === "RESERVED" ? "Đã phân công" : "Đang trong chuyến"}
                      </Tag>
                    </span>
                    <span className="resource-card-heading">
                      <strong>{p.fullName}</strong>
                      <span>
                        {p.crewType === "DRIVER"
                          ? "Tài xế"
                          : p.crewType === "ESCORT"
                            ? "Lơ xe"
                            : "Chưa có hồ sơ"}
                      </span>
                    </span>
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
