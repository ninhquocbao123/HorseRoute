/**
 * CUS-11 đến CUS-15 Tạo đơn vận chuyển, cùng 4 bước và cùng dữ liệu với web:
 * Chuyến đi → Chọn ngựa → Dịch vụ & bảo hiểm → Xác nhận & gửi.
 * Khác web có chủ đích: nháp lưu trên máy và máy chủ vì điện thoại hay bị ngắt giữa chừng.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { uuid } from "expo";
import { CircleCheck } from "lucide-react-native";
import {
  Banner,
  Button,
  Card,
  ScreenBody,
  Section,
  StatusBadge,
  StepBar,
  Txt,
  useTheme,
} from "../../ui";
import { useOverlay } from "../../overlay";
import { useResource, useSession } from "../../session";
import { ResourceState } from "../../live-ui";
import { orderStatus } from "../../theme";
import { ApiError, messageOf } from "../../api/http";
import { API_URL } from "../../config";
import type { Navigate, OrderDetail, Page, Profile } from "../../api/types";
import type { PriceEstimate } from "../../../../../packages/shared/src/types/pricing.type";
import {
  asId,
  canResumeDraft,
  day,
  fromOrder,
  label,
  ymd,
} from "../../live-domain";
import {
  BOOKING_STEPS,
  draftFromOrder,
  estimateInput,
  migrateOldDraft,
  newDraft,
  orderBody,
  stepErrors,
  withVehicleFor,
  type BookingContact,
  type BookingData,
  type BookingDraft,
  type BookingErrors,
} from "../../booking-domain";
import {
  CostBar,
  HorsesStep,
  ReviewStep,
  ServicesStep,
  TripStep,
} from "./BookingSteps";

export function BookingScreen({
  page,
  go,
  replace,
}: {
  page: Page;
  go: Navigate;
  replace: Navigate;
}) {
  const profiles = useResource<Profile[]>("/customer/profiles");
  const order = useResource<OrderDetail>(
    page.id ? `/orders/${asId(page.id)}` : null,
  );
  if (!profiles.data || (page.id && !order.data))
    return (
      <ScreenBody>
        <ResourceState
          resource={page.id && profiles.data ? order : profiles}
          what="thông tin đặt chuyến"
          skeleton="detail"
        >
          {null}
        </ResourceState>
      </ScreenBody>
    );
  return (
    <BookingForm
      go={go}
      replace={replace}
      profiles={profiles.data}
      initialOrder={order.data}
      selectedHorse={page.horseId}
    />
  );
}

/** Quãng đường theo tỉnh và xã, giống `useRouteDistance` của web. */
function useRouteDistance(sender: BookingContact, recipient: BookingContact) {
  const { request } = useSession();
  const point = (c: BookingContact) => ({
    country: c.country,
    city: c.city,
    ward: c.ward,
  });
  const key = JSON.stringify({ from: point(sender), to: point(recipient) });
  const complete = !!(
    sender.city &&
    sender.ward &&
    recipient.city &&
    recipient.ward
  );
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    km: number | null;
    error: string;
  }>({ key: "", km: null, error: "" });
  useEffect(() => {
    if (!complete) return;
    let alive = true;
    const timer = setTimeout(() => {
      void request<{ distanceKm: number }>("/customer/route-distance", {
        method: "POST",
        body: JSON.parse(key),
        timeoutMs: 60000,
      })
        .then((r) => {
          if (alive) setState({ key, km: r.distanceKm, error: "" });
        })
        .catch((e) => {
          if (alive) setState({ key, km: null, error: messageOf(e) });
        });
    }, 700);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [key, complete, attempt, request]);
  const current = complete && state.key === key;
  return {
    km: current ? state.km : null,
    error: current ? state.error : "",
    loading: complete && (!current || (!state.km && !state.error)),
    complete,
    retry: () => {
      setState({ key: "", km: null, error: "" });
      setAttempt((n) => n + 1);
    },
  };
}

