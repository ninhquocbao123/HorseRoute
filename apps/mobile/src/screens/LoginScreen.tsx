/**
 * Màn đăng nhập theo thiết kế "Đăng nhập (mobile)" sáng/tối:
 * nền gradient + quầng sáng vàng sau logo, đường bay nét đứt, logo trong khung
 * viền gradient, wordmark Horse/Route, ô nhập bo tròn có ô icon, nút vàng có mũi tên.
 */
import React, { useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner, useTheme } from "../ui";
import { fontFamily } from "../theme";
import { useSession } from "../session";
import { useOverlay } from "../overlay";
import { discardForeign, foreignItems } from "../queue";
import { messageOf } from "../api/http";
import { API_URL } from "../config";

type Appearance = "light" | "dark" | "system";

/** Bảng màu riêng của màn đăng nhập, lấy theo 2 bản thiết kế. */
const palettes = {
  light: {
    bgTop: "#d9eef4",
    bgMid: "#eef7f8",
    bgBottom: "#ffffff",
    glow: "#f4c86a",
    glowOpacity: 0.45,
    dash: "#7fb9c4",
    dot: "#4f97a5",
    ring: "#f4b942",
    ink: "#0d2a2e",
    route: "#f28a1c",
    tagline: "#14707a",
    body: "#3f5b60",
    fieldBg: "#ffffff",
    fieldBorder: "#cfe1e4",
    iconTileBg: "#fdefd2",
    icon: "#c27c0e",
    placeholder: "#6b8a8f",
    text: "#0d2a2e",
    eye: "#4f7880",
    link: "#0e6b75",
    muted: "#4c6a6f",
    toggleBg: "#e3eef1",
    toggleBorder: "#cfe0e4",
    toggleOn: "#ffffff",
    toggleOnIcon: "#c27c0e",
    toggleOffIcon: "#5d7b80",
  },
  dark: {
    bgTop: "#0f3f49",
    bgMid: "#082429",
    bgBottom: "#061719",
    glow: "#c9a13a",
    glowOpacity: 0.32,
    dash: "#2f6a73",
    dot: "#4fa3ad",
    ring: "#f4b942",
    ink: "#f2fafa",
    route: "#f9a63a",
    tagline: "#6fd3dd",
    body: "#a9c4c7",
    fieldBg: "#0d2a30",
    fieldBorder: "#24515a",
    iconTileBg: "#2e3a2c",
    icon: "#f4b942",
    placeholder: "#8fb0b4",
    text: "#e8f4f4",
    eye: "#8fb0b4",
    link: "#ffc95c",
    muted: "#a9c4c7",
    toggleBg: "#0d2a30",
    toggleBorder: "#24515a",
    toggleOn: "#ffffff",
    toggleOnIcon: "#0d2a2e",
    toggleOffIcon: "#a9c4c7",
  },
};
type Palette = (typeof palettes)["light"];

