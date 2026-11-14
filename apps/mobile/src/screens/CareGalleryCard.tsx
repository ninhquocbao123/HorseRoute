/**
 * Khu "Ảnh trong chuyến" trên app (hộ tống, khách hàng): mọi ảnh chăm sóc của chuyến ở một chỗ, không chia theo ngựa.
 * Một lần ghi cho nhiều con chỉ hiện một ảnh, chú thích ghi tên các con (careGallery dùng chung với web).
 */
import React, { useMemo } from "react";
import { View } from "react-native";
import { careGallery } from "../../../../packages/shared/src/care-gallery";
import type { ICareActivity } from "../../../../packages/shared/src/types/tracking.type";
import { Card, Section, Txt, s, useTheme } from "../ui";
import { PrivateImage } from "../live-ui";
import { asId, label } from "../live-domain";

const clock = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
    : "--:--";
};

export function CareGalleryCard({ activities }: { activities: ICareActivity[] }) {
  const { colors: c } = useTheme();
  const items = useMemo(() => careGallery(activities), [activities]);
  if (!items.length) return null;
  return (
    <>
      <Section title={`Ảnh trong chuyến · ${items.length}`} />
      <Card>
        <View style={s.wrap}>
          {items.map((item) => (
            <View key={item.photo.id} style={{ width: 104, gap: 4 }}>
              <PrivateImage
                path={`/tracking/attachments/${asId(item.photo.id)}`}
                caption={item.photo.originalName}
                size={104}
              />
              <Txt size={12} color={c.textSecondary} numberOfLines={3}>
                {`${label(item.activityType)} · ${item.horseNames.length ? item.horseNames.join(", ") : "Cả đoàn"} · ${clock(item.performedAt)}`}
              </Txt>
            </View>
          ))}
        </View>
      </Card>
    </>
  );
}
