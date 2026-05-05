import { useEffect, useMemo } from 'react';
import { fetchSnapshot, refreshSnapshot, subscribeEvents } from './api';
import { useStore, type Tab } from './store';
import {
  buildInjectedSections,
  buildRuntimeSections,
  defaultDirectorySelection,
  selectionForAbsPath,
} from './tree';
import { TabBar } from './components/TabBar';
import { DirectoryTree } from './components/DirectoryTree';
import { RuntimeList } from './components/RuntimeList';
import { InjectedList } from './components/InjectedList';
import { DetailPane } from './components/DetailPane';
import { WarningsBanner } from './components/WarningsBanner';
import { PathPicker } from './components/PathPicker';

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function App() {
  const snapshot = useStore((s) => s.snapshot);
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const tab = useStore((s) => s.tab);
  const selectionByTab = useStore((s) => s.selectionByTab);
  const viewMode = useStore((s) => s.viewMode);

  useEffect(() => {
    let mounted = true;
    useStore.getState().setLoading(true);
    fetchSnapshot()
      .then((s) => {
        if (!mounted) return;
        useStore.getState().setSnapshot(s);
      })
      .catch((e) => {
        if (!mounted) return;
        useStore.getState().setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!mounted) return;
        useStore.getState().setLoading(false);
      });

    const unsub = subscribeEvents((p) => {
      const st = useStore.getState();
      switch (p.kind) {
        case 'snapshot.replaced':
          st.setSnapshot(p.snapshot);
          break;
        case 'injection.updated':
          st.upsertInjection(p.injection);
          break;
        case 'injection.removed':
          st.removeInjection(p.id);
          break;
        case 'warning.added':
          st.addWarning(p.message);
          break;
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Default selection on first snapshot load: pick a sensible entry for
  // whichever tab we land on.
  useEffect(() => {
    if (!snapshot) return;
    const st = useStore.getState();
    const sel = st.selectionByTab[st.tab];
    if (sel) return;
    if (st.tab === 'runtime') {
      const sections = buildRuntimeSections(snapshot);
      const first = sections.find((s) => s.items.length > 0)?.items[0];
      if (first) st.select({ kind: 'injection', id: first.id });
    } else if (st.tab === 'injected') {
      const { sections } = buildInjectedSections(snapshot);
      const first = sections.find((s) => s.items.length > 0)?.items[0];
      if (first) st.select({ kind: 'injection', id: first.id });
    } else {
      st.select(defaultDirectorySelection(st.tab, snapshot, snapshot.home));
    }
  }, [snapshot]);

  const counts = useMemo<Record<Tab, number>>(() => {
    if (!snapshot) return { project: 0, global: 0, runtime: 0, injected: 0 };
    const projectInj = snapshot.injections.filter((i) =>
      i.source.path?.startsWith(`${snapshot.cwd}/`),
    ).length;
    const globalInj = snapshot.injections.filter((i) =>
      i.source.path?.startsWith(`${snapshot.home}/.claude/`),
    ).length;
    const runtimeInj = snapshot.injections.filter(
      (i) => i.origin === 'hook-capture' || i.origin === 'parsed-runtime',
    ).length;
    const injectedTotal = snapshot.injections.filter(
      (i) =>
        !i.title.includes('(not auto-loaded)') &&
        !i.title.includes('(path-scoped)'),
    ).length;
    return { project: projectInj, global: globalInj, runtime: runtimeInj, injected: injectedTotal };
  }, [snapshot]);

  const currentSelection = selectionByTab[tab];

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <header className="border-b border-zinc-800 px-4 py-2 flex items-center gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-zinc-100 font-bold tracking-tight">cccv</span>
          <span className="text-zinc-500 text-[11px]">Claude Code Context Visualizer</span>
        </div>
        {snapshot ? (
          <PathPicker cwd={snapshot.cwd} />
        ) : (
          <div className="flex-1 text-zinc-500 text-[11px] font-mono truncate">…</div>
        )}
        {snapshot && (
          <div className="text-[11px] text-zinc-400 tabular-nums">
            {fmtTokens(snapshot.totalTokens)} tok · {snapshot.injections.length} injections
          </div>
        )}
        <button
          type="button"
          onClick={async () => {
            useStore.getState().setLoading(true);
            try {
              const s = await refreshSnapshot();
              useStore.getState().setSnapshot(s);
            } catch (e) {
              useStore.getState().setError(e instanceof Error ? e.message : String(e));
            } finally {
              useStore.getState().setLoading(false);
            }
          }}
          disabled={loading}
          className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error && (
        <div className="border-b border-red-800/40 bg-red-900/30 text-red-200 px-4 py-1.5 text-xs">
          Error: {error}
        </div>
      )}

      {snapshot && <WarningsBanner warnings={snapshot.warnings} />}

      <div className="flex-1 flex min-h-0">
        <aside className="w-80 border-r border-zinc-800 flex flex-col min-h-0">
          <TabBar
            active={tab}
            counts={counts}
            onChange={(t) => {
              const st = useStore.getState();
              st.setTab(t);
              if (!st.selectionByTab[t] && snapshot) {
                if (t === 'runtime') {
                  const sections = buildRuntimeSections(snapshot);
                  const first = sections.find((s) => s.items.length > 0)?.items[0];
                  if (first) st.select({ kind: 'injection', id: first.id });
                } else if (t === 'injected') {
                  const { sections } = buildInjectedSections(snapshot);
                  const first = sections.find((s) => s.items.length > 0)?.items[0];
                  if (first) st.select({ kind: 'injection', id: first.id });
                } else {
                  st.select(defaultDirectorySelection(t, snapshot, snapshot.home));
                }
              }
            }}
          />
          <div className="flex-1 overflow-y-auto">
            {!snapshot && loading ? (
              <div className="p-4 text-zinc-500 text-sm">Capturing context…</div>
            ) : snapshot ? (
              tab === 'runtime' ? (
                <RuntimeList
                  snapshot={snapshot}
                  selection={currentSelection}
                  onSelect={(sel) => useStore.getState().select(sel)}
                />
              ) : tab === 'injected' ? (
                <InjectedList
                  snapshot={snapshot}
                  selection={currentSelection}
                  onSelect={(sel) => useStore.getState().select(sel)}
                />
              ) : (
                <DirectoryTree
                  tab={tab}
                  snapshot={snapshot}
                  selection={currentSelection}
                  onSelect={(sel) => useStore.getState().select(sel)}
                />
              )
            ) : (
              <div className="p-4 text-zinc-500 text-sm">No snapshot yet.</div>
            )}
          </div>
        </aside>
        <main className="flex-1 flex min-w-0">
          {snapshot ? (
            <DetailPane
              snapshot={snapshot}
              tab={tab}
              selection={currentSelection}
              viewMode={viewMode}
              onChangeViewMode={(m) => useStore.getState().setViewMode(m)}
              onSelect={(sel) => useStore.getState().select(sel)}
              onNavigateImport={(absPath) => {
                if (!snapshot) return;
                const st = useStore.getState();
                // Prefer a canonical/neighbor selection so the tree row
                // highlights too. Fall back to injection-only selection
                // if the path isn't in either directory tree (rare).
                const hit = selectionForAbsPath(snapshot, absPath);
                if (hit) {
                  if (st.tab !== hit.tab) st.setTab(hit.tab);
                  st.select(hit.selection);
                  return;
                }
                const target = snapshot.injections.find((i) => i.source.path === absPath);
                if (target) st.select({ kind: 'injection', id: target.id });
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
              {loading ? 'Capturing context…' : 'No snapshot yet.'}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
