import {
  ArrowLeftOutlined,
  CarOutlined,
  TeamOutlined,
  SendOutlined,
  EnvironmentOutlined,
  PlusOutlined,
  SearchOutlined,
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
import { planLabels } from "./CoordinatorTripsPage";
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
  const [crewPages, setCrewPages] = useState({ DRIVER: 1, ESCORT: 1 });
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
  const locationName = (key: string) =>
    locations.find((l) => l.id === key)?.name ||
    trip.legs.find((l) => l.fromLocationId === key)?.fromLocationName ||
    trip.legs.find((l) => l.toLocationId === key)?.toLocationName ||
    "Chưa chọn";
  const normalizedSearch = search.trim().toLocaleLowerCase("vi");
  const filteredVehicles = vehicles.filter((vehicle) =>
    vehicle.plateOrCode.toLocaleLowerCase("vi").includes(normalizedSearch),
  );
  const knownCrew = [...(crew.options.data?.items ?? [])];
  for (const assigned of crew.assignments.data?.items ?? []) {
    if (!knownCrew.some((person) => person.id === assigned.userId)) knownCrew.push({
      id: assigned.userId, fullName: assigned.fullName, crewType: assigned.crewType,
      workStatus: assigned.workStatus, selectable: false, scheduleEvaluation: 'NOT_EVALUATED',
      blockingReasons: [{ code: 'PERSISTED_INVALID_ASSIGNMENT', message: 'Phân công cũ không còn hợp lệ; cần thay thế.' }],
    });
  }
  const filteredCrew = knownCrew.filter((person) =>
    person.fullName.toLocaleLowerCase("vi").includes(normalizedSearch),
  );
  const crewSelectionComplete =
    pendingRoster.some((item) => item.role === "DRIVER") &&
    pendingRoster.some((item) => item.role === "ESCORT") &&
    new Set(pendingRoster.map((item) => item.userId)).size === pendingRoster.length;
  const formatVietnamDateTime = (value: string | null) => value
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(value))
    : "Chưa lập lịch";
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
            <TripRoutePlanner legs={legs} locations={locations} readOnly={!editable} />
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
                </div>
                {legs.map((l, i) => (
                  <div className="assignment-resource-body" key={i}>
                    <small>Chặng {i + 1}</small>
                    <strong>
                      {vehicles.find((v) => v.id === l.vehicleId)
                        ?.plateOrCode ||
                        trip.legs.find((v) => v.id === l.id)?.vehicleCode ||
                        "Chưa chọn phương tiện"}
                    </strong>
                    <Button
                      type="primary"
                      block
                      disabled={
                        !editable ||
                        busy ||
                        options.isPending ||
                        options.isError
                      }
                      onClick={() => {
                        setSearch("");
                        setVehiclePage(1);
                        setPendingVehicle(l.vehicleId);
                        setVehicleLeg(i);
                      }}
                    >
                      Chọn phương tiện
                    </Button>
                  </div>
                ))}
              </section>
              <section className="assignment-resource">
                <div className="assignment-resource-heading">
                  <span className="assignment-resource-icon">
                    <TeamOutlined />
                  </span>
                  <h4>Nhân sự</h4>
                </div>
                <div className="assignment-resource-body assignment-personnel-list">
                  {(["DRIVER", "ESCORT"] as const).map((role) => (
                    <div key={role}>
                      <span>{role === "DRIVER" ? "Tài xế" : "Hộ tống"}</span>
                      <strong>
                        {roster
                          .filter((r) => r.role === role)
                          .map(
                            (r) =>
                              crew.options.data?.items.find(
                                (p) => p.id === r.userId,
                              )?.fullName ||
                              crew.assignments.data?.items.find(
                                (p) => p.userId === r.userId,
                              )?.fullName ||
                              r.userId,
                          )
                          .join(", ") || "Chưa chọn"}
                      </strong>
                    </div>
                  ))}
                </div>
                <Button
                  type="primary"
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
                    setPendingRoster(roster.map((r) => ({ ...r })));
                    setCrewOpen(true);
                  }}
                >
                  Chọn nhân sự
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
          <Card className="trip-command-header">
            <div className="command-header-topline">
              <Tag color="gold">{planLabels[trip.planStatus]}</Tag>
            </div>
            <div className="command-title-row">
              <div>
                <Typography.Text className="command-eyebrow">
                  KẾ HOẠCH VẬN CHUYỂN
                </Typography.Text>
                <Typography.Title level={2}>{trip.orderCode}</Typography.Title>
              </div>
            </div>
            <div className="journey-strip">
              <div className="journey-point">
                <span className="journey-marker origin">
                  <EnvironmentOutlined />
                </span>
                <div>
                  <small>ĐIỂM ĐI</small>
                  <strong>{locationName(legs[0]?.fromLocationId || "")}</strong>
                </div>
              </div>
              <span className="journey-line" />
              <div className="journey-point">
                <span className="journey-marker destination">
                  <EnvironmentOutlined />
                </span>
                <div>
                  <small>ĐIỂM ĐẾN</small>
                  <strong>
                    {locationName(legs.at(-1)?.toLocationId || "")}
                  </strong>
                </div>
              </div>
            </div>
            <p>
              Thông tin người gửi, người nhận và yêu cầu đơn chưa được cung cấp
              cho màn hình này.
            </p>
            <dl className="trip-facts">
              <div><dt>Trạng thái đơn</dt><dd>{trip.orderStatus}</dd></div>
              <div><dt>Khởi hành dự kiến</dt><dd>{formatVietnamDateTime(trip.plannedDepartureAt)}</dd></div>
              <div><dt>Đến dự kiến</dt><dd>{formatVietnamDateTime(trip.plannedArrivalAt)}</dd></div>
              <div><dt>Số chặng</dt><dd>{legs.length}</dd></div>
            </dl>
          </Card>
        </aside>
      </div>
      {crew.assignments.data?.crewReadiness.blockers.map((b) => (
        <Alert
          key={b.code + (b.userId || "")}
          type="warning"
          message={b.message}
        />
      ))}
      <div className="trip-decision-bar">
        <div className="decision-actions">
          <Button
            className="decision-cancel"
            onClick={() => go("/coordinator/trips")}
            disabled={busy}
          >
            Hủy
          </Button>
          {crewEditable && (
            <Button
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
            <>
              <Button
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
              <span title="Chưa có API từ chối đơn dành cho Coordinator">
                <Button className="decision-reject" danger disabled>
                  Từ chối đơn
                </Button>
              </span>
              <Button
                className="decision-submit"
                icon={<SendOutlined />}
                type="primary"
                loading={busy}
                disabled={
                  resourcesLoading ||
                  crew.assignments.isError ||
                  options.isError ||
                  crew.options.isError
                }
                onClick={() => void save(true)}
              >
                Gửi duyệt
              </Button>
            </>
          )}
        </div>
      </div>
      <Modal
        open={vehicleLeg !== null}
        rootClassName="coordinator-scope"
        className="assignment-picker vehicle-picker"
        width={960}
        title={`Chọn phương tiện · Chặng ${(vehicleLeg ?? 0) + 1}`}
        okText="Xác nhận phương tiện"
        cancelText="Hủy"
        okButtonProps={{ disabled: !pendingVehicle }}
        onOk={() => {
          if (vehicleLeg !== null)
            update(vehicleLeg, { vehicleId: pendingVehicle });
          setVehicleLeg(null);
        }}
        onCancel={() => setVehicleLeg(null)}
      >
        <p className="ap-hint">
          Xe mới phải ở trạng thái Sẵn sàng; xe đã thuộc chính chặng vẫn được
          hiển thị để xử lý. Lịch được kiểm tra lại khi lưu và duyệt.
        </p>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Tìm biển số"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setVehiclePage(1); }}
        />
        <div className="resource-grid" style={{ marginTop: 16 }}>
          {!filteredVehicles.length && <Empty description="Không tìm thấy phương tiện" />}
          {filteredVehicles
            .slice((vehiclePage - 1) * 12, vehiclePage * 12)
            .map((v) => {
              const selected = pendingVehicle === v.id;
              const currentForLeg = vehicleLeg !== null && legs[vehicleLeg]?.vehicleId === v.id;
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
                  <CarOutlined />
                  <Tag color={v.status === 'AVAILABLE' ? 'success' : v.status === 'RESERVED' ? 'warning' : 'processing'}>
                    {v.status === 'AVAILABLE' ? 'Sẵn sàng' : v.status === 'RESERVED' ? 'Đã giữ chỗ' : 'Đang vận chuyển'}
                  </Tag>
                </span>
                <span className="resource-card-heading">
                  <strong>{v.plateOrCode}</strong>
                  <span>{v.vehicleType}</span>
                </span>
                <span className="resource-card-info">
                  Sức chứa {v.capacityStalls} ngựa
                </span>
                {v.blockingReasons.map(reason => <span className="resource-card-busy" role="alert" key={reason.code}>{reason.message}</span>)}
                {v.scheduleEvaluation === 'NOT_EVALUATED' && v.selectable !== false && <span className="resource-card-busy">Chưa kiểm tra lịch nháp; máy chủ sẽ kiểm tra khi lưu.</span>}
                <span className="resource-card-choice">{disabled ? 'Không thể chọn' : 'Chọn phương tiện'}</span>
              </button>
            );})}
        </div>
        {filteredVehicles.length > 12 && (
          <Pagination className="ap-pagination" current={vehiclePage} pageSize={12} total={filteredVehicles.length} showSizeChanger={false} onChange={setVehiclePage} />
        )}
      </Modal>
      <Modal
        open={crewOpen}
        rootClassName="coordinator-scope"
        className="assignment-picker"
        width={960}
        title="Phân công tài xế & hộ tống"
        onCancel={() => setCrewOpen(false)}
        onOk={() => {
          setRoster(pendingRoster);
          setCrewChanged(true);
          setCrewOpen(false);
        }}
        okText="Xác nhận nhân sự"
        cancelText="Hủy"
        okButtonProps={{ disabled: !crewSelectionComplete }}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder="Tìm tên nhân sự"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCrewPages({ DRIVER: 1, ESCORT: 1 }); }}
          allowClear
        />
        {!knownCrew.some((p) =>
          p.fullName
            .toLocaleLowerCase("vi")
            .includes(search.trim().toLocaleLowerCase("vi")),
        ) && <Empty description="Không tìm thấy nhân sự" />}
        <p className="ap-hint">
          Chọn ít nhất một tài xế và một người hộ tống khác nhau. Thay đổi chỉ
          được lưu khi bấm Lưu phân công hoặc lưu kế hoạch.
        </p>
        <div className="ap-summary" aria-live="polite">
          <div className={pendingRoster.some((item) => item.role === "DRIVER") ? "ap-filled" : ""}>Tài xế: {pendingRoster.filter((item) => item.role === "DRIVER").length}</div>
          <div className={pendingRoster.some((item) => item.role === "ESCORT") ? "ap-filled" : ""}>Hộ tống: {pendingRoster.filter((item) => item.role === "ESCORT").length}</div>
        </div>
        {(["DRIVER", "ESCORT"] as const).map((role) => (
          <div key={role} style={{ marginBottom: 18 }}>
            <h3>{role === "DRIVER" ? "Tài xế" : "Hộ tống"}</h3>
            <div className="resource-grid">
              {filteredCrew
                .slice((crewPages[role] - 1) * 12, crewPages[role] * 12)
                .map((p) => {
                  const selected = pendingRoster.some(
                    (r) => r.userId === p.id && r.role === role,
                  );
                  const used = pendingRoster.some(
                    (r) => r.userId === p.id && r.role !== role,
                  );
                  const roleMismatch = p.crewType !== role;
                  const unavailable = p.selectable === false;
                  const disabled = !selected && (used || roleMismatch || unavailable);
                  const reasons = [
                    ...p.blockingReasons.map(reason => reason.message),
                    ...(roleMismatch ? [p.crewType ? `Hồ sơ chỉ cho phép vai trò ${p.crewType === 'DRIVER' ? 'Tài xế' : 'Hộ tống'}.` : 'Chưa có hồ sơ nhân sự.'] : []),
                    ...(p.scheduleEvaluation === 'NOT_EVALUATED' && p.selectable !== false ? ['Chưa kiểm tra lịch nháp; máy chủ sẽ kiểm tra khi lưu.'] : []),
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
                            : [...v, { userId: p.id, role }],
                        );
                      }}
                    >
                      <span className="resource-card-top">
                        <TeamOutlined />
                        <Tag>
                          {selected
                            ? "Đã chọn"
                            : disabled
                              ? "Không thể chọn"
                              : "Nhân sự"}
                        </Tag>
                      </span>
                      <span className="resource-card-heading">
                        <strong>{p.fullName}</strong>
                        <span>{p.crewType === 'DRIVER' ? 'Tài xế' : p.crewType === 'ESCORT' ? 'Hộ tống' : 'Chưa có hồ sơ'}</span>
                      </span>
                      {reasons.map(reason => <span className="resource-card-busy" role="alert" key={reason}>{reason}</span>)}
                    </button>
                  );
                })}
            </div>
            {filteredCrew.length > 12 && (
              <Pagination
                className="ap-pagination"
                current={crewPages[role]}
                pageSize={12}
                total={filteredCrew.length}
                showSizeChanger={false}
                onChange={(page) => setCrewPages((pages) => ({ ...pages, [role]: page }))}
              />
            )}
          </div>
        ))}
      </Modal>
    </div>
  );
}
