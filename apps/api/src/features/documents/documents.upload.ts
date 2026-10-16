import multer from 'multer';
import { MAX_FILE_SIZE } from './file-storage';
export const uploadDocument = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 5, fieldSize: 2048 } }).single('file');

