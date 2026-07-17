import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** 通用底部弹出层（移动端友好的 action sheet 形态） */
export default function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 pb-8 shadow-xl dark:bg-stone-900 sm:rounded-2xl">
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-800 dark:text-stone-100">{title}</h3>
            <button onClick={onClose} className="rounded-full p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800" aria-label="关闭">
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
