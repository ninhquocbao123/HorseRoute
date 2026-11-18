/**
 * Khu "Ảnh trong chuyến" trên app (hộ tống, khách hàng): mọi ảnh chăm sóc của chuyến ở một chỗ, không chia theo ngựa.
 * Một lần ghi cho nhiều con chỉ hiện một ảnh, chú thích ghi tên các con (careGallery dùng chung với web).
 */
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { careGallery } from "../../../../packages/shared/src/care-gallery";
import type { ICareActivity } from "../../../../packages/shared/src/types/tracking.type";
import { Card, Section, Txt, s, useTheme } from "../ui";
import { ImageViewer, PhotoThumb, type ViewerPhoto } from "../image-viewer";
import { asId, label } from "../live-domain";

// Giờ phút; khác ngày hôm nay thì kèm dd/mm (cùng kiểu với lịch trình).
const clock = (iso: string) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "--:--";
  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return time;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${time} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

/** Bấm ảnh mở trình xem toàn màn hình (mục 3). `placeOf`: tên chặng/mốc theo legId nếu màn gọi có dữ liệu. */
export function CareGalleryCard({
  activities,
  placeOf,
}: {
  activities: ICareActivity[];
  placeOf?: (legId: string | null) => string | null;
}) {
  const { colors: c } = useTheme();
  const items = useMemo(() => careGallery(activities), [activities]);
  const [open, setOpen] = useState<number | null>(null);
  const legOf = useMemo(() => {
    const byPhoto = new Map<string, string | null>();
    for (const a of activities) for (const p of a.photos) byPhoto.set(p.id, a.legId);
    return byPhoto;
  }, [activities]);
  const photos: ViewerPhoto[] = items.map((item) => ({
    key: item.photo.id,
    path: `/tracking/attachments/${asId(item.photo.id)}`,
    caption: `${label(item.activityType)} · ${item.horseNames.length ? item.horseNames.join(", ") : "Cả đoàn"} · ${item.createdByName}`,
    takenAt: item.photo.uploadedAt || item.performedAt,
    place: placeOf?.(legOf.get(item.photo.id) ?? null) ?? null,
  }));
  if (!items.length) return null;
  return (
    <>
      <Section title={`Ảnh trong chuyến · ${items.length}`} />
      <Card>
        <View style={s.wrap}>
          {items.map((item, index) => (
            <View key={item.photo.id} style={{ width: 104, gap: 4 }}>
              <PhotoThumb photo={photos[index]} size={104} onPress={() => setOpen(index)} />
              <Txt size={12} color={c.textSecondary} numberOfLines={3}>
                {`${label(item.activityType)} · ${item.horseNames.length ? item.horseNames.join(", ") : "Cả đoàn"} · ${clock(item.performedAt)}`}
              </Txt>
            </View>
          ))}
        </View>
      </Card>
      <ImageViewer photos={photos} index={open} onClose={() => setOpen(null)} />
    </>
  );
}
