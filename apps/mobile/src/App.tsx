import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { BeVietnamPro_400Regular } from "@expo-google-fonts/be-vietnam-pro/400Regular";
import { BeVietnamPro_500Medium } from "@expo-google-fonts/be-vietnam-pro/500Medium";
import { BeVietnamPro_600SemiBold } from "@expo-google-fonts/be-vietnam-pro/600SemiBold";
import { BeVietnamPro_700Bold } from "@expo-google-fonts/be-vietnam-pro/700Bold";
import {
  Bell,
  ClipboardList,
  LogOut,
  PawPrint,
  RefreshCw,
  Route,
  TriangleAlert,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";
import {
  ThemeContext,
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  Field,
  Header,
  IconButton,
  Row,
  Section,
  Txt,
  s,
  useTheme,
} from "./ui";
import { lightTheme, darkTheme } from "./theme";
import { SessionProvider, useResource, useSession } from "./session";
import { API_URL } from "./config";
import { messageOf } from "./api/http";
import { asId, dateTime } from "./live-domain";
import { Empty, ResourceState, WebButton } from "./live-ui";
import type { IDriverTripSummary, Navigate, Notice, Page } from "./api/types";
import {
  BookingScreen,
  CustomerHome,
  HealthScreen,
  OrderScreen,
  ProfileFormScreen,
  ProfilesScreen,
  QuoteScreen,
  TrackingScreen,
} from "./screens/CustomerScreens";
import {
  ChecklistScreen,
  CrewFormScreen,
  JournalScreen,
  TripList,
  TripScreen,
} from "./screens/CrewScreens";

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
  health: "Sức khỏe ngựa",
  trip: "Chi tiết chuyến",
  "crew-map": "Tuyến và vị trí",
  checklist: "Trước chuyến đi",
  journal: "Nhật ký",
  incidents: "Sự cố",
  report: "Báo cáo sức khỏe",
  "quick-log": "Ghi nhanh",
  "incident-form": "Báo sự cố",
  notifications: "Thông báo",
  account: "Tài khoản",
  password: "Đổi mật khẩu",
};
const guardedForms = new Set([
  "horse-form",
  "report",
  "quick-log",
  "incident-form",
  "password",
]);
type Appearance = "light" | "dark" | "system";
function Login() {
  const { login, error: sessionError } = useSession();
  const { colors: c } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !password) {
      setError("Nhập email và mật khẩu tài khoản HorseRoute.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      setPassword("");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: 24,
        gap: 20,
      }}
    >
      <Image
        source={require("../assets/logo.png")}
        accessibilityLabel="Logo HorseRoute"
        style={{ width: 88, height: 88, borderRadius: 20 }}
      />
      <Txt size={32} bold>
        HorseRoute
      </Txt>
      <Txt color={c.textSecondary}>
        Đăng nhập để theo dõi và quản lý hành trình của bạn.
      </Txt>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        editable={!busy}
      />
      <Field
        label="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        editable={!busy}
        onSubmitEditing={() => void submit()}
      />
      {error || sessionError ? (
        <Banner warning text={error || sessionError} />
      ) : null}
      <Button
        title={busy ? "Đang đăng nhập…" : "Đăng nhập"}
        disabled={busy}
        onPress={() => void submit()}
      />
      <Txt size={12} color={c.textSecondary}>
        Dùng cùng tài khoản với website HorseRoute. Quyền truy cập được xác định
        từ tài khoản và chuyến được phân công.
      </Txt>
      {error ? <Txt size={12}>Máy chủ: {API_URL}</Txt> : null}
    </ScrollView>
  );
}
function Account({
  appearance,
  changeAppearance,
  go,
  roleName,
}: {
  appearance: Appearance;
  changeAppearance: (value: Appearance) => void;
  go: Navigate;
  roleName: string;
}) {
  const { user, logout, writing } = useSession();
  const [error, setError] = useState("");
  return (
    <>
      <Card>
        <UserRound size={40} />
        <Txt size={24} bold>
          {user!.fullName}
        </Txt>
        <Badge label={roleName} />
        <Txt>{user!.email}</Txt>
        <Txt>{user!.phone || "Chưa có số điện thoại"}</Txt>
        {user!.address ? <Txt>{user!.address}</Txt> : null}
      </Card>
      <Section title="Giao diện" />
      <View style={s.wrap}>
        {(["light", "dark", "system"] as const).map((value, i) => (
          <Chip
            key={value}
            label={["Sáng", "Tối", "Theo máy"][i]}
            selected={appearance === value}
            onPress={() => changeAppearance(value)}
          />
        ))}
      </View>
      <Row
        title="Đổi mật khẩu"
        onPress={() => go("password")}
        icon={UserRound}
      />
      {error ? <Banner warning text={error} /> : null}
      <Button
        title="Đăng xuất"
        kind="secondary"
        disabled={writing}
        icon={LogOut}
        onPress={() =>
          Alert.alert(
            "Đăng xuất?",
            "Nháp yêu cầu đã lưu trên thiết bị sẽ chỉ mở lại được trong đúng tài khoản này.",
            [
              { text: "Ở lại", style: "cancel" },
              {
                text: "Đăng xuất",
                style: "destructive",
                onPress: () => {
                  void logout().catch((e) => setError(messageOf(e)));
                },
              },
            ],
          )
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
    <ResourceState resource={resource}>
      {error ? <Banner text={error} warning /> : null}
      {resource.data?.length ? (
        resource.data.map((notice) => (
          <Card key={notice.id}>
            <Badge
              label={notice.is_read ? "Đã đọc" : "Chưa đọc"}
              tone={notice.is_read ? "neutral" : "info"}
            />
            <Txt>{notice.content}</Txt>
            <Txt size={12}>{dateTime(notice.created_at)}</Txt>
            <Button
              title="Mở và đánh dấu đã đọc"
              kind="secondary"
              disabled={writing}
              onPress={() => void open(notice)}
            />
          </Card>
        ))
      ) : (
        <Empty title="Chưa có thông báo" />
      )}
    </ResourceState>
  );
}
function Authenticated({
  appearance,
  changeAppearance,
}: {
  appearance: Appearance;
  changeAppearance: (value: Appearance) => void;
}) {
  const { user, refresh, writing } = useSession();
  const { colors: c } = useTheme();
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
  const page = pages[pages.length - 1];
  const screen = page.screen;
  const roleName = customer
    ? "Khách hàng"
    : selected?.crewRole === "DRIVER"
      ? "Tài xế"
      : selected?.crewRole === "ESCORT"
        ? "Hộ tống"
        : "Tổ vận chuyển";
  const tabs: { screen: string; title: string; icon: LucideIcon }[] = customer
    ? [
        { screen: "home", title: "Hành trình", icon: Route },
        { screen: "orders", title: "Đơn hàng", icon: ClipboardList },
        { screen: "horses", title: "Ngựa", icon: PawPrint },
        { screen: "account", title: "Tài khoản", icon: UserRound },
      ]
    : [
        { screen: "home", title: "Chuyến", icon: Truck },
        {
          screen: selected?.crewRole === "ESCORT" ? "journal" : "incidents",
          title: selected?.crewRole === "ESCORT" ? "Nhật ký" : "Sự cố",
          icon: selected?.crewRole === "ESCORT" ? ClipboardList : TriangleAlert,
        },
        { screen: "notifications", title: "Thông báo", icon: Bell },
        { screen: "account", title: "Tài khoản", icon: UserRound },
      ];
  const go: Navigate = (target, params = {}) => {
    if (params.tripId) setSelectedId(params.tripId);
    const next = { screen: target, ...params };
    if (tabs.some((tab) => tab.screen === target)) setPages([next]);
    else setPages((old) => [...old, next]);
  };
  const back = useCallback(() => {
    if (writing) return true;
    if (pages.length <= 1) return false;
    const pop = () => setPages((old) => old.slice(0, -1));
    if (guardedForms.has(screen))
      Alert.alert(
        "Rời biểu mẫu?",
        "Nội dung chưa gửi trong biểu mẫu này sẽ bị bỏ.",
        [
          { text: "Ở lại", style: "cancel" },
          { text: "Bỏ thay đổi", style: "destructive", onPress: pop },
        ],
      );
    else pop();
    return true;
  }, [writing, pages.length, screen]);
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
        appearance={appearance}
        changeAppearance={changeAppearance}
        go={go}
        roleName={roleName}
      />
    );
  else if (screen === "password") content = <PasswordScreen go={go} />;
  else if (screen === "notifications") content = <Notifications go={go} />;
  else if (customer) {
    if (screen === "home" || screen === "orders")
      content = <CustomerHome go={go} ordersOnly={screen === "orders"} />;
    else if (screen === "horses" || screen === "horse")
      content = (
        <ProfilesScreen go={go} id={screen === "horse" ? page.id : undefined} />
      );
    else if (screen === "horse-form")
      content = <ProfileFormScreen go={go} id={page.id} />;
    else if (screen === "booking")
      content = <BookingScreen page={page} go={go} />;
    else if (page.id && (screen === "order" || screen === "documents"))
      content = (
        <OrderScreen id={page.id} go={go} documents={screen === "documents"} />
      );
    else if (page.id && screen === "quote")
      content = <QuoteScreen id={page.id} />;
    else if (page.id && screen === "tracking")
      content = <TrackingScreen id={page.id} go={go} />;
    else if (page.id && page.orderId && screen === "health")
      content = <HealthScreen id={page.id} orderId={page.orderId} />;
  } else if (screen === "home")
    content = (
      <ResourceState resource={trips}>
        <TripList trips={trips.data ?? []} go={go} />
      </ResourceState>
    );
  else if (!tripId)
    content = (
      <Empty
        title="Chọn chuyến được phân công trước"
        detail="Mở tab Chuyến để chọn chuyến cần thao tác."
      />
    );
  else if (screen === "trip" || screen === "crew-map")
    content = (
      <TripScreen
        tripId={String(tripId)}
        go={go}
        mapOnly={screen === "crew-map"}
      />
    );
  else if (screen === "checklist")
    content = <ChecklistScreen tripId={String(tripId)} go={go} />;
  else if (screen === "journal" || screen === "incidents")
    content = (
      <JournalScreen
        tripId={String(tripId)}
        incidentsOnly={screen === "incidents"}
        go={go}
      />
    );
  else if (["quick-log", "report", "incident-form"].includes(screen))
    content = (
      <CrewFormScreen
        tripId={String(tripId)}
        horseId={page.horseId}
        screen={screen}
        go={go}
      />
    );
  return (
    <>
      <Header
        title={titles[screen] || (customer ? "Hành trình" : "Chuyến của tôi")}
        subtitle={pages.length === 1 ? roleName : undefined}
        back={
          pages.length > 1
            ? () => {
                back();
              }
            : undefined
        }
        right={
          <View style={{ flexDirection: "row" }}>
            <IconButton
              icon={RefreshCw}
              label="Tải lại dữ liệu"
              onPress={() => {
                if (!writing) refresh();
              }}
            />
            <IconButton
              icon={Bell}
              label="Thông báo"
              onPress={() => {
                if (!writing) go("notifications");
              }}
            />
          </View>
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
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
          {content ?? <Empty title="Không tìm thấy nội dung" />}
        </ScrollView>
      </KeyboardAvoidingView>
      {pages.length === 1 ? (
        <View
          style={{
            flexDirection: "row",
            backgroundColor: c.surface,
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab.screen}
              disabled={writing}
              accessibilityRole="tab"
              accessibilityLabel={tab.title}
              accessibilityState={{
                selected: tab.screen === screen,
                disabled: writing,
              }}
              onPress={() => go(tab.screen)}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                minHeight: 72,
                padding: 6,
                gap: 4,
                borderTopWidth: 3,
                borderTopColor:
                  tab.screen === screen ? c.accent : "transparent",
              }}
            >
              <tab.icon
                color={tab.screen === screen ? c.tabActive : c.tabInactive}
                size={24}
              />
              <Txt size={12} bold={tab.screen === screen}>
                {tab.title}
              </Txt>
            </Pressable>
          ))}
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
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <StatusBar style={theme.name === "dark" ? "light" : "dark"} />
        {settingsError ? <Banner warning text={settingsError} /> : null}
        {!session.ready ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <ActivityIndicator color={theme.colors.link} />
            <Txt>Đang kiểm tra phiên đăng nhập…</Txt>
          </View>
        ) : session.token && !session.user ? (
          <ScrollView contentContainerStyle={s.content}>
            <Empty
              title="Chưa xác minh được phiên đăng nhập"
              detail={session.error}
            />
            <Button
              title="Thử lại kết nối"
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
          <Login />
        ) : unsupported ? (
          <ScrollView contentContainerStyle={s.content}>
            <Empty
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
            appearance={appearance}
            changeAppearance={changeAppearance}
          />
        )}
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}
export default function LiveApp() {
  const [loaded, fontError] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
  });
  if (!loaded && !fontError)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator />
        </SafeAreaView>
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
