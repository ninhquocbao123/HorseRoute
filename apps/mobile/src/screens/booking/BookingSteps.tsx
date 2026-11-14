/** Giao diện 4 bước tạo đơn. Logic nằm ở `booking-domain.ts`, trạng thái ở `BookingScreen`. */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  ArrowLeftRight,
  Check,
  ChevronUp,
  CircleCheck,
  FileText,
  Lock,
  PawPrint,
  Plus,
  RefreshCw,
  UserRound,
} from "lucide-react-native";
import {
  Button,
  Card,
  CheckRow,
  Chip,
  DateField,
  Field,
  IconButton,
  InfoLine,
  Row,
  Section,
  Stepper,
  Txt,
  s,
  useTheme,
} from "../../ui";
import { Sheet, useOverlay } from "../../overlay";
import { useResource, useSession } from "../../session";
import { Empty, SelectField } from "../../live-ui";
import { motion } from "../../theme";
import type { Navigate, Profile } from "../../api/types";
import type {
  PriceEstimate,
  PricingConfig,
} from "../../../../../packages/shared/src/types/pricing.type";
import { day, fromYmd, money, num, ymd } from "../../live-domain";
import {
  COUNTRY_NAMES,
  INSURANCE_GROUPS,
  borderGates,
  PICKUP_TIMES,
  VEHICLES,
  accountContact,
  contactAddress,
  insuranceForBreeds,
  normalizeSearch,
  setRoute,
  setTripType,
  withVehicleFor,
  type BookingContact,
  type BookingData,
  type BookingDraft,
  type BookingErrors,
} from "../../booking-domain";

type Change = (updater: (d: BookingDraft) => BookingDraft) => void;
type Province = { name: string; wards: string[] };

/** Nạp dữ liệu địa điểm khi cần, tránh đọc cả ba nước lúc mở app. */
const provincesOf = (country: string): Province[] => {
  if (country === "CN")
    return require("../../../../../packages/shared/src/data/china-locations.json");
  if (country === "TH")
    return require("../../../../../packages/shared/src/data/thailand-locations.json");
  return require("../../../../../packages/shared/src/data/vietnam-locations.json");
};

/* ---------------- Bước 1. Chuyến đi ---------------- */

function ContactSection({
  who,
  contact,
  errors,
  onChange,
  onUseAccount,
  onLayoutY,
}: {
  who: "sender" | "recipient";
  contact: BookingContact;
  errors: BookingErrors;
  onChange: (patch: Partial<BookingContact>, field: string) => void;
  onUseAccount?: () => void;
  onLayoutY: (y: number) => void;
}) {
  const { colors: c } = useTheme();
  const sender = who === "sender";
  const provinces = provincesOf(contact.country);
  const province = provinces.find((p) => p.name === contact.city);
  const err = (field: string) => errors[`${who}.${field}`];
  const address = contactAddress(contact);
  return (
    <View
      style={{ gap: 16 }}
      onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)}
    >
      <Section
        title={sender ? "Người gửi & điểm đón" : "Người nhận & điểm giao"}
      />
      {onUseAccount ? (
        <Button
          title="Tôi là người gửi"
          kind="secondary"
          icon={UserRound}
          onPress={onUseAccount}
        />
      ) : null}
      <Field
        label={
          sender
            ? "Họ tên người gửi / Tên đơn vị *"
            : "Họ tên người nhận / Tên trại đích *"
        }
        value={contact.name}
        maxLength={100}
        error={err("name")}
        onChangeText={(name) => onChange({ name }, "name")}
      />
      <Field
        label={
          sender ? "Số điện thoại người gửi *" : "Số điện thoại người nhận *"
        }
        value={contact.phone}
        maxLength={20}
        keyboardType="phone-pad"
        placeholder="VD: 0901 234 567"
        error={err("phone")}
        hint={sender ? undefined : "Tài xế gọi số này khi giao ngựa."}
        onChangeText={(phone) => onChange({ phone }, "phone")}
      />
      <SelectField
        label="Tỉnh / Thành phố *"
        value={contact.city}
        placeholder={`Chọn tỉnh, thành phố · ${COUNTRY_NAMES[contact.country] ?? contact.country}`}
        options={provinces.map((p) => p.name)}
        error={err("city")}
        onChange={(city) => onChange({ city, ward: "" }, "city")}
      />
      <SelectField
        label="Xã / Phường / Khu vực *"
        value={contact.ward}
        placeholder={
          province ? "Chọn xã, phường, khu vực" : "Chọn tỉnh, thành phố trước"
        }
        options={province?.wards ?? []}
        disabled={!province}
        error={err("ward")}
        onChange={(ward) => onChange({ ward }, "ward")}
      />
      <Field
        label="Tên trang trại / Địa chỉ cụ thể *"
        value={contact.address}
        maxLength={120}
        placeholder="Số nhà, tên đường hoặc tên trang trại"
        error={err("address")}
        onChangeText={(value) => onChange({ address: value }, "address")}
      />
      {address ? (
        <Txt size={15} color={c.textSecondary}>
          {`Địa chỉ ${sender ? "đón" : "giao"}: ${address}`}
        </Txt>
      ) : null}
      <Field
        label="CCCD / MST / Hộ chiếu *"
        value={contact.identityNumber}
        maxLength={30}
        error={err("identityNumber")}
        onChangeText={(identityNumber) =>
          onChange({ identityNumber }, "identityNumber")
        }
      />
    </View>
  );
}

