import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { Injection, Snapshot } from '@cccv/shared';
import { fetchFile } from '../api';
import { resolveSelection, type TreeNode, type DirectoryTab } from '../tree';
import { type Selection } from '../store';
import { CopyActions } from './CopyActions';
import { StatusBadge } from './StatusBadge';
import { ViewerBody } from './ViewerBody';

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function Breadcrumb({
  tab,
  segments,
  onCrumbClick,
}: {
  tab: DirectoryTab | 'runtime';
  segments: { label: string; relPath?: string }[];
  onCrumbClick: (relPath: string) => void;
}) {
  return (
    <nav aria-label="breadcrumb" className="text-[11px] font-mono text-zinc-500 truncate">
      <span className="uppercase tracking-wider text-zinc-600 mr-2">{tab}</span>
      {segments.map((s, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={`${s.label}:${i}`}>
            {i > 0 && <span className="mx-1 text-zinc-700">/</span>}
            {s.relPath !== undefined && !isLast ? (
              <button
                type="button"
                onClick={() => s.relPath !== undefined && onCrumbClick(s.relPath)}
                className="hover:text-zinc-300 transition-colors"
              >
                {s.label}
              </button>
            ) : (
              <span className={clsx(isLast ? 'text-zinc-300' : 'text-zinc-500')}>{s.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function WhenCallout({ when }: { when: string }) {
  return (
    <aside className="bg-sky-900/20 border-l-[3px] border-sky-400/80 rounded-r px-4 py-3 my-3">
      <div className="text-[10.5px] uppercase tracking-wider text-sky-300 font-semibold mb-1">
        When it loads
      </div>
      <p className="text-sm text-zinc-200 leading-relaxed">{when}</p>
    </aside>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="my-3">
      <div className="text-[10.5px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">
        {label}
      </div>
      {children}
    </section>
  );
}

function ImportsList({ injection }: { injection: Injection }) {
  if (!injection.imports || injection.imports.length === 0) return null;
  return (
    <Section label="Imports">
      <ul className="space-y-1 text-[11px] font-mono">
        {injection.imports.map((e) => (
          <li
            key={`${e.from}::${e.to}`}
            className={clsx(
              'truncate',
              e.cycle
                ? 'text-amber-400'
                : !e.resolved
                  ? 'text-red-400'
                  : 'text-emerald-400',
            )}
            title={e.to}
          >
            {e.cycle ? '↻ cycle: ' : !e.resolved ? '✗ missing: ' : '→ '}
            {e.to}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------- detail panes per kind ---------- */

function PlaceholderEmpty() {
  return (
    <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm px-8 text-center">
      Pick a row on the left to see its content and provenance.
    </div>
  );
}

function MissingPlaceholder({ absPath }: { absPath?: string }) {
  return (
    <div className="border border-dashed border-zinc-700 rounded px-4 py-6 my-3 text-zinc-400 text-sm">
      <div className="font-medium text-zinc-300 mb-1">This file does not exist yet.</div>
      <p className="leading-relaxed">
        The description above is what would apply if you created it. Nothing is currently injected from this path.
      </p>
      {absPath && (
        <p className="text-[11px] font-mono text-zinc-500 mt-2 break-all">{absPath}</p>
      )}
    </div>
  );
}

function FolderChildList({
  node,
  tab,
  onSelectChild,
}: {
  node: TreeNode;
  tab: DirectoryTab;
  onSelectChild: (sel: Selection) => void;
}) {
  if (!node.children || node.children.length === 0) {
    return (
      <div className="text-zinc-500 text-sm py-2">
        No children captured yet.
      </div>
    );
  }
  return (
    <ul className="border border-zinc-800 rounded divide-y divide-zinc-900 bg-zinc-950/40">
      {node.children.map((c) => (
        <li key={c.key}>
          <button
            type="button"
            onClick={() => {
              if (c.fromCanonical) onSelectChild({ kind: 'canonical', tab, relPath: c.relPath });
              else if (c.absPath) onSelectChild({ kind: 'neighbor', tab, path: c.absPath });
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-900/60 transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-zinc-600 text-[10px]">
                {c.type === 'folder' ? '▸' : '·'}
              </span>
              <span className={clsx('truncate', c.exists ? 'text-zinc-200' : 'text-zinc-500 italic')}>
                {c.label}
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0 text-[10px] text-zinc-500">
              {c.injected && <span className="text-emerald-400">●</span>}
              {c.tokens > 0 && <span className="tabular-nums">{fmtTokens(c.tokens)}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function NeighborBody({ absPath, viewMode }: { absPath: string; viewMode: 'rendered' | 'source' }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);
    fetchFile(absPath)
      .then((r) => {
        if (cancelled) return;
        setContent(r.content);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [absPath]);

  if (error) {
    return (
      <div className="px-4 py-3 my-3 border border-red-800/40 bg-red-900/20 rounded text-red-200 text-sm">
        Could not read this file. Path:
        <div className="font-mono text-[11px] text-red-300 mt-1 break-all">{absPath}</div>
        <div className="text-[11px] text-red-300/80 mt-1">{error}</div>
      </div>
    );
  }
  if (content === null) {
    return (
      <div className="px-4 py-6 text-zinc-500 text-sm">Reading file…</div>
    );
  }
  return <ViewerBody content={content} viewMode={viewMode} />;
}

function ViewModeSwitch({
  viewMode,
  onChange,
}: {
  viewMode: 'rendered' | 'source';
  onChange: (m: 'rendered' | 'source') => void;
}) {
  return (
    <div className="inline-flex border border-zinc-700 rounded text-xs overflow-hidden" role="tablist" aria-label="View mode">
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'rendered'}
        onClick={() => onChange('rendered')}
        className={clsx(
          'px-2 py-0.5',
          viewMode === 'rendered' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800',
        )}
      >
        rendered
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'source'}
        onClick={() => onChange('source')}
        className={clsx(
          'px-2 py-0.5 border-l border-zinc-700',
          viewMode === 'source' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800',
        )}
      >
        source
      </button>
    </div>
  );
}

/* ---------- main ---------- */

function buildBreadcrumbSegments(
  relPath: string,
  rootLabel: string,
): { label: string; relPath?: string }[] {
  if (!relPath) return [{ label: rootLabel }];
  const parts = relPath.split('/');
  const segments: { label: string; relPath?: string }[] = [
    { label: rootLabel, relPath: '' },
  ];
  let cur = '';
  for (let i = 0; i < parts.length; i++) {
    cur = cur ? `${cur}/${parts[i]}` : parts[i] ?? '';
    segments.push({ label: parts[i] ?? '', relPath: cur });
  }
  return segments;
}

export function DetailPane({
  snapshot,
  tab,
  selection,
  viewMode,
  onChangeViewMode,
  onSelect,
  onNavigateImport,
}: {
  snapshot: Snapshot;
  tab: 'project' | 'global' | 'runtime' | 'injected';
  selection: Selection;
  viewMode: 'rendered' | 'source';
  onChangeViewMode: (m: 'rendered' | 'source') => void;
  onSelect: (sel: Selection) => void;
  onNavigateImport?: (absPath: string) => void;
}) {
  const resolved = useMemo(
    () => resolveSelection(snapshot, tab, selection, snapshot.home),
    [snapshot, tab, selection],
  );

  if (!resolved) return <PlaceholderEmpty />;

  /* ---------- runtime injection ---------- */
  if (resolved.kind === 'injection') {
    const inj = resolved.injection;
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
        <div className="px-6 pt-4 pb-3 border-b border-zinc-800 flex flex-col gap-2">
          <Breadcrumb tab="runtime" segments={[{ label: inj.title }]} onCrumbClick={() => undefined} />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-zinc-100 truncate min-w-0" title={inj.title}>
              {inj.title}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge label="Injected" tone="ok" />
              <span className="text-[11px] text-zinc-500 tabular-nums">
                {fmtTokens(inj.tokenEstimate)} tok
              </span>
            </div>
          </div>
          {inj.source.path && (
            <div className="text-[11px] font-mono text-zinc-500 truncate" title={inj.source.path}>
              {inj.source.path}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mt-1">
            <ViewModeSwitch viewMode={viewMode} onChange={onChangeViewMode} />
            <CopyActions injection={inj} />
          </div>
        </div>
        <ImportsList injection={inj} />
        <div className="flex-1 overflow-auto">
          <ViewerBody
            content={inj.content}
            viewMode={viewMode}
            imports={inj.imports}
            onNavigate={onNavigateImport}
          />
        </div>
      </div>
    );
  }

  /* ---------- directory tree node ---------- */
  const node = resolved.node;
  const directoryTab: DirectoryTab =
    tab === 'project' || tab === 'global' ? tab : 'project';
  const rootLabel = directoryTab === 'project' ? 'your-project/' : '~/';
  const segments = buildBreadcrumbSegments(node.relPath, rootLabel);

  // Compute badges for the file
  const badges: { label: string; tone: Parameters<typeof StatusBadge>[0]['tone']; title?: string }[] = [];
  const expectedBadge = node.canonical?.expectedBadge;
  if (expectedBadge) badges.push({ label: expectedBadge, tone: 'neutral' });
  if (node.injected) badges.push({ label: 'injected', tone: 'ok', title: 'Content lands in the model context' });
  else if (node.exists && node.canonical?.injects) badges.push({ label: 'not injected', tone: 'neutral' });
  if (!node.exists && node.fromCanonical) badges.push({ label: 'missing', tone: 'warn', title: 'Canonical entry, not present on disk' });
  if (!node.fromCanonical) badges.push({ label: 'extra', tone: 'neutral', title: 'Not in the canonical doc skeleton' });

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
      <div className="px-6 pt-4 pb-3 border-b border-zinc-800 flex flex-col gap-2">
        <Breadcrumb
          tab={directoryTab}
          segments={segments}
          onCrumbClick={(rel) => onSelect({ kind: 'canonical', tab: directoryTab, relPath: rel })}
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-zinc-100 truncate min-w-0" title={node.label}>
            {node.label}
          </h2>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {badges.map((b) => (
              <StatusBadge key={b.label} label={b.label} tone={b.tone} title={b.title} />
            ))}
            {node.tokens > 0 && (
              <span className="text-[11px] text-zinc-500 tabular-nums ml-1">
                {fmtTokens(node.tokens)} tok
              </span>
            )}
          </div>
        </div>
        {node.absPath && (
          <div className="text-[11px] font-mono text-zinc-500 truncate" title={node.absPath}>
            {node.absPath}
          </div>
        )}
        {(node.injection || (node.exists && node.type === 'file')) && (
          <div className="flex items-center justify-between gap-2 mt-1">
            <ViewModeSwitch viewMode={viewMode} onChange={onChangeViewMode} />
            {node.injection && <CopyActions injection={node.injection} />}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4 max-w-3xl">
          {node.canonical?.oneLiner && (
            <p className="text-zinc-400 text-sm leading-relaxed mb-2">{node.canonical.oneLiner}</p>
          )}
          {node.canonical?.when && <WhenCallout when={node.canonical.when} />}
          {node.canonical?.description && (
            <Section label="Description">
              <p className="text-sm text-zinc-200 leading-relaxed">{node.canonical.description}</p>
            </Section>
          )}
          {node.canonical?.tips && node.canonical.tips.length > 0 && (
            <Section label="Tips">
              <ul className="text-sm text-zinc-300 list-disc pl-5 space-y-1">
                {node.canonical.tips.map((t, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: tips are stable, ordered, content-addressed
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </Section>
          )}
          {node.injection && <ImportsList injection={node.injection} />}

          {node.type === 'folder' ? (
            <Section label="Contents">
              <FolderChildList node={node} tab={directoryTab} onSelectChild={onSelect} />
            </Section>
          ) : node.injection ? (
            <Section label="Content">
              <ViewerBody
                content={node.injection.content}
                viewMode={viewMode}
                imports={node.injection.imports}
                onNavigate={onNavigateImport}
              />
            </Section>
          ) : node.exists && node.absPath ? (
            <Section label="Content">
              <NeighborBody absPath={node.absPath} viewMode={viewMode} />
            </Section>
          ) : (
            <MissingPlaceholder absPath={node.absPath} />
          )}
        </div>
      </div>
    </div>
  );
}
