// Thu nhỏ ảnh trước khi tải lên, giống app mobile: cạnh dài tối đa 1600px, JPEG chất lượng 0.8.
// Ảnh chụp từ điện thoại thường 3-5 MB; sau khi thu nhỏ còn vài trăm KB nên lưu hồ sơ nhanh hơn nhiều.
export const PHOTO_MAX_SIDE = 1600;
const QUALITY = 0.8;
const SMALL_ENOUGH = 1024 * 1024;

export function fitWithin(width: number, height: number, max = PHOTO_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Trả về ảnh đã thu nhỏ; nếu không xử lý được hoặc không nhỏ hơn thì trả lại tệp gốc. */
export async function shrinkPhoto(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png'].includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const size = fitWithin(bitmap.width, bitmap.height);
      if (size.width === bitmap.width && size.height === bitmap.height && file.size <= SMALL_ENOUGH) return file;
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext('2d');
      if (!context) return file;
      // PNG trong suốt chuyển sang JPEG sẽ thành nền đen nếu không tô nền trắng trước.
      context.fillStyle = '#fff';
      context.fillRect(0, 0, size.width, size.height);
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      const blob = await new Promise<Blob | null>(done => canvas.toBlob(done, 'image/jpeg', QUALITY));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
