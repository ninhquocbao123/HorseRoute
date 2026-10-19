import { useEffect, useRef, type ReactNode } from 'react';

/** Hộp thoại modal dạng "sheet" (trượt từ dưới lên trên điện thoại), dùng thẻ <dialog> như ConfirmDialog. */
export default function Sheet({ title, caption, onClose, children, danger = false }: {
  title: string;
  caption?: string;
  onClose: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={'trk-sheet' + (danger ? ' is-danger' : '')}
      aria-labelledby="trk-sheet-title"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="trk-sheet-head">
        <div>
          {caption && <span className="trk-caption">{caption}</span>}
          <h2 id="trk-sheet-title">{title}</h2>
        </div>
        <button type="button" className="trk-icon-button" aria-label="Đóng" onClick={onClose}>
          ✕
        </button>
      </header>
      <div className="trk-sheet-body">{children}</div>
    </dialog>
  );
}
