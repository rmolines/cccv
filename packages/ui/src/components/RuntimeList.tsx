import clsx from 'clsx';
import type { Snapshot } from '@cccv/shared';
import { buildRuntimeSections } from '../tree';
import type { Selection } from '../store';

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function RuntimeList({
  snapshot,
  selection,
  onSelect,
}: {
  snapshot: Snapshot;
  selection: Selection;
  onSelect: (sel: Selection) => void;
}) {
  const sections = buildRuntimeSections(snapshot);
  const selectedId = selection?.kind === 'injection' ? selection.id : null;

  return (
    <div className="py-1 select-none">
      {sections.map((sec) => (
        <div key={sec.key} className="mb-2">
          <div className="px-3 py-1.5 text-[10.5px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center justify-between">
            <span>{sec.label}</span>
            <span className="tabular-nums text-zinc-600">{sec.items.length}</span>
          </div>
          {sec.items.length === 0 ? (
            <div className="px-3 py-1.5 text-[11px] text-zinc-600 italic">
              {sec.empty}
            </div>
          ) : (
            <ul>
              {sec.items.map((it) => {
                const selected = selectedId === it.id;
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => onSelect({ kind: 'injection', id: it.id })}
                      title={it.title}
                      className={clsx(
                        'w-full flex items-center justify-between gap-2 px-3 py-1 text-left transition-colors text-xs',
                        selected
                          ? 'bg-blue-600/20 text-zinc-100'
                          : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100',
                      )}
                    >
                      <span className="truncate">{it.title}</span>
                      <span className="text-zinc-500 text-[10px] tabular-nums shrink-0">
                        {fmtTokens(it.tokenEstimate)}
                      </span>
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
