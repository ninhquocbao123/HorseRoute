import React, { useCallback, useEffect, useState } from "react";
import {
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Circle, Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { BeVietnamPro_400Regular } from "@expo-google-fonts/be-vietnam-pro/400Regular";
import { BeVietnamPro_500Medium } from "@expo-google-fonts/be-vietnam-pro/500Medium";
import { BeVietnamPro_600SemiBold } from "@expo-google-fonts/be-vietnam-pro/600SemiBold";
import { BeVietnamPro_700Bold } from "@expo-google-fonts/be-vietnam-pro/700Bold";
import {
  Bell,
  ClipboardList,
  CloudOff,
  CloudUpload,
  History,
  LogOut,
  MapPin,
  Monitor,
  NotebookPen,
  PawPrint,
  RefreshCw,
  Route,
  ShieldAlert,
  TriangleAlert,
  Truck,
  Mail,
  Phone,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";
import {
  ThemeContext,
  Banner,
  Button,
  Card,
  Chip,
  Field,
  Header,
  IconButton,
  Row,
  Txt,
  s,
  useTheme,
} from "./ui";
import { lightTheme, darkTheme } from "./theme";
import { SessionProvider, useResource, useSession } from "./session";
import { API_URL } from "./config";
import { messageOf } from "./api/http";
import { asId, dateTime } from "./live-domain";
import {
  AvatarPicker,
  Empty,
  NotFound,
  ResourceState,
  StateView,
  WebButton,
} from "./live-ui";
import { Skeleton } from "./skeleton";
import { OverlayProvider, useOverlay } from "./overlay";
import { discardForeign, foreignItems, useOnline, useQueue } from "./queue";
import type { IDriverTripSummary, Navigate, Notice, Page } from "./api/types";
import {
  CustomerHome,
  HealthScreen,
  OrderScreen,
  OrdersScreen,
  ProfileFormScreen,
  ProfilesScreen,
  QuoteScreen,
  TrackingMapScreen,
  TrackingScreen,
} from "./screens/CustomerScreens";
import {
  ChecklistScreen,
  CrewRoute,
  TripList,
  TripScreen,
} from "./screens/CrewScreens";
import { LocationScreen, QueueScreen } from "./screens/TripScreens";
import { LoginScreen, ThemeToggle } from "./screens/LoginScreen";
import { BookingScreen } from "./screens/booking/BookingScreen";

const titles: Record<string, string> = {
  orders: "Đơn hàng",
  order: "Chi tiết đơn",
  horses: "Hồ sơ ngựa",
  horse: "Hồ sơ ngựa",
  "horse-form": "Chỉnh sửa hồ sơ",
  booking: "Yêu cầu vận chuyển",
  quote: "Báo giá",
  documents: "Giấy tờ",
  tracking: "Theo dõi hành trình",
  "tracking-map": "Bản đồ hành trình",
  health: "Sức khỏe ngựa",
  trip: "Chi tiết chuyến",
  "crew-map": "Tuyến và vị trí",
  checklist: "Trước chuyến đi",
  journal: "Nhật ký",
  incidents: "Sự cố",
  report: "Báo cáo sức khỏe",
  "quick-log": "Ghi nhanh",
  "incident-form": "Báo sự cố",
  "incident-sent": "Đã báo sự cố",
  "crew-horse": "Chi tiết ngựa",
  trips: "Lịch sử chuyến",
  notifications: "Thông báo",
  account: "Tài khoản",
  password: "Đổi mật khẩu",
  queue: "Hàng chờ gửi",
  location: "Quyền vị trí",
};
/** Màn khách hàng tự cuộn, có thanh nút cố định ở đáy (ScreenBody). */
const customerSelfScrolling = new Set([
  "orders",
  "order",
  "documents",
  "quote",
  "tracking",
  "horses",
  "horse",
  "booking",
]);
/** Màn tự cuộn và có thanh nút cố định ở đáy (ScreenBody). */
const selfScrolling = new Set([
  "trip",
  "checklist",
  "location",
  "journal",
  "incidents",
  "incident-form",
  "incident-sent",
  "report",
  "crew-horse",
  "crew-map",
]);
const guardedForms = new Set([
  "horse-form",
  "report",
  "quick-log",
  "incident-form",
  "password",
]);
type Appearance = "light" | "dark" | "system";
/** R-35 Đăng ký tài khoản khách hàng; xong thì đăng nhập luôn. */
function Register({ onBack }: { onBack: () => void }) {
  const { request, login } = useSession();
  const { colors: c } = useTheme();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    club: false,
    organizationName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));
  const submit = async () => {
    if (busy) return;
    const phone = form.phone.replace(/[\s.]/g, "");
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 2) e.fullName = "Nhập họ tên.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))
      e.email = "Email chưa đúng định dạng.";
    if (!/^\+?\d{9,15}$/.test(phone))
      e.phone = "Số điện thoại cần 9 đến 15 chữ số.";
    if (form.address.trim().length < 5) e.address = "Nhập địa chỉ liên hệ.";
    if (form.password.length < 8) e.password = "Mật khẩu ít nhất 8 ký tự.";
    if (form.club && !form.organizationName.trim())
      e.organizationName = "Nhập tên câu lạc bộ hoặc tổ chức.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setError("");
    try {
      await request("/auth/register", {
        method: "POST",
        anonymous: true,
        body: {
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          phone,
          address: form.address.trim(),
          customerType: form.club ? "CLUB" : "INDIVIDUAL",
          ...(form.club
            ? { organizationName: form.organizationName.trim() }
            : {}),
        },
      });
      await login(form.email, form.password);
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 24, gap: 16 }}
    >
      <Txt size={24} bold>
        Tạo tài khoản khách hàng
      </Txt>
      <Txt color={c.textSecondary}>
        Dùng chung cho app và website HorseRoute.
      </Txt>
      <Field
        label="Họ tên"
        value={form.fullName}
        onChangeText={(fullName) => set({ fullName })}
        autoComplete="name"
        error={errors.fullName}
        editable={!busy}
      />
      <Field
        label="Email"
        value={form.email}
        onChangeText={(email) => set({ email })}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        error={errors.email}
        editable={!busy}
      />
      <Field
        label="Số điện thoại"
        value={form.phone}
        onChangeText={(phone) => set({ phone })}
        keyboardType="phone-pad"
        autoComplete="tel"
        error={errors.phone}
        editable={!busy}
      />
      <Field
        label="Địa chỉ"
        value={form.address}
        onChangeText={(address) => set({ address })}
        error={errors.address}
        editable={!busy}
      />
      <Field
        label="Mật khẩu"
        value={form.password}
        onChangeText={(password) => set({ password })}
        secureTextEntry
        autoComplete="new-password"
        hint="Ít nhất 8 ký tự."
        error={errors.password}
        editable={!busy}
      />
      <View style={s.wrap}>
        <Chip
          label="Cá nhân"
          selected={!form.club}
          onPress={() => set({ club: false })}
        />
        <Chip
          label="Câu lạc bộ, tổ chức"
          selected={form.club}
          onPress={() => set({ club: true })}
        />
      </View>
      {form.club ? (
        <Field
          label="Tên câu lạc bộ hoặc tổ chức"
          value={form.organizationName}
          onChangeText={(organizationName) => set({ organizationName })}
          error={errors.organizationName}
          editable={!busy}
        />
      ) : null}
      {error ? <Banner warning text={error} /> : null}
      <Button
        title={busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
        disabled={busy}
        onPress={() => void submit()}
      />
      <Button
        title="Đã có tài khoản? Đăng nhập"
        kind="tertiary"
        disabled={busy}
        onPress={onBack}
      />
    </ScrollView>
  );
}
function Login({
  changeAppearance,
}: {
  changeAppearance: (value: Appearance) => void;
}) {
  const [register, setRegister] = useState(false);
  return register ? (
    <Register onBack={() => setRegister(false)} />
  ) : (
    <LoginScreen
      onRegister={() => setRegister(true)}
      changeAppearance={changeAppearance}
    />
  );
}
function Account({
  changeAppearance,
  go,
  roleName,
}: {
  changeAppearance: (value: Appearance) => void;
  go: Navigate;
  roleName: string;
}) {
  const { user, logout, writing } = useSession();
  const { confirm } = useOverlay();
  const { colors: c, name: themeName } = useTheme();
  const pending = useQueue();
  const [error, setError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const info = [
    { icon: Mail, text: user!.email },
    { icon: Phone, text: user!.phone || "Chưa có số điện thoại" },
    { icon: MapPin, text: user!.address || "Chưa có nơi ở" },
  ];
  return (
    <>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <AvatarPicker onError={setAvatarError} />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt size={17} bold>
              {user!.fullName}
            </Txt>
            <Txt size={15} color={c.textSecondary}>
              {roleName}
            </Txt>
          </View>
        </View>
        {avatarError ? (
          <Txt size={15} color={c.dangerFg}>
            {avatarError}
          </Txt>
        ) : null}
        <View style={{ gap: 8 }}>
          {info.map(({ icon: Icon, text }) => (
            <View
              key={text}
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Icon size={20} color={c.textSecondary} />
              <Txt style={{ flex: 1 }}>{text}</Txt>
            </View>
          ))}
        </View>
      </Card>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Txt bold>Giao diện</Txt>
        <ThemeToggle dark={themeName === "dark"} onChange={changeAppearance} />
      </View>
      <Row
        title="Đổi mật khẩu"
        onPress={() => go("password")}
        icon={UserRound}
      />
      {user!.role === "DRIVER_ESCORT" ? (
        <>
          <Row
            title={
              pending.length
                ? `Hàng chờ gửi (${pending.length})`
                : "Hàng chờ gửi"
            }
            onPress={() => go("queue")}
            icon={CloudUpload}
          />
          <Row
            title="Quyền vị trí"
            onPress={() => go("location")}
            icon={MapPin}
          />
        </>
      ) : null}
      {error ? <Banner warning text={error} /> : null}
      <Button
        title="Đăng xuất"
        kind="danger"
        disabled={writing}
        icon={LogOut}
        onPress={() =>
          void confirm({
            title: "Đăng xuất?",
            body: pending.length
              ? `Còn ${pending.length} mục chưa gửi. Mục được giữ trên máy và gửi tiếp khi bạn đăng nhập lại.`
              : "Nháp đã lưu trên máy chỉ mở lại được trong đúng tài khoản này.",
            confirmLabel: "Đăng xuất",
            destructive: true,
          }).then((ok) => {
            if (ok) void logout().catch((e) => setError(messageOf(e)));
          })
        }
      />
    </>
  );
}
function PasswordScreen({ go }: { go: Navigate }) {
  const { request, write, writing } = useSession();
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    try {
      await write(async () => {
        if (!oldPassword || newPassword.length < 8 || newPassword !== confirm)
          throw new Error(
            "Nhập mật khẩu hiện tại, mật khẩu mới ít nhất 8 ký tự và xác nhận trùng khớp.",
          );
        await request("/users/me/password", {
          method: "POST",
          body: { currentPassword: oldPassword, newPassword },
        });
        go("account");
      });
    } catch (e) {
      setError(messageOf(e));
    }
  };
  return (
    <>
      <Field
        label="Mật khẩu hiện tại"
        secureTextEntry
        value={oldPassword}
        onChangeText={setOld}
      />
      <Field
        label="Mật khẩu mới"
        secureTextEntry
        value={newPassword}
        onChangeText={setNew}
      />
      <Field
        label="Nhập lại mật khẩu mới"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />
      {error ? <Banner warning text={error} /> : null}
      <Button
        title={writing ? "Đang lưu…" : "Lưu mật khẩu mới"}
        disabled={writing}
        onPress={() => void save()}
      />
    </>
  );
}
function Notifications({ go }: { go: Navigate }) {
  const resource = useResource<Notice[]>("/notifications");
  const { user, request, write, writing, refresh } = useSession();
  const { colors: c } = useTheme();
  const [error, setError] = useState("");
  const open = async (notice: Notice) => {
    setError("");
    try {
      await write(async () => {
        if (!notice.is_read)
          await request(`/notifications/${asId(notice.id)}/read`, {
            method: "POST",
          });
        refresh();
        const orderId =
          notice.order_id ||
          (notice.related_type === "ORDER" ? notice.related_id : undefined);
        if (orderId && user!.role === "CUSTOMER")
          go("order", { id: String(orderId) });
        else if (
          notice.related_type === "TRIP" &&
          notice.related_id &&
          user!.role === "DRIVER_ESCORT"
        )
          go("trip", { tripId: String(notice.related_id) });
      });
    } catch (e) {
      setError(messageOf(e));
    }
  };
  return (
    <ResourceState resource={resource} skeleton="rows" what="thông báo">
      {error ? <Banner text={error} warning /> : null}
      {resource.data?.length ? (
        resource.data.map((notice) => (
          <Pressable
            key={notice.id}
            accessibilityRole="button"
            accessibilityLabel={`${notice.is_read ? "" : "Chưa đọc. "}${notice.content}`}
            disabled={writing}
            onPress={() => void open(notice)}
            style={({ pressed }) => ({
              flexDirection: "row",
              gap: 12,
              padding: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: notice.is_read ? c.surface : c.infoBg,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginTop: 8,
                backgroundColor: notice.is_read ? "transparent" : c.accent,
              }}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt bold={!notice.is_read}>{notice.content}</Txt>
              <Txt size={12} color={c.textSecondary}>
                {dateTime(notice.created_at)}
              </Txt>
            </View>
          </Pressable>
        ))
      ) : (
        <Empty
          icon={Bell}
          title="Chưa có thông báo"
          detail="Cập nhật về chuyến, báo giá và sự cố sẽ hiện ở đây."
        />
      )}
    </ResourceState>
  );
}
/** Số chưa đọc trên chuông và tab Thông báo. */
/** Nét bên trong icon, vẽ lại bằng màu nền khi icon được tô đặc để không mất chi tiết. */
const tabIconDetails = new Map<LucideIcon, string[]>([
  [TriangleAlert, ["M12 9v4", "M12 17h.01"]],
  [ClipboardList, ["M12 11h4", "M12 16h4", "M8 11h.01", "M8 16h.01"]],
  [
    NotebookPen,
    [
      "M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
    ],
  ],
]);
/** Icon của tab: đang chọn thì tô đặc, chưa chọn chỉ có nét. */
function TabIcon({
  icon: Icon,
  selected,
  color,
  background,
}: {
  icon: LucideIcon;
  selected: boolean;
  color: string;
  background: string;
}) {
  if (!selected) return <Icon color={color} size={24} />;
  // Đường đi của Route là nét hở, tô vào sẽ méo: chỉ tô hai điểm đầu cuối.
  if (Icon === Route)
    return (
      <Icon color={color} size={24}>
        <Circle cx={6} cy={19} r={3} fill={color} />
        <Circle cx={18} cy={5} r={3} fill={color} />
      </Icon>
    );
  return (
    <Icon color={color} fill={color} size={24}>
      {tabIconDetails.get(Icon)?.map((d) => (
        <Path key={d} d={d} stroke={background} fill={color} />
      ))}
    </Icon>
  );
}
function CountDot({
  count,
  inset = false,
}: {
  count: number;
  inset?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: inset ? 4 : -4,
        right: inset ? 4 : -10,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 4,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.dangerFg,
      }}
    >
      <Txt size={12} bold color={c.surface}>
        {count > 9 ? "9+" : String(count)}
      </Txt>
    </View>
  );
}
function Authenticated({
  changeAppearance,
}: {
  changeAppearance: (value: Appearance) => void;
}) {
  const { user, request, write, refresh, writing } = useSession();
  const { colors: c, shadow } = useTheme();
  const { confirm, notify } = useOverlay();
  const customer = user!.role === "CUSTOMER";
  const trips = useResource<IDriverTripSummary[]>(
    customer ? null : "/tracking/driver/trips",
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [pages, setPages] = useState<Page[]>([{ screen: "home" }]);
  const selected =
    trips.data?.find((t) => String(t.id) === selectedId) ??
    trips.data?.find((t) => t.orderStatus === "IN_TRANSIT") ??
    trips.data?.find((t) => t.orderStatus === "READY") ??
    trips.data?.[0];
  const escort = !customer && selected?.crewRole === "ESCORT";
  const notices = useResource<Notice[]>("/notifications");
  const unread = notices.data?.filter((n) => !n.is_read).length ?? 0;
  const readAll = async () => {
    try {
      await write(() => request("/notifications/read-all", { method: "POST" }));
      refresh();
    } catch (e) {
      notify("Chưa đánh dấu được thông báo", messageOf(e));
    }
  };
  const online = useOnline();
  const pending = useQueue();
  const page = pages[pages.length - 1];
  const screen = page.screen;
  const roleName = customer
    ? "Khách hàng"
    : selected?.crewRole === "DRIVER"
      ? "Tài xế"
      : selected?.crewRole === "ESCORT"
        ? "Hộ tống"
        : "Tổ vận chuyển";
  const crewTabs = escort
    ? [
        { screen: "home", title: "Ngựa", icon: PawPrint },
        { screen: "journal", title: "Nhật ký", icon: NotebookPen },
        { screen: "incidents", title: "Sự cố", icon: TriangleAlert },
      ]
    : [
        { screen: "home", title: "Chuyến", icon: Truck },
        { screen: "incidents", title: "Sự cố", icon: TriangleAlert },
      ];
  const tabs: { screen: string; title: string; icon: LucideIcon }[] = customer
    ? [
        { screen: "home", title: "Hành trình", icon: Route },
        { screen: "orders", title: "Đơn hàng", icon: ClipboardList },
        { screen: "horses", title: "Ngựa", icon: PawPrint },
        { screen: "account", title: "Tài khoản", icon: UserRound },
      ]
    : [
        ...crewTabs,
        { screen: "notifications", title: "Thông báo", icon: Bell },
        { screen: "account", title: "Tài khoản", icon: UserRound },
      ];
  const go: Navigate = (target, params = {}) => {
    if (target === "back") {
      setPages((old) => (old.length > 1 ? old.slice(0, -1) : old));
      return;
    }
    if (params.tripId) setSelectedId(params.tripId);
    const next = { screen: target, ...params };
    if (tabs.some((tab) => tab.screen === target)) setPages([next]);
    else setPages((old) => [...old, next]);
  };
  /** Thay trang trên cùng (Gửi sự cố xong không quay lại được form đã gửi). */
  const replace: Navigate = (target, params = {}) => {
    if (target === "back") return go("back");
    if (params.tripId) setSelectedId(params.tripId);
    setPages((old) => [...old.slice(0, -1), { screen: target, ...params }]);
  };
  const back = useCallback(() => {
    if (writing) return true;
    if (pages.length <= 1) return false;
    const pop = () => setPages((old) => old.slice(0, -1));
    if (guardedForms.has(screen))
      void confirm({
        title: "Rời biểu mẫu?",
        body: "Nội dung chưa gửi trong biểu mẫu này sẽ bị bỏ.",
        confirmLabel: "Bỏ thay đổi",
        destructive: true,
      }).then((ok) => {
        if (ok) pop();
      });
    else pop();
    return true;
  }, [writing, pages.length, screen, confirm]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      back,
    );
    return () => subscription.remove();
  }, [back]);
  const tripId = page.tripId || selected?.id;
  let content: React.ReactNode;
  if (screen === "account")
    content = (
      <Account
        changeAppearance={changeAppearance}
        go={go}
        roleName={roleName}
      />
    );
  else if (screen === "password") content = <PasswordScreen go={go} />;
  else if (screen === "notifications") content = <Notifications go={go} />;
  else if (screen === "queue") content = <QueueScreen />;
  else if (screen === "location") content = <LocationScreen go={go} />;
  else if (customer) {
    if (screen === "home") content = <CustomerHome go={go} />;
    else if (screen === "orders") content = <OrdersScreen go={go} />;
    else if (screen === "horses" || screen === "horse")
      content = (
        <ProfilesScreen go={go} id={screen === "horse" ? page.id : undefined} />
      );
    else if (screen === "horse-form")
      content = <ProfileFormScreen go={go} replace={replace} id={page.id} />;
    else if (screen === "booking")
      content = <BookingScreen page={page} go={go} replace={replace} />;
    else if (page.id && (screen === "order" || screen === "documents"))
      content = (
        <OrderScreen id={page.id} go={go} documents={screen === "documents"} />
      );
    else if (page.id && screen === "quote")
      content = <QuoteScreen id={page.id} />;
    else if (page.id && screen === "tracking")
      content = <TrackingScreen id={page.id} go={go} />;
    else if (page.id && screen === "tracking-map")
      content = <TrackingMapScreen id={page.id} />;
    else if (page.id && page.orderId && screen === "health")
      content = <HealthScreen id={page.id} orderId={page.orderId} />;
  } else if (screen === "home" && escort && selected)
    // ESC-02 là màn chính của hộ tống: mở thẳng chuyến hiện tại, lịch sử ở icon đồng hồ.
    content = <TripScreen tripId={String(selected.id)} go={go} />;
  else if (screen === "home" || screen === "trips")
    content = (
      <ResourceState resource={trips} what="danh sách chuyến">
        <TripList trips={trips.data ?? []} go={go} />
      </ResourceState>
    );
  else if (!tripId)
    // Danh sách chuyến còn đang tải hoặc tải lỗi: chưa thể nói "chưa có chuyến".
    content = !trips.data ? (
      <ResourceState resource={trips} what="danh sách chuyến">
        {null}
      </ResourceState>
    ) : (
      <Empty
        icon={Truck}
        title="Chưa có chuyến được phân công"
        detail="Chuyến sẽ xuất hiện khi điều phối phân công tài khoản này."
      />
    );
  else if (screen === "trip")
    content = <TripScreen tripId={String(tripId)} go={go} />;
  else if (screen === "checklist")
    content = <ChecklistScreen tripId={String(tripId)} go={go} />;
  else if (
    [
      "journal",
      "incidents",
      "incident-form",
      "incident-sent",
      "report",
      "crew-horse",
      "crew-map",
    ].includes(screen)
  )
    content = (
      <CrewRoute
        key={`${screen}:${tripId}:${page.horseId ?? ""}`}
        screen={screen}
        tripId={String(tripId)}
        horseId={page.horseId}
        incidentType={page.incidentType}
        queueId={page.id}
        go={go}
        replace={replace}
      />
    );
  const selfScroll =
    (customer && customerSelfScrolling.has(screen)) ||
    (!customer &&
      ((screen === "home" && escort && !!selected) ||
        (selfScrolling.has(screen) && !!tripId)));
  const showSync =
    !online || (!customer && pending.length > 0 && screen !== "queue");
  const rejected = pending.filter((i) => i.status === "REJECTED").length;
  const sending = pending.length - rejected;
  return (
    <>
      <Header
        title={
          screen === "home" && escort && selected
            ? "Ngựa trên chuyến"
            : screen === "horse-form" && !page.id
              ? "Thêm hồ sơ ngựa"
              : titles[screen] || (customer ? "Hành trình" : "Chuyến của tôi")
        }
        subtitle={pages.length === 1 ? roleName : undefined}
        back={
          pages.length > 1
            ? () => {
                back();
              }
            : undefined
        }
        right={
          screen === "notifications" && unread ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Đọc tất cả ${unread} thông báo`}
              disabled={writing}
              hitSlop={8}
              onPress={() => void readAll()}
              style={({ pressed }) => ({
                alignSelf: "flex-end",
                marginBottom: 4,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.borderInput,
                opacity: pressed || writing ? 0.6 : 1,
              })}
            >
              <Txt size={12} bold color={c.link}>
                Đọc tất cả
              </Txt>
            </Pressable>
          ) : customer && screen !== "notifications" ? (
            <View>
              <IconButton
                icon={Bell}
                label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
                onPress={() => {
                  if (!writing) go("notifications");
                }}
              />
              {unread ? <CountDot count={unread} inset /> : null}
            </View>
          ) : screen === "home" && escort && selected ? (
            <IconButton
              icon={History}
              label="Lịch sử chuyến"
              onPress={() => {
                if (!writing) go("trips");
              }}
            />
          ) : undefined
        }
      />
      {showSync ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={customer ? "Mất kết nối mạng" : "Mở hàng chờ gửi"}
          disabled={customer}
          onPress={() => go("queue")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: online ? c.infoBg : c.surfaceBrand,
          }}
        >
          {online ? (
            <CloudUpload size={18} color={c.link} />
          ) : (
            <CloudOff size={18} color={c.onBrand} />
          )}
          <Txt
            size={12}
            bold
            color={online ? c.textPrimary : c.onBrand}
            style={{ flex: 1 }}
          >
            {online
              ? sending
                ? `Đang gửi ${sending} mục chờ`
                : `${rejected} mục không gửi được, chạm để xử lý`
              : customer
                ? "Mất kết nối · đang xem dữ liệu đã lưu, tự cập nhật khi có mạng"
                : pending.length
                  ? `Mất sóng · ${pending.length} mục chờ gửi, tự gửi khi có sóng`
                  : "Mất sóng · thao tác vẫn lưu và tự gửi khi có sóng"}
          </Txt>
        </Pressable>
      ) : null}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {selfScroll && content ? (
          <View key={`${screen}:${page.tripId || ""}`} style={{ flex: 1 }}>
            {content}
          </View>
        ) : (
          <ScrollView
            key={`${screen}:${page.id || ""}:${page.tripId || ""}:${page.horseId || ""}`}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={false}
                enabled={!writing}
                onRefresh={refresh}
                tintColor={c.link}
              />
            }
            contentContainerStyle={s.content}
          >
            {content ?? (
              <NotFound
                title="Không tìm thấy nội dung"
                detail="Nội dung có thể đã bị xóa hoặc bạn không còn quyền xem."
              />
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      {pages.length === 1 ? (
        <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          {/* Thanh viên thuốc nổi: tab đang chọn chỉ tô icon và chữ, thêm nền rất nhạt để dễ nhận ra. */}
          <View
            style={[
              {
                flexDirection: "row",
                padding: 4,
                borderRadius: 32,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.surface,
              },
              shadow.md,
            ]}
          >
            {tabs.map((tab) => {
              const selected = tab.screen === screen;
              const color = selected ? c.tabActive : c.tabInactive;
              return (
                <Pressable
                  key={tab.screen}
                  disabled={writing}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.title}
                  accessibilityState={{ selected, disabled: writing }}
                  onPress={() => go(tab.screen)}
                  style={{ flex: 1, minHeight: 60 }}
                >
                  {/* Đổi key để tạo lại view: nếu chỉ đổi nền từ trong suốt, Android không bo góc. */}
                  <View
                    key={selected ? "selected" : "idle"}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                      paddingVertical: 6,
                      borderRadius: 28,
                      backgroundColor: selected
                        ? c.surfaceMuted
                        : "transparent",
                    }}
                  >
                    <View>
                      <TabIcon
                        icon={tab.icon}
                        selected={selected}
                        color={color}
                        background={c.surfaceMuted}
                      />
                      {tab.screen === "notifications" && unread ? (
                        <CountDot count={unread} />
                      ) : null}
                    </View>
                    <Txt size={12} bold={selected} color={color}>
                      {tab.title}
                    </Txt>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </>
  );
}
function Shell() {
  const session = useSession();
  const system = useColorScheme();
  const [appearance, setAppearance] = useState<Appearance>("system");
  const [settingsError, setSettingsError] = useState("");
  useEffect(() => {
    AsyncStorage.getItem("horseroute.appearance")
      .then((value) => {
        if (value === "light" || value === "dark" || value === "system")
          setAppearance(value);
      })
      .catch(() => setSettingsError("Không đọc được lựa chọn giao diện."));
  }, []);
  const changeAppearance = (value: Appearance) => {
    setAppearance(value);
    void AsyncStorage.setItem("horseroute.appearance", value).catch(() =>
      setSettingsError("Không lưu được lựa chọn giao diện."),
    );
  };
  const theme = (
    appearance === "system" ? system === "dark" : appearance === "dark"
  )
    ? darkTheme
    : lightTheme;
  const unsupported =
    session.user && !["CUSTOMER", "DRIVER_ESCORT"].includes(session.user.role);
  return (
    <ThemeContext.Provider value={theme}>
      <OverlayProvider>
        <SafeAreaView
          // Màn đăng nhập tự vẽ nền tràn viền (sau thanh trạng thái và thanh điều hướng).
          edges={
            session.ready && !session.token && !session.user ? [] : undefined
          }
          style={{ flex: 1, backgroundColor: theme.colors.bg }}
        >
          <StatusBar style={theme.name === "dark" ? "light" : "dark"} />
          {settingsError ? <Banner warning text={settingsError} /> : null}
          {!session.ready ? (
            <Skeleton
              variant="screen"
              label="Đang kiểm tra phiên đăng nhập"
              style={{ padding: 16 }}
            />
          ) : session.token && !session.user ? (
            <ScrollView
              contentContainerStyle={[
                s.content,
                { flexGrow: 1, justifyContent: "center" },
              ]}
            >
              <StateView
                tone="error"
                icon={ShieldAlert}
                title="Chưa xác minh được phiên đăng nhập"
                detail={
                  session.error
                    ? `${session.error.replace(/[.\s]+$/, "")}. Kiểm tra kết nối rồi thử lại.`
                    : "Kiểm tra kết nối rồi thử lại."
                }
              />
              <Button
                title="Thử lại kết nối"
                icon={RefreshCw}
                onPress={() => void session.retrySession()}
              />
              <Button
                title="Đăng nhập lại"
                kind="secondary"
                onPress={() => {
                  void session
                    .logout()
                    .catch((e) => setSettingsError(messageOf(e)));
                }}
              />
            </ScrollView>
          ) : !session.user ? (
            <Login changeAppearance={changeAppearance} />
          ) : unsupported ? (
            <ScrollView
              contentContainerStyle={[
                s.content,
                { flexGrow: 1, justifyContent: "center" },
              ]}
            >
              <Empty
                icon={Monitor}
                title="Tài khoản này sử dụng website"
                detail="Ứng dụng dành cho khách hàng, tài xế và người hộ tống."
              />
              <WebButton title="Mở website" />
              <Button
                title="Đăng xuất"
                kind="secondary"
                onPress={() => {
                  void session
                    .logout()
                    .catch((e) => setSettingsError(messageOf(e)));
                }}
              />
            </ScrollView>
          ) : (
            <Authenticated
              key={`${session.user.id}:${session.token}`}
              changeAppearance={changeAppearance}
            />
          )}
        </SafeAreaView>
      </OverlayProvider>
    </ThemeContext.Provider>
  );
}
export default function LiveApp() {
  const scheme = useColorScheme();
  const [loaded, fontError] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
  });
  if (!loaded && !fontError)
    return (
      <SafeAreaProvider>
        {/* Font chưa sẵn sàng (vài trăm ms): chỉ giữ nền đúng chế độ, không nháy spinner. */}
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: (scheme === "dark" ? darkTheme : lightTheme).colors
              .bg,
          }}
        />
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Shell />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
