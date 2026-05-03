import { useEffect } from 'react';
import { fetchSnapshot, refreshSnapshot, subscribeEvents } from './api';
import { useStore } from './store';
import { Tree } from './components/Tree';
import { Viewer } from './components/Viewer';
import { WarningsBanner } from './components/WarningsBanner';

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function App() {
  const snapshot = useStore((s) => s.snapshot);
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const selectedId = useStore((s) => s.selectedId);
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

  const selected = snapshot?.injections.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <header className="border-b border-zinc-800 px-4 py-2 flex items-center gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-zinc-100 font-bold">cccv</span>
          <span className="text-zinc-500 text-xs">Claude Code Context Visualizer</span>
        </div>
        <div className="flex-1 text-zinc-500 text-xs font-mono truncate" title={snapshot?.cwd}>
          {snapshot?.cwd ?? '…'}
        </div>
        {snapshot && (
          <div className="text-xs text-zinc-400 tabular-nums">
            {fmtTokens(snapshot.totalTokens)} tokens • {snapshot.injections.length} injections
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
          className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-200 disabled:opacity-50"
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
        <aside className="w-80 border-r border-zinc-800 overflow-y-auto">
          {!snapshot && loading ? (
            <div className="p-4 text-zinc-500 text-sm">Capturing context…</div>
          ) : snapshot ? (
            <Tree
              injections={snapshot.injections}
              selectedId={selectedId}
              onSelect={(id) => useStore.getState().select(id)}
            />
          ) : (
            <div className="p-4 text-zinc-500 text-sm">No snapshot yet.</div>
          )}
        </aside>
        <main className="flex-1 flex min-w-0">
          <Viewer
            injection={selected}
            viewMode={viewMode}
            onChangeViewMode={(m) => useStore.getState().setViewMode(m)}
          />
        </main>
      </div>
    </div>
  );
}
