import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile, unlink, readFile } from 'fs/promises';
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
export async function saveFile(file:Upload){const type=fileType(file);const key=randomUUID();await mkdir(directory(),{recursive:true});await writeFile(resolve(directory(),key),file.buffer,{flag:'wx'});return {key,type,name:basename(file.originalname).replace(/[\r\n\x00-\x1f]/g,'').slice(0,255)||'document',size:file.buffer.length};}
export async function removeFile(key:string){await unlink(resolve(directory(),key)).catch(()=>{});}
export async function loadFile(key:string){if(!/^[a-f0-9-]{36}$/.test(key))throw new BadRequestException('File cũ chưa được đưa vào kho tài liệu.');return readFile(resolve(directory(),key));}