export function TripStep({
  draft,
  errors,
  account,
  change,
  clearError,
  sectionY,
}: {
  draft: BookingDraft;
  errors: BookingErrors;
  account: { fullName: string; phone?: string | null; address?: string | null };
  change: Change;
  clearError: (field: string) => void;
  sectionY: Record<string, number>;
}) {
  const { colors: c } = useTheme();
  const { request } = useSession();
  const b = draft.booking;
  const foreign =
    b.sender.country === "VN" ? b.recipient.country : b.sender.country;
  const outbound = b.sender.country === "VN";
  const contact = (
    who: "sender" | "recipient",
    patch: Partial<BookingContact>,
    field: string,
  ) => {
    clearError(`${who}.${field}`);
    if (patch.city) clearError(`${who}.ward`);
    change((d) => ({
      ...d,
      booking: { ...d.booking, [who]: { ...d.booking[who], ...patch } },
    }));
  };
  return (
    <>
      <View
        style={{ gap: 16 }}
        onLayout={(e) => {
          sectionY.trip = e.nativeEvent.layout.y;
          sectionY.date = e.nativeEvent.layout.y;
          sectionY.route = e.nativeEvent.layout.y;
        }}
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          {([false, true] as const).map((value) => (
            <View key={String(value)} style={{ flex: 1 }}>
              <Chip
                compact
                label={value ? "Quốc tế" : "Trong nước"}
                selected={draft.international === value}
                onPress={() => change((d) => setTripType(d, value))}
              />
            </View>
          ))}
        </View>
        {draft.international ? (
          <>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["CN", "TH"] as const).map((code) => (
                <View key={code} style={{ flex: 1 }}>
                  <Chip
                    compact
                    label={COUNTRY_NAMES[code]}
                    selected={foreign === code}
                    onPress={() =>
                      change((d) =>
                        outbound
                          ? setRoute(d, "VN", code)
                          : setRoute(d, code, "VN"),
                      )
                    }
                  />
                </View>
              ))}
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Txt bold style={{ flex: 1 }}>
                {`${COUNTRY_NAMES[b.sender.country]} → ${COUNTRY_NAMES[b.recipient.country]}`}
              </Txt>
              <IconButton
                icon={ArrowLeftRight}
                label="Đảo chiều hành trình"
                onPress={() =>
                  change((d) =>
                    setRoute(
                      d,
                      d.booking.recipient.country,
                      d.booking.sender.country,
                    ),
                  )
                }
              />
            </View>
          </>
        ) : (
          <Txt size={15} color={c.textSecondary}>
            Việt Nam → Việt Nam
          </Txt>
        )}
        {errors.route ? (
          <Txt size={15} color={c.dangerFg}>
            {errors.route}
          </Txt>
        ) : null}
        <DateField
          label="Ngày khởi hành *"
          value={fromYmd(draft.date)}
          minimumDate={new Date()}
          error={errors.date}
          onChange={(d) => {
            clearError("date");
            change((old) => ({ ...old, date: ymd(d) }));
          }}
        />
      </View>
      <ContactSection
        who="sender"
        contact={b.sender}
        errors={errors}
        onLayoutY={(y) => (sectionY.sender = y)}
        onChange={(patch, field) => contact("sender", patch, field)}
        onUseAccount={async () => {
          // "Tôi là người gửi": thông tin đã lưu (tài khoản + đơn gần nhất khách là người gửi); tỉnh, phường chỉ điền khi cùng nước.
          let patch: Partial<BookingContact> = accountContact(account);
          try {
            const p = await request<Partial<BookingContact>>("/orders/sender-profile");
            const same = !p.country || p.country === b.sender.country;
            patch = {
              name: p.name || account.fullName,
              phone: p.phone || account.phone || "",
              address: p.address || account.address || "",
              identityNumber: p.identityNumber || "",
              ...(same && p.city ? { city: p.city, ward: p.ward || "" } : {}),
            };
          } catch {
            /* mất mạng: điền phần có trong tài khoản */
          }
          Object.keys(patch).forEach((f) => clearError(`sender.${f}`));
          change((d) => ({
            ...d,
            booking: { ...d.booking, sender: { ...d.booking.sender, ...patch } },
          }));
        }}
      />
      <ContactSection
        who="recipient"
        contact={b.recipient}
        errors={errors}
        onLayoutY={(y) => (sectionY.recipient = y)}
        onChange={(patch, field) => contact("recipient", patch, field)}
      />
    </>
  );
}

