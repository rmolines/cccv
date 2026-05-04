import { create } from 'zustand';
import type { Injection, Snapshot } from '@cccv/shared';

type ViewMode = 'rendered' | 'source';
export type Tab = 'project' | 'global' | 'runtime';

/**
 * What the user has currently picked. Three shapes because the three tabs
 * key on different things — the directory tabs key on a canonical relPath
 * (or a neighbor's absolute path), and Runtime keys on injection IDs.
 */
export type Selection =
  | { kind: 'canonical'; tab: 'project' | 'global'; relPath: string }
  | { kind: 'neighbor'; tab: 'project' | 'global'; path: string }
  | { kind: 'injection'; id: string }
  | null;

const STORAGE_KEY = 'cccv:ui-state:v2';

type Persisted = {
  tab: Tab;
  selectionByTab: Record<Tab, Selection>;
  viewMode: ViewMode;
};

function loadPersisted(): Persisted {
  if (typeof window === 'undefined') {
    return { tab: 'project', selectionByTab: { project: null, global: null, runtime: null }, viewMode: 'rendered' };
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('miss');
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      tab: parsed.tab ?? 'project',
      selectionByTab: parsed.selectionByTab ?? { project: null, global: null, runtime: null },
      viewMode: parsed.viewMode ?? 'rendered',
    };
  } catch {
    return { tab: 'project', selectionByTab: { project: null, global: null, runtime: null }, viewMode: 'rendered' };
  }
}

function savePersisted(p: Persisted): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore quota / private mode failures
  }
}

type State = {
  snapshot: Snapshot | null;
  loading: boolean;
  error: string | null;
  tab: Tab;
  /** Per-tab selection so switching tabs restores the user's spot. */
  selectionByTab: Record<Tab, Selection>;
  viewMode: ViewMode;
  setSnapshot: (s: Snapshot) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
  setTab: (t: Tab) => void;
  select: (sel: Selection) => void;
  setViewMode: (m: ViewMode) => void;
  upsertInjection: (inj: Injection) => void;
  removeInjection: (id: string) => void;
  addWarning: (m: string) => void;
};

const initial = loadPersisted();

export const useStore = create<State>((set, get) => ({
  snapshot: null,
  loading: false,
  error: null,
  tab: initial.tab,
  selectionByTab: initial.selectionByTab,
  viewMode: initial.viewMode,
  setSnapshot: (s) => set({ snapshot: s }),
  setLoading: (b) => set({ loading: b }),
  setError: (e) => set({ error: e }),
  setTab: (t) => {
    set({ tab: t });
    const st = get();
    savePersisted({ tab: t, selectionByTab: st.selectionByTab, viewMode: st.viewMode });
  },
  select: (sel) => {
    set((st) => {
      const tab = st.tab;
      const next: Record<Tab, Selection> = { ...st.selectionByTab, [tab]: sel };
      savePersisted({ tab, selectionByTab: next, viewMode: st.viewMode });
      return { selectionByTab: next };
    });
  },
  setViewMode: (m) => {
    set({ viewMode: m });
    const st = get();
    savePersisted({ tab: st.tab, selectionByTab: st.selectionByTab, viewMode: m });
  },
  upsertInjection: (inj) =>
    set((st) => {
      if (!st.snapshot) return st;
      const idx = st.snapshot.injections.findIndex((i) => i.id === inj.id);
      const next = [...st.snapshot.injections];
      if (idx >= 0) next[idx] = inj;
      else next.push(inj);
      return {
        snapshot: {
          ...st.snapshot,
          injections: next,
          totalTokens: next.reduce((a, i) => a + i.tokenEstimate, 0),
        },
      };
    }),
  removeInjection: (id) =>
    set((st) => {
      if (!st.snapshot) return st;
      const next = st.snapshot.injections.filter((i) => i.id !== id);
      return {
        snapshot: {
          ...st.snapshot,
          injections: next,
          totalTokens: next.reduce((a, i) => a + i.tokenEstimate, 0),
        },
      };
    }),
  addWarning: (m) =>
    set((st) => {
      if (!st.snapshot) return st;
      return {
        snapshot: { ...st.snapshot, warnings: [...st.snapshot.warnings, m] },
      };
    }),
}));

/** Convenience selector — the current selection for the active tab. */
export function useCurrentSelection(): Selection {
  return useStore((s) => s.selectionByTab[s.tab]);
}
