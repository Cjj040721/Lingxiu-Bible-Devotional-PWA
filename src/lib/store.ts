/** 通用 localStorage 响应式存储（供计划/笔记/书签/对话记录使用） */
import { useSyncExternalStore } from 'react';

export interface LocalStore<T> {
  get: () => T;
  set: (v: T) => void;
  update: (fn: (v: T) => T) => void;
  subscribe: (l: () => void) => () => void;
}

export function createLocalStore<T>(key: string, defaultValue: T): LocalStore<T> {
  const read = (): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...defaultValue, ...(JSON.parse(raw) as T) } : defaultValue;
    } catch {
      return defaultValue;
    }
  };
  let state = read();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  return {
    get: () => state,
    set: (v) => {
      state = v;
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* 存储已满等情况静默失败 */
      }
      notify();
    },
    update(fn) {
      this.set(fn(state));
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export function useStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}