/* ---------------- Bước 2. Chọn ngựa ---------------- */

const DOCUMENTS = [
  { label: "Hộ chiếu", pattern: /hộ chiếu|passport/i },
  { label: "Sổ tiêm", pattern: /tiêm|vaccin/i },
  { label: "Xét nghiệm", pattern: /eia|coggins/i },
];

/**
 * Hàng chọn ngựa. Ngựa bận vẫn chạm được để giải thích: hàng rung,
 * viền vàng sáng lên trong lúc thông báo hiện rồi tắt cùng thông báo (Long, 02/11).
 */
function HorseRow({
  horse: h,
  reason,
  selected,
  disabled,
  flash,
  documents,
  onPress,
}: {
  horse: Profile;
  reason?: string;
  selected: boolean;
  disabled: boolean;
  flash: boolean;
  documents: { label: string; done: boolean }[];
  onPress: () => void;
}) {
  const { colors: c } = useTheme();
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!flash) return;
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 8, -8, 4, -4, 0].map((toValue) =>
        Animated.timing(shake, {
          toValue,
          duration: 50,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [flash, shake]);
  return (
    <Animated.View style={{ transform: [{ translateX: shake }] }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected, disabled: !!reason }}
        accessibilityLabel={`${h.name}${reason ? `, ${reason}` : ""}`}
        accessibilityHint={reason ? "Không chọn được ngựa này" : undefined}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          gap: 8,
          padding: 12,
          minHeight: 64,
          borderRadius: 16,
          borderCurve: "continuous",
          borderWidth: flash || selected ? 2 : 1,
          borderColor: flash ? c.accent : selected ? c.link : c.border,
          backgroundColor: selected
            ? c.infoBg
            : pressed
              ? c.surfaceMuted
              : c.surface,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {reason ? (
            <Lock size={22} color={c.textSecondary} />
          ) : (
            <PawPrint size={22} color={c.link} />
          )}
          <View style={{ flex: 1, gap: 2, opacity: reason ? 0.6 : 1 }}>
            <Txt bold>{h.name}</Txt>
            <Txt size={15} color={c.textSecondary}>
              {reason ??
                ([
                  h.microchip && `Chip ${h.microchip}`,
                  h.breed,
                  h.sex,
                  h.coatColor,
                ]
                  .filter(Boolean)
                  .join(" · ") ||
                  "Hồ sơ ngựa")}
            </Txt>
          </View>
          {reason ? null : (
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: selected ? c.link : c.borderInput,
                backgroundColor: selected ? c.link : "transparent",
              }}
            >
              {selected ? (
                <Check size={16} color={c.surface} strokeWidth={3} />
              ) : null}
            </View>
          )}
        </View>
        {reason ? null : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {documents.map((d) => (
              <View
                key={d.label}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                {d.done ? (
                  <CircleCheck size={14} color={c.successFg} />
                ) : (
                  <FileText size={14} color={c.textSecondary} />
                )}
                <Txt size={12} color={d.done ? c.successFg : c.textSecondary}>
                  {d.label}
                </Txt>
              </View>
            ))}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function HorsesStep({
  draft,
  errors,
  profiles,
  disabled,
  change,
  clearError,
  setBooking,
  go,
}: {
  draft: BookingDraft;
  errors: BookingErrors;
  profiles: Profile[];
  disabled: boolean;
  change: Change;
  clearError: (field: string) => void;
  setBooking: (patch: Partial<BookingData>) => void;
  go: Navigate;
}) {
  const { colors: c } = useTheme();
  const { notify } = useOverlay();
  const types = useResource<{ id: string; name: string }[]>(
    "/customer/document-types",
  );
  const [search, setSearch] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );
  const b = draft.booking;
  const count = draft.lockedHorses?.length ?? draft.selected.length;
  const locked = (h: Profile) =>
    h.activeOrderId && String(h.activeOrderId) !== draft.savedId
      ? `Đang trên đơn ${h.activeOrderCode ?? ""}`
      : !h.passportNo.trim()
        ? "Thiếu số hộ chiếu"
        : null;
  const query = normalizeSearch(search);
  const matches = profiles.filter((h) =>
    normalizeSearch(`${h.name} ${h.microchip} ${h.breed}`).includes(query),
  );
  const free = matches.filter((h) => !locked(h));
  const busy = matches.filter((h) => locked(h));
  const documents = (h: Profile) =>
    DOCUMENTS.map(({ label, pattern }) => {
      const type = types.data?.find((t) => pattern.test(t.name));
      return {
        label,
        done:
          !!type &&
          h.files.some(
            (f) => f.kind === "DOCUMENT" && String(f.slot) === String(type.id),
          ),
      };
    });
  const toggle = (h: Profile) => {
    clearError("horses");
    clearError("vehicle");
    change((d) => {
      const id = String(h.id);
      const selected = d.selected.includes(id)
        ? d.selected.filter((v) => v !== id)
        : [...d.selected, id];
      return withVehicleFor(selected.length, { ...d, selected });
    });
  };
  /** Chạm ngựa không chọn được: rung, viền vàng và thông báo trên cùng trong cùng 3 giây. */
  const refuse = (h: Profile, reason: string) => {
    setFlash(String(h.id));
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), motion.topNoticeMs);
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
    notify(
      h.activeOrderId
        ? `${h.name} đang trong chuyến khác`
        : `${h.name} chưa có số hộ chiếu`,
      h.activeOrderId
        ? `${reason}. Vui lòng chọn ngựa khác.`
        : "Cập nhật hồ sơ ngựa trước, hoặc chọn ngựa khác.",
    );
  };
  return (
    <>
      <Txt bold>Khung giờ đón</Txt>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginRight: -16 }}
        contentContainerStyle={{ gap: 8, paddingRight: 16 }}
      >
        {PICKUP_TIMES.map((time) => (
          <Chip
            key={time}
            compact
            label={time}
            selected={b.pickupTime === time}
            onPress={() => setBooking({ pickupTime: time })}
          />
        ))}
      </ScrollView>
      <Txt bold>Hạng xe</Txt>
      <View style={s.wrap}>
        {VEHICLES.map((v) => (
          <Chip
            key={v.capacity}
            compact
            label={v.label}
            selected={b.vehicleCapacity === v.capacity}
            disabled={v.capacity < count}
            onPress={() => {
              clearError("vehicle");
              setBooking({
                vehicleClass: v.vehicleClass,
                vehicleCapacity: v.capacity,
              });
            }}
          />
        ))}
      </View>
      {errors.vehicle ? (
        <Txt size={15} color={c.dangerFg}>
          {errors.vehicle}
        </Txt>
      ) : null}
      <Section
        title={
          draft.lockedHorses
            ? `${count} ngựa trong đơn`
            : `Đã chọn ${count} / ${profiles.length} ngựa`
        }
      />
      {errors.horses ? (
        <Txt size={15} color={c.dangerFg}>
          {errors.horses}
        </Txt>
      ) : null}
      {draft.lockedHorses ? (
        <Card>
          {draft.lockedHorses.map((h, i) => (
            <Row
              key={h.id ?? i}
              title={h.name}
              detail={h.passportNo ? `Hộ chiếu ${h.passportNo}` : undefined}
              icon={PawPrint}
            />
          ))}
        </Card>
      ) : (
        <>
          {profiles.length > 6 ? (
            <Field
              label="Tìm ngựa"
              value={search}
              placeholder="Tên ngựa, microchip, giống…"
              onChangeText={setSearch}
            />
          ) : null}
          {free.map((h) => (
            <HorseRow
              key={h.id}
              horse={h}
              selected={draft.selected.includes(String(h.id))}
              disabled={disabled}
              flash={false}
              documents={documents(h)}
              onPress={() => toggle(h)}
            />
          ))}
          {busy.length ? (
            <>
              <Section title="Chưa chọn được" />
              {busy.map((h) => (
                <HorseRow
                  key={h.id}
                  horse={h}
                  reason={locked(h)!}
                  selected={false}
                  disabled={disabled}
                  flash={flash === String(h.id)}
                  documents={[]}
                  onPress={() => refuse(h, locked(h)!)}
                />
              ))}
            </>
          ) : null}
          {!matches.length ? (
            <Empty
              icon={PawPrint}
              title={
                profiles.length ? "Không tìm thấy ngựa" : "Chưa có hồ sơ ngựa"
              }
              detail={
                profiles.length
                  ? "Thử từ khóa khác."
                  : "Thêm hồ sơ ngựa trước khi đặt vận chuyển."
              }
            />
          ) : null}
          <Button
            title="Thêm hồ sơ ngựa"
            kind="tertiary"
            icon={Plus}
            onPress={() => go("horse-form")}
          />
        </>
      )}
    </>
  );
}

