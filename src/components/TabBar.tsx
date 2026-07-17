import { NavLink, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/', label: '首页', icon: '🏠', end: true },
  { to: '/books', label: '圣经', icon: '📖' },
  { to: '/search', label: '搜索', icon: '🔍' },
  { to: '/plans', label: '计划', icon: '🗓️' },
  { to: '/notes', label: '笔记', icon: '✏️' },
  { to: '/ask', label: '问AI', icon: '💬' },
];

/** 底部主导航；阅读页（/books/:bookId/:chapter）隐藏以专注阅读 */
export default function TabBar() {
  const { pathname } = useLocation();
  if (/^\/books\/[^/]+\/\d+/.test(pathname)) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
      <div className="mx-auto flex max-w-lg">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition ${
                isActive ? 'font-semibold text-indigo-700 dark:text-indigo-300' : 'text-stone-400 dark:text-stone-500'
              }`
            }
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
