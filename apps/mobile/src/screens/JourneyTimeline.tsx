import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Check } from "lucide-react-native";
import type { IOrderTimeline } from "../../../../packages/shared/src/types/tracking.type";
import { Txt, useTheme } from "../ui";
import { ImageViewer, PhotoThumb, type ViewerPhoto } from "../image-viewer";
import { JOURNEY_STEPS, journeyEvents, journeyStep, upcomingStops, type JourneyPhoto } from "../journey";

const pad = (n: number) => String(n).padStart(2, "0");
/** Cột giờ bên trái như web: "Hôm nay / 14:22", "Hôm qua", "28/10". */
function when(iso: string, now = Date.now()) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return { day: "", time: "--:--" };
  const today = new Date(now).toDateString() === d.toDateString();
  const yesterday = new Date(now - 86_400_000).toDateString() === d.toDateString();
  return {
    day: today ? "Hôm nay" : yesterday ? "Hôm qua" : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * Timeline hành trình của khách (mục 7), cùng thứ tự và câu chữ với web: mốc mới nhất trên cùng, nổi bật;
 * mốc cũ màu xám; điểm sắp tới viền nét đứt ở khối riêng. Mỗi mốc có giờ check-in và ảnh chụp sau mốc đó,
 * bấm ảnh mở trình xem toàn màn hình. Màn gọi tải lại khi có socket nên không cần kéo để cập nhật.
 */
export function JourneyTimeline({ timeline, photos }: { timeline: IOrderTimeline; photos: JourneyPhoto[] }) {
  const { colors: c } = useTheme();
  const events = useMemo(() => journeyEvents(timeline, photos), [timeline, photos]);
  const upcoming = useMemo(() => (timeline.orderStatus === "DELIVERED" ? [] : upcomingStops(timeline)), [timeline]);
  const step = journeyStep(timeline);
  const viewerPhotos: ViewerPhoto[] = useMemo(
    () =>
      events.flatMap((e) =>
        e.photos.map((p) => ({
          key: p.id,
          path: `/tracking/attachments/${encodeURIComponent(p.id)}`,
          caption: p.caption ? `${e.title} · ${p.caption}` : e.title,
          takenAt: p.at,
          place: p.place,
        })),
      ),
    [events],
  );
  const [open, setOpen] = useState<number | null>(null);
  let photoIndex = 0;
  return (
    <View style={{ gap: 16 }}>
      {/* Thanh 5 bước như web */}
      <View accessibilityRole="progressbar" accessibilityLabel={`Bước ${step + 1}/5: ${JOURNEY_STEPS[step]}`} style={{ flexDirection: "row", gap: 4 }}>
        {JOURNEY_STEPS.map((label, i) => (
          <View key={label} style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: i <= step ? c.surfaceBrand : c.border }} />
            <Txt size={12} bold={i === step} color={i === step ? c.textPrimary : c.textSecondary} numberOfLines={2}>
              {label}
            </Txt>
          </View>
        ))}
      </View>

      {upcoming.length ? (
        <View style={{ gap: 8 }}>
          <Txt size={15} bold color={c.textSecondary}>
            Sắp tới
          </Txt>
          {[...upcoming].reverse().map((u) => (
            <View key={u.key} style={{ flexDirection: "row", gap: 12, alignItems: "center" }} accessibilityLabel={`Chưa tới: ${u.name}`}>
              <View style={{ width: 56 }}>
                <Txt size={12} color={c.textSecondary}>
                  {u.plannedAt ? `dự kiến ${when(u.plannedAt).time}` : ""}
                </Txt>
              </View>
              <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderStyle: "dashed", borderColor: c.borderInput }} />
              <Txt size={15} color={c.textSecondary} style={{ flex: 1 }} numberOfLines={2}>
                {u.name}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}

      {events.length === 0 ? (
        <Txt size={15} color={c.textSecondary}>
          Chuyến đã sẵn sàng. Các mốc sẽ hiện ở đây ngay khi tài xế cập nhật.
        </Txt>
      ) : (
        <View>
          {events.map((e, i) => {
            const latest = i === 0;
            const w = when(e.at);
            const first = photoIndex;
            photoIndex += e.photos.length;
            return (
              <View key={e.key} style={{ flexDirection: "row", gap: 12 }} accessibilityLabel={`${latest ? "Mốc mới nhất. " : ""}${w.day} ${w.time}. ${e.title}`}>
                <View style={{ width: 56, paddingTop: 2 }}>
                  <Txt size={12} bold={latest} color={latest ? c.textPrimary : c.textSecondary}>
                    {w.day}
                  </Txt>
                  <Txt size={15} bold={latest} color={latest ? c.textPrimary : c.textSecondary}>
                    {w.time}
                  </Txt>
                </View>
                <View style={{ width: 20, alignItems: "center" }}>
                  <View
                    style={{
                      width: latest ? 20 : 12,
                      height: latest ? 20 : 12,
                      marginTop: latest ? 2 : 6,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: latest ? c.accent : c.border,
                      borderWidth: latest ? 3 : 0,
                      borderColor: c.surfaceBrand,
                    }}
                  >
                    {latest ? <Check size={10} color={c.surfaceBrand} strokeWidth={4} /> : null}
                  </View>
                  {i < events.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: c.border }} /> : null}
                </View>
                <View
                  style={{
                    flex: 1,
                    gap: 4,
                    marginBottom: 16,
                    ...(latest ? { padding: 12, borderRadius: 12, backgroundColor: c.infoBg, borderWidth: 1, borderColor: c.surfaceBrandAlt } : {}),
                  }}
                >
                  <Txt size={latest ? 17 : 15} bold={latest} color={latest ? c.textPrimary : c.textSecondary}>
                    {e.title}
                  </Txt>
                  {e.detail ? (
                    <Txt size={12} color={c.textSecondary}>
                      {e.detail}
                    </Txt>
                  ) : null}
                  {e.photos.length ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                      {e.photos.map((p, k) => (
                        <PhotoThumb key={p.id} size={64} photo={viewerPhotos[first + k]} onPress={() => setOpen(first + k)} />
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
      <ImageViewer photos={viewerPhotos} index={open} onClose={() => setOpen(null)} />
    </View>
  );
}
