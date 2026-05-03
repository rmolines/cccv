import { create } from 'zustand';
import type { Injection, Snapshot } from '@cccv/shared';

type ViewMode = 'rendered' | 'source';

type State = {
  snapshot: Snapshot | null;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  viewMode: ViewMode;
  setSnapshot: (s: Snapshot) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
  select: (id: string | null) => void;
  setViewMode: (m: ViewMode) => void;
  upsertInjection: (inj: Injection) => void;
  removeInjection: (id: string) => void;
  addWarning: (m: string) => void;
};

export const useStore = create<State>((set) => ({
  snapshot: null,
  loading: false,
  error: null,
  selectedId: null,
  viewMode: 'rendered',
  setSnapshot: (s) => set({ snapshot: s }),
  setLoading: (b) => set({ loading: b }),
  setError: (e) => set({ error: e }),
  select: (id) => set({ selectedId: id }),
  setViewMode: (m) => set({ viewMode: m }),
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
