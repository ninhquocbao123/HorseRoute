import multer from 'multer';
import { MAX_FILE_SIZE } from '../documents/file-storage';

export const MAX_PHOTOS = 3;

// Ảnh hiện trường gửi cùng form (multipart, field `photos`); request JSON thuần vẫn đi qua bình thường.
// `fields`: form sự cố có tới 13 trường chữ (kể cả 3 nhãn ảnh `captions`).
export const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_PHOTOS, fields: 20, fieldSize: 4096 },
}).array('photos', MAX_PHOTOS);