/** Nền: gradient dọc, quầng sáng sau logo, hai đường bay nét đứt và các chấm. */
function Backdrop({
  p,
  width,
  height,
  top,
}: {
  p: Palette;
  width: number;
  height: number;
  /** Chiều cao thanh trạng thái: nền vẽ từ mép màn, họa tiết dời theo nội dung. */
  top: number;
}) {
  const w = width;
  const h = height;
  // Tâm logo: inset trên + đệm 12 + công tắc 52 + khoảng 24 + nửa logo 72.
  const logoY = top + 160;
  return (
    <Svg
      pointerEvents="none"
      width={w}
      height={h}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={p.bgTop} />
          <Stop offset="0.45" stopColor={p.bgMid} />
          <Stop offset="1" stopColor={p.bgBottom} />
        </LinearGradient>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={p.glow} stopOpacity={p.glowOpacity} />
          <Stop
            offset="0.55"
            stopColor={p.glow}
            stopOpacity={p.glowOpacity * 0.35}
          />
          <Stop offset="1" stopColor={p.glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={w} height={h} fill="url(#bg)" />
      <Circle cx={w / 2} cy={logoY} r={w * 0.62} fill="url(#glow)" />
      {/* Vị trí đo từ bản thiết kế, tính theo tâm logo (đơn vị dp). */}
      {/* Đường bay trên: từ mép trái chui dưới wordmark rồi vòng lên góc phải */}
      <Path
        d={`M -10 ${logoY + 150} C ${w * 0.18} ${logoY + 112}, ${w * 0.42} ${logoY + 128}, ${w * 0.6} ${logoY + 70} S ${w * 0.84} ${logoY - 40}, ${w + 10} ${logoY - 22}`}
        stroke={p.dash}
        strokeWidth={2}
        strokeDasharray="5 7"
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />
      {/* Đường bay dưới: ngay dưới dòng Đăng ký */}
      <Path
        d={`M -10 ${logoY + 600} C ${w * 0.22} ${logoY + 585}, ${w * 0.42} ${logoY + 640}, ${w * 0.66} ${logoY + 600} S ${w * 0.9} ${logoY + 545}, ${w + 10} ${logoY + 552}`}
        stroke={p.dash}
        strokeWidth={2}
        strokeDasharray="5 7"
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
      />
      <Circle cx={w * 0.087} cy={logoY - 30} r={3} fill={p.dot} />
      <Circle cx={w * 0.77} cy={logoY - 58} r={3} fill={p.dot} />
      <Circle cx={w * 0.9} cy={logoY + 138} r={3} fill={p.dot} />
      {[
        // Vòng trái nằm ngang wordmark nhưng lùi ra ngoài chữ "H".
        { x: w * 0.12, y: logoY + 104 },
        { x: w * 0.835, y: logoY + 42 },
      ].map((d, i) => (
        <React.Fragment key={i}>
          <Circle
            cx={d.x}
            cy={d.y}
            r={14}
            stroke={p.ring}
            strokeWidth={1.5}
            fill="none"
            opacity={0.6}
          />
          <Circle cx={d.x} cy={d.y} r={6} fill={p.ring} />
        </React.Fragment>
      ))}
    </Svg>
  );
}

/** Logo trong khung trắng bo 40, viền gradient vàng → teal. */
function LogoBadge() {
  const size = 144;
  const border = 5;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignSelf: "center",
        shadowColor: "#f4b942",
        shadowOpacity: 0.35,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
        borderRadius: 40,
      }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="frame" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffcf4d" />
            <Stop offset="0.5" stopColor="#f4b942" />
            <Stop offset="0.8" stopColor="#7fd1d8" />
            <Stop offset="1" stopColor="#1b8a96" />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={size}
          height={size}
          rx={40}
          fill="url(#frame)"
        />
        <Rect
          x={border}
          y={border}
          width={size - border * 2}
          height={size - border * 2}
          rx={36}
          fill="#ffffff"
        />
      </Svg>
      <Image
        source={require("../../assets/logo.png")}
        accessibilityLabel="Logo HorseRoute"
        style={{
          position: "absolute",
          // Ảnh logo có nền trắng vuông: bo góc để không lấn ra viền gradient.
          left: 9,
          top: 9,
          width: size - 18,
          height: size - 18,
          borderRadius: 32,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

/** Công tắc sáng/tối, dùng chung cho trang đăng nhập và màn Tài khoản. */
export function ThemeToggle({
  dark,
  onChange,
}: {
  dark: boolean;
  onChange: (value: Appearance) => void;
}) {
  const p = dark ? palettes.dark : palettes.light;
  const item = (value: "light" | "dark", Icon: LucideIcon, label: string) => {
    const on = dark === (value === "dark");
    return (
      <Pressable
        key={value}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        onPress={() => onChange(value)}
        hitSlop={4}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: on ? p.toggleOn : "transparent",
          shadowColor: "#000",
          shadowOpacity: on ? 0.12 : 0,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: on ? 3 : 0,
        }}
      >
        <Icon
          size={20}
          color={on ? p.toggleOnIcon : p.toggleOffIcon}
          strokeWidth={2}
        />
      </Pressable>
    );
  };
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Giao diện"
      style={{
        flexDirection: "row",
        padding: 3,
        borderRadius: 26,
        backgroundColor: p.toggleBg,
        borderWidth: 1,
        borderColor: p.toggleBorder,
        alignSelf: "flex-end",
      }}
    >
      {item("light", Sun, "Giao diện sáng")}
      {item("dark", Moon, "Giao diện tối")}
    </View>
  );
}

/** Ô nhập bo tròn: ô icon vàng nhạt bên trái, chữ gợi ý là nhãn. */
function LoginField({
  p,
  icon: Icon,
  label,
  right,
  inputRef,
  ...props
}: TextInputProps & {
  p: Palette;
  icon: LucideIcon;
  label: string;
  right?: React.ReactNode;
  inputRef?: React.Ref<React.ComponentRef<typeof TextInput>>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        paddingLeft: 12,
        paddingRight: right ? 4 : 16,
        borderRadius: 24,
        borderWidth: focused ? 1.5 : 1,
        borderColor: focused ? p.icon : p.fieldBorder,
        backgroundColor: p.fieldBg,
        shadowColor: "#0b3b42",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 1,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: p.iconTileBg,
        }}
      >
        <Icon size={20} color={p.icon} strokeWidth={2} />
      </View>
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={p.placeholder}
        selectionColor={p.icon}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
        style={{
          flex: 1,
          minHeight: 56,
          fontFamily: fontFamily.medium,
          fontSize: 17,
          color: p.text,
        }}
      />
      {right}
    </View>
  );
}

