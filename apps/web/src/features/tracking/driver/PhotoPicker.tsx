import { useEffect, useMemo, useRef } from 'react';
import { Button } from 'antd';
import { CloseOutlined, PictureOutlined } from '@ant-design/icons';

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Chọn tối đa 3 ảnh JPG/PNG ≤ 5 MB (khớp giới hạn backend). Ảnh chỉ giữ trong bộ nhớ, không lưu vào localStorage. */
export default function PhotoPicker({ files, onChange, onError, disabled }: {
  files: File[];
  onChange: (files: File[]) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map(file => URL.createObjectURL(file)), [files]);
  useEffect(() => () => urls.forEach(url => URL.revokeObjectURL(url)), [urls]);

  function add(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        onError('Chỉ nhận ảnh JPG hoặc PNG.');
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        onError(`Ảnh "${file.name}" lớn hơn 5 MB.`);
        continue;
      }
      if (next.length >= MAX_PHOTOS) {
        onError(`Tối đa ${MAX_PHOTOS} ảnh.`);
        break;
      }
      next.push(file);
    }
    onChange(next);
    if (input.current) input.current.value = '';
  }

  return (
    <div className="drv-photos">
      <input ref={input} type="file" accept="image/jpeg,image/png" multiple hidden onChange={event => add(event.target.files)} />
      <div className="drv-photos-row">
        {files.map((file, index) => (
          <figure key={file.name + index} className="drv-photo">
            <img src={urls[index]} alt={file.name} />
            <Button size="small" shape="circle" danger icon={<CloseOutlined />} aria-label={`Bỏ ảnh ${file.name}`} disabled={disabled}
              onClick={() => onChange(files.filter((_, i) => i !== index))} />
          </figure>
        ))}
        {files.length < MAX_PHOTOS && (
          <Button className="drv-photo-add" icon={<PictureOutlined />} disabled={disabled} onClick={() => input.current?.click()}>
            Thêm ảnh ({files.length}/{MAX_PHOTOS})
          </Button>
        )}
      </div>
      <span className="drv-muted">JPG hoặc PNG, tối đa {MAX_PHOTOS} ảnh, mỗi ảnh ≤ 5 MB.</span>
    </div>
  );
}
