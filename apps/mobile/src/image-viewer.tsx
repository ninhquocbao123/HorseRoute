import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StatusBar,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Clock, ImageOff, MapPin, X } from "lucide-react-native";
import { Txt } from "./ui";
import { useSession } from "./session";
import { usePrivateImage } from "./live-ui";

/** Một ảnh trong trình xem: ảnh riêng tư (đường dẫn API) hoặc uri sẵn có, kèm thời gian chụp và mốc/địa điểm nếu có. */
export type ViewerPhoto = {
  key: string;
  path?: string;
  uri?: string;
  caption?: string;
  takenAt?: string | null;
  place?: string | null;
};

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 280;
const CLOSE_DRAG = 120;
const WHITE = "#ffffff";
const MUTED = "#c9d6d8";

const dateTimeText = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const distance = (e: GestureResponderEvent) => {
  const [a, b] = e.nativeEvent.touches;
  return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
};

/**
 * Một ảnh phóng to được: chụm hai ngón để phóng (tối đa 4x), chạm đúp để phóng 2,5x hoặc trở về, kéo để xem khi đang phóng.
 * Ở cỡ gốc, vuốt xuống để đóng; vuốt ngang để FlatList chuyển ảnh.
 */
function ZoomableImage({
  photo,
  width,
  height,
  onZoom,
  onDragClose,
  backdrop,
}: {
  photo: ViewerPhoto;
  width: number;
  height: number;
  onZoom: (zoomed: boolean) => void;
  onDragClose: () => void;
  backdrop: Animated.Value;
}) {
  const { token } = useSession();
  const remote = usePrivateImage(photo.path ?? "", photo.path ? token : null);
  const uri = photo.uri ?? (photo.path ? remote.uri : null);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const failed = decodeFailed || (!!photo.path && remote.failed);
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const g = useRef({ scale: 1, x: 0, y: 0, startScale: 1, startDist: 0, startX: 0, startY: 0, lastTap: 0, moved: false }).current;

  const apply = (next: { scale: number; x: number; y: number }, animated: boolean) => {
    const s = Math.min(MAX_SCALE, Math.max(1, next.scale));
    // Không kéo ảnh ra ngoài khung quá phần đã phóng.
    const maxX = ((s - 1) * width) / 2, maxY = ((s - 1) * height) / 2;
    const x = Math.max(-maxX, Math.min(maxX, next.x)), y = Math.max(-maxY, Math.min(maxY, next.y));
    g.scale = s; g.x = x; g.y = y;
    onZoom(s > 1.01);
    if (animated) {
      Animated.parallel([
        Animated.spring(scale, { toValue: s, useNativeDriver: true, bounciness: 0 }),
        Animated.spring(tx, { toValue: x, useNativeDriver: true, bounciness: 0 }),
        Animated.spring(ty, { toValue: y, useNativeDriver: true, bounciness: 0 }),
      ]).start();
    } else {
      scale.setValue(s); tx.setValue(x); ty.setValue(y);
    }
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (e, s) =>
          e.nativeEvent.touches.length > 1 || g.scale > 1.01 || (s.dy > 8 && Math.abs(s.dy) > Math.abs(s.dx) * 1.5),
        // Đang phóng hoặc chụm hai ngón thì giữ cử chỉ, không nhường cho danh sách vuốt ngang.
        onPanResponderTerminationRequest: () => g.scale <= 1.01,
        onPanResponderGrant: (e) => {
          g.moved = false;
          g.startScale = g.scale; g.startX = g.x; g.startY = g.y;
          g.startDist = distance(e);
        },
        onPanResponderMove: (e, s) => {
          if (Math.abs(s.dx) > 6 || Math.abs(s.dy) > 6) g.moved = true;
          if (e.nativeEvent.touches.length > 1) {
            const d = distance(e);
            if (!g.startDist) { g.startDist = d; g.startScale = g.scale; return; }
            apply({ scale: (g.startScale * d) / g.startDist, x: g.x, y: g.y }, false);
          } else if (g.scale > 1.01) {
            apply({ scale: g.scale, x: g.startX + s.dx, y: g.startY + s.dy }, false);
          } else if (s.dy > 0) {
            ty.setValue(s.dy);
            backdrop.setValue(Math.max(0.3, 1 - s.dy / 400));
          }
        },
        onPanResponderRelease: (_, s) => {
          g.startDist = 0;
          if (!g.moved) {
            const now = Date.now();
            if (now - g.lastTap < DOUBLE_TAP_MS) {
              g.lastTap = 0;
              apply(g.scale > 1.01 ? { scale: 1, x: 0, y: 0 } : { scale: DOUBLE_TAP_SCALE, x: 0, y: 0 }, true);
            } else g.lastTap = now;
            return;
          }
          if (g.scale <= 1.01) {
            if (s.dy > CLOSE_DRAG || s.vy > 1.2) onDragClose();
            else {
              Animated.spring(ty, { toValue: 0, useNativeDriver: true }).start();
              Animated.timing(backdrop, { toValue: 1, duration: 150, useNativeDriver: true }).start();
            }
          }
        },
      }),
    [width, height], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <View style={{ width, height, alignItems: "center", justifyContent: "center" }} {...responder.panHandlers}>
      {failed ? (
        <View style={{ alignItems: "center", gap: 12, padding: 24 }} accessibilityLabel="Không tải được ảnh">
          <ImageOff size={48} color={MUTED} />
          <Txt size={15} color={MUTED}>
            Không tải được ảnh này
          </Txt>
        </View>
      ) : !uri ? (
        <ActivityIndicator size="large" color={WHITE} accessibilityLabel="Đang tải ảnh" />
      ) : (
        <Animated.Image
          source={{ uri }}
          resizeMode="contain"
          onError={() => setDecodeFailed(true)}
          accessibilityLabel={photo.caption || "Ảnh trong chuyến"}
          style={{ width, height, transform: [{ translateX: tx }, { translateY: ty }, { scale }] }}
        />
      )}
    </View>
  );
}

