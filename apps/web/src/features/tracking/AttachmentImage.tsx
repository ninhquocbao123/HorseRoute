import { useEffect, useState } from 'react';
import { trackingApi } from './tracking.api';

/** Ảnh đính kèm cần token nên tải bằng axios rồi hiển thị qua object URL. */
export default function AttachmentImage({ id, name }: { id: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    trackingApi
      .attachmentBlob(id)
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (failed) return <span className="trk-thumb is-missing" title={name}>Không tải được ảnh</span>;
  return url ? <img className="trk-thumb" src={url} alt={name} /> : <span className="trk-thumb is-loading" aria-label="Đang tải ảnh" />;
}