/* ---------------- Bước 3. Dịch vụ & bảo hiểm ---------------- */

function OptionGroup({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: string;
  options: { value: string; title: string; note?: string }[];
  onChange: (value: string) => void;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Txt bold>{title}</Txt>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={`${o.title}${o.note ? `, ${o.note}` : ""}`}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 56,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 16,
              borderCurve: "continuous",
              borderWidth: on ? 2 : 1,
              borderColor: on ? c.link : c.border,
              backgroundColor: on ? c.infoBg : c.surface,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: on ? c.link : c.borderInput,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {on ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: c.link,
                  }}
                />
              ) : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt>{o.title}</Txt>
              {o.note ? (
                <Txt size={12} color={c.textSecondary}>
                  {o.note}
                </Txt>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ServicesStep({
  draft,
  errors,
  horses,
  change,
  setBooking,
}: {
  draft: BookingDraft;
  errors: BookingErrors;
  horses: Profile[];
  change: Change;
  setBooking: (patch: Partial<BookingData>) => void;
}) {
  const { colors: c } = useTheme();
  const pricing = useResource<{ config: PricingConfig | null }>(
    "/pricing/current",
  );
  const config = pricing.data?.config;
  const b = draft.booking;
  const fee = (amount: number | undefined, unit = "ngựa") =>
    amount == null
      ? "Theo bảng giá hiện hành"
      : `+${amount.toLocaleString("vi-VN")} ₫ / ${unit}`;
  const included = "Đã gồm trong cước";
  return (
    <>
      <Txt size={15} color={c.textSecondary}>
        {`Áp dụng cho ${draft.lockedHorses?.length ?? horses.length} ngựa trong chuyến.`}
      </Txt>
      <OptionGroup
        title="Khoang trên xe"
        value={b.extraStall ? "EXTRA" : "STANDARD"}
        onChange={(v) => setBooking({ extraStall: v === "EXTRA" })}
        options={[
          { value: "STANDARD", title: "Khoang tiêu chuẩn", note: included },
          {
            value: "EXTRA",
            title: "Khoang đơn mở rộng",
            note: fee(config?.fees.extraStallPerHorse),
          },
        ]}
      />
      <OptionGroup
        title="Gói thức ăn"
        value={b.feed}
        onChange={(v) => setBooking({ feed: v as BookingData["feed"] })}
        options={[
          { value: "STANDARD", title: "Gói cơ bản", note: included },
          {
            value: "PREMIUM",
            title: "Gói nâng cao",
            note: fee(config?.fees.premiumFeedPerHorse),
          },
          {
            value: "SPORT",
            title: "Gói thể thao",
            note: fee(config?.fees.sportFeedPerHorse),
          },
        ]}
      />
      <OptionGroup
        title="Cữ nước"
        value={b.waterRounds ? b.water : "STANDARD"}
        onChange={(v) =>
          setBooking(
            v === "STANDARD"
              ? { waterRounds: 0 }
              : {
                  water: v as BookingData["water"],
                  waterRounds: Math.max(1, b.waterRounds),
                },
          )
        }
        options={[
          { value: "STANDARD", title: "Tiêu chuẩn", note: included },
          {
            value: "EVERY_2_HOURS",
            title: "Mỗi 2 giờ",
            note: fee(config?.fees.water2hPerHorse, "ngựa / cữ"),
          },
          {
            value: "EVERY_HOUR",
            title: "Mỗi giờ",
            note: fee(config?.fees.water1hPerHorse, "ngựa / cữ"),
          },
        ]}
      />
      {b.waterRounds > 0 ? (
        <Stepper
          label="Số cữ nước bổ sung / ngựa"
          value={b.waterRounds}
          step={1}
          min={1}
          max={1000}
          unit="cữ"
          onChange={(waterRounds) =>
            setBooking({ waterRounds: Math.round(waterRounds) })
          }
        />
      ) : null}
      {errors.waterRounds ? (
        <Txt size={15} color={c.dangerFg}>
          {errors.waterRounds}
        </Txt>
      ) : null}
      <OptionGroup
        title="Bảo hiểm chuyến đi"
        value={b.insurance === "NONE" ? "NONE" : "BUY"}
        onChange={(v) =>
          setBooking({
            insurance:
              v === "NONE"
                ? "NONE"
                : b.insurance !== "NONE"
                  ? b.insurance
                  : insuranceForBreeds(horses.map((h) => h.breed)),
          })
        }
        options={[
          { value: "NONE", title: "Không mua bảo hiểm" },
          {
            value: "BUY",
            title: "Mua bảo hiểm",
            note:
              b.insurance !== "NONE"
                ? fee(config?.insurance[b.insurance])
                : "Phí tính theo nhóm bảo hiểm được chọn",
          },
        ]}
      />
      {b.insurance !== "NONE" ? (
        <View style={{ gap: 8 }}>
          <Txt bold>Nhóm bảo hiểm</Txt>
          <View style={s.wrap}>
            {INSURANCE_GROUPS.map(([code, name]) => (
              <Chip
                key={code}
                compact
                label={name}
                selected={b.insurance === code}
                onPress={() => setBooking({ insurance: code })}
              />
            ))}
          </View>
        </View>
      ) : null}
      {draft.international ? (
        <View style={{ gap: 8 }}>
          <Txt bold>Thông quan (không bắt buộc, có thể bổ sung sau)</Txt>
          <Txt size={15} color={c.textSecondary}>
            Số tờ khai hải quan thường có sau khi có giấy kiểm dịch. Chưa có thì để trống và bổ sung ở chi tiết đơn trước ngày xe chạy.
          </Txt>
          <Txt size={15}>Cửa khẩu dự kiến</Txt>
          <View style={s.wrap}>
            {["", ...borderGates(b.sender.country, b.recipient.country)].map((gate) => (
              <Chip
                key={gate || "auto"}
                compact
                label={gate || "Để điều phối chọn"}
                selected={b.border === gate}
                onPress={() => setBooking({ border: gate })}
              />
            ))}
          </View>
          <Field
            label="Số tờ khai hải quan"
            maxLength={80}
            value={b.customsCode}
            placeholder="Ví dụ: 30512345678"
            onChangeText={(customsCode) => setBooking({ customsCode })}
          />
          <Field
            label="Số giấy phép nhập khẩu"
            maxLength={80}
            value={b.importPermit}
            placeholder="Do nước nhận cấp"
            onChangeText={(importPermit) => setBooking({ importPermit })}
          />
        </View>
      ) : null}
      <Field
        label="Yêu cầu thêm cho ngựa"
        multiline
        maxLength={5000}
        value={draft.notes}
        placeholder="Thói quen, chế độ ăn, lưu ý trong hành trình…"
        onChangeText={(notes) => change((d) => ({ ...d, notes }))}
      />
    </>
  );
}

function CostLines({
  estimate,
  waterRounds,
}: {
  estimate: PriceEstimate;
  waterRounds: number;
}) {
  return (
    <>
      {estimate.items
        .filter((i) => i.code !== "WATER" || waterRounds > 0)
        .map((i) => (
          <View key={i.code} style={{ flexDirection: "row", gap: 12 }}>
            <Txt size={15} style={{ flex: 1 }}>
              {i.label}
            </Txt>
            <Txt size={15} style={{ fontVariant: ["tabular-nums"] }}>
              {money(i.amount)}
            </Txt>
          </View>
        ))}
    </>
  );
}

/** Thanh tổng tiền cố định ở bước 3, thay cho cột ước tính bên phải của web. */
export function CostBar({
  route,
  estimate,
  estimateError,
  waterRounds,
}: {
  route: {
    km: number | null;
    error: string;
    loading: boolean;
    complete: boolean;
    retry: () => void;
  };
  estimate: PriceEstimate | null;
  estimateError: string;
  waterRounds: number;
}) {
  const { colors: c } = useTheme();
  const [open, setOpen] = useState(false);
  if (route.error || !route.km)
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Txt
          size={15}
          color={route.error ? c.dangerFg : c.textSecondary}
          style={{ flex: 1 }}
        >
          {route.error ||
            (route.loading
              ? "Đang tìm tuyến đường…"
              : "Chọn đủ điểm đón và điểm giao để tính chi phí.")}
        </Txt>
        {route.error ? (
          <IconButton
            icon={RefreshCw}
            label="Tính lại quãng đường"
            onPress={route.retry}
          />
        ) : null}
      </View>
    );
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          estimate
            ? `Tổng ước tính ${money(estimate.total)}. Xem chi tiết`
            : "Đang tính giá"
        }
        disabled={!estimate}
        onPress={() => setOpen(true)}
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={12} color={c.textSecondary}>
            {`Khoảng ${route.km.toLocaleString("vi-VN")} km · Tổng ước tính`}
          </Txt>
          <Txt bold color={estimateError ? c.dangerFg : undefined}>
            {estimate
              ? money(estimate.total)
              : estimateError || "Đang tính giá…"}
          </Txt>
        </View>
        {estimate ? <ChevronUp size={22} color={c.textSecondary} /> : null}
      </Pressable>
      {estimate ? (
        <Sheet
          visible={open}
          onClose={() => setOpen(false)}
          title="Chi phí dự kiến"
        >
          <CostLines estimate={estimate} waterRounds={waterRounds} />
          <InfoLine
            label="Tổng ước tính"
            value={money(estimate.total)}
            strong
          />
          <Txt size={15} color={c.textSecondary}>
            {`Báo giá chính thức do quản lý duyệt, hiệu lực ${estimate.quoteValidityHours} giờ.`}
          </Txt>
        </Sheet>
      ) : null}
    </>
  );
}

