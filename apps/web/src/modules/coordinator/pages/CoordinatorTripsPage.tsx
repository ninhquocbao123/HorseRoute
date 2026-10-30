import { ArrowRightOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Input, Table, Tag, Tooltip } from "antd";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTripsQuery } from "../../trips/hooks/use-trips-query";
import { statuses as orderLabels } from "../../../features/orders/types";
import type { TripListItem } from "../../trips/types/trip.types";

export const planLabels: Record<string, string> = {
  DRAFT: "Chưa lập kế hoạch",
  PENDING_APPROVAL: "Chờ duyệt",
  APPROVED: "Đã duyệt",
};

const orderStatusTabs = [
  ["PREPARING", "Đang chuẩn bị"],
  ["REJECTED", "Từ chối"],
  ["READY", "Sẵn sàng"],
  ["all", "Tổng hợp"],
] as const;

export default function CoordinatorTripsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get("page"));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const limit = 20;
  const query = useTripsQuery({ page, limit });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("PREPARING");
  const items = query.data?.items || [];
  const rows = items.filter(
    (t) =>
      (status === "all" || t.orderStatus === status) &&
      t.orderCode
        .toLocaleLowerCase("vi")
        .includes(search.trim().toLocaleLowerCase("vi")),
  );
  return (
    <>
      {query.isError && (
        <Alert
          type="error"
          showIcon
          message="Không tải được danh sách chuyến"
          action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
        />
      )}
      <Card className="table-card" styles={{ body: { padding: 0 } }}>
        <div
          className="trip-status-navigation"
          role="group"
          aria-label="Trạng thái đơn trong trang hiện tại"
        >
          {orderStatusTabs.map(
            ([value, label]) => (
              <button
                key={value}
                className={`trip-status-option ${status === value ? "active" : ""}`}
                aria-pressed={status === value}
                onClick={() => setStatus(value)}
              >
                <span className="trip-status-option-label">{label}</span>
                <strong>
                  {value === "all"
                    ? items.length
                    : items.filter((t) => t.orderStatus === value).length}
                </strong>
              </button>
            ),
          )}
        </div>
        <div className="trip-table-toolbar">
          <div className="trip-table-filters">
            <Input
              className="trip-code-search"
              prefix={<SearchOutlined />}
              placeholder="Tìm mã vận chuyển trong trang này"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </div>
        </div>
        <Table<TripListItem>
          rowKey="id"
          loading={query.isPending}
          dataSource={rows}
          scroll={{ x: 1050 }}
          columns={[
            { title: "ID đơn", dataIndex: "orderId", width: 80 },
            {
              title: "Mã vận chuyển",
              dataIndex: "orderCode",
              render: (v) => <strong>{v}</strong>,
            },
            {
              title: "Ngày khởi hành yêu cầu",
              dataIndex: "desiredDepartureDate",
              render: (value: string | null) => value ? value.split('-').reverse().join('/') : 'Chưa cung cấp',
            },
            {
              title: "Giờ đón yêu cầu",
              dataIndex: "requestedPickupTime",
              render: (value: string | null) => value || 'Chưa cung cấp',
            },
            {
              title: "Số ngựa", dataIndex: "horseCount", width: 100,
            },
            {
              title: "Trạng thái đơn",
              dataIndex: "orderStatus",
              render: (v) => (
                <Tag
                  color={
                    ["APPROVED", "READY", "DELIVERED"].includes(v) ? "green" : ["REJECTED", "CANCELLED"].includes(v) ? "red" : v === "DRAFT" ? "gold" : "blue"
                  }
                >
                  {orderLabels[v] || v}
                </Tag>
              ),
            },
            {
              title: "Thao tác",
              width: 88,
              render: (_, r) => (
                <Tooltip title="Mở chi tiết chuyến">
                  <Button
                    type="text"
                    icon={<ArrowRightOutlined />}
                    aria-label={`Mở chi tiết chuyến ${r.orderCode}`}
                    onClick={() => navigate(`/coordinator/trips/${r.tripId}`)}
                  />
                </Tooltip>
              ),
            },
          ]}
          pagination={{
            current: page,
            pageSize: limit,
            total: query.data?.total || 0,
            showSizeChanger: false,
            onChange: (p) => setParams({ page: String(p) }),
            showTotal: (total) =>
              `${total} đơn · bộ lọc áp dụng trong trang hiện tại`,
          }}
        />
      </Card>
    </>
  );
}
