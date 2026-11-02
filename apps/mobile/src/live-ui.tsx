import React, { useState } from "react";
import { ActivityIndicator, Image, Linking, View } from "react-native";
import { Camera, ImagePlus } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import Svg, { Polyline, Circle } from "react-native-svg";
import { Banner, Button, Card, Section, Txt, useTheme } from "./ui";
import { useSession } from "./session";
import { API_URL, WEB_URL } from "./config";
import { dateTime } from "./live-domain";
import type { ITripMap } from "./api/types";
export function ResourceState({
  resource,
  empty,
  children,
}: {
  resource: {
    data?: unknown;
    loading: boolean;
    error: string;
    reload: () => void;
  };
  empty?: string;
  children: React.ReactNode;
}) {
  const { colors: c } = useTheme();
  if (resource.data === undefined)
    return resource.error ? (
      <Card>
        <Banner warning text={resource.error} />
        <Button title="Thử lại" onPress={resource.reload} />
      </Card>
    ) : (
      <View style={{ padding: 40, gap: 16 }}>
        <ActivityIndicator color={c.link} />
        <Txt>Đang tải dữ liệu…</Txt>
      </View>
    );
  return (
    <>
      {resource.error ? (
        <Banner
          warning
          text={`Chưa cập nhật được dữ liệu mới: ${resource.error}`}
          onPress={resource.reload}
        />
      ) : null}
      {empty ? (
        <Card>
          <Txt size={24} bold>
            {empty}
          </Txt>
          <Button title="Tải lại" kind="secondary" onPress={resource.reload} />
        </Card>
      ) : (
        children
      )}
    </>
  );
}
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <Card>
      <Txt size={24} bold>
        {title}
      </Txt>
      {detail ? <Txt>{detail}</Txt> : null}
    </Card>
  );
}
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
  const url = `${WEB_URL}/dashboard?view=${documents ? "documents" : "orders"}${orderId ? `&order=${encodeURIComponent(orderId)}` : ""}`;
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
}: {
  path: string;
  caption?: string;
}) {
  const { token } = useSession();
  const [failed, setFailed] = useState(false);
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
        style={{ width: "100%", height: 230, borderRadius: 16 }}
      />
      {caption ? <Txt size={12}>{caption}</Txt> : null}
    </View>
  );
}
export function PhotoPicker({
  uri,
  onChange,
}: {
  uri: string;
  onChange: (uri: string) => void;
}) {
  const [error, setError] = useState("");
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
        setError(
          "Chưa có quyền camera. Bạn có thể chọn ảnh từ thư viện hoặc mở Cài đặt.",
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
      onChange(photo.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không mở được ảnh.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Section title="Ảnh báo cáo" />
      {uri ? (
        <Image
          source={{ uri }}
          accessibilityLabel="Ảnh sắp gửi"
          style={{ width: "100%", height: 200, borderRadius: 16 }}
        />
      ) : null}
      <Button
        title="Chụp ảnh"
        kind="secondary"
        icon={Camera}
        disabled={busy}
        onPress={() => void pick(true)}
      />
      <Button
        title="Chọn ảnh từ thư viện"
        kind="secondary"
        icon={ImagePlus}
        disabled={busy}
        onPress={() => void pick(false)}
      />
      {error ? (
        <>
          <Banner warning text={error} />
          <Button
            title="Mở Cài đặt quyền"
            kind="secondary"
            onPress={() => {
              void Linking.openSettings().catch(() =>
                setError("Mở Cài đặt Android → Ứng dụng → HorseRoute → Quyền."),
              );
            }}
          />
        </>
      ) : null}
    </>
  );
}
export function appendPhoto(form: FormData, uri: string, field = "photos") {
  if (uri)
    form.append(field, {
      uri,
      name: `photo-${Date.now()}.jpg`,
      type: "image/jpeg",
    } as unknown as Blob);
}
export function RouteMap({ map }: { map: ITripMap }) {
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
      <Txt bold>Tuyến từ dữ liệu hành trình</Txt>
      <View
        accessible
        accessibilityLabel={`Sơ đồ ${map.stops.map((s) => s.name).join(" → ")}`}
        style={{ backgroundColor: c.surfaceMuted, borderRadius: 12 }}
      >
        <Svg width="100%" height={200} viewBox="0 0 330 200">
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
      <Txt size={12}>Sơ đồ tọa độ, không phải bản đồ dẫn đường.</Txt>
      <Txt>
        {map.position
          ? `${map.position.source === "GPS" ? "Vị trí GPS" : "Vị trí ước tính theo mốc"} · ${dateTime(map.position.asOf)}`
          : "Chưa có vị trí xe"}
      </Txt>
      {map.remainingKm !== null ? (
        <Txt>Còn {map.remainingKm.toLocaleString("vi-VN")} km</Txt>
      ) : null}
      {map.warnings.map((warning, index) => (
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
