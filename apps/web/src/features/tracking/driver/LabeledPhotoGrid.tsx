import { AutoComplete } from 'antd';
import PhotoPicker from './PhotoPicker';
import { CAPTION_SUGGESTIONS } from './driver-ui';

/** "4. Hình ảnh": PhotoPicker dạng ô lớn, mỗi ảnh một nhãn ngắn (gợi ý sẵn), nhãn đi theo đúng thứ tự ảnh. */
export default function LabeledPhotoGrid({ photos, captions, onChange, onError, disabled }: {
  photos: File[];
  captions: string[];
  onChange: (photos: File[], captions: string[]) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  return (
    <PhotoPicker
      variant="tiles" files={photos} onError={onError} disabled={disabled}
      onChange={next => onChange(next, next.map((_, index) => captions[index] ?? ''))}
      onRemove={index => onChange(photos.filter((_, i) => i !== index), captions.filter((_, i) => i !== index))}
      renderCaption={index => (
        <AutoComplete
          size="small" value={captions[index] ?? ''} disabled={disabled} placeholder="Nhãn ảnh" aria-label={`Nhãn ảnh ${index + 1}`}
          options={CAPTION_SUGGESTIONS.map(value => ({ value }))} maxLength={100}
          onChange={value => onChange(photos, photos.map((_, i) => (i === index ? value : captions[i] ?? '')))}
        />
      )}
    />
  );
}
