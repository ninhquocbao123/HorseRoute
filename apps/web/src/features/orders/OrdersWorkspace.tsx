import { WorkflowIntro, FlowSection } from "../workflow/WorkflowUI";
import SaveOrderDialog from "./SaveOrderDialog";
import "./order-list.css";
import DeleteOrderDialog from "./DeleteOrderDialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../../lib/axios";
import {
  OrderDetail,
  OrderDraft,
  OrderSummary,
  ReviewOptions,
  draftFrom,
  emptyDraft,
  emptyHorse,
  statuses,
} from "./types";

type Errors = Record<string, string>;
const documentLabels: Record<string, string> = {
  NOT_SUBMITTED: "Chưa nộp",
  SUBMITTED: "Đã nộp",
  VALID: "Hợp lệ",
  INVALID: "Không hợp lệ",
  EXPIRED: "Hết hạn",
};
const historyLabels: Record<string, string> = {
  CREATE: "Tạo đơn nháp",
  EDIT: "Sửa đơn",
  SUBMIT: "Gửi duyệt",
  REVIEW: "Phản hồi từ quản lý",
};
export default function OrdersWorkspace({
  role,
  refreshNotifications,
  onLeaveGuardChange,
}: {
  role: string;
  refreshNotifications: () => void;
  onLeaveGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
}) {
  const customer = role === "CUSTOMER";
  const manager = role === "MANAGER";
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  async function removeDraft() {
    setShowDeleteDialog(false);
    await action(async () => {
      if (detail) await api.delete("/orders/" + detail.id);
      setDetail(null);
      setDraft(emptyDraft());
      setEditing(false);
      setDirty(false);
      requestId.current = crypto.randomUUID();
      if (page > 1) setPage(1);
      else await load();
      setMessage("Đã xóa đơn nháp.");
    });
  }
  const saveAnswer = useRef<((save: boolean) => void) | null>(null);
  function askToSave() {
    return new Promise<boolean>((resolve) => {
      saveAnswer.current = resolve;
      setShowSaveDialog(true);
    });
  }
  function answerSave(save: boolean) {
    saveAnswer.current?.(save);
    saveAnswer.current = null;
    setShowSaveDialog(false);
  }
  useEffect(
    () => () => {
      saveAnswer.current?.(false);
    },
    [],
  );
  const [items, setItems] = useState<OrderSummary[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0);
  const [group, setGroup] = useState("");
  const [filter, setFilter] = useState(""),
    [search, setSearch] = useState("");
  const [detail, setDetail] = useState<OrderDetail | null>(null),
    [draft, setDraft] = useState<OrderDraft>(emptyDraft);
  const [editing, setEditing] = useState(false),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [errors, setErrors] = useState<Errors>({});
  const [options, setOptions] = useState<ReviewOptions>({
    coordinators: [],
    rules: [],
  });
  const [coordinatorId, setCoordinatorId] = useState(""),
    [ruleIds, setRuleIds] = useState<string[]>([]),
    [reason, setReason] = useState("");
  const requestId = useRef(crypto.randomUUID()),
    saving = useRef(false),
    listVersion = useRef(0);
  const report = (e: unknown) => {
    const body = isAxiosError(e) ? e.response?.data : null;
    setMessage(
      Array.isArray(body?.message)
        ? body.message.join(" · ")
        : body?.message ||
            "Không kết nối được máy chủ. Dữ liệu đang nhập được giữ lại; hãy thử lại.",
    );
    setErrors(body?.fields || {});
    setFailed(true);
  };
  const load = useCallback(async () => {
    const version = ++listVersion.current;
    setLoading(true);
    try {
      const { data } = await api.get("/orders", {
        params: {
          page,
          limit: 10,
          group: manager && group ? group : undefined,
          status: filter || undefined,
          search: search || undefined,
        },
      });
      if (version === listVersion.current) {
        setItems(data.items);
        setTotal(data.total);
      }
    } catch (e) {
      if (version === listVersion.current) report(e);
    } finally {
      if (version === listVersion.current) setLoading(false);
    }
  }, [page, filter, search, group, manager]);
  useEffect(() => {
    void load();
    return () => {
      listVersion.current++;
    };
  }, [load]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (customer && editing && dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [customer, editing, dirty]);
  useEffect(() => {
    onLeaveGuardChange?.(
      customer && editing && (dirty || busy)
        ? async () => {
            if (saving.current) return false;
            return askToSave();
          }
        : null,
    );
    return () => onLeaveGuardChange?.(null);
  });
  const leave = async () => !customer || !dirty || (await askToSave());
  async function action(work: () => Promise<void>) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage("");
    setErrors({});
    setFailed(false);
    try {
      await work();
    } catch (e) {
      report(e);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function read(id: string) {
    const { data } = await api.get<OrderDetail>("/orders/" + id);
    setDetail(data);
    return data;
  }
  async function open(id: string) {
    await read(id);
    setEditing(false);
    setDirty(false);
    setReason("");
    setCoordinatorId("");
    setRuleIds([]);
    setOptions({ coordinators: [], rules: [] });
    if (manager) {
      const { data } = await api.get<ReviewOptions>(
        "/orders/" + id + "/review-options",
      );
      setOptions(data);
      setRuleIds(
        data.rules
          .filter((r) => r.border_location_id === null)
          .map((r) => String(r.id)),
      );
    }
  }
  function startEdit(order: OrderDetail) {
    setDraft(draftFrom(order));
    setEditing(true);
    setDirty(false);
    setErrors({});
  }
  async function persist(submit: boolean) {
    const { data } = detail
      ? await api.put("/orders/" + detail.id, draft)
      : await api.post("/orders", { ...draft, requestId: requestId.current });
    const saved = await read(data.id);
    setDirty(false);
    if (submit) {
      try {
        await api.post("/orders/" + data.id + "/submit");
      } catch (e) {
        setDraft(draftFrom(saved));
        setEditing(true);
        throw e;
      }
    }
  }
  function change(key: keyof Omit<OrderDraft, "horses">, value: string) {
    setDraft((d) => ({
      ...d,
      [key]: key.endsWith("Country") ? value.toUpperCase() : value,
    }));
    setDirty(true);
  }
  function error(path: string) {
    return errors[path] ? (
      <small id={"error-" + path} className="error" role="alert">
        {errors[path]}
      </small>
    ) : null;
  }
  function input(
    key: keyof Omit<OrderDraft, "horses">,
    label: string,
    type = "text",
    max = 255,
  ) {
    return (
      <label htmlFor={key}>
        {label}
        <input
          id={key}
          type={type}
          maxLength={max}
          value={draft[key]}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? "error-" + key : undefined}
          onChange={(e) => change(key, e.target.value)}
        />
        {error(key)}
      </label>
    );
  }
  async function review(decision: string) {
    await api.post("/orders/" + detail!.id + "/review", {
      decision,
      reason,
      ...(decision === "APPROVED" ? { coordinatorId, ruleIds } : {}),
    });
    await open(detail!.id);
    await load();
    refreshNotifications();
    setMessage("Đã ghi nhận kết quả duyệt và gửi thông báo cho khách hàng.");
  }
  const deleteButton =
    customer && (!detail || detail.status === "DRAFT") ? (
      <button
        type="button"
        className="flow-danger"
        disabled={busy}
        onClick={() => setShowDeleteDialog(true)}
      >
        Xóa đơn
      </button>
    ) : null;
  return (
    <section className="flow-workspace flow-orders" aria-label="Đơn vận chuyển">
      <WorkflowIntro
        number="01"
        title={
          customer
            ? "Bắt đầu một hành trình mới"
            : "Tiếp nhận & xét duyệt yêu cầu"
        }
        description={
          customer
            ? "Chuẩn bị thông tin chuyến đi, thêm ngựa và gửi yêu cầu đến đội ngũ vận chuyển."
            : "Kiểm tra thông tin khách hàng, lựa chọn quy định và phản hồi ngay trên từng đơn."
        }
        steps={["Tạo yêu cầu", "Kiểm tra thông tin", "Xét duyệt đơn"]}
      />
      {showSaveDialog && <SaveOrderDialog onAnswer={answerSave} />}
      {showDeleteDialog && (
        <DeleteOrderDialog
          onClose={() => setShowDeleteDialog(false)}
          onDelete={() => void removeDraft()}
        />
      )}
      {message && (
        <p
          className={"workspace-message " + (failed ? "error" : "")}
          role={failed ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      <div className="flow-context-bar">
        <div>
          <strong>
            {customer ? "Không gian riêng của bạn" : "Hàng đợi tiếp nhận"}
          </strong>
          <p>
            {customer
              ? "Chỉ bạn thấy đơn của mình. Bản nháp chưa được gửi cho Manager."
              : "Chỉ hiển thị đơn đã gửi. Đơn tạo trước được xếp trước trong từng nhóm."}
          </p>
        </div>
        <span className="flow-sort-label">Cũ nhất → Mới nhất</span>
      </div>
      {manager && (
        <nav className="flow-queue-tabs" aria-label="Nhóm đơn vận chuyển">
          {[
            ["", "Tất cả đơn đã gửi", "Theo dõi toàn bộ yêu cầu"],
            ["pending", "Chưa duyệt", "Chờ duyệt / bổ sung thông tin"],
            ["approved", "Đã duyệt", "Theo dõi tiến độ vận chuyển"],
            [
              "documents",
              "Cần bổ sung giấy tờ",
              "Đã duyệt · thiếu, lỗi hoặc hết hạn",
            ],
            ["closed", "Từ chối / Đã hủy", "Các yêu cầu đã dừng"],
          ].map(([value, label, hint]) => (
            <button
              key={value}
              aria-pressed={group === value}
              disabled={busy}
              onClick={() => {
                setGroup(value);
                setFilter("");
                setPage(1);
                setDetail(null);
              }}
            >
              <strong>{label}</strong>
              <small>{hint}</small>
            </button>
          ))}
        </nav>
      )}
      <div className="workspace-grid">
        <section className="card flow-list">
          <div className="header">
            <h2>{customer ? "Đơn của tôi" : "Duyệt yêu cầu"}</h2>
            {customer && (
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  if (!(await leave())) return;
                  setDetail(null);
                  setDraft(emptyDraft());
                  setEditing(true);
                  setDirty(false);
                  setMessage("");
                  setErrors({});
                  requestId.current = crypto.randomUUID();
                }}
              >
                Tạo đơn +
              </button>
            )}
          </div>
          <p className="flow-list-caption">{total} yêu cầu trong danh sách</p>
          <div className="order-list-filters">
            <label htmlFor="order-search">
              Tìm mã đơn
              <input
                id="order-search"
                placeholder="VD: WDP-2026…"
                value={search}
                maxLength={50}
                disabled={busy}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label htmlFor="order-status">
              Trạng thái
              <select
                id="order-status"
                disabled={busy}
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(statuses)
                  .filter(([v]) => customer || v !== "DRAFT")
                  .map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
              </select>
            </label>
            <button disabled={busy || loading} onClick={() => void load()}>
              Làm mới
            </button>
          </div>
          <div
            className="order-list-scroll"
            role="region"
            aria-label="Danh sách đơn vận chuyển"
            tabIndex={0}
            aria-busy={loading}
          >
            {loading ? (
              <p role="status">Đang tải danh sách…</p>
            ) : items.length === 0 ? (
              <p>Không có đơn phù hợp.</p>
            ) : (
              items.map((o) => (
                <button
                  className={
                    "order-row " + (detail?.id === o.id ? "selected" : "")
                  }
                  key={o.id}
                  disabled={busy}
                  onClick={async () => {
                    if (await leave()) void action(() => open(o.id));
                  }}
                >
                  <strong>{o.order_code}</strong>
                  {manager && <span>{o.customer_name}</span>}
                  <span>
                    {o.origin_country || "Chưa chọn"} →{" "}
                    {o.destination_country || "Chưa chọn"}
                  </span>
                  {o.created_at && (
                    <small className="flow-created">
                      Tạo ngày{" "}
                      {new Date(o.created_at).toLocaleDateString("vi-VN")}
                    </small>
                  )}
                  <span className="status-chip" data-status={o.status}>
                    {statuses[o.status] || o.status}
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="pagination">
            <button
              disabled={page === 1 || busy || loading}
              onClick={() => setPage(page - 1)}
            >
              ← Trước
            </button>
            <span>
              Trang {page} · {total} đơn
            </span>
            <button
              disabled={page * 10 >= total || busy || loading}
              onClick={() => setPage(page + 1)}
            >
              Sau →
            </button>
          </div>
        </section>
        <section className="card order-content">
          {editing ? (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void action(() => persist(true));
              }}
            >
              <div className="flow-editor-title">
                <div>
                  <span className="flow-kicker">YÊU CẦU VẬN CHUYỂN</span>
                  <h2>
                    {detail ? "Chỉnh sửa yêu cầu" : "Yêu cầu vận chuyển mới"}
                  </h2>
                </div>
                <span className="status-chip" data-status="DRAFT">
                  {detail?.status === "NEED_INFO"
                    ? "Đang bổ sung"
                    : "Bản nháp riêng tư"}
                </span>
              </div>
              <p className="form-hint">
                Bạn có thể lưu nháp khi chưa điền đủ. Khi gửi duyệt, cần địa
                chỉ, quốc gia, ngày khởi hành và ít nhất một ngựa có tên, định
                danh.
              </p>
              <fieldset disabled={busy}>
                <FlowSection
                  number="01"
                  title="Thông tin hành trình"
                  description="Điểm đi, điểm đến và thời gian bạn mong muốn."
                />
                <div className="form-grid flow-route-fields">
                  {input("originAddress", "Địa chỉ đi")}
                  {input("destinationAddress", "Địa chỉ đến")}
                  {input("originCountry", "Mã quốc gia đi (VD: VN)", "text", 2)}
                  {input(
                    "destinationCountry",
                    "Mã quốc gia đến (VD: SG)",
                    "text",
                    2,
                  )}
                  {input(
                    "desiredDepartureDate",
                    "Ngày khởi hành mong muốn",
                    "date",
                  )}
                  <label htmlFor="specialRequirements">
                    Yêu cầu đặc biệt
                    <textarea
                      id="specialRequirements"
                      maxLength={5000}
                      value={draft.specialRequirements}
                      onChange={(e) =>
                        change("specialRequirements", e.target.value)
                      }
                    />
                    {error("specialRequirements")}
                  </label>
                </div>
                <FlowSection
                  number="02"
                  title={`Danh sách ngựa (${draft.horses.length})`}
                  description="Mỗi ngựa cần tên và định danh / hộ chiếu riêng khi gửi duyệt."
                />
                {error("horses")}
                {draft.horses.map((horse, index) => (
                  <fieldset className="horse-form" key={horse.id || index}>
                    <legend>Ngựa {index + 1}</legend>
                    <div className="form-grid">
                      {(
                        [
                          "name",
                          "passportNo",
                          "breed",
                          "birthDate",
                          "sex",
                          "coatColor",
                          "note",
                        ] as const
                      ).map((key, i) => {
                        const path = `horses.${index}.${key}`;
                        return (
                          <label htmlFor={path} key={key}>
                            {
                              [
                                "Tên ngựa",
                                "Định danh / hộ chiếu",
                                "Giống ngựa",
                                "Ngày sinh",
                                "Giới tính",
                                "Màu lông",
                                "Ghi chú",
                              ][i]
                            }
                            <input
                              id={path}
                              type={key === "birthDate" ? "date" : "text"}
                              maxLength={
                                key === "name"
                                  ? 100
                                  : key === "note"
                                    ? 255
                                    : key === "sex"
                                      ? 10
                                      : key === "coatColor"
                                        ? 30
                                        : 50
                              }
                              value={horse[key]}
                              aria-invalid={!!errors[path]}
                              aria-describedby={
                                errors[path] ? "error-" + path : undefined
                              }
                              onChange={(e) => {
                                setDraft((d) => ({
                                  ...d,
                                  horses: d.horses.map((h, n) =>
                                    n === index
                                      ? { ...h, [key]: e.target.value }
                                      : h,
                                  ),
                                }));
                                setDirty(true);
                              }}
                            />
                            {error(path)}
                          </label>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft((d) => ({
                          ...d,
                          horses: d.horses.filter((_, i) => i !== index),
                        }));
                        setDirty(true);
                      }}
                    >
                      Bỏ ngựa {index + 1}
                    </button>
                  </fieldset>
                ))}
                <button
                  type="button"
                  disabled={draft.horses.length >= 50}
                  onClick={() => {
                    setDraft((d) => ({
                      ...d,
                      horses: [...d.horses, emptyHorse()],
                    }));
                    setDirty(true);
                  }}
                >
                  + Thêm ngựa
                </button>
                <div className="form-actions flow-form-footer">
                  {deleteButton}
                  <button
                    type="button"
                    onClick={() => void action(() => persist(false))}
                  >
                    Lưu nháp
                  </button>
                  <button className="button" type="submit">
                    {busy ? "Đang xử lý…" : "Lưu và gửi duyệt"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (await leave()) {
                        setEditing(false);
                        setDirty(false);
                      }
                    }}
                  >
                    Đóng
                  </button>
                </div>
              </fieldset>
            </form>
          ) : detail ? (
            <>
              <div className="header">
                <h2>{detail.order_code}</h2>
                <span className="status-chip" data-status={detail.status}>
                  {statuses[detail.status]}
                </span>
              </div>
              <p className="flow-customer-line">
                <strong>Khách hàng:</strong> {detail.customer.full_name} ·{" "}
                {detail.customer.email}
                {detail.customer.phone && ` · ${detail.customer.phone}`}
              </p>
              <p className="flow-route-summary">
                <strong>Đi:</strong> {detail.origin_address || "Chưa nhập"} (
                {detail.origin_country || "—"})<br />
                <strong>Đến:</strong>{" "}
                {detail.destination_address || "Chưa nhập"} (
                {detail.destination_country || "—"})<br />
                <strong>Khởi hành:</strong>{" "}
                {detail.desired_departure_date?.slice(0, 10) || "Chưa chọn"}
              </p>
              <p className="preserve-text">{detail.special_requirements}</p>
              {detail.manager_note && (
                <p className="workspace-message preserve-text">
                  Phản hồi quản lý: {detail.manager_note}
                </p>
              )}
              <FlowSection number="01" title="Ngựa trong yêu cầu" />
              {detail.draft ? (
                <p>
                  {detail.draft.horses.length} ngựa trong bản nháp. Chọn Chỉnh
                  sửa để xem và hoàn thiện.
                </p>
              ) : (
                detail.horses.map((h) => (
                  <article className="horse-summary" key={h.id}>
                    <strong>{h.name}</strong>
                    <p>
                      {h.passport_no} · {h.breed || "Chưa có giống"} ·{" "}
                      {h.sex || "Chưa có giới tính"}
                      {h.birth_date && ` · Sinh ${h.birth_date.slice(0, 10)}`}
                      {h.coat_color && ` · ${h.coat_color}`}
                    </p>
                    {h.note && <p>{h.note}</p>}
                  </article>
                ))
              )}
              <FlowSection number="02" title="Giấy tờ đã ghi nhận" />
              {detail.documents.length ? (
                <ul>
                  {detail.documents.map((d) => (
                    <li key={d.id}>
                      {d.horse_name} · {d.document_name}:{" "}
                      {documentLabels[d.status] || d.status}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Chưa có giấy tờ. Checklist được khởi tạo khi duyệt đơn.</p>
              )}
              {customer && ["DRAFT", "NEED_INFO"].includes(detail.status) && (
                <div className="form-actions">
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => startEdit(detail)}
                  >
                    Chỉnh sửa và gửi duyệt
                  </button>
                  {deleteButton}
                </div>
              )}
              {manager && detail.status === "PENDING" && (
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(() => review("APPROVED"));
                  }}
                >
                  <fieldset disabled={busy}>
                    <FlowSection
                      number="03"
                      title="Kết quả xét duyệt"
                      description="Chọn người phụ trách và quy định áp dụng trước khi duyệt."
                    />
                    <label htmlFor="coordinator">
                      Điều phối viên phụ trách
                      <select
                        id="coordinator"
                        value={coordinatorId}
                        onChange={(e) => setCoordinatorId(e.target.value)}
                      >
                        <option value="">Chọn điều phối viên</option>
                        {options.coordinators.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name}
                          </option>
                        ))}
                      </select>
                      {error("coordinatorId")}
                    </label>
                    <fieldset className="rule-list">
                      <legend>Quy định áp dụng khi khởi tạo hồ sơ</legend>
                      {options.rules.length ? (
                        options.rules.map((r) => (
                          <label key={r.id}>
                            <input
                              type="checkbox"
                              checked={ruleIds.includes(String(r.id))}
                              onChange={(e) =>
                                setRuleIds((ids) =>
                                  e.target.checked
                                    ? [...ids, String(r.id)]
                                    : ids.filter((x) => x !== String(r.id)),
                                )
                              }
                            />
                            {r.authority_name || "Chưa có cơ quan"} ·{" "}
                            {r.border_name || "Quy định chung"}
                          </label>
                        ))
                      ) : (
                        <p>
                          Chưa có quy định cho cặp quốc gia này. Cần bổ sung
                          danh mục trước khi duyệt.
                        </p>
                      )}
                      {error("ruleIds")}
                    </fieldset>
                    <label htmlFor="reason">
                      Nội dung phản hồi
                      <textarea
                        id="reason"
                        maxLength={2000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Bắt buộc khi từ chối hoặc yêu cầu bổ sung"
                      />
                      {error("reason")}
                    </label>
                    <div className="form-actions">
                      <button className="button" type="submit">
                        Duyệt đơn
                      </button>
                      <button
                        type="button"
                        onClick={() => void action(() => review("NEED_INFO"))}
                      >
                        Yêu cầu bổ sung
                      </button>
                      <button
                        className="flow-danger"
                        type="button"
                        onClick={() => void action(() => review("REJECTED"))}
                      >
                        Từ chối
                      </button>
                    </div>
                  </fieldset>
                </form>
              )}
              <details className="order-history">
                <summary>Lịch sử xử lý</summary>
                {detail.history.length ? (
                  detail.history.map((h) => (
                    <p key={h.id}>
                      <strong>{historyLabels[h.action] || h.action}</strong> ·{" "}
                      {h.actor_name} ·{" "}
                      {new Date(h.occurred_at).toLocaleString("vi-VN")}
                      <br />
                      {h.reason}
                    </p>
                  ))
                ) : (
                  <p>Chưa có lịch sử xử lý được ghi nhận.</p>
                )}
              </details>
            </>
          ) : (
            <div className="workspace-empty flow-empty">
              <div className="flow-empty-symbol" aria-hidden="true">
                ↗
              </div>
              <p className="eyebrow">FLOW 1 · YÊU CẦU VẬN CHUYỂN</p>
              <h2>Mỗi hành trình, một sự an tâm.</h2>
              <p>
                {customer
                  ? "Tạo bản nháp hoặc chọn đơn để tiếp tục hoàn thiện."
                  : "Chọn đơn Chờ duyệt để kiểm tra thông tin và phản hồi khách hàng."}
              </p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
