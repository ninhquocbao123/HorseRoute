import React, { createContext, useContext } from "react";
import {
  Pressable,
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
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  MapPin,
  type LucideIcon,
} from "lucide-react-native";
import {
  lightTheme,
  fontFamily,
  toneColors,
  type Theme,
  type StatusTone,
} from "./theme";

export const ThemeContext = createContext<Theme>(lightTheme);
export const useTheme = () => useContext(ThemeContext);
export function Txt({
  children,
  size = 16,
  bold = false,
  color,
  style,
}: {
  children: React.ReactNode;
  size?: 12 | 16 | 24 | 32;
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
          lineHeight: size * 1.5,
          color: color ?? c.textPrimary,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  kind = "primary",
  icon: Icon,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "danger";
  icon?: LucideIcon;
  disabled?: boolean;
}) {
  const { colors: c } = useTheme();
  const color = disabled
    ? c.textSecondary
    : kind === "primary"
      ? c.onAccent
      : kind === "danger"
        ? c.dangerFg
        : c.textPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: disabled
            ? c.surfaceMuted
            : kind === "primary"
              ? pressed
                ? c.accentPressed
                : c.accent
              : c.surface,
          borderColor:
            kind === "danger"
              ? c.dangerFg
              : kind === "primary"
                ? "transparent"
                : c.borderInput,
          opacity: pressed ? 0.82 : 1,
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
}: {
  children: React.ReactNode;
  brand?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: brand ? c.surfaceBrand : c.surface,
          borderColor: brand ? c.surfaceBrand : c.border,
        },
        style,
      ]}
    >
      {children}
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
  ...props
}: TextInputProps & { label: string; error?: string }) {
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
            borderColor: error ? c.dangerFg : c.borderInput,
            minHeight: props.multiline ? 120 : 56,
            textAlignVertical: props.multiline ? "top" : "center",
          },
          props.style,
        ]}
      />
      {error ? <Txt color={c.dangerFg}>{error}</Txt> : null}
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
          backgroundColor: selected ? c.textPrimary : c.surface,
          borderColor: selected ? c.textPrimary : c.borderInput,
        },
      ]}
    >
      <Txt color={selected ? c.bg : c.textSecondary}>{label}</Txt>
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
        <Txt size={back ? 24 : 32} bold>
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
          key={stop.name}
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
              {index < active ? " · Đã hoàn thành" : " · Dự kiến"}
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
    minHeight: 64,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
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
    fontSize: 16,
  },
  chip: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