/** Nút chính: gradient vàng, bo 24, quầng sáng, mũi tên bên phải chữ. */
function GoldButton({
  title,
  busy,
  onPress,
}: {
  title: string;
  busy: boolean;
  onPress: () => void;
}) {
  const [w, setW] = useState(0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={({ pressed }) => ({
        height: 60,
        borderRadius: 24,
        overflow: "visible",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 12,
        opacity: busy ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        shadowColor: "#f4a81c",
        shadowOpacity: 0.4,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
        backgroundColor: "#f4b942",
      })}
    >
      {w ? (
        <Svg width={w} height={60} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffd164" />
              <Stop offset="1" stopColor="#f2a516" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={w} height={60} rx={24} fill="url(#gold)" />
        </Svg>
      ) : null}
      <Text
        style={{
          fontFamily: fontFamily.semibold,
          fontSize: 17,
          color: "#2b1a00",
        }}
      >
        {title}
      </Text>
      {busy ? null : <ArrowRight size={22} color="#2b1a00" strokeWidth={2.5} />}
    </Pressable>
  );
}

export function LoginScreen({
  onRegister,
  changeAppearance,
}: {
  onRegister: () => void;
  changeAppearance: (value: Appearance) => void;
}) {
  const theme = useTheme();
  const dark = theme.name === "dark";
  const p = dark ? palettes.dark : palettes.light;
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { login, logout, error: sessionError } = useSession();
  const { confirm } = useOverlay();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !password) {
      setError("Nhập email và mật khẩu tài khoản HorseRoute.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const user = await login(email, password);
      setPassword("");
      // Hàng chờ gắn với tài khoản: mục của tài khoản khác không gửi bằng phiên này.
      const foreign = foreignItems(String(user.id));
      if (foreign.length) {
        const drop = await confirm({
          title: `Còn ${foreign.length} mục chưa gửi của tài khoản khác`,
          body: "Các mục này chỉ gửi được khi tài khoản đó đăng nhập lại trên máy này.",
          cancelLabel: "Đăng nhập lại tài khoản kia",
          confirmLabel: `Bỏ ${foreign.length} mục`,
          destructive: true,
        });
        if (drop) await discardForeign(String(user.id));
        else await logout();
      }
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const message = error || sessionError;
  return (
    <View
      style={{ flex: 1, backgroundColor: p.bgBottom }}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((old) =>
          old.width === width && old.height === height
            ? old
            : { width, height },
        );
      }}
    >
      {size.width ? (
        <Backdrop
          p={p}
          width={size.width}
          height={size.height}
          top={insets.top}
        />
      ) : null}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 32,
          }}
        >
          <ThemeToggle dark={dark} onChange={changeAppearance} />
          <View style={{ marginTop: 24 }}>
            <LogoBadge />
          </View>
          <Text
            accessibilityRole="header"
            style={{
              marginTop: 28,
              textAlign: "center",
              fontFamily: fontFamily.bold,
              fontSize: 38,
              lineHeight: 48,
              letterSpacing: -0.5,
              color: p.ink,
            }}
          >
            Horse<Text style={{ color: p.route }}>Route</Text>
          </Text>
          <Text
            style={{
              marginTop: 6,
              textAlign: "center",
              fontFamily: fontFamily.bold,
              fontSize: 15,
              letterSpacing: 3,
              color: p.tagline,
            }}
          >
            VẬN CHUYỂN NGỰA
          </Text>
          <Text
            style={{
              marginTop: 16,
              alignSelf: "center",
              maxWidth: 300,
              textAlign: "center",
              fontFamily: fontFamily.regular,
              fontSize: 17,
              lineHeight: 26,
              color: p.body,
            }}
          >
            Đăng nhập để theo dõi và quản lý hành trình của bạn.
          </Text>

          <View style={{ marginTop: 36, gap: 16 }}>
            <LoginField
              p={p}
              icon={Mail}
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!busy}
            />
            <LoginField
              p={p}
              icon={Lock}
              label="Mật khẩu"
              inputRef={passwordRef}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              editable={!busy}
              onSubmitEditing={() => void submit()}
              right={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onPress={() => setShow((v) => !v)}
                  style={{
                    width: 52,
                    height: 52,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {show ? (
                    <EyeOff size={22} color={p.eye} />
                  ) : (
                    <Eye size={22} color={p.eye} />
                  )}
                </Pressable>
              }
            />
            {message ? <Banner warning text={message} /> : null}
            <View style={{ marginTop: 8 }}>
              <GoldButton
                title={busy ? "Đang đăng nhập…" : "Đăng nhập"}
                busy={busy}
                onPress={() => void submit()}
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chưa có tài khoản? Đăng ký"
            disabled={busy}
            onPress={onRegister}
            style={{ marginTop: 20, minHeight: 48, justifyContent: "center" }}
          >
            <Text
              style={{
                textAlign: "center",
                fontFamily: fontFamily.regular,
                fontSize: 17,
                color: p.muted,
              }}
            >
              Chưa có tài khoản?{" "}
              <Text style={{ fontFamily: fontFamily.bold, color: p.link }}>
                Đăng ký
              </Text>
            </Text>
          </Pressable>
          {error ? (
            <Text
              style={{
                marginTop: 8,
                textAlign: "center",
                fontFamily: fontFamily.regular,
                fontSize: 12,
                color: p.muted,
              }}
            >
              Máy chủ: {API_URL}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
