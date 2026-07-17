/**
 * 阅读设置（字号档位 / 夜间模式），localStorage 持久化。
 * 后续可在此扩展：当前读经计划、阅读进度等。
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export const FONT_SIZES = [16, 18, 21, 24] as const; // 四档字号（px）
export const FONT_SIZE_LABELS = ['小', '标准', '大', '特大'] as const;

export interface Settings {
  fontSizeLevel: number; // 0-3
  nightMode: boolean;
}

const STORAGE_KEY = 'lingxiu-bandu.settings.v1';
const DEFAULT_SETTINGS: Settings = { fontSizeLevel: 1, nightMode: false };

function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      fontSizeLevel:
        typeof parsed.fontSizeLevel === 'number' && parsed.fontSizeLevel >= 0 && parsed.fontSizeLevel < FONT_SIZES.length
          ? parsed.fontSizeLevel
          : DEFAULT_SETTINGS.fontSizeLevel,
      nightMode: parsed.nightMode === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SettingsContextValue {
  settings: Settings;
  setFontSizeLevel: (level: number) => void;
  toggleNightMode: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(readSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.classList.toggle('dark', settings.nightMode);
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      setFontSizeLevel: (level) =>
        setSettings((s) => ({ ...s, fontSizeLevel: Math.max(0, Math.min(FONT_SIZES.length - 1, level)) })),
      toggleNightMode: () => setSettings((s) => ({ ...s, nightMode: !s.nightMode })),
    }),
    [settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings 必须在 SettingsProvider 内使用');
  return ctx;
}
