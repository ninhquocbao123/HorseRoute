import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  View,
} from "react-native";
import {
  Camera,
  Check,
  ChevronDown,
  CircleAlert,
  CloudOff,
  ImagePlus,
  Inbox,
  RefreshCw,
  SearchX,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import Svg, { Polyline, Circle } from "react-native-svg";
import { Banner, Button, Card, Field, Section, Txt, useTheme } from "./ui";
import { useResource, useSession } from "./session";
import { useOnline } from "./queue";
import { appendPhoto, keepPicked } from "./photo";
import { ApiError } from "./api/http";
import { Sheet } from "./overlay";
import { normalizeSearch } from "./booking-domain";
import { Skeleton, type SkeletonVariant } from "./skeleton";
import { API_URL, WEB_URL } from "./config";
import { dateTime } from "./live-domain";
import type { ITripMap } from "./api/types";
export type StateTone = "neutral" | "error" | "offline";

/**
 * EmptyState / ErrorState (design system 5.26): icon 28 trong ô 64 bo 20,
 * tiêu đề, một câu giải thích cỡ 15, tối đa một nút. Không minh họa, không emoji.
 */
export function StateView({
  icon: Icon = Inbox,
  tone = "neutral",
  title,
  detail,
  action,
  actionIcon,
  onAction,
  compact = false,
}: {
  icon?: LucideIcon;
  tone?: StateTone;
  title: string;
  detail?: string;
  action?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
  /** Đặt trong một thẻ/khối có sẵn: ít khoảng đệm hơn. */
  compact?: boolean;
}) {
  const { colors: c } = useTheme();
  const box =
    tone === "error"
      ? { bg: c.dangerBg, fg: c.dangerFg }
      : tone === "offline"
        ? { bg: c.surfaceBrand, fg: c.onBrand }
        : { bg: c.surfaceMuted, fg: c.link };
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      style={{
        alignItems: "center",
        gap: 12,
        paddingVertical: compact ? 16 : 40,
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: box.bg,
        }}
      >
        <Icon size={28} color={box.fg} strokeWidth={2} />
      </View>
      <Txt bold style={{ textAlign: "center" }}>
        {title}
      </Txt>
      {detail ? (
        <Txt
          size={15}
          color={c.textSecondary}
          style={{ textAlign: "center", maxWidth: 300 }}
        >
          {detail}
        </Txt>
      ) : null}
      {action && onAction ? (
        <View style={{ alignSelf: "stretch", marginTop: 4 }}>
          <Button
            title={action}
            kind="secondary"
            icon={actionIcon ?? RefreshCw}
            onPress={onAction}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Thanh ngay dưới header khi đang xem dữ liệu cũ (5.24). Chạm để thử lại. */
export function StaleBar({
  offline,
  cachedAt,
  error,
  onPress,
}: {
  offline: boolean;
  cachedAt?: number;
  error: string;
  onPress: () => void;
}) {
  const { colors: c } = useTheme();
  const time = cachedAt
    ? dateTime(new Date(cachedAt).toISOString())
    : undefined;
  const text = offline
    ? time
      ? `Mất sóng · đang xem dữ liệu lưu lúc ${time}`
      : "Mất sóng · đang xem dữ liệu đã tải trước đó"
    : `Chưa cập nhật được dữ liệu mới. ${error}`;
  const fg = offline ? c.onBrand : c.warningFg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text}. Chạm để thử lại`}
      accessibilityHint="Tải lại dữ liệu"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: offline
          ? pressed
            ? c.surfaceBrandAlt
            : c.surfaceBrand
          : c.warningBg,
        opacity: pressed && !offline ? 0.85 : 1,
      })}
    >
      {offline ? (
        <CloudOff size={18} color={fg} />
      ) : (
        <CircleAlert size={18} color={fg} />
      )}
      <Txt size={15} color={fg} style={{ flex: 1 }}>
        {text}
      </Txt>
      <RefreshCw size={18} color={fg} />
    </Pressable>
  );
}

export function ResourceState({
  resource,
  empty,
  skeleton = "list",
  what = "dữ liệu",
  children,
}: {
  /** Hình khối skeleton khớp với nội dung thật của màn. */
  skeleton?: SkeletonVariant;
  /** Tên nội dung cho câu lỗi: "Không tải được {what}". */
  what?: string;
  resource: {
    data?: unknown;
    loading: boolean;
    error: string;
    cachedAt?: number;
    reload: () => void;
  };
  empty?: string;
  children: React.ReactNode;
}) {
  const online = useOnline();
  const { data, error, reload } = resource;
  // Có mạng trở lại thì tự tải lại màn đang lỗi.
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current && error) reload();
    wasOnline.current = online;
  }, [online, error, reload]);

  if (data === undefined) {
    if (!error) return <Skeleton variant={skeleton} />;
    return !online ? (
      <StateView
        tone="offline"
        icon={WifiOff}
        title="Mất kết nối mạng"
        detail={`Máy chưa lưu ${what} để xem khi mất sóng. Bật dữ liệu di động hoặc Wi-Fi, màn sẽ tự tải lại.`}
        action="Thử lại"
        onAction={reload}
      />
    ) : (
      <StateView
        tone="error"
        icon={CircleAlert}
        title={`Không tải được ${what}`}
        detail={`${error.replace(/[.\s]+$/, "")}. Kéo xuống hoặc bấm Thử lại.`}
        action="Thử lại"
        onAction={reload}
      />
    );
  }
  return (
    <>
      {error ? (
        <StaleBar
          offline={!online || !!resource.cachedAt}
          cachedAt={resource.cachedAt}
          error={error}
          onPress={reload}
        />
      ) : null}
      {empty ? (
        <StateView title={empty} action="Tải lại" onAction={reload} />
      ) : (
        children
      )}
    </>
  );
}

/** Trạng thái trống: nói khi nào sẽ có dữ liệu hoặc cách tạo. */
export function Empty({
  title,
  detail,
  icon,
  action,
  actionIcon,
  onAction,
}: {
  title: string;
  detail?: string;
  icon?: LucideIcon;
  action?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
}) {
  return (
    <StateView
      icon={icon}
      title={title}
      detail={detail}
      action={action}
      actionIcon={actionIcon}
      onAction={onAction}
    />
  );
}

/** Không tìm thấy (sai mã, đã bị xóa, không thuộc chuyến). */
export function NotFound({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return <StateView icon={SearchX} title={title} detail={detail} />;
}
export const webUrl = (orderId?: string, documents = false) =>
  `${WEB_URL}/dashboard?view=${documents ? "documents" : "orders"}${orderId ? `&order=${encodeURIComponent(orderId)}` : ""}`;
export function WebButton({
  orderId,
  documents = false,
  title,
}: {
  orderId?: string;
  documents?: boolean;
  title?: string;
}) {
  const [error, setError] = useState("");
  const url = webUrl(orderId, documents);
  return (
    <>
      {error ? <Banner warning text={error} /> : null}
      <Button
        title={
          title ?? (documents ? "Bổ sung giấy tờ trên web" : "Mở đơn trên web")
        }
        onPress={() => {
          void Linking.openURL(url).catch(() =>
            setError(
              "Không mở được website. Kiểm tra địa chỉ web trong cấu hình ứng dụng.",
            ),
          );
        }}
      />
      <Txt size={12}>
        Website có phiên đăng nhập riêng. Đăng nhập bằng cùng tài khoản nếu được
        yêu cầu.
      </Txt>
    </>
  );
}
export function PrivateImage({
  path,
  caption,
  size,
}: {
  path: string;
  caption?: string;
  /** Ảnh vuông nhỏ (danh sách ngựa); bỏ trống = ảnh toàn chiều rộng. */
  size?: number;
}) {
  const { token } = useSession();
  const { colors: c } = useTheme();
  const [failed, setFailed] = useState(false);
  if (size)
    return failed ? null : (
      <Image
        source={{
          uri: API_URL + path,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }}
        onError={() => setFailed(true)}
        accessibilityLabel={caption || "Ảnh"}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: c.surfaceMuted,
        }}
      />
    );
  return failed ? (
    <Banner
      warning
      text="Không tải được ảnh. Kéo để tải lại màn hình hoặc kiểm tra quyền truy cập."
    />
  ) : (
    <View style={{ gap: 8 }}>
      <Image
        source={{
          uri: API_URL + path,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }}
        onError={() => setFailed(true)}
        accessibilityLabel={caption || "Ảnh đính kèm"}
        style={{
          width: "100%",
          height: 230,
          borderRadius: 16,
          backgroundColor: c.surfaceMuted,
        }}
      />
      {caption ? <Txt size={12}>{caption}</Txt> : null}
    </View>
  );
}
/** Ô chọn từ danh sách dài (tỉnh, xã): mở sheet có ô tìm không dấu. */
export function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
  error,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  const { colors: c } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = normalizeSearch(search);
  const matches = options.filter((o) => normalizeSearch(o).includes(query));
  const close = () => {
    setOpen(false);
    setSearch("");
  };
  return (
    <View style={{ gap: 8 }}>
      <Txt bold>{label}</Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || "chưa chọn"}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          minHeight: 56,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderWidth: 1,
          borderRadius: 12,
          borderCurve: "continuous",
          borderColor: error ? c.dangerFg : c.borderInput,
          backgroundColor: disabled ? c.surfaceMuted : c.surface,
        }}
      >
        <Txt
          color={value ? c.textPrimary : c.textSecondary}
          style={{ flex: 1 }}
        >
          {value || placeholder}
        </Txt>
        <ChevronDown size={20} color={c.textSecondary} />
      </Pressable>
      {error ? (
        <Txt size={15} color={c.dangerFg}>
          {error}
        </Txt>
      ) : null}
      <Sheet visible={open} onClose={close} title={label}>
        {options.length > 8 ? (
          <Field
            label="Tìm"
            value={search}
            placeholder="Gõ không dấu cũng được"
            autoCorrect={false}
            onChangeText={setSearch}
          />
        ) : null}
        {matches.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: option === value }}
            onPress={() => {
              onChange(option);
              close();
            }}
            style={{
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Txt bold={option === value} style={{ flex: 1 }}>
              {option}
            </Txt>
            {option === value ? <Check size={20} color={c.link} /> : null}
          </Pressable>
        ))}
        {!matches.length ? (
          <Txt size={15} color={c.textSecondary}>
            Không tìm thấy. Thử từ khóa khác.
          </Txt>
        ) : null}
      </Sheet>
    </View>
  );
}

/** COM-10 Ảnh đại diện: khung tròn, chạm để chụp hoặc chọn ảnh mới. Ảnh được cắt vuông giữa và nén còn 512 px. */
export function AvatarPicker({
  size = 72,
  onError,
}: {
  size?: number;
  onError: (message: string) => void;
}) {
  const { colors: c } = useTheme();
  const { request } = useSession();
  const avatar = useResource<{ image: string | null }>("/users/me/avatar");
  const [saved, setSaved] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const image = saved ?? avatar.data?.image ?? null;
  const pick = async (camera: boolean) => {
    setChoosing(false);
    onError("");
    setBusy(true);
    try {
      // iOS không mở được bộ chọn ảnh khi sheet còn đang đóng.
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (
        camera &&
        !(await ImagePicker.requestCameraPermissionsAsync()).granted
      ) {
        onError(
          "Chưa có quyền camera. Chọn ảnh từ thư viện, hoặc mở Cài đặt để cho phép camera.",
        );
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.8,
      };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      // Tự cắt vuông giữa ảnh: màn cắt có sẵn (allowsEditing) lỗi khi chụp bằng camera trên Android.
      const side = Math.min(asset.width, asset.height);
      const photo = await manipulateAsync(
        asset.uri,
        [
          {
            crop: {
              originX: Math.floor((asset.width - side) / 2),
              originY: Math.floor((asset.height - side) / 2),
              width: side,
              height: side,
            },
          },
          { resize: { width: 512 } },
        ],
        { compress: 0.8, format: SaveFormat.JPEG },
      );
      const body = new FormData();
      appendPhoto(body, photo.uri, "avatar");
      const uploaded = await request<{ image: string }>("/users/me/avatar", {
        method: "POST",
        body,
      });
      setSaved(uploaded.image);
    } catch (e) {
      onError(
        e instanceof ApiError
          ? e.message
          : "Không đổi được ảnh đại diện. Thử lại hoặc chọn ảnh khác.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={image ? "Đổi ảnh đại diện" : "Thêm ảnh đại diện"}
        disabled={busy}
        onPress={() => setChoosing(true)}
        style={{ width: size, height: size }}
      >
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1,
            borderColor: c.borderInput,
            backgroundColor: c.surfaceMuted,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {image ? (
            <Image
              source={{ uri: image }}
              accessibilityIgnoresInvertColors
              style={{ width: size, height: size }}
            />
          ) : busy ? null : (
            <Camera size={24} color={c.link} />
          )}
          {busy ? (
            <View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={c.link} />
            </View>
          ) : null}
        </View>
        {image && !busy ? (
          <View
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: c.surface,
              backgroundColor: c.surfaceBrand,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Camera size={12} color={c.onBrand} />
          </View>
        ) : null}
      </Pressable>
      <Sheet
        visible={choosing}
        onClose={() => setChoosing(false)}
        title="Ảnh đại diện"
      >
        <Button
          title="Chụp ảnh"
          kind="secondary"
          icon={Camera}
          onPress={() => void pick(true)}
        />
        <Button
          title="Chọn từ thư viện"
          kind="secondary"
          icon={ImagePlus}
          onPress={() => void pick(false)}
        />
      </Sheet>
    </>
  );
}

/**
 * Ô ảnh: chụp hoặc chọn từ thư viện, nén về cạnh dài 1600, tối đa `max` ảnh.
 * R-01: camera bị từ chối thì vẫn chọn được ảnh từ thư viện, có nút mở Cài đặt.
 */
export function PhotoPicker({
  photos,
  onChange,
  max = 3,
  required = false,
  error: fieldError,
  label = "Ảnh",
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
  required?: boolean;
  error?: string;
  label?: string;
}) {
  const { colors: c } = useTheme();
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const pick = async (camera: boolean) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (
        camera &&
        !(await ImagePicker.requestCameraPermissionsAsync()).granted
      ) {
        setDenied(true);
        setError(
          "Chưa có quyền camera. Chọn ảnh từ thư viện, hoặc mở Cài đặt để cho phép camera.",
        );
        return;
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
          });
      if (result.canceled) return;
      const asset = result.assets[0];
      const photo = await manipulateAsync(
        asset.uri,
        asset.width > 1600 || asset.height > 1600
          ? [
              {
                resize:
                  asset.width >= asset.height
                    ? { width: 1600 }
                    : { height: 1600 },
              },
            ]
          : [],
        { compress: 0.8, format: SaveFormat.JPEG },
      );
      if (new File(photo.uri).size > 5 * 1024 * 1024)
        throw new Error("Ảnh sau nén vẫn lớn hơn 5 MB. Chọn ảnh khác.");
      onChange([...photos, keepPicked(photo.uri)].slice(0, max));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không mở được ảnh.");
    } finally {
      setBusy(false);
    }
  };
  const full = photos.length >= max;
  return (
    <View style={{ gap: 12 }}>
      <Txt bold>
        {`${label}${required ? "" : " (không bắt buộc)"} · ${photos.length}/${max}`}
      </Txt>
      {photos.length ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {photos.map((uri, i) => (
            <View key={uri}>
              <Image
                source={{ uri }}
                accessibilityLabel={`Ảnh ${i + 1}`}
                style={{ width: 96, height: 96, borderRadius: 12 }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Bỏ ảnh ${i + 1}`}
                onPress={() => onChange(photos.filter((p) => p !== uri))}
                style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.border,
                }}
              >
                <X size={18} color={c.textPrimary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {!full ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Chụp ảnh"
              kind="secondary"
              icon={Camera}
              disabled={busy}
              onPress={() => void pick(true)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Thư viện"
              kind="secondary"
              icon={ImagePlus}
              disabled={busy}
              onPress={() => void pick(false)}
            />
          </View>
        </View>
      ) : null}
      {fieldError && !photos.length ? (
        <Txt size={15} color={c.dangerFg}>
          {fieldError}
        </Txt>
      ) : null}
      {error ? (
        <Txt size={15} color={c.dangerFg}>
          {error}
        </Txt>
      ) : null}
      {denied ? (
        <Button
          title="Mở Cài đặt"
          kind="tertiary"
          onPress={() => {
            void Linking.openSettings().catch(() =>
              setError("Mở Cài đặt → Ứng dụng → HorseRoute → Quyền."),
            );
          }}
        />
      ) : null}
    </View>
  );
}
export { appendPhoto } from "./photo";
export function RouteMap({
  map,
  compact = false,
  bare = false,
}: {
  map: ITripMap;
  /** Thẻ nhỏ cao 160 (CUS-05): chỉ sơ đồ và nhãn vị trí. */
  compact?: boolean;
  /** Phương án dự phòng của TripMapView: màn hình tự hiện vị trí và km, ở đây chỉ vẽ sơ đồ. */
  bare?: boolean;
}) {
  const { colors: c } = useTheme();
  const points = map.legs.flatMap((l) => l.coordinates ?? []);
  const coords = [
    ...points,
    ...map.stops
      .filter((s) => s.lng !== null && s.lat !== null)
      .map((s) => [s.lng!, s.lat!] as [number, number]),
    ...(map.position
      ? [[map.position.lng, map.position.lat] as [number, number]]
      : []),
  ].filter((p) => p.every(Number.isFinite));
  if (!coords.length)
    return (
      <Banner text="Máy chủ chưa có tọa độ cho tuyến này. Xem tiến độ theo mốc bên dưới." />
    );
  const minX = Math.min(...coords.map((p) => p[0])),
    maxX = Math.max(...coords.map((p) => p[0]));
  const minY = Math.min(...coords.map((p) => p[1])),
    maxY = Math.max(...coords.map((p) => p[1]));
  const project = (x: number, y: number) => [
    20 + ((x - minX) / (maxX - minX || 1)) * 290,
    180 - ((y - minY) / (maxY - minY || 1)) * 160,
  ];
  return (
    <Card>
      {compact || bare ? null : <Txt bold>Tuyến từ dữ liệu hành trình</Txt>}
      <View
        accessible
        accessibilityLabel={`Sơ đồ ${map.stops.map((s) => s.name).join(" → ")}`}
        style={{ backgroundColor: c.surfaceMuted, borderRadius: 12 }}
      >
        <Svg
          width="100%"
          height={compact ? 160 : 200}
          viewBox="0 0 330 200"
          preserveAspectRatio="xMidYMid meet"
        >
          {map.legs.map((l) =>
            l.coordinates ? (
              <Polyline
                key={l.id}
                points={l.coordinates
                  .map((p) => project(p[0], p[1]).join(","))
                  .join(" ")}
                stroke={c.link}
                strokeWidth={3}
                fill="none"
              />
            ) : null,
          )}
          {map.stops.map((s) =>
            s.lat !== null && s.lng !== null ? (
              <Circle
                key={s.locationId}
                cx={project(s.lng, s.lat)[0]}
                cy={project(s.lng, s.lat)[1]}
                r={5}
                fill={c.surfaceBrand}
              />
            ) : null,
          )}
          {map.position ? (
            <Circle
              cx={project(map.position.lng, map.position.lat)[0]}
              cy={project(map.position.lng, map.position.lat)[1]}
              r={8}
              fill={c.accent}
              stroke={c.textPrimary}
              strokeWidth={2}
            />
          ) : null}
        </Svg>
      </View>
      {compact ? null : (
        <Txt size={12}>Sơ đồ tọa độ, không phải bản đồ dẫn đường.</Txt>
      )}
      {bare ? null : (
        <Txt size={compact ? 12 : 17}>
          {map.position
            ? `${map.position.source === "GPS" ? "Vị trí GPS" : "Vị trí ước tính theo mốc"} · ${dateTime(map.position.asOf)}`
            : "Chưa có vị trí xe"}
        </Txt>
      )}
      {map.remainingKm !== null && !compact && !bare ? (
        <Txt>Còn {map.remainingKm.toLocaleString("vi-VN")} km</Txt>
      ) : null}
      {(compact || bare ? [] : map.warnings).map((warning, index) => (
        <Banner key={index} text={warning} warning />
      ))}
    </Card>
  );
}
export function Contact({
  name,
  phone,
}: {
  name: string;
  phone: string | null;
}) {
  const [error, setError] = useState("");
  return (
    <>
      <Txt bold>{name}</Txt>
      {phone ? (
        <Button
          title={`Gọi ${phone}`}
          kind="secondary"
          onPress={() => {
            void Linking.openURL(`tel:${phone.replace(/[^+\d]/g, "")}`).catch(
              () => setError("Thiết bị không hỗ trợ gọi điện."),
            );
          }}
        />
      ) : (
        <Txt>Chưa có số điện thoại.</Txt>
      )}
      {error ? <Banner text={error} warning /> : null}
    </>
  );
}
