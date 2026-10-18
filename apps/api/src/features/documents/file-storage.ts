import { Logger } from '../../shared/utils/logger.util';
import { BadRequestException, NotFoundException } from '../../shared/core/error.response';
import { storageClient, unavailable } from './supabase-storage';
import { randomUUID } from 'crypto';
import { mkdir, writeFile, unlink, readFile, lstat } from 'fs/promises';
import { resolve, basename } from 'path';
export type Upload={buffer:Buffer;originalname:string;size:number};
export const MAX_FILE_SIZE=5*1024*1024;
export function fileType(file:Upload){
 if(!file?.buffer?.length||file.buffer.length>MAX_FILE_SIZE)throw new BadRequestException('Chọn file PDF/JPG/PNG, tối đa 5 MB.');
 const b=file.buffer;
 if(b.subarray(0,5).toString()==='%PDF-')return 'PDF';
 if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'PNG';
 if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'JPG';
 throw new BadRequestException('Nội dung file không phải PDF/JPG/PNG được hỗ trợ.');
}
const directory=()=>resolve(process.env.DOCUMENT_STORAGE_DIR||'var/private-documents');
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const bucketPattern = /^[a-z0-9][a-z0-9_-]{0,62}$/;
const logger = new Logger('DocumentStorage');

function location(key: string) {
 if (uuidPattern.test(key)) return { object: key, bucket: null };
 const match = /^supabase:([^/]+)\/([^/]+)$/.exec(key);
 if (match && bucketPattern.test(match[1]) && uuidPattern.test(match[2])) {
  return { bucket: match[1], object: match[2] };
 }
 throw new BadRequestException('File cũ chưa được đưa vào kho tài liệu.');
}

export async function saveFile(file: Upload) {
 const type = fileType(file);
 const object = randomUUID();
 let key = object;
 const provider = process.env.DOCUMENT_STORAGE_PROVIDER || 'local';
 if (provider === 'supabase') {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'wdp-documents';
  if (!bucketPattern.test(bucket)) throw unavailable();
  try {
   const storage = storageClient();
   const info = await storage.getBucket(bucket);
   // Server keys bypass RLS: reject public buckets for sensitive documents.
   if (info.error || !info.data || info.data.public !== false) throw unavailable();
   const result = await storage.from(bucket).upload(object, file.buffer, {
    contentType: { PDF: 'application/pdf', PNG: 'image/png', JPG: 'image/jpeg' }[type],
    upsert: false,
   });
   if (result.error) throw unavailable();
   key = `supabase:${bucket}/${object}`;
  } catch { throw unavailable(); }
 } else if (provider === 'local') {
  await mkdir(directory(), { recursive: true });
  await writeFile(resolve(directory(), object), file.buffer, { flag: 'wx' });
 } else { throw unavailable(); }
 return { key, type, name: basename(file.originalname).replace(/[\r\n\x00-\x1f]/g, '').slice(0,255) || 'document', size: file.buffer.length };
}

// Do not hide a failed DB transaction if rollback cleanup also fails.
export async function removeFile(key: string) {
 try {
  const target = location(key);
  if (target.bucket) {
   const result = await storageClient().from(target.bucket).remove([target.object]);
   if (result.error) throw unavailable();
  } else { await unlink(resolve(directory(), target.object)); }
 } catch { logger.warn(`Không dọn được file sau thao tác thất bại: ${uuidPattern.test(key) || /^supabase:[a-z0-9_-]+\/[a-f0-9-]+$/.test(key) ? key : 'invalid key'}`); }
}

export async function loadFile(key: string) {
 const target = location(key);
 if (!target.bucket) {
  try { return await readFile(resolve(directory(), target.object)); }
  catch (error) {
   if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundException('File không có trong kho tài liệu hiện tại.');
   throw unavailable();
  }
 }
 try {
  const { data, error } = await storageClient().from(target.bucket).download(target.object);
  if (error || !data || data.size > MAX_FILE_SIZE) throw unavailable();
  return Buffer.from(await data.arrayBuffer());
 } catch { throw unavailable(); }
}


// Metadata only: never download document contents for readiness.
export async function verifyStoredFile(key: string, expectedSize: string): Promise<boolean> {
 try {
  if (!/^[1-9]\d*$/.test(expectedSize)) return false;
  const target = location(key);
  if (!target.bucket) {
   const info = await lstat(resolve(directory(), target.object), { bigint: true });
   return info.isFile() && info.size.toString() === expectedSize;
  }
  const storage = storageClient();
  const bucket = await storage.getBucket(target.bucket);
  if (bucket.error || bucket.data?.public !== false) return false;
  const result = await storage.from(target.bucket).info(target.object);
  return !result.error && String(result.data?.size) === expectedSize;
 } catch { return false; }
}
