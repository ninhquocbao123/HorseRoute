/**
 * Skeleton (design system 5.27): giữ đúng hình khối nội dung thật, nền
 * surfaceMuted, ánh sáng chạy 1,4 giây, chỉ hiện sau 300 ms để tránh nháy,
 * tắt ánh sáng chạy khi bật Reduce Motion.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "./ui";
import { radius } from "./theme";

const SHIMMER_MS = 1400;
const SHOW_DELAY_MS = 300;
const BAND = 140;

/** Tiến độ ánh sáng chạy dùng chung cho mọi khối trong cùng một màn. */
const ShimmerContext = createContext<Animated.Value | null>(null);

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduce(v);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** Khung bọc: trễ 300 ms, chạy một vòng lặp ánh sáng chung, nhãn trợ năng. */
export function SkeletonGroup({
  children,
  label = "Đang tải dữ liệu",
  delay = SHOW_DELAY_MS,
  style,
}: {
  children: React.ReactNode;
  label?: string;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const [visible, setVisible] = useState(delay <= 0);
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) return;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay, visible]);

  useEffect(() => {
    if (!visible) return;
    Animated.timing(fade, {
      toValue: 1,
      duration: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    if (reduce) {
      progress.stopAnimation();
      return;
    }
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SHIMMER_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, reduce, fade, progress]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={style}
    >
      {visible ? (
        <ShimmerContext.Provider value={reduce ? null : progress}>
          <Animated.View style={{ opacity: fade, gap: 16 }}>
            {children}
          </Animated.View>
        </ShimmerContext.Provider>
      ) : null}
    </View>
  );
}

/** Một khối xám. Mặc định là một dòng chữ cao 14. */
export function Bone({
  width = "100%",
  height = 14,
  r = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  r?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  const progress = useContext(ShimmerContext);
  const [w, setW] = useState(0);
  const translateX =
    progress && w
      ? progress.interpolate({ inputRange: [0, 1], outputRange: [-BAND, w] })
      : null;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[
        {
          width,
          height,
          borderRadius: r,
          backgroundColor: c.surfaceMuted,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {translateX ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { width: BAND, transform: [{ translateX }] },
          ]}
        >
          <Svg width={BAND} height="100%">
            <Defs>
              <LinearGradient id="shim" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={c.surface} stopOpacity={0} />
                <Stop offset="0.5" stopColor={c.surface} stopOpacity={0.55} />
                <Stop offset="1" stopColor={c.surface} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={BAND} height="100%" fill="url(#shim)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Khung thẻ giống Card (nền surface, viền, bo 16). */
function BoneCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.lg,
          padding: 16,
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type SkeletonVariant = "list" | "detail" | "rows" | "map" | "screen";

/** Thẻ chuyến/đơn: nhãn nhỏ, tiêu đề, chip trạng thái, 2 dòng phụ. */
function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <BoneCard key={i}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Bone width="35%" height={12} />
            <Bone width={88} height={24} r={radius.full} />
          </View>
          <Bone width={i % 2 ? "70%" : "85%"} height={22} />
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Bone width={20} height={20} r={radius.full} />
            <Bone width="55%" />
          </View>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Bone width={20} height={20} r={radius.full} />
            <Bone width="45%" />
          </View>
        </BoneCard>
      ))}
    </>
  );
}

/** Dòng thông báo / nhật ký / sự cố: ô icon 40 + 2 dòng chữ. */
function RowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <BoneCard style={{ gap: 20 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 12 }}>
          <Bone width={40} height={40} r={radius.md} />
          <View style={{ flex: 1, gap: 8, justifyContent: "center" }}>
            <Bone width={i % 2 ? "60%" : "80%"} height={16} />
            <Bone width="40%" height={12} />
          </View>
        </View>
      ))}
    </BoneCard>
  );
}

/** Màn chi tiết: thẻ thương hiệu đầu trang, khối thông tin, khối lớn. */
function DetailSkeleton() {
  return (
    <>
      <BoneCard>
        <Bone width="30%" height={12} />
        <Bone width="80%" height={28} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Bone width={96} height={28} r={radius.full} />
          <Bone width={72} height={28} r={radius.full} />
        </View>
      </BoneCard>
      <BoneCard style={{ gap: 16 }}>
        {[70, 55, 65, 45].map((w, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <Bone width="30%" />
            <Bone width={`${w - 20}%`} />
          </View>
        ))}
      </BoneCard>
      <BoneCard>
        <Bone height={120} r={radius.md} />
      </BoneCard>
      <Bone height={56} r={radius.md} />
    </>
  );
}

/** Bản đồ: khối lớn + thẻ tóm tắt bên dưới. */
function MapSkeleton() {
  return (
    <>
      <Bone height={320} r={radius.lg} />
      <BoneCard>
        <Bone width="40%" height={12} />
        <Bone width="75%" height={20} />
        <Bone width="50%" />
      </BoneCard>
    </>
  );
}

/** Màn khởi động (kiểm tra phiên): khung tiêu đề lớn + thẻ. */
function ScreenSkeleton() {
  return (
    <>
      <View style={{ gap: 8, paddingTop: 8 }}>
        <Bone width={64} height={12} />
        <Bone width="55%" height={34} />
      </View>
      <ListSkeleton count={2} />
    </>
  );
}

export function Skeleton({
  variant = "list",
  count,
  label,
  delay,
  style,
}: {
  variant?: SkeletonVariant;
  count?: number;
  label?: string;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SkeletonGroup label={label} delay={delay} style={style}>
      {variant === "detail" ? (
        <DetailSkeleton />
      ) : variant === "rows" ? (
        <RowsSkeleton count={count} />
      ) : variant === "map" ? (
        <MapSkeleton />
      ) : variant === "screen" ? (
        <ScreenSkeleton />
      ) : (
        <ListSkeleton count={count} />
      )}
    </SkeletonGroup>
  );
}

/** Dòng chữ đang tải đặt trong một thẻ có sẵn (vd. báo giá). */
export function SkeletonLines({
  lines = 2,
  label,
}: {
  lines?: number;
  label?: string;
}) {
  return (
    <SkeletonGroup label={label} style={{ paddingVertical: 4 }}>
      <View style={{ gap: 8 }}>
        {Array.from({ length: lines }, (_, i) => (
          <Bone key={i} width={i === lines - 1 ? "55%" : "85%"} height={16} />
        ))}
      </View>
    </SkeletonGroup>
  );
}
