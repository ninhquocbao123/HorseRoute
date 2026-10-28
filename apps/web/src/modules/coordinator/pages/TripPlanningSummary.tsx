import {
  CarOutlined,
  CheckCircleFilled,
  EnvironmentOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Card, Progress, Tag } from "antd";
import type {
  TripAssignmentsInput,
  TripPlanLegInput,
} from "../../trips/types/trip.types";

export default function TripPlanningSummary({
  legs,
  roster,
  locationName,
  vehicleName,
  personName,
}: {
  legs: TripPlanLegInput[];
  roster: TripAssignmentsInput["assignments"];
  locationName: (id: string) => string;
  vehicleName: (id: string) => string;
  personName: (id: string) => string;
}) {
  const routeReady =
    legs.length > 0 && legs.every((l) => l.fromLocationId && l.toLocationId);
  const vehiclesReady = legs.length > 0 && legs.every((l) => l.vehicleId);
  const rows = [
    {
      icon: <EnvironmentOutlined />,
      label: "Tuyến đường",
      value: routeReady
        ? `${locationName(legs[0].fromLocationId)} → ${locationName(legs[legs.length - 1].toLocationId)}`
        : "",
    },
    {
      icon: <CarOutlined />,
      label: "Phương tiện",
      value: vehiclesReady
        ? [...new Set(legs.map((l) => vehicleName(l.vehicleId)))].join(", ")
        : "",
    },
    {
      icon: <UserOutlined />,
      label: "Tài xế",
      value: roster
        .filter((p) => p.role === "DRIVER")
        .map((p) => personName(p.userId))
        .join(", "),
    },
    {
      icon: <TeamOutlined />,
      label: "Hộ tống",
      value: roster
        .filter((p) => p.role === "ESCORT")
        .map((p) => personName(p.userId))
        .join(", "),
    },
  ];
  const missing = rows.filter((r) => !r.value).map((r) => r.label);
  const hasTimes =
    legs.length > 0 &&
    legs.every((l) => l.plannedDepartureAt && l.plannedArrivalAt);
  if (!hasTimes) missing.push("Lịch khởi hành");
  const percent = Math.round(((5 - missing.length) / 5) * 100);
  return (
    <Card className="planning-summary-card" title="Tóm tắt kế hoạch">
      <div className="completion-head">
        <span>
          <strong>{percent}%</strong>
          <small>Thông tin đã chọn</small>
        </span>
        <Progress
          percent={percent}
          showInfo={false}
          strokeColor="#0f4d55"
          railColor="#e8eeee"
        />
      </div>
      <div className="summary-list">
        {rows.map((row) => (
          <div
            className={`summary-row${row.value ? " complete" : ""}`}
            key={row.label}
          >
            <span className="summary-row-icon">{row.icon}</span>
            <span>
              <small>{row.label}</small>
              <strong>{row.value || "Chưa chọn"}</strong>
            </span>
            {row.value && <CheckCircleFilled className="summary-check" />}
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <div className="planning-missing-notice" role="status">
          <WarningOutlined />
          <div>
            <strong>Chưa chọn đủ thông tin</strong>
            <span>Vui lòng bổ sung trước khi gửi duyệt.</span>
            <div className="planning-missing-tags">
              {missing.map((label) => (
                <Tag key={label}>{label}</Tag>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
