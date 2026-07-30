import { useState } from 'react';
import Modal from './Modal';
import { addBookmark, addNote, refText, type VerseRef } from '../lib/marks';

export interface SelectedVerse extends VerseRef {
  text: string;
}

interface Props {
  verse: SelectedVerse | null;
  /** 该节的逐节注解（无数据时为 null） */
  note?: string | null;
  onClose: () => void;
  onShareCard: (v: SelectedVerse) => void;
}

/** 点击经文后的操作菜单：逐节注解 / 复制（带出处）/ 书签 / 写笔记 / 分享卡片 */
export default function VerseActionSheet({ verse, note, onClose, onShareCard }: Props) {
  const [mode, setMode] = useState<'menu' | 'note'>('menu');
  const [noteText, setNoteText] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  if (!verse) return null;
  const ref = refText(verse);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
      handleClose();
    }, 900);
  };

  const handleClose = () => {
    setMode('menu');
    setNoteText('');
    onClose();
  };

  const copyVerse = async () => {
    const content = `${verse.text} ——${ref}（和合本）`;
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    notify('已复制');
  };

  const saveBookmark = () => {
    addBookmark({ ...verse, verseText: verse.text });
    notify('已加入书签');
  };

  const saveNote = () => {
    if (!noteText.trim()) return;
    addNote({ ...verse, verseText: verse.text, note: noteText.trim() });
    notify('笔记已保存');
  };

  return (
    <Modal open onClose={handleClose} title={mode === 'menu' ? ref : `笔记 · ${ref}`}>
      {toast ? (
        <div className="py-6 text-center text-base font-medium text-indigo-700 dark:text-indigo-300">{toast} ✓</div>
      ) : mode === 'menu' ? (
        <div>
          <p className="font-scripture mb-3 text-[15px] leading-7 text-stone-700 dark:text-stone-300">{verse.text}</p>
          {/* 逐节注解（点击哪节看哪节） */}
          <div className="mb-5 rounded-xl border-l-2 border-indigo-200 bg-stone-100/70 px-3 py-2.5 dark:border-indigo-800 dark:bg-stone-900/60">
            <div className="text-xs font-semibold text-indigo-500 dark:text-indigo-400">📜 本节注解</div>
            <p className="mt-1 max-h-48 overflow-y-auto text-sm leading-6 text-stone-600 dark:text-stone-300">
              {note ?? '本卷暂无逐节注解，可查看页面底部的「本章注解」。'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Action onClick={copyVerse} icon="📋" label="复制经文" />
            <Action onClick={saveBookmark} icon="🔖" label="加书签" />
            <Action onClick={() => setMode('note')} icon="✏️" label="写笔记" />
            <Action
              onClick={() => {
                onShareCard(verse);
                handleClose();
              }}
              icon="🖼️"
              label="分享卡片"
            />
          </div>
        </div>
      ) : (
        <div>
          <p className="font-scripture mb-3 border-l-2 border-indigo-300 pl-3 text-sm leading-6 text-stone-500 dark:text-stone-400">
            {verse.text}
          </p>
          <textarea
            autoFocus
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="写下你的领受…"
            rows={4}
            className="w-full rounded-xl border border-stone-300 bg-transparent p-3 text-[15px] text-stone-800 outline-none focus:border-indigo-400 dark:border-stone-700 dark:text-stone-100"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setMode('menu')}
              className="flex-1 rounded-xl border border-stone-300 py-2.5 text-sm text-stone-600 dark:border-stone-700 dark:text-stone-300"
            >
              返回
            </button>
            <button
              onClick={saveNote}
              disabled={!noteText.trim()}
              className="flex-1 rounded-xl bg-indigo-700 py-2.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-indigo-600"
            >
              保存笔记
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Action({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 transition active:scale-[0.97] dark:border-stone-700 dark:text-stone-200"
    >
      <span className="text-lg">{icon}</span>
      {label}
    </button>
  );
}