/**
 * Trình xem ảnh toàn màn hình (mục 3): chụm để phóng, chạm đúp, vuốt trái/phải chuyển ảnh, vuốt xuống hoặc nút X để đóng,
 * đếm "2/5", thời gian chụp và mốc/địa điểm. Đang tải có vòng quay, ảnh lỗi hiện ô thay thế.
 */
export function ImageViewer({
  photos,
  index,
  onClose,
}: {
  photos: ViewerPhoto[];
  /** null: đóng. */
  index: number | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index ?? 0);
  const [zoomed, setZoomed] = useState(false);
  const backdrop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (index !== null) {
      setCurrent(index);
      setZoomed(false);
      backdrop.setValue(1);
    }
  }, [index, backdrop]);
  const photo = photos[current];
  return (
    <Modal visible={index !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <Animated.View style={{ flex: 1, backgroundColor: "#000", opacity: backdrop }}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(p) => p.key}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <ZoomableImage photo={item} width={width} height={height} onZoom={setZoomed} onDragClose={onClose} backdrop={backdrop} />
          )}
        />
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", top: insets.top + 8, left: 8, right: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.55)" }}>
            <Txt size={15} bold color={WHITE}>
              {`${current + 1}/${photos.length}`}
            </Txt>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng trình xem ảnh"
            onPress={onClose}
            hitSlop={8}
            style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" }}
          >
            <X size={26} color={WHITE} />
          </Pressable>
        </View>
        {photo && (photo.caption || photo.takenAt || photo.place) ? (
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 16, gap: 4, backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            {photo.caption ? (
              <Txt size={15} bold color={WHITE} numberOfLines={2}>
                {photo.caption}
              </Txt>
            ) : null}
            {photo.takenAt ? (
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Clock size={14} color={MUTED} />
                <Txt size={12} color={MUTED}>{`Chụp lúc ${dateTimeText(photo.takenAt)}`}</Txt>
              </View>
            ) : null}
            {photo.place ? (
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <MapPin size={14} color={MUTED} />
                <Txt size={12} color={MUTED} numberOfLines={2}>
                  {photo.place}
                </Txt>
              </View>
            ) : null}
          </View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

/** Ảnh nhỏ bấm được để mở trình xem (dùng ở thư viện ảnh chuyến, timeline). */
export function PhotoThumb({ photo, size, onPress }: { photo: ViewerPhoto; size: number; onPress: () => void }) {
  const { token } = useSession();
  const remote = usePrivateImage(photo.path ?? "", photo.path ? token : null);
  const uri = photo.uri ?? remote.uri;
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: 12, backgroundColor: "#e7f1f1", overflow: "hidden" as const, alignItems: "center" as const, justifyContent: "center" as const };
  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Mở ảnh${photo.caption ? `: ${photo.caption}` : ""}`} onPress={onPress} style={({ pressed }) => [box, { opacity: pressed ? 0.8 : 1 }]}>
      {failed || remote.failed ? (
        <ImageOff size={24} color="#546d71" />
      ) : uri ? (
        <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size }} />
      ) : (
        <ActivityIndicator color="#14606a" />
      )}
    </Pressable>
  );
}
