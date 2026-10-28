import { EyeOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Input, Table, Tag } from "antd";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTripsQuery } from "../../trips/hooks/use-trips-query";
import { formatTripDate } from "../../trips/utils/trip-list.utils";
import type { TripSummary } from "../../trips/types/trip.types";

export const planLabels: Record<string, string> = {
  DRAFT: "Chưa lập kế hoạch",
  PENDING_APPROVAL: "Chờ duyệt",
  APPROVED: "Đã duyệt",
};
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
  const [status, setStatus] = useState("all");
  const items = query.data?.items || [];
  const rows = items.filter(
    (t) =>
      (status === "all" || t.planStatus === status) &&
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
          aria-label="Trạng thái trong trang hiện tại"
        >
          {[["all", "Tổng hợp"], ...Object.entries(planLabels)].map(
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
                    : items.filter((t) => t.planStatus === value).length}
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
        <Table<TripSummary>
          rowKey="id"
          loading={query.isPending}
          dataSource={rows}
          scroll={{ x: 720 }}
          columns={[
            { title: "ID", dataIndex: "id", width: 80 },
            {
              title: "Mã vận chuyển",
              dataIndex: "orderCode",
              render: (v) => <strong>{v}</strong>,
            },
            {
              title: "Ngày khởi hành",
              dataIndex: "plannedDepartureAt",
              render: formatTripDate,
            },
            {
              title: "Ngày đến",
              dataIndex: "plannedArrivalAt",
              render: formatTripDate,
            },
            {
              title: "Trạng thái",
              dataIndex: "planStatus",
              render: (v) => (
                <Tag
                  color={
                    v === "APPROVED" ? "green" : v === "DRAFT" ? "gold" : "blue"
                  }
                >
                  {planLabels[v] || v}
                </Tag>
              ),
            },
            {
              title: "Xem",
              width: 88,
              render: (_, r) => (
                <Button
                  type="text"
                  icon={<EyeOutlined />}
                  aria-label={`Xem ${r.orderCode}`}
                  onClick={() => navigate(`/coordinator/trips/${r.id}`)}
                />
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
              `${total} chuyến · bộ lọc áp dụng trong trang hiện tại`,
          }}
        />
      </Card>
    </>
  );
}