function useEstimate(input: object | null) {
  const { request } = useSession();
  const key = input ? JSON.stringify(input) : "";
  const [state, setState] = useState<{
    key: string;
    estimate: PriceEstimate | null;
    error: string;
  }>({ key: "", estimate: null, error: "" });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const timer = setTimeout(() => {
      void request<PriceEstimate>("/pricing/estimate", {
        method: "POST",
        body: JSON.parse(key),
      })
        .then((estimate) => {
          if (alive) setState({ key, estimate, error: "" });
        })
        .catch((e) => {
          if (alive) setState({ key, estimate: null, error: messageOf(e) });
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [key, request]);
  const current = !!key && state.key === key;
  return {
    estimate: current ? state.estimate : null,
    error: current ? state.error : "",
  };
}

function BookingForm({
  profiles,
  initialOrder,
  selectedHorse,
  go,
  replace,
}: {
  profiles: Profile[];
  initialOrder?: OrderDetail;
  selectedHorse?: string;
  go: Navigate;
  replace: Navigate;
}) {
  const { colors: c } = useTheme();
  const { user, request, write, writing, refresh } = useSession();
  const { confirm } = useOverlay();
  const account = {
    fullName: user!.fullName,
    phone: user!.phone,
    address: user!.address,
  };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<BookingErrors>({});
  const [sent, setSent] = useState<{ id: string; code: string } | null>(null);
  /** Đang sửa từ màn Xác nhận: xong thì quay lại đó. */
  const [fromReview, setFromReview] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [draft, setDraft] = useState<BookingDraft>(() => {
    const requestId = uuid.v4();
    if (initialOrder)
      return draftFromOrder(
        initialOrder,
        account,
        requestId,
        fromOrder(initialOrder).horses,
      );
    return newDraft(requestId, account, selectedHorse ? [selectedHorse] : []);
  });
  const lockedHorses = !!draft.lockedHorses;
  const base = `horseroute.booking.${API_URL}:${user!.id}:${initialOrder?.id ?? "new"}`;
  const key = `v4:${base}`;
  const oldKey = `horseroute.booking.v3:${API_URL}:${user!.id}:${initialOrder?.id ?? "new"}`;
  const chain = useRef(Promise.resolve());
  const finished = useRef(false);
  /** Đã bấm Gửi trong lần mở này: gặp đơn Chờ duyệt nghĩa là lần gửi trước đã tới máy chủ. */
  const submitted = useRef(false);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      const raw = await AsyncStorage.getItem(key);
      const oldRaw = raw ? null : await AsyncStorage.getItem(oldKey);
      if (!raw && !oldRaw) return;
      const data: BookingDraft = raw
        ? JSON.parse(raw)
        : migrateOldDraft(JSON.parse(oldRaw!), account, uuid.v4());
      if (!data.requestId || !data.booking || !Array.isArray(data.selected))
        throw new Error("Nháp không hợp lệ.");
      if (!initialOrder && data.savedId) {
        // Nháp có thể đã được gửi hoặc xóa từ màn khác: không dùng lại cho yêu cầu mới.
        const server = await request<OrderDetail>(
          `/orders/${asId(data.savedId)}`,
        ).catch((e) =>
          e instanceof ApiError && e.status === 404 ? null : undefined,
        );
        if (server === null || (server && !canResumeDraft(server.status))) {
          await AsyncStorage.multiRemove([key, oldKey]);
          return;
        }
      }
      if (!active) return;
      const selected = selectedHorse ? [selectedHorse] : data.selected;
      setDraft(withVehicleFor(selected.length, { ...data, selected }));
      if (oldRaw) await AsyncStorage.removeItem(oldKey);
    };
    restore()
      .catch(() => {
        if (active)
          setError(
            "Không đọc được nháp trên máy. Đang dùng nội dung từ máy chủ hoặc biểu mẫu trống.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [key, selectedHorse]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || finished.current) return;
    chain.current = chain.current
      .then(() => AsyncStorage.setItem(key, JSON.stringify(draft)))
      .catch(() =>
        setError(
          "Không lưu được nháp trên máy. Giữ ứng dụng mở trước khi gửi.",
        ),
      );
  }, [draft, key, ready]);

  const b = draft.booking;
  const horseCount = draft.lockedHorses?.length ?? draft.selected.length;
  const chosen = useMemo(
    () => profiles.filter((h) => draft.selected.includes(String(h.id))),
    [profiles, draft.selected],
  );
  const route = useRouteDistance(b.sender, b.recipient);
  const { estimate, error: estimateError } = useEstimate(
    route.km ? estimateInput(draft, horseCount, route.km) : null,
  );
  useEffect(() => {
    if (route.km && route.km !== b.distanceKm)
      setDraft((d) => ({
        ...d,
        booking: { ...d.booking, distanceKm: route.km! },
      }));
  }, [route.km, b.distanceKm]);

  const change = (updater: (d: BookingDraft) => BookingDraft) => {
    setError("");
    setDraft(updater);
  };
  const setBooking = (patch: Partial<BookingData>) =>
    change((d) => ({ ...d, booking: { ...d.booking, ...patch } }));
  const clearError = (field: string) =>
    setErrors((e) => {
      if (!e[field]) return e;
      const { [field]: _gone, ...rest } = e;
      return rest;
    });

  /** Hiện lỗi và cuộn tới ô đầu tiên bị lỗi. Ô điều khoản nằm cuối màn xác nhận. */
  const showErrors = (e: BookingErrors, step: number) => {
    setErrors(e);
    const first = Object.keys(e)[0];
    if (!first) return false;
    setError("Kiểm tra các ô được đánh dấu.");
    if (step === 3) {
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
      return true;
    }
    const y = step === 0 ? (sectionY.current[first.split(".")[0]] ?? 0) : 0;
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true }),
    );
    return true;
  };
  const today = ymd(new Date());

  /** Lưu nháp lên máy chủ để mở lại được trên web. Lỗi mạng thì vẫn còn nháp trên máy. */
  const saveServerDraft = async (next: BookingDraft) => {
    if (initialOrder && initialOrder.status !== "DRAFT") return next;
    if (!next.selected.length) return next;
    try {
      const body = orderBody(next, profiles);
      if (next.savedId) {
        await request(`/orders/${asId(next.savedId)}`, { method: "PUT", body });
        return next;
      }
      const r = await request<{ id: string }>("/orders", {
        method: "POST",
        body: { ...body, requestId: next.requestId },
      });
      return { ...next, savedId: String(r.id) };
    } catch {
      return next;
    }
  };
  const forward = async () => {
    setError("");
    if (showErrors(stepErrors(draft.step, draft, today), draft.step)) return;
    if (draft.step === 2 && !estimate) {
      setError(
        route.error ||
          estimateError ||
          "Đang tính quãng đường và chi phí, chờ một chút rồi bấm lại.",
      );
      return;
    }
    let next = { ...draft, step: fromReview ? 3 : draft.step + 1 };
    setFromReview(false);
    await write(async () => {
      next = await saveServerDraft(next);
    }).catch(() => {});
    setDraft(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const jump = (step: number, review = false) => {
    setError("");
    setErrors({});
    setFromReview(review);
    change((d) => ({ ...d, step }));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const submit = async () => {
    setError("");
    for (const step of [0, 1, 2]) {
      const e = stepErrors(step, draft, today);
      if (Object.keys(e).length) {
        jump(step, true);
        showErrors(e, step);
        return;
      }
    }
    if (showErrors(stepErrors(3, draft, today), 3)) return;
    if (!route.km || !estimate) {
      setError(
        route.error ||
          estimateError ||
          "Cần tính được quãng đường và chi phí trước khi gửi đơn.",
      );
      return;
    }
    try {
      await write(async () => {
        await chain.current;
        const body = orderBody(
          { ...draft, booking: { ...b, distanceKm: route.km! } },
          profiles,
        );
        await AsyncStorage.setItem(key, JSON.stringify(draft));
        let savedId = draft.savedId;
        if (!savedId) {
          const result = await request<{ id: string }>("/orders", {
            method: "POST",
            body: { ...body, requestId: draft.requestId },
          });
          savedId = String(result.id);
          const checkpoint = { ...draft, savedId };
          await AsyncStorage.setItem(key, JSON.stringify(checkpoint));
          setDraft(checkpoint);
        }
        const current = await request<OrderDetail>(`/orders/${asId(savedId)}`);
        if (canResumeDraft(current.status)) {
          await request(`/orders/${asId(savedId)}`, { method: "PUT", body });
          submitted.current = true;
          await request(`/orders/${asId(savedId)}/submit`, { method: "POST" });
        } else if (current.status !== "PENDING" || !submitted.current) {
          // Không báo "Đã gửi" với đơn cũ: yêu cầu đang nhập chưa hề được gửi.
          await AsyncStorage.removeItem(key);
          throw new Error(
            `Nháp này thuộc đơn ${current.order_code}, đơn đã ở trạng thái ${label(current.status)}. Yêu cầu vừa nhập chưa được gửi. Thoát màn này và tạo yêu cầu mới.`,
          );
        }
        finished.current = true;
        await chain.current;
        await AsyncStorage.multiRemove([key, oldKey]);
        refresh();
        setSent({ id: savedId, code: current.order_code });
      });
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const cancelBooking = async () => {
    const ok = await confirm({
      title: "Hủy chuyến đang đặt?",
      body: "Nội dung đã nhập và đơn nháp sẽ bị xóa, không khôi phục được.",
      cancelLabel: "Tiếp tục đặt",
      confirmLabel: "Hủy chuyến",
      destructive: true,
    });
    if (!ok) return;
    try {
      await write(async () => {
        if (draft.savedId)
          await request(`/orders/${asId(draft.savedId)}`, {
            method: "DELETE",
          }).catch((e) => {
            if (!(e instanceof ApiError && e.status === 404)) throw e;
          });
        finished.current = true;
        await chain.current;
        await AsyncStorage.multiRemove([key, oldKey]);
        refresh();
        go("back");
      });
    } catch (e) {
      finished.current = false;
      setError(messageOf(e));
    }
  };

  if (sent)
    // CUS-15 Đã gửi yêu cầu
    return (
      <ScreenBody
        footer={
          <Button
            title="Xem đơn"
            onPress={() => replace("order", { id: sent.id })}
          />
        }
      >
        <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
          <CircleCheck size={56} color={c.successFg} />
          <Txt size={24} bold style={{ textAlign: "center" }}>
            Đã gửi yêu cầu
          </Txt>
          <Txt style={{ textAlign: "center" }}>
            {`${sent.code} · ${horseCount} ngựa · khởi hành ${day(draft.date)}`}
          </Txt>
          <StatusBadge spec={orderStatus.PENDING} />
        </View>
        <Section title="Bước tiếp theo" />
        <Card>
          {[
            ["Đã gửi yêu cầu", true],
            ["Quản lý duyệt và gửi báo giá", false],
            ["Bạn đặt cọc ngay trên app", false],
            ["Điều phối lập chuyến, bạn theo dõi trên app", false],
          ].map(([text, done], i) => (
            <View
              key={String(text)}
              style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
            >
              {done ? (
                <CircleCheck size={22} color={c.successFg} />
              ) : (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 1.5,
                    borderColor: c.borderInput,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt size={12}>{String(i + 1)}</Txt>
                </View>
              )}
              <Txt style={{ flex: 1 }}>{String(text)}</Txt>
            </View>
          ))}
        </Card>
        <Txt size={15} color={c.textSecondary}>
          Bạn nhận thông báo khi quản lý duyệt hoặc cần bổ sung.
        </Txt>
      </ScreenBody>
    );

  if (!ready)
    return (
      <ScreenBody>
        <Txt>Đang khôi phục nháp…</Txt>
      </ScreenBody>
    );

  const step = draft.step;
  const canCancel = !initialOrder || initialOrder.status === "DRAFT";
  return (
    <ScreenBody
      scrollRef={scrollRef}
      footer={
        <>
          {step === 2 ? (
            <CostBar
              route={route}
              estimate={estimate}
              estimateError={estimateError}
              waterRounds={b.waterRounds}
            />
          ) : null}
          <View style={{ flexDirection: "row", gap: 12 }}>
            {step > 0 ? (
              <View style={{ flex: 2 }}>
                <Button
                  title="Quay lại"
                  kind="secondary"
                  disabled={writing}
                  onPress={() => jump(step - 1)}
                />
              </View>
            ) : null}
            <View style={{ flex: 3 }}>
              <Button
                title={
                  writing
                    ? step === 3
                      ? "Đang gửi…"
                      : "Đang lưu…"
                    : step === 3
                      ? "Gửi đơn chờ duyệt"
                      : fromReview
                        ? "Xong"
                        : "Tiếp tục"
                }
                disabled={writing}
                onPress={() => void (step === 3 ? submit() : forward())}
              />
            </View>
          </View>
        </>
      }
    >
      <View>
        <StepBar step={step} steps={BOOKING_STEPS} />
        {/* Chạm bước đã qua để quay lại, giống thanh bước của web. */}
        <View style={[StyleSheet.absoluteFill, { flexDirection: "row" }]}>
          {BOOKING_STEPS.map((name, i) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={`Quay lại bước ${name}`}
              accessibilityElementsHidden={i >= step}
              disabled={i >= step || writing}
              onPress={() => jump(i)}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      </View>
      {step === 0 ? (
        <TripStep
          draft={draft}
          errors={errors}
          account={account}
          change={change}
          clearError={clearError}
          sectionY={sectionY.current}
        />
      ) : null}
      {step === 1 ? (
        <HorsesStep
          draft={draft}
          errors={errors}
          profiles={profiles}
          disabled={writing}
          change={change}
          clearError={clearError}
          setBooking={setBooking}
          go={go}
        />
      ) : null}
      {step === 2 ? (
        <ServicesStep
          draft={draft}
          errors={errors}
          horses={chosen}
          change={change}
          setBooking={setBooking}
        />
      ) : null}
      {step === 3 ? (
        <ReviewStep
          draft={draft}
          errors={errors}
          horseNames={
            draft.lockedHorses?.map((h) => h.name) ?? chosen.map((h) => h.name)
          }
          km={route.km}
          routeError={route.error}
          retryRoute={route.retry}
          estimate={estimate}
          estimateError={estimateError}
          setBooking={setBooking}
          clearError={clearError}
          onEdit={(target) => jump(target, true)}
        />
      ) : null}
      {error ? <Banner warning text={error} /> : null}
      {draft.savedId ? (
        <Txt size={12} color={c.textSecondary}>
          Nháp đã lưu, mở lại được từ danh sách đơn.
        </Txt>
      ) : null}
      {lockedHorses ? (
        <Txt size={12} color={c.textSecondary}>
          Đơn cần bổ sung giữ nguyên danh sách ngựa.
        </Txt>
      ) : null}
      {canCancel ? (
        <Button
          title="Hủy chuyến đang đặt"
          kind="tertiary"
          disabled={writing}
          onPress={() => void cancelBooking()}
        />
      ) : null}
    </ScreenBody>
  );
}
