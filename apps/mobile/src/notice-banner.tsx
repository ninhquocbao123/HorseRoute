import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, PanResponder, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Bell, TriangleAlert, X } from "lucide-react-native";
import { Txt, useTheme } from "./ui";
import type { Notice } from "./api/types";
import { isIncidentNotice, noticeTitle } from "./notice-route";

const VISIBLE_MS = 5000;

/** Dòng giờ ngắn "14:05". */
const clock = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * Popup thông báo trong app (mục 4): trượt xuống từ trên, tự ẩn sau 5 giây, vuốt lên hoặc bấm X để tắt,
 * bấm thân popup thì mở màn liên quan. Nhiều thông báo cùng lúc: xếp hàng, hiện lần lượt từng cái, không chồng.
 * Thường: nền xanh nhạt, viền teal. Sự cố: viền đỏ, nền đỏ nhạt, icon cảnh báo (giống toast web mục 5).
 */
export function NoticeBanner({
  queue,
  onOpen,
  onDone,
}: {
  queue: Notice[];
  onOpen: (notice: Notice) => void;
  /** Popup đầu hàng đã đóng (tự ẩn, vuốt, X hoặc bấm mở). */
  onDone: (notice: Notice) => void;
}) {
  const { colors: c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const notice = queue[0];
  const y = useRef(new Animated.Value(-200)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closing = useRef(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const close = useCallback(
    (after?: () => void) => {
      if (!notice || closing.current) return;
      closing.current = true;
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(y, { toValue: -200, duration: reduceMotion ? 0 : 200, useNativeDriver: true }).start(() => {
        closing.current = false;
        after?.();
        onDone(notice);
      });
    },
    [notice, onDone, reduceMotion, y],
  );

  useEffect(() => {
    if (!notice) return;
    y.setValue(-200);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: reduceMotion ? 100 : 14, bounciness: 0 }).start();
    if (isIncidentNotice(notice.event_type))
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    AccessibilityInfo.announceForAccessibility(`${noticeTitle(notice.event_type)}. ${notice.content}`);
    timer.current = setTimeout(() => close(), VISIBLE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [notice?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => y.setValue(Math.min(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -30 || g.vy < -0.5) closeRef.current();
        else Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;
  const closeRef = useRef(() => close());
  closeRef.current = () => close();

  if (!notice) return null;
  const incident = isIncidentNotice(notice.event_type);
  const Icon = incident ? TriangleAlert : Bell;
  const accent = incident ? c.dangerFg : c.link;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 12,
        right: 12,
        zIndex: 1000,
        elevation: 12,
        transform: [{ translateY: y }],
      }}
      {...pan.panHandlers}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${noticeTitle(notice.event_type)}: ${notice.content}. Chạm để mở`}
        accessibilityHint="Vuốt lên để tắt"
        onPress={() => close(() => onOpen(notice))}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            gap: 12,
            padding: 14,
            paddingRight: 8,
            borderRadius: 16,
            borderWidth: 1,
            borderLeftWidth: 4,
            borderColor: incident ? c.dangerFg : c.border,
            borderLeftColor: accent,
            backgroundColor: incident ? c.dangerBg : c.surface,
            opacity: pressed ? 0.92 : 1,
          },
          shadow.md,
        ]}
      >
        <Icon size={22} color={accent} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={15} bold color={incident ? c.dangerFg : c.textPrimary} numberOfLines={1}>
            {noticeTitle(notice.event_type)}
          </Txt>
          <Txt size={15} numberOfLines={2}>
            {notice.content}
          </Txt>
          <Txt size={12} color={c.textSecondary}>
            {clock(notice.created_at)}
            {queue.length > 1 ? ` · còn ${queue.length - 1} thông báo` : ""}
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng thông báo"
          hitSlop={8}
          onPress={() => close()}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <X size={20} color={c.textSecondary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
