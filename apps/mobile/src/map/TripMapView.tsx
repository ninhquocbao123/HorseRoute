/**
 * Bản đồ dùng chung của mobile: WebView chạy MapLibre, nền OpenFreeMap (docs/mobile-design/12).
 * Không vẽ được thì về sơ đồ SVG RouteMap kèm lý do, giống MapFallback của web.
 * Màn hình chỉ dùng component này, sau này đổi sang native thì chỉ sửa ở đây.
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, View } from "react-native";
import { WebView } from "react-native-webview";
import type { ITripMap } from "../api/types";
import { RouteMap } from "../live-ui";
import { useOnline } from "../queue";
import { Button, Txt, useTheme } from "../ui";
import { DEFAULT_STYLE_URL, MAP_PAGE_URL, mapHtml } from "./map-html";
import {
  buildScene,
  mapColors,
  type MapMode,
  type OwnFix,
} from "./map-scene";
import type { ITripTrackPoint } from "../../../../packages/shared/src/types/trackmap.type";

// Kiểu của react-native-webview 14 chưa khớp RN 0.88 (props thành never): gom phép ép kiểu vào một chỗ.
type WebHandle = { injectJavaScript(code: string): void; reload(): void };
type WebProps = {
  ref?: React.Ref<WebHandle>;
  style?: object;
  originWhitelist: string[];
  source: { html: string; baseUrl: string };
  javaScriptEnabled: boolean;
  scrollEnabled: boolean;
  setSupportMultipleWindows: boolean;
  onShouldStartLoadWithRequest(request: { url: string }): boolean;
  onMessage(event: { nativeEvent: { data: string } }): void;
  onError(): void;
  onRenderProcessGone?(): void;
  onContentProcessDidTerminate?(): void;
};
const Web = WebView as unknown as React.ComponentType<WebProps>;

const STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim() || DEFAULT_STYLE_URL;
const MAP_ENABLED =
  process.env.EXPO_PUBLIC_MAP_ENABLED?.trim().toLowerCase() !== "false";
/** Quá thời gian này mà chưa vẽ xong thì về sơ đồ. */
const LOAD_TIMEOUT_MS = 15_000;

type Failure = "disabled" | "no-webgl" | "load-failed" | "timeout";
const FAILURE_TEXT: Record<Failure, string> = {
  disabled: "Bản đồ đang tạm tắt, đang hiện sơ đồ tuyến.",
  "no-webgl": "Máy này không hiển thị được bản đồ, đang hiện sơ đồ tuyến.",
  "load-failed": "Không tải được bản đồ, đang hiện sơ đồ tuyến.",
  timeout: "Bản đồ tải quá lâu, đang hiện sơ đồ tuyến.",
};

export type TripMapHandle = { recenter(): void; fit(): void };

export const TripMapView = forwardRef<
  TripMapHandle,
  {
    map: ITripMap | null;
    mode: MapMode;
    running?: boolean;
    track?: ITripTrackPoint[];
    ownFix?: OwnFix | null;
    navigating?: boolean;
    following?: boolean;
    /** Thẻ nhỏ: không nhãn, không nhận thao tác */
    compact?: boolean;
    height?: number;
    accessibilityLabel: string;
    onUserMoved?: () => void;
    /** Đang hiện sơ đồ dự phòng: màn hình ẩn các nút nổi chỉ dành cho bản đồ */
    onFallbackChange?: (fallback: boolean) => void;
  }
