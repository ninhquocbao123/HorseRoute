import type { ICareActivity, ILogAttachment } from './types/tracking.type';

/** Một ảnh trong khu "Ảnh trong chuyến": ảnh chung, không gắn với riêng một con ngựa. */
export interface ICareGalleryItem {
  photo: ILogAttachment;
  activityType: ICareActivity['activityType'];
  performedAt: string;
  /** Các con ngựa trong lần ghi có ảnh này; rỗng = cả đoàn */
  horseNames: string[];
  createdByName: string;
}

/** Hai bản tải lên trong cùng một lần ghi cách nhau tối đa chừng này (mỗi con một yêu cầu, gửi liền nhau). */
const SAME_BATCH_MS = 2 * 60_000;

/**
 * Gom ảnh chăm sóc của cả chuyến thành một khu ảnh chung (mới nhất trước).
 * Hộ tống ghi một hoạt động cho nhiều con thì cùng một tấm ảnh được lưu lại cho từng con; ở đây gộp các bản đó
 * (cùng tên tệp, cùng dung lượng, cùng người ghi, tải lên gần nhau) thành một ảnh, chú thích ghi đủ tên các con.
 * Bản đã được đính chính thì lấy ảnh của bản đính chính.
 */
export function careGallery(activities: ICareActivity[]): ICareGalleryItem[] {
  const corrected = new Set(activities.map(activity => activity.correctsActivityId).filter(Boolean));
  const sorted = [...activities].sort((a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt));
  const items: (ICareGalleryItem & { createdBy: string })[] = [];
  for (const activity of sorted) {
    if (corrected.has(activity.id)) continue;
    for (const photo of activity.photos) {
      const same = items.find(item => item.createdBy === activity.createdBy && item.photo.originalName === photo.originalName
        && item.photo.sizeBytes === photo.sizeBytes && Math.abs(Date.parse(item.photo.uploadedAt) - Date.parse(photo.uploadedAt)) <= SAME_BATCH_MS);
      if (same) {
        if (activity.horseName && !same.horseNames.includes(activity.horseName)) same.horseNames.push(activity.horseName);
        continue;
      }
      items.push({ photo, activityType: activity.activityType, performedAt: activity.performedAt,
        horseNames: activity.horseName ? [activity.horseName] : [], createdByName: activity.createdByName, createdBy: activity.createdBy });
    }
  }
  return items.map(({ createdBy: _createdBy, ...item }) => item);
}
