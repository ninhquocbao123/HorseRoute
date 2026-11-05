import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  TextInput,
  StyleSheet,
  type TextStyle,
  type StyleProp,
  type ViewStyle,
  type TextInputProps,
} from "react-native";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Ban,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  CloudOff,
  Eye,
  FilePenLine,
  HeartPulse,
  MapPin,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Send,
  Square,
  SquareCheck,
  Thermometer,
  Truck,
  UserCheck,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import {
  lightTheme,
  fontFamily,
  toneColors,
  type Theme,
  type StatusSpec,
  type StatusTone,
} from "./theme";

export const ThemeContext = createContext<Theme>(lightTheme);
export const useTheme = () => useContext(ThemeContext);
export function Txt({
  children,
  size = 17,
  bold = false,
  color,
  style,
}: {
  children: React.ReactNode;
  /** Bốn cỡ chữ của design system: 24 tiêu đề, 17 nội dung, 15 phụ, 12 nhãn. */
  size?: 12 | 15 | 17 | 24;
  bold?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const { colors: c } = useTheme();
  return (
    <Text
      style={[
        {
          fontFamily: bold ? fontFamily.semibold : fontFamily.regular,
          fontSize: size,
          lineHeight: Math.round(size * (size >= 24 ? 1.33 : 1.5)),
          color: color ?? c.textPrimary,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export type ButtonKind =
  | "primary"
  | "secondary"
  | "tertiary"
  | "danger"
  | "destructive"
  | "brand";
/**
 * primary: vàng, chỉ một nút mỗi màn. danger: viền đỏ cho "Báo sự cố", "Báo bất thường".
 * destructive: nền đỏ cho hành động xóa/bỏ. brand: teal cho xác nhận trong hộp thoại.
 */
export function Button({
  title,
  onPress,
  kind = "primary",
  icon: Icon,
  disabled = false,
  large = false,
  hint,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Nút chính đáy màn của tài xế, cao 64. */
  large?: boolean;
  hint?: string;
}) {
  const { colors: c } = useTheme();
  const palette = {
    primary: {
      bg: c.accent,
      pressed: c.accentPressed,
      fg: c.onAccent,
      border: c.accent,
    },
    brand: {
      bg: c.surfaceBrand,
      pressed: c.surfaceBrandAlt,
      fg: c.onBrand,
      border: c.surfaceBrand,
    },
    secondary: {
      bg: c.surface,
      pressed: c.surfaceMuted,
      fg: c.textPrimary,
      border: c.borderInput,
    },
    tertiary: {
      bg: "transparent",
      pressed: c.surfaceMuted,
      fg: c.link,
      border: "transparent",
    },
    danger: {
      bg: c.surface,
      pressed: c.dangerBg,
      fg: c.dangerFg,
      border: c.dangerFg,
    },
    destructive: {
      bg: c.dangerSolid,
      pressed: c.dangerFg,
      fg: c.onBrand,
      border: c.dangerSolid,
    },
  }[kind];
  const color = disabled ? c.textSecondary : palette.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={hint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          minHeight: large ? 64 : 56,
          backgroundColor: disabled
            ? kind === "tertiary"
              ? "transparent"
              : c.surfaceMuted
            : pressed
              ? palette.pressed
              : palette.bg,
          borderColor: disabled ? c.surfaceMuted : palette.border,
          borderWidth: kind === "secondary" || kind === "danger" ? 1.5 : 0,
        },
      ]}
    >
      {Icon ? <Icon size={22} color={color} /> : null}
      <Txt bold color={color} style={{ textAlign: "center", flexShrink: 1 }}>
        {title}
      </Txt>
    </Pressable>
  );
}
export function IconButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const { colors: c } = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 56,
        minHeight: 56,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 16,
        backgroundColor: pressed ? c.surfaceMuted : "transparent",
      })}
    >
      <Icon color={c.textPrimary} size={24} />
    </Pressable>
  );
}
export function Card({
  children,
  brand = false,
  style,
  onPress,
  onLongPress,
  label,
}: {
  children: React.ReactNode;
  brand?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Cả thẻ là vùng chạm (thẻ chuyến, thẻ đơn). */
  onPress?: () => void;
  /** Chạm giữ (thẻ ngựa: Báo bất thường). */
  onLongPress?: () => void;
  label?: string;
}) {
  const { colors: c } = useTheme();
  const base = [
    s.card,
    {
      backgroundColor: brand ? c.surfaceBrand : c.surface,
      borderColor: brand ? c.surfaceBrand : c.border,
    },
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        ...base,
        pressed
          ? { backgroundColor: brand ? c.surfaceBrandAlt : c.surfaceMuted }
          : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={[...base, style]}>{children}</View>
  );
}
const specIcons: Record<string, LucideIcon> = {
  activity: Activity,
  "badge-check": BadgeCheck,
  ban: Ban,
  "calendar-check": CalendarCheck,
  check: Check,
  "circle-alert": CircleAlert,
  "circle-check": CircleCheck,
  "circle-dashed": CircleDashed,
  "circle-x": CircleX,
  clock: Clock,
  "cloud-off": CloudOff,
  eye: Eye,
  "file-pen-line": FilePenLine,
  "heart-pulse": HeartPulse,
  "map-pin": MapPin,
  package: Package,
  "refresh-cw": RefreshCw,
  send: Send,
  thermometer: Thermometer,
  truck: Truck,
  "user-check": UserCheck,
  "utensils-crossed": UtensilsCrossed,
  wallet: Wallet,
};
/** Nhãn trạng thái nghiệp vụ: tone + icon + chữ, không chỉ dựa vào màu. */
export function StatusBadge({ spec }: { spec: StatusSpec }) {
  const theme = useTheme();
  const colors = toneColors(theme, spec.tone);
  const Icon = specIcons[spec.icon] ?? Clock;
  return (
    <View style={[s.badge, { backgroundColor: colors.bg }]}>
      <Icon size={16} color={colors.fg} />
      <Txt size={12} bold color={colors.fg}>
        {spec.label}
      </Txt>
    </View>
  );
}
/** Vạch mức độ sự cố 1-2-3 kèm chữ. */
export function SeverityBars({
  level,
  label,
  tone,
}: {
  level: 1 | 2 | 3;
  label: string;
  tone: StatusTone;
}) {
  const theme = useTheme();
  const colors = toneColors(theme, tone);
  const fill = tone === "neutral" ? theme.colors.textSecondary : colors.fg;
  return (
    <View
      accessible
      accessibilityLabel={`Mức độ ${label}, ${level} trên 3`}
      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
    >
      <View style={{ flexDirection: "row", gap: 3, alignItems: "flex-end" }}>
        {[1, 2, 3].map((n) => (
          <View
            key={n}
            style={{
              width: 6,
              height: 6 + n * 5,
              borderRadius: 2,
              backgroundColor: n <= level ? fill : theme.colors.border,
            }}
          />
        ))}
      </View>
      <Txt size={15} bold color={fill}>
        {label}
      </Txt>
    </View>
  );
}
/** Ô số có nút trừ/cộng 56, chạm giữa để gõ. */
export function Stepper({
  label,
  value,
  onChange,
  step,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step: number;
  min: number;
  max: number;
  unit: string;
}) {
  const { colors: c } = useTheme();
  const clamp = (v: number) =>
    Math.min(max, Math.max(min, Math.round(v * 10) / 10));
  const [text, setText] = useState(String(value));
  React.useEffect(() => setText(String(value).replace(".", ",")), [value]);
  const box = {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.borderInput,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: c.surface,
  };
  return (
    <View style={{ gap: 8 }}>
      <Txt bold>{label}</Txt>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: `${value} ${unit}` }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) =>
          onChange(
            clamp(
              value + (e.nativeEvent.actionName === "increment" ? step : -step),
            ),
          )
        }
        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        <Pressable
          accessibilityLabel={`Bớt ${step} ${unit}`}
          onPress={() => onChange(clamp(value - step))}
          style={box}
        >
          <Minus size={22} color={c.textPrimary} />
        </Pressable>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            onEndEditing={() => {
              const n = Number(text.replace(",", "."));
              if (Number.isFinite(n)) onChange(clamp(n));
              else setText(String(value));
            }}
            keyboardType="decimal-pad"
            style={[
              s.input,
              {
                flex: 1,
                minHeight: 56,
                textAlign: "center",
                color: c.textPrimary,
                borderColor: c.borderInput,
                backgroundColor: c.surface,
                fontFamily: fontFamily.semibold,
              },
            ]}
          />
          <Txt color={c.textSecondary}>{unit}</Txt>
        </View>
        <Pressable
          accessibilityLabel={`Thêm ${step} ${unit}`}
          onPress={() => onChange(clamp(value + step))}
          style={box}
        >
          <Plus size={22} color={c.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}
