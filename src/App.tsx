import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import TabBar from './components/TabBar';
import { SettingsProvider } from './lib/settings';
import AskPage from './pages/AskPage';
import BooksPage from './pages/BooksPage';
import ChaptersPage from './pages/ChaptersPage';
import HomePage from './pages/HomePage';
import NotesPage from './pages/NotesPage';
import PlansPage from './pages/PlansPage';
import ReadPage from './pages/ReadPage';
import SearchPage from './pages/SearchPage';

/**
 * 路由结构（HashRouter：适配静态托管与微信内置浏览器）
 *  /                       首页（金句 + 今日任务 + 入口）
 *  /books                  卷列表（旧约/新约）
 *  /books/:bookId          章选择
 *  /books/:bookId/:chapter 经文阅读
 *  /search                 全文搜索
 *  /plans                  读经计划 + 打卡
 *  /notes                  笔记与书签
 *  /ask                    AI 灵修问答
 */
export default function App() {
  return (
    <SettingsProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/books" element={<BooksPage />} />
          <Route path="/books/:bookId" element={<ChaptersPage />} />
          <Route path="/books/:bookId/:chapter" element={<ReadPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/ask" element={<AskPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <TabBar />
      </HashRouter>
    </SettingsProvider>
  );
}
