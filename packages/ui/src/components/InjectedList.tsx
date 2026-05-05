import clsx from 'clsx';
import type { Snapshot } from '@cccv/shared';
import { buildInjectedSections } from '../tree';
import type { Selection } from '../store';

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * Flat sectioned list of every injection that actually lands in context,
 * grouped by scope (Project / Global / Runtime) and sorted by token weight
 * descending so the heaviest contributor reads first.
 */
export function InjectedList({
  snapshot,
  selection,
  onSelect,
}: {
  snapshot: Snapshot;
  selection: Selection;
  onSelect: (sel: Selection) => void;
}) {
  const { sections, maxTokens } = buildInjectedSections(snapshot);
  const selectedId = selection?.kind === 'injection' ? selection.id : null;

  return (
    <div className="py-1 select-none">
      {sections.map((sec) => (
        <div key={sec.key} className="mb-2">
          <div className="px-3 py-1.5 text-[10.5px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center justify-between">
            <span>{sec.label}</span>
            <span className="tabular-nums text-zinc-600">
              {sec.items.length > 0 ? `${fmtTokens(sec.tokens)} tok` : '0'}
            </span>
          </div>
          {sec.items.length === 0 ? (
            <div className="px-3 py-1.5 text-[11px] text-zinc-600 italic">
              {sec.empty}
            </div>
          ) : (
            <ul>
              {sec.items.map((it) => {
                const selected = selectedId === it.id;
                const widthPct = maxTokens > 0
                  ? Math.max(2, Math.round((it.tokenEstimate / maxTokens) * 100))
                  : 0;
                const label =
                  it.source.path?.split('/').pop() ?? it.title;
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => onSelect({ kind: 'injection', id: it.id })}
                      title={it.source.path ?? it.title}
                      className={clsx(
                        'w-full flex flex-col gap-1 px-3 py-1.5 text-left transition-colors',
                        selected
                          ? 'bg-blue-600/20 text-zinc-100'
                          : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{label}</span>
                        <span className="text-zinc-500 text-[10px] tabular-nums shrink-0">
                          {fmtTokens(it.tokenEstimate)}
                        </span>
                      </div>
                      <div className="h-[3px] w-full rounded-sm bg-zinc-800 overflow-hidden" aria-hidden>
                        <div
                          className="h-full bg-emerald-500/60"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
