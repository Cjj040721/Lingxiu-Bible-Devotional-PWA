import { useEffect, useState } from 'react';
import Modal from './Modal';
import { CARD_THEMES, downloadCanvas, renderVerseCard } from '../lib/card';

interface Props {
  text: string;
  refLabel: string;
  onClose: () => void;
}

/** 金句卡片预览弹窗：模板切换 + 保存 PNG */
export default function VerseCardModal({ text, refLabel, onClose }: Props) {
  const [themeId, setThemeId] = useState(CARD_THEMES[0].id);
  const [img, setImg] = useState<string | null>(null);
  const theme = CARD_THEMES.find((t) => t.id === themeId) ?? CARD_THEMES[0];

  useEffect(() => {
    // 等字体就绪后渲染，避免衬线字体未加载
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      const canvas = renderVerseCard(theme, { text, ref: refLabel });
      setImg(canvas.toDataURL('image/png'));
    };
    if (document.fonts?.ready) document.fonts.ready.then(render);
    else render();
    return () => {
      cancelled = true;
    };
  }, [theme, text, refLabel]);

  return (
    <Modal open onClose={onClose} title="分享卡片">
      <div className="flex justify-center gap-2 pb-3">
        {CARD_THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setThemeId(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              t.id === themeId
                ? 'bg-indigo-700 text-white dark:bg-indigo-600'
                : 'border border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-300'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      {img ? (
        <img src={img} alt={`${refLabel} 分享卡片`} className="mx-auto w-full max-w-xs rounded-xl shadow-lg" />
      ) : (
        <div className="py-16 text-center text-sm text-stone-400">正在生成卡片…</div>
      )}
      <button
        onClick={() => {
          const canvas = renderVerseCard(theme, { text, ref: refLabel });
          downloadCanvas(canvas, `${refLabel.replace(/\s+/g, '')}-灵修伴读.png`);
        }}
        className="mt-4 w-full rounded-xl bg-indigo-700 py-3 text-sm font-medium text-white transition active:scale-[0.98] dark:bg-indigo-600"
      >
        保存图片
      </button>
      <p className="mt-2 text-center text-xs text-stone-400">微信内可长按图片保存/分享</p>
    </Modal>
  );
}