/* ---------------- Bước 4. Xác nhận & gửi ---------------- */

function ReviewCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const { colors: c } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Txt bold style={{ flex: 1 }}>
          {title}
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sửa ${title}`}
          hitSlop={12}
          onPress={onEdit}
        >
          <Txt size={15} bold color={c.link}>
            Sửa
          </Txt>
        </Pressable>
      </View>
      {children}
    </Card>
  );
}

const contactLines = (c: BookingContact) =>
  [
    c.name,
    c.phone,
    contactAddress(c),
    c.identityNumber && `Giấy tờ: ${c.identityNumber}`,
    COUNTRY_NAMES[c.country],
  ].filter(Boolean) as string[];

export function ReviewStep({
  draft,
  errors,
  horseNames,
  km,
  routeError,
  retryRoute,
  estimate,
  estimateError,
  setBooking,
  clearError,
  onEdit,
}: {
  draft: BookingDraft;
  errors: BookingErrors;
  horseNames: string[];
  km: number | null;
  routeError: string;
  retryRoute: () => void;
  estimate: PriceEstimate | null;
  estimateError: string;
  setBooking: (patch: Partial<BookingData>) => void;
  clearError: (field: string) => void;
  onEdit: (step: number) => void;
}) {
  const { colors: c } = useTheme();
  const [terms, setTerms] = useState(false);
  const b = draft.booking;
  const vehicle = VEHICLES.find((v) => v.capacity === b.vehicleCapacity);
  const services =
    [
      b.extraStall && "Khoang đơn mở rộng",
      b.feed === "PREMIUM" && "Thức ăn nâng cao",
      b.feed === "SPORT" && "Thức ăn thể thao",
      b.waterRounds > 0 &&
        `${b.waterRounds} cữ nước ${b.water === "EVERY_HOUR" ? "mỗi giờ" : "mỗi 2 giờ"}`,
      b.insurance !== "NONE" &&
        `Bảo hiểm ${INSURANCE_GROUPS.find(([code]) => code === b.insurance)?.[1] ?? ""}`,
    ]
      .filter(Boolean)
      .join(", ") || "Tiêu chuẩn";
  return (
    <>
      <Txt size={15} color={c.textSecondary}>
        Sau khi gửi, quản lý duyệt đơn và báo giá chính thức. Bạn chỉ đặt cọc
        khi đã nhận báo giá.
      </Txt>
      <ReviewCard title="Chuyến đi" onEdit={() => onEdit(0)}>
        <Txt>{`${day(draft.date)} · ${b.pickupTime}`}</Txt>
        {km ? (
          <Txt size={15} color={c.textSecondary}>
            {`Khoảng ${km.toLocaleString("vi-VN")} km`}
          </Txt>
        ) : null}
      </ReviewCard>
      <ReviewCard title="Người gửi" onEdit={() => onEdit(0)}>
        {contactLines(b.sender).map((line) => (
          <Txt key={line} size={15}>
            {line}
          </Txt>
        ))}
      </ReviewCard>
      <ReviewCard title="Người nhận" onEdit={() => onEdit(0)}>
        {contactLines(b.recipient).map((line) => (
          <Txt key={line} size={15}>
            {line}
          </Txt>
        ))}
      </ReviewCard>
      <ReviewCard title="Ngựa và xe" onEdit={() => onEdit(1)}>
        <Txt>{horseNames.join(", ")}</Txt>
        <Txt size={15} color={c.textSecondary}>
          {vehicle?.label}
        </Txt>
      </ReviewCard>
      <ReviewCard title="Dịch vụ" onEdit={() => onEdit(2)}>
        <Txt>{services}</Txt>
        {draft.notes ? (
          <Txt size={15} color={c.textSecondary}>
            {draft.notes}
          </Txt>
        ) : null}
      </ReviewCard>
      <Card>
        <Txt bold>Chi phí dự kiến</Txt>
        {estimate ? (
          <>
            <CostLines estimate={estimate} waterRounds={b.waterRounds} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Txt bold style={{ flex: 1 }}>
                Tổng ước tính
              </Txt>
              <Txt bold style={{ fontVariant: ["tabular-nums"] }}>
                {money(estimate.total)}
              </Txt>
            </View>
            <Txt size={15} color={c.textSecondary}>
              {`Đặt cọc ${num(estimate.depositPercent)}% sau khi duyệt: ${money(estimate.deposit)}`}
            </Txt>
          </>
        ) : routeError ? (
          <>
            <Txt size={15} color={c.dangerFg}>
              {routeError}
            </Txt>
            <Button
              title="Tính lại"
              kind="tertiary"
              icon={RefreshCw}
              onPress={retryRoute}
            />
          </>
        ) : (
          <Txt size={15} color={estimateError ? c.dangerFg : c.textSecondary}>
            {estimateError || "Đang tính giá…"}
          </Txt>
        )}
      </Card>
      <CheckRow
        label="Tôi đã đọc và đồng ý điều khoản vận chuyển động vật sống"
        checked={b.termsAccepted}
        onPress={() => {
          clearError("terms");
          setBooking({ termsAccepted: !b.termsAccepted });
        }}
      />
      {errors.terms ? (
        <Txt size={15} color={c.dangerFg}>
          {errors.terms}
        </Txt>
      ) : null}
      <Button
        title="Xem điều khoản"
        kind="tertiary"
        onPress={() => setTerms(true)}
      />
      <Sheet
        visible={terms}
        onClose={() => setTerms(false)}
        title="Điều kiện gửi yêu cầu vận chuyển"
        footer={<Button title="Đã đọc" onPress={() => setTerms(false)} />}
      >
        <Txt size={15}>
          Bạn xác nhận thông tin người gửi, người nhận, ngựa và giấy tờ cung cấp
          là chính xác. Đơn gửi đi là yêu cầu vận chuyển, chưa phải xác nhận
          chuyến.
        </Txt>
        <Txt size={15}>
          Quản lý sẽ kiểm tra lịch trình, điều kiện kiểm dịch và báo giá. Phí,
          mức đặt cọc và phương thức thanh toán thực hiện theo báo giá chính
          thức được hai bên xác nhận.
        </Txt>
        <Txt size={15}>
          Vui lòng khai báo tình trạng sức khỏe và yêu cầu chăm sóc đặc biệt
          trước chuyến đi.
        </Txt>
      </Sheet>
    </>
  );
}
