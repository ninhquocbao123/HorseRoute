import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { isAxiosError } from "axios";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { App } from "antd";
import { useAuth } from "../../../features/auth/hooks/useAuth";
import { useTripDetailQuery } from "../hooks/use-trip-detail-query";
import { useTripPlanOptionsQuery } from "../hooks/use-trip-plan-options-query";
import { saveTripPlan, submitTripPlan } from "../api/trips.api";
import { tripQueryKeys } from "../constants/trip-query-keys";
import {
  readTripListParams,
  tripListSearch,
  formatTripDate,
} from "../utils/trip-list.utils";
import { inputToUtc, utcToInput } from "../utils/trip-time.utils";
import {
  tripPlanSchema,
  type TripPlanFormValues,
} from "../schemas/trip-plan.schema";

export default function TripPlanPage() {
  const { tripId } = useParams();
  const [search] = useSearchParams();
  const { account } = useAuth();
  const { message: messageApi } = App.useApp();
  const back = tripListSearch(readTripListParams(search));
  const detail = useTripDetailQuery(tripId);
  const options = useTripPlanOptionsQuery(tripId);
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const defaults = useMemo<TripPlanFormValues>(
    () => ({
      legs: (detail.data?.legs || []).map((l) => ({
        id: l.id,
        fromLocationId: l.fromLocationId,
        toLocationId: l.toLocationId,
        vehicleId: l.vehicleId || "",
        plannedDepartureAt: utcToInput(l.plannedDepartureAt),
        plannedArrivalAt: utcToInput(l.plannedArrivalAt),
      })),
    }),
    [detail.data],
  );
  const form = useForm<TripPlanFormValues>({
    resolver: zodResolver(tripPlanSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "legs",
  });
  useEffect(() => {
    if (detail.data && !form.formState.isDirty) form.reset(defaults);
  }, [detail.data, defaults, form]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [form.formState.isDirty]);
  const editable =
    account?.role === "COORDINATOR" &&
    detail.data?.planStatus === "DRAFT" &&
    ["APPROVED", "PREPARING"].includes(detail.data.orderStatus);
  const leave = () =>
    !form.formState.isDirty ||
    window.confirm("Bạn có thay đổi chưa lưu. Rời trang sẽ bỏ thay đổi?");
  async function persist(values: TripPlanFormValues, send: boolean) {
    if (!tripId || !editable) return;
    const payload = {
      legs: values.legs.map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        fromLocationId: l.fromLocationId,
        toLocationId: l.toLocationId,
        vehicleId: l.vehicleId,
        plannedDepartureAt: inputToUtc(l.plannedDepartureAt),
        plannedArrivalAt: inputToUtc(l.plannedArrivalAt),
      })),
    };
    if (
      send &&
      values.legs.some(
        (l) => new Date(l.plannedArrivalAt) <= new Date(l.plannedDepartureAt),
      )
    ) {
      form.setError("legs", {
        message: "Gửi duyệt yêu cầu giờ đến sau giờ đi.",
      });
      return;
    }
    setSaving(true);
    try {
      const saved = await saveTripPlan(tripId, payload);
      qc.setQueryData(tripQueryKeys.detail(account?.id, tripId), saved);
      form.reset({
        legs: saved.legs.map((l) => ({
          id: l.id,
          fromLocationId: l.fromLocationId,
          toLocationId: l.toLocationId,
          vehicleId: l.vehicleId || "",
          plannedDepartureAt: utcToInput(l.plannedDepartureAt),
          plannedArrivalAt: utcToInput(l.plannedArrivalAt),
        })),
      });
      if (send) {
        try {
          const submitted = await submitTripPlan(tripId);
          qc.setQueryData(tripQueryKeys.detail(account?.id, tripId), submitted);
          void messageApi.success({ key: "trip-plan-feedback", content: "Đã lưu và gửi kế hoạch chờ duyệt." });
        } catch {
          void messageApi.warning({
            key: "trip-plan-feedback",
            content: "Đã lưu bản nháp, nhưng chưa gửi duyệt. Bạn có thể thử gửi lại.",
            duration: 5,
          });
        }
      } else void messageApi.success({ key: "trip-plan-feedback", content: "Đã lưu bản nháp kế hoạch." });
    } catch (e) {
      const body = isAxiosError(e) ? e.response?.data : null;
      void messageApi.error({
        key: "trip-plan-feedback",
        content: String(body?.message || "Không thể lưu kế hoạch. Dữ liệu nhập vẫn được giữ lại."),
        duration: 5,
      });
      if (body?.fields)
        Object.entries(body.fields).forEach(([key, val]) =>
          form.setError(key as any, {
            message: Array.isArray(val) ? val.join(" · ") : String(val),
          }),
        );
    } finally {
      setSaving(false);
    }
  }
  const submit = (values: TripPlanFormValues) => persist(values, true);
  if (detail.isPending)
    return (
      <div className="trip-detail-loading" role="status">
        Đang tải kế hoạch…
      </div>
    );
  if (detail.isError || !detail.data)
    return (
      <div className="trip-detail-error" role="alert">
        <h1>Không thể tải kế hoạch</h1>
        <p>Chuyến không tồn tại hoặc bạn không có quyền truy cập.</p>
        <Link className="trip-link" to={`/dashboard/trips${back}`}>
          Về chi tiết chuyến
        </Link>
      </div>
    );
  if (!editable)
    return (
      <ReadOnly
        detail={detail.data}
        back={back}
        note={
          account?.role === "MANAGER"
            ? "Manager chỉ xem kế hoạch; Coordinator mới có thể lưu nháp."
            : "Chỉ kế hoạch DRAFT của chuyến đang chuẩn bị mới có thể chỉnh sửa."
        }
      />
    );
  return (
    <>
      <Link
        className="trip-back"
        onClick={(e) => {
          if (!leave()) e.preventDefault();
        }}
        to={`/dashboard/trips/${tripId}${back}`}
      >
        ← Chi tiết chuyến
      </Link>
      <header className="trip-heading">
        <p className="trip-eyebrow">QUY TRÌNH 03 · KẾ HOẠCH NHÁP</p>
        <h1>Kế hoạch chuyến #{tripId}</h1>
        <p>Nhập giờ theo Asia/Ho_Chi_Minh (UTC+07:00). Chỉ lưu bản nháp.</p>
      </header>
      <form
        className="trip-plan-form"
        onSubmit={form.handleSubmit(submit)}
        noValidate
      >
        <div className="trip-plan-legs">
          {fields.map((field, i) => (
            <LegForm
              key={field.id}
              index={i}
              fieldId={field.id}
              form={form}
              options={options.data}
              saving={saving}
              onRemove={() => remove(i)}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={
            saving ||
            fields.length >= 50 ||
            !options.data?.locations.length ||
            !options.data?.vehicles.length
          }
          onClick={() => {
            const last = form.getValues("legs").at(-1);
            append({
              fromLocationId:
                last?.toLocationId || options.data?.locations[0]?.id || "",
              toLocationId:
                options.data?.locations[1]?.id ||
                options.data?.locations[0]?.id ||
                "",
              vehicleId: options.data?.vehicles[0]?.id || "",
              plannedDepartureAt: last?.plannedArrivalAt || "",
              plannedArrivalAt: last?.plannedArrivalAt || "",
            });
          }}
        >
          + Thêm chặng cuối
        </button>
        {options.isLoading && (
          <p role="status">Đang tải địa điểm và phương tiện…</p>
        )}
        {options.isError && (
          <p className="trip-form-message is-error" role="alert">
            Không tải được danh mục địa điểm/phương tiện.
          </p>
        )}
        <div className="trip-form-actions">
          <Link
            className="trip-link"
            onClick={(e) => {
              if (!leave()) e.preventDefault();
            }}
            to={`/dashboard/trips/${tripId}${back}`}
          >
            Hủy
          </Link>
          <button
            className="trip-action-button"
            type="submit"
            disabled={saving || !options.data}
          >
            {saving ? "Đang lưu…" : "Lưu bản nháp"}
          </button>
        </div>
      </form>
    </>
  );
}
function LegForm({
  index,
  fieldId,
  form,
  options,
  saving,
  onRemove,
}: {
  index: number;
  fieldId: string;
  form: any;
  options: any;
  saving: boolean;
  onRemove: () => void;
}) {
  const p = `legs.${index}`;
  const error = (name: string) =>
    form.formState.errors.legs?.[index]?.[name]?.message;
  return (
    <fieldset className="trip-panel trip-leg-form">
      <legend>
        Chặng {String(index + 1).padStart(2, "0")}
        <small> · ID {fieldId}</small>
      </legend>
      <div className="trip-form-grid">
        {(["fromLocationId", "toLocationId", "vehicleId"] as const).map(
          (name) => (
            <label key={name}>
              {name === "fromLocationId"
                ? "Điểm đi"
                : name === "toLocationId"
                  ? "Điểm đến"
                  : "Phương tiện"}
              <select
                {...form.register(`${p}.${name}`)}
                disabled={saving || (name === "fromLocationId" && index > 0)}
              >
                {name === "fromLocationId" && index > 0 && (
                  <option value={form.watch(`legs.${index - 1}.toLocationId`)}>
                    Nối từ chặng trước
                  </option>
                )}
                {(name === "vehicleId"
                  ? options?.vehicles
                  : options?.locations
                )?.map((x: any) => (
                  <option key={x.id} value={x.id}>
                    {x.name ||
                      `${x.plateOrCode} · ${x.vehicleType} · ${x.capacityStalls} chỗ`}
                  </option>
                ))}
              </select>
              {error(name) && (
                <span className="trip-field-error">{error(name)}</span>
              )}
            </label>
          ),
        )}
        {(["plannedDepartureAt", "plannedArrivalAt"] as const).map((name) => (
          <label key={name}>
            {name === "plannedDepartureAt"
              ? "Khởi hành dự kiến (giờ Việt Nam)"
              : "Đến dự kiến (giờ Việt Nam)"}
            <input
              type="datetime-local"
              {...form.register(`${p}.${name}`)}
              disabled={saving}
            />
            {error(name) && (
              <span className="trip-field-error">{error(name)}</span>
            )}
          </label>
        ))}
      </div>
      {fieldId ? (
        <p className="trip-form-hint">
          ID và thứ tự chặng đã lưu được giữ nguyên.
        </p>
      ) : (
        <button type="button" disabled={saving} onClick={onRemove}>
          Bỏ chặng mới
        </button>
      )}
    </fieldset>
  );
}
function ReadOnly({
  detail,
  back,
  note,
}: {
  detail: any;
  back: string;
  note: string;
}) {
  return (
    <>
      <Link className="trip-back" to={`/dashboard/trips/${detail.id}${back}`}>
        ← Chi tiết chuyến
      </Link>
      <section className="trip-panel">
        <h1>Kế hoạch chuyến #{detail.id}</h1>
        <p>{note}</p>
        <p>
          Kế hoạch: {detail.planStatus} · Đơn: {detail.orderStatus}
        </p>
        <p>
          Khởi hành: {formatTripDate(detail.plannedDepartureAt)} · Đến:{" "}
          {formatTripDate(detail.plannedArrivalAt)}
        </p>
      </section>
    </>
  );
}
