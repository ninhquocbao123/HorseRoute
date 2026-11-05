import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Undo2, X } from "lucide-react-native";
import { motion } from "./theme";
import { Button, IconButton, Txt, useTheme } from "./ui";

export type ConfirmOptions = {
  title: string;
  body?: string;
  /** Nút an toàn, luôn ở trên. */
  cancelLabel?: string;
  confirmLabel: string;
  destructive?: boolean;
};
type UndoRequest = {
  message: string;
  onUndo: () => void;
  onExpire?: () => void;
};
type Overlay = {
  /** Hộp xác nhận theo design system, thay cho Alert của hệ thống. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Báo đã lưu ở trên cùng, kiểu thông báo điện thoại (quyết định 30/10). */
  notify: (title: string, body?: string) => void;
  /** Thanh Hoàn tác ở đáy, trong tầm ngón cái. */
  undo: (request: UndoRequest) => void;
};
const Context = createContext<Overlay>({
  confirm: async () => false,
  notify: () => {},
  undo: () => {},
});
export const useOverlay = () => useContext(Context);

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<{
    options: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const [top, setTop] = useState<{
    title: string;
    body?: string;
    key: number;
  } | null>(null);
  const [undoing, setUndoing] = useState<
    (UndoRequest & { key: number }) | null
  >(null);
  const value = useMemo<Overlay>(
    () => ({
      confirm: (options) =>
        new Promise<boolean>((resolve) => setDialog({ options, resolve })),
      notify: (title, body) => {
        setTop({ title, body, key: Date.now() });
        AccessibilityInfo.announceForAccessibility(
          body ? `${title}. ${body}` : title,
        );
      },
      undo: (request) => setUndoing({ ...request, key: Date.now() }),
    }),
    [],
  );
  const close = (ok: boolean) => {
    dialog?.resolve(ok);
    setDialog(null);
  };
  return (
    <Context.Provider value={value}>
      {children}
      {top ? (
        <TopNotice
          key={top.key}
          title={top.title}
          body={top.body}
          onDone={() => setTop(null)}
        />
      ) : null}
      {undoing ? (
        <UndoBar
          key={undoing.key}
          request={undoing}
          onDone={() => setUndoing(null)}
        />
      ) : null}
      <ConfirmDialog
        options={dialog?.options ?? null}
        onCancel={() => close(false)}
        onConfirm={() => close(true)}
      />
    </Context.Provider>
  );
}

function ConfirmDialog({
  options,
  onCancel,
  onConfirm,
}: {
  options: ConfirmOptions | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { colors: c, shadow } = useTheme();
  return (
    <Modal
      visible={!!options}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={[styles.dim, { backgroundColor: c.overlay }]}>
        {options ? (
          <View
            accessibilityViewIsModal
            style={[
              styles.dialog,
              { backgroundColor: c.surfaceElevated },
              shadow.lg,
            ]}
          >
            <Txt bold>{options.title}</Txt>
            {options.body ? (
              <Txt size={15} color={c.textSecondary}>
                {options.body}
              </Txt>
            ) : null}
            <View style={{ gap: 12, marginTop: 8 }}>
              <Button
                title={options.cancelLabel ?? "Ở lại"}
                kind="secondary"
                onPress={onCancel}
              />
              <Button
                title={options.confirmLabel}
                kind={options.destructive ? "destructive" : "brand"}
                onPress={onConfirm}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function TopNotice({
  title,
  body,
  onDone,
}: {
  title: string;
  body?: string;
  onDone: () => void;
}) {
  const { colors: c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-160)).current;
  useEffect(() => {
    Animated.spring(y, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
    }).start();
    const timer = setTimeout(
      () =>
        Animated.timing(y, {
          toValue: -160,
          duration: motion.duration.base,
          useNativeDriver: true,
        }).start(onDone),
      motion.topNoticeMs,
    );
    return () => clearTimeout(timer);
  }, [y, onDone]);
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.topWrap,
        { top: insets.top + 8, transform: [{ translateY: y }] },
      ]}
    >
      <Pressable
        accessibilityRole="alert"
        onPress={onDone}
        style={[
          styles.top,
          { backgroundColor: c.surfaceElevated, borderColor: c.border },
          shadow.lg,
        ]}
      >
        <Image source={require("../assets/logo.png")} style={styles.appIcon} />
        <View style={{ flex: 1 }}>
          <Txt size={12} color={c.textSecondary}>
            HorseRoute · bây giờ
          </Txt>
          <Txt size={15} bold>
            {title}
          </Txt>
          {body ? (
            <Txt size={15} color={c.textSecondary}>
              {body}
            </Txt>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function UndoBar({
  request,
  onDone,
}: {
  request: UndoRequest;
  onDone: () => void;
}) {
  const { colors: c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const ms = motion.undoWindowMs;
  const [left, setLeft] = useState(Math.ceil(ms / 1000));
  const done = useRef(false);
  const finish = useCallback(
    (undone: boolean) => {
      if (done.current) return;
      done.current = true;
      if (!undone) request.onExpire?.();
      onDone();
    },
    [request, onDone],
  );
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const remain = Math.ceil((ms - (Date.now() - started)) / 1000);
      setLeft(remain);
      if (remain <= 0) {
        clearInterval(timer);
        finish(false);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [ms, finish]);
  return (
    <View
      style={[
        styles.undo,
        { bottom: insets.bottom + 16, backgroundColor: c.surfaceBrand },
        shadow.lg,
      ]}
    >
      <Txt size={15} color={c.onBrand} style={{ flex: 1 }}>
        {request.message}
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Hoàn tác, còn ${left} giây`}
        onPress={() => {
          request.onUndo();
          finish(true);
        }}
        style={({ pressed }) => [
          styles.undoButton,
          { opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Undo2 size={20} color={c.accent} />
        <Txt bold color={c.accent}>
          {`Hoàn tác ${left}`}
        </Txt>
      </Pressable>
    </View>
  );
}

/** Bottom sheet. Nút Back của Android đóng sheet. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { colors: c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable
          accessibilityLabel="Đóng"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]}
        />
        <View style={{ flex: 1 }} pointerEvents="box-none" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: c.surfaceElevated,
              paddingBottom: insets.bottom + 12,
            },
            shadow.lg,
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          <View style={styles.sheetHead}>
            <Txt bold style={{ flex: 1 }}>
              {title}
            </Txt>
            <IconButton icon={X} label="Đóng" onPress={onClose} />
          </View>
          <ScrollView
            style={{ maxHeight: 560 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, justifyContent: "center", padding: 24 },
  dialog: { borderRadius: 24, padding: 24, gap: 8 },
  topWrap: { position: "absolute", left: 12, right: 12, zIndex: 100 },
  top: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
  },
  appIcon: { width: 36, height: 36, borderRadius: 9 },
  undo: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 16,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 90,
  },
  undoButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8 },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 4,
  },
});