>(function TripMapView(
  {
    map,
    mode,
    running = false,
    track,
    ownFix,
    navigating,
    following,
    compact = false,
    height,
    accessibilityLabel,
    onUserMoved,
    onFallbackChange,
  },
  ref,
) {
  const { colors: c, name, map: tokens } = useTheme();
  const dark = name === "dark";
  const web = useRef<WebHandle | null>(null);
  const booted = useRef(false);
  const [failure, setFailure] = useState<Failure | null>(
    MAP_ENABLED ? null : "disabled",
  );
  const [attempt, setAttempt] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const html = useMemo(() => mapHtml(STYLE_URL), []);

  const colors = useMemo(() => mapColors(tokens, dark), [tokens, dark]);
  const scene = useMemo(
    () =>
      buildScene({
        map,
        mode,
        running,
        track,
        ownFix,
        navigating,
        following,
        compact,
        colors,
        dark,
        size,
      }),
    [map, mode, running, track, ownFix, navigating, following, compact, colors, dark, size],
  );

  const send = useCallback((code: string) => {
    web.current?.injectJavaScript(`${code}; true;`);
  }, []);
  const latest = useRef(scene);
  latest.current = scene;
  const render = useCallback(() => {
    send(`window.__hr && window.__hr.render(${JSON.stringify(latest.current)})`);
  }, [send]);

  useEffect(() => {
    // Chưa đo được khung thì chưa tính được góc nhìn.
    if (booted.current && size.width > 0) render();
  }, [scene, render, size.width]);

  useImperativeHandle(
    ref,
    () => ({
      recenter: () => send(`window.__hr && window.__hr.command("recenter")`),
      fit: () => send(`window.__hr && window.__hr.command("fit")`),
    }),
    [send],
  );

  // Quá hạn thì về sơ đồ; thử lại sẽ đặt lại đồng hồ.
  const loaded = useRef(false);
  useEffect(() => {
    if (failure) return;
    loaded.current = false;
    const timer = setTimeout(() => {
      if (!loaded.current) setFailure("timeout");
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [attempt, failure]);

  const fallback = failure !== null;
  const notify = useRef(onFallbackChange);
  notify.current = onFallbackChange;
  useEffect(() => {
    notify.current?.(fallback);
  }, [fallback]);

  const retry = useCallback(() => {
    booted.current = false;
    setFailure(null);
    setAttempt((n) => n + 1);
  }, []);
  // Có mạng trở lại thì tự thử lại, tài xế không phải bấm.
  const online = useOnline();
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current && (failure === "load-failed" || failure === "timeout"))
      retry();
    wasOnline.current = online;
  }, [online, failure, retry]);

  const onMessage = (event: { nativeEvent: { data: string } }) => {
    let message: { type?: string; detail?: string };
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.type === "booted" || message.type === "ready") {
      booted.current = true;
      render();
    } else if (message.type === "loaded") {
      loaded.current = true;
    } else if (message.type === "failed") {
      console.warn(`[map] ${message.detail}`);
      setFailure(message.detail === "no-webgl" ? "no-webgl" : "load-failed");
    } else if (message.type === "userMoved") {
      onUserMoved?.();
    } else if (message.type === "log" && message.detail) {
      console.log(`[map] ${message.detail}`);
    }
  };

  const box = height ? { height } : { flex: 1 };
  if (failure) {
    return (
      <View style={compact ? { gap: 8 } : [box, { gap: 8, padding: 12 }]}>
        {map ? <RouteMap map={map} compact={compact} bare /> : null}
        {compact ? null : (
          <>
            <Txt size={15} color={c.textSecondary}>
              {FAILURE_TEXT[failure]}
            </Txt>
            {failure === "disabled" || failure === "no-webgl" ? null : (
              <Button
                title="Thử tải lại bản đồ"
                kind="secondary"
                onPress={retry}
              />
            )}
          </>
        )}
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[box, { overflow: "hidden", backgroundColor: colors.land }]}
      pointerEvents={compact ? "none" : "auto"}
      onLayout={(event) => {
        const { width, height: h } = event.nativeEvent.layout;
        setSize((old) =>
          old.width === width && old.height === h ? old : { width, height: h },
        );
      }}
    >
      <Web
        key={attempt}
        ref={web}
        style={{ flex: 1, backgroundColor: "transparent" }}
        originWhitelist={["*"]}
        source={{ html, baseUrl: MAP_PAGE_URL }}
        javaScriptEnabled
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(request) =>
          request.url === MAP_PAGE_URL || request.url === "about:blank"
        }
        onMessage={onMessage}
        onError={() => setFailure("load-failed")}
        {...(Platform.OS === "android"
          ? { onRenderProcessGone: () => setFailure("load-failed") }
          : { onContentProcessDidTerminate: () => web.current?.reload() })}
      />
    </View>
  );
});