/** Một dòng nhãn và giá trị trong thẻ thông tin. */
export function InfoLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Txt size={12} color={c.textSecondary}>
        {label}
      </Txt>
      <Txt bold={strong}>{value}</Txt>
    </View>
  );
}
/** Thanh tiến độ các bước của wizard. */
/**
 * Thanh tiến độ kiểu web: vòng số nối bằng đường kẻ, nhãn dưới mỗi vòng.
 * Chỉ để xem (không phải nút): bước xong tô teal có dấu tick, bước hiện tại viền teal đậm có quầng nhạt.
 */
export function StepBar({ step, steps }: { step: number; steps: string[] }) {
  const { colors: c } = useTheme();
  const size = 32;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Bước ${step + 1} trên ${steps.length}: ${steps[step]}`}
      style={{ flexDirection: "row" }}
    >
      {steps.map((name, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <View key={name} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: "100%",
                height: size + 8,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    right: "50%",
                    height: 2,
                    backgroundColor: i <= step ? c.link : c.borderInput,
                  }}
                />
              ) : null}
              {i < steps.length - 1 ? (
                <View
                  style={{
                    position: "absolute",
                    left: "50%",
                    right: 0,
                    height: 2,
                    backgroundColor: i < step ? c.link : c.borderInput,
                  }}
                />
              ) : null}
              <View
                style={{
                  width: size + 8,
                  height: size + 8,
                  borderRadius: (size + 8) / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: current ? `${c.link}33` : "transparent",
                }}
              >
                <View
                  style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: current ? 2.5 : 1.5,
                    borderColor: done || current ? c.link : c.borderInput,
                    backgroundColor: done ? c.link : c.surface,
                  }}
                >
                  {done ? (
                    <Check size={16} color={c.surface} strokeWidth={3} />
                  ) : (
                    <Txt
                      size={15}
                      bold={current}
                      color={current ? c.link : c.textSecondary}
                    >
                      {String(i + 1)}
                    </Txt>
                  )}
                </View>
              </View>
            </View>
            <Txt
              size={12}
              bold={current}
              color={current ? c.link : done ? c.textPrimary : c.textSecondary}
              style={{ textAlign: "center", paddingHorizontal: 2 }}
            >
              {name}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}
export function Badge({
  label,
  tone = "info",
}: {
  label: string;
  tone?: StatusTone;
}) {
  const theme = useTheme();
  const colors = toneColors(theme, tone);
  const Icon =
    tone === "success"
      ? CircleCheck
      : tone === "warning" || tone === "danger"
        ? CircleAlert
        : Clock;
  return (
    <View style={[s.badge, { backgroundColor: colors.bg }]}>
      <Icon size={16} color={colors.fg} />
      <Txt size={12} bold color={colors.fg}>
        {label}
      </Txt>
    </View>
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={s.section}>
      <Txt bold style={{ flex: 1 }}>
        {title}
      </Txt>
      {action && onPress ? (
        <Pressable accessibilityRole="button" onPress={onPress} style={s.link}>
          <Txt color={c.link} size={12} bold>
            {action}
          </Txt>
          <ArrowUpRight size={16} color={c.link} />
        </Pressable>
      ) : null}
    </View>
  );
}
export function Row({
  title,
  detail,
  icon: Icon = MapPin,
  onPress,
  danger = false,
}: {
  title: string;
  detail?: string;
  icon?: LucideIcon;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { colors: c } = useTheme();
  const content = (
    <>
      <View
        style={[
          s.rowIcon,
          { backgroundColor: danger ? c.warningBg : c.surfaceMuted },
        ]}
      >
        <Icon size={22} color={danger ? c.warningFg : c.link} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt bold>{title}</Txt>
        {detail ? (
          <Txt size={12} color={c.textSecondary}>
            {detail}
          </Txt>
        ) : null}
      </View>
      {onPress ? <ChevronRight size={20} color={c.textSecondary} /> : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[s.row, { borderBottomColor: c.border }]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[s.row, { borderBottomColor: c.border }]}>{content}</View>
  );
}
export function Field({
  label,
  error,
  hint,
  warn,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  /** Cảnh báo cam: giá trị hợp lệ nhưng ngoài khoảng thường gặp. */
  warn?: string | null;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Txt bold>{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textSecondary}
        {...props}
        style={[
          s.input,
          {
            color: c.textPrimary,
            backgroundColor: c.surface,
            borderColor: error
              ? c.dangerFg
              : warn
                ? c.warningFg
                : c.borderInput,
            minHeight: props.multiline ? 120 : 56,
            textAlignVertical: props.multiline ? "top" : "center",
          },
          props.style,
        ]}
      />
      {error ? (
        <Txt size={15} color={c.dangerFg}>
          {error}
        </Txt>
      ) : warn ? (
        <Txt size={15} color={c.warningFg}>
          {warn}
        </Txt>
      ) : hint ? (
        <Txt size={15} color={c.textSecondary}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}
export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.chip,
        {
          backgroundColor: selected ? c.chipSelectedBg : c.chipBg,
          borderColor: selected ? c.chipSelectedBg : c.chipBorder,
        },
      ]}
    >
      {/* Quyết định 30/10: đổi màu nền, không thêm dấu tick, không đổi độ đậm để chip không nhảy. */}
      <Txt color={selected ? c.chipSelectedFg : c.textPrimary}>{label}</Txt>
    </Pressable>
  );
}
export function Banner({
  text,
  warning = false,
  onPress,
}: {
  text: string;
  warning?: boolean;
  onPress?: () => void;
}) {
  const { colors: c } = useTheme();
  const content = (
    <>
      <CircleAlert size={20} color={warning ? c.warningFg : c.infoFg} />
      <Txt
        size={12}
        color={warning ? c.warningFg : c.infoFg}
        style={{ flex: 1 }}
      >
        {text}
      </Txt>
      {onPress ? <ChevronRight color={c.infoFg} size={20} /> : null}
    </>
  );
  const style = {
    padding: 16,
    gap: 12,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: warning ? c.warningBg : c.infoBg,
  };
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={style}>
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}
export function Header({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: () => void;
  right?: React.ReactNode;
}) {
  const { colors: c } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      {back ? (
        <IconButton icon={ArrowLeft} label="Quay lại" onPress={back} />
      ) : null}
      <View style={{ flex: 1 }}>
        {subtitle ? (
          <Txt size={12} bold color={c.textSecondary}>
            {subtitle}
          </Txt>
        ) : null}
        <Txt size={24} bold>
          {title}
        </Txt>
      </View>
      {right}
    </View>
  );
}
export function Timeline({
  active = 1,
  stops,
}: {
  active?: number;
  stops: { name: string; note: string; time: string }[];
}) {
  const { colors: c } = useTheme();
  return (
    <View>
      {stops.map((stop, index) => (
        <View
          key={`${index}:${stop.name}`}
          style={{ flexDirection: "row", gap: 16, minHeight: 100 }}
        >
          <View style={{ width: 32, alignItems: "center" }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                borderWidth: index === active ? 3 : 1,
                borderColor: index === active ? c.accent : c.borderInput,
                backgroundColor: index < active ? c.surfaceBrand : c.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {index < active ? (
                <Check size={16} color={c.onBrand} />
              ) : (
                <MapPin size={16} color={c.textPrimary} />
              )}
            </View>
            {index < stops.length - 1 ? (
              <View
                style={{
                  width: 2,
                  flex: 1,
                  backgroundColor: c.border,
                  marginVertical: 4,
                }}
              />
            ) : null}
          </View>
          <View style={{ flex: 1, paddingBottom: 24 }}>
            <Txt bold>{stop.name}</Txt>
            <Txt size={12} color={c.textSecondary}>
              {stop.note}
            </Txt>
            <Txt bold color={index === active ? c.link : c.textSecondary}>
              {stop.time}
              {index < active ? " · Đã hoàn thành" : ""}
            </Txt>
          </View>
        </View>
      ))}
    </View>
  );
}
export const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 16 },
  card: { padding: 20, borderWidth: 1, borderRadius: 20, gap: 12 },
  button: {
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    minHeight: 40,
  },
  link: {
    minHeight: 56,
    minWidth: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  row: {
    minHeight: 80,
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontFamily: fontFamily.regular,
    fontSize: 17,
  },
  chip: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
/**
 * Thân màn tự cuộn, có vùng nút cố định ở đáy (DRV-02, ESC-02): nút chính luôn trong tầm ngón cái.
 */
export function ScreenBody({
  children,
  footer,
  onRefresh,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  onRefresh?: () => void;
}) {
  const { colors: c, shadow } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={false}
              onRefresh={onRefresh}
              tintColor={c.link}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={[
            {
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 12,
              gap: 12,
              backgroundColor: c.surface,
              borderTopWidth: 1,
              borderTopColor: c.border,
            },
            shadow.md,
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
/** Ô chọn ngày hoặc giờ bằng bộ chọn của máy (không gõ tay "YYYY-MM-DD"). */
export function DateField({
  label,
  value,
  onChange,
  mode = "date",
  minimumDate,
  maximumDate,
  error,
  hint,
}: {
  label: string;
  value: Date | null;
  onChange: (value: Date) => void;
  mode?: "date" | "time";
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string;
  hint?: string;
}) {
  const { colors: c } = useTheme();
  const [open, setOpen] = useState(false);
  // Android: thư viện mở lại hộp thoại mỗi khi onChange hoặc value đổi, làm mất giờ đang chọn
  // lúc màn phía sau tải lại. Giữ cả hai ổn định trong suốt thời gian hộp đang mở.
  const latestOnChange = useRef(onChange);
  latestOnChange.current = onChange;
  const openedAt = useRef(value ?? new Date());
  const onAndroidChange = useCallback(
    (event: { type: string }, date?: Date) => {
      setOpen(false);
      if (event.type === "set" && date) latestOnChange.current(date);
    },
    [],
  );
  const text = value
    ? mode === "date"
      ? value.toLocaleDateString("vi-VN", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : value.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })
    : "Chọn";
  return (
    <View style={{ gap: 8 }}>
      <Txt bold>{label}</Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? text : "chưa chọn"}`}
        onPress={() => {
          openedAt.current = value ?? new Date();
          setOpen(true);
        }}
        style={[
          s.input,
          {
            minHeight: 56,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: c.surface,
            borderColor: error ? c.dangerFg : c.borderInput,
          },
        ]}
      >
        {mode === "date" ? (
          <CalendarDays size={20} color={c.link} />
        ) : (
          <Clock size={20} color={c.link} />
        )}
        <Txt color={value ? c.textPrimary : c.placeholder} style={{ flex: 1 }}>
          {text}
        </Txt>
      </Pressable>
      {hint && !error ? (
        <Txt size={15} color={c.textSecondary}>
          {hint}
        </Txt>
      ) : null}
      {error ? (
        <Txt size={15} color={c.dangerFg}>
          {error}
        </Txt>
      ) : null}
      {open && Platform.OS === "ios" ? (
        // iOS: bộ chọn dạng cuộn nằm ngay dưới ô, bấm Xong để đóng.
        <View style={{ gap: 8 }}>
          <DateTimePicker
            value={value ?? new Date()}
            mode={mode}
            display="spinner"
            locale="vi-VN"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_event, date) => {
              if (date) onChange(date);
            }}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (!value) onChange(new Date());
              setOpen(false);
            }}
            style={{
              minHeight: 56,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt bold color={c.link}>
              Xong
            </Txt>
          </Pressable>
        </View>
      ) : open ? (
        <DateTimePicker
          value={openedAt.current}
          mode={mode}
          is24Hour
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={onAndroidChange}
        />
      ) : null}
    </View>
  );
}
/** Dòng đánh dấu cho danh sách kiểm tra: cả dòng là vùng chạm. */
export function CheckRow({
  label,
  checked,
  onPress,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors: c } = useTheme();
  const Icon = checked ? SquareCheck : Square;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        {
          borderBottomColor: c.border,
          backgroundColor: pressed ? c.surfaceMuted : "transparent",
          minHeight: 64,
        },
      ]}
    >
      <Icon size={28} color={checked ? c.surfaceBrandAlt : c.borderInput} />
      <Txt style={{ flex: 1 }}>{label}</Txt>
    </Pressable>
  );
}
