import { useEffect, useMemo, useRef } from 'react';

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Chọn/chụp tối đa 3 ảnh JPG/PNG ≤ 5 MB (khớp giới hạn backend). Ảnh chỉ giữ trong bộ nhớ, không lưu vào localStorage. */
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
    <div className="trk-photos">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        multiple
        hidden
        onChange={event => add(event.target.files)}
      />
      <button type="button" className="trk-secondary" disabled={disabled || files.length >= MAX_PHOTOS} onClick={() => input.current?.click()}>
        📷 Chụp / chọn ảnh ({files.length}/{MAX_PHOTOS})
      </button>
      {files.length > 0 && (
        <ul className="trk-photo-list">
          {files.map((file, index) => (
            <li key={file.name + index}>
              <img src={urls[index]} alt={file.name} />
              <button type="button" aria-label={`Bỏ ảnh ${file.name}`} disabled={disabled} onClick={() => onChange(files.filter((_, i) => i !== index))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
