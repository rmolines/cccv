import { useMemo, useState } from 'react';
import type { Injection, Origin } from '@cccv/shared';
import clsx from 'clsx';
import { OriginBadge } from './OriginBadge';

type Group = {
  origin: Origin;
  label: string;
  items: Injection[];
};

const GROUP_LABELS: Record<Origin, string> = {
  'fs-static': 'Static files',
  'hook-capture': 'Captured at session start',
  'parsed-runtime': 'Runtime (reconstructed)',
};

function groupInjections(injections: Injection[]): Group[] {
  const byOrigin: Record<Origin, Injection[]> = {
    'fs-static': [],
    'hook-capture': [],
    'parsed-runtime': [],
  };
  for (const i of injections) byOrigin[i.origin].push(i);
  return (['fs-static', 'hook-capture', 'parsed-runtime'] as const).map((o) => ({
    origin: o,
    label: GROUP_LABELS[o],
    items: byOrigin[o],
  }));
}

function shortTitle(t: string, max = 60): string {
  if (t.length <= max) return t;
  const tail = t.slice(-max + 1);
  return `…${tail}`;
}

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function Tree({
  injections,
  selectedId,
  onSelect,
}: {
  injections: Injection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const groups = useMemo(() => groupInjections(injections), [injections]);
  const [collapsed, setCollapsed] = useState<Record<Origin, boolean>>({
    'fs-static': false,
    'hook-capture': false,
    'parsed-runtime': false,
  });

  return (
    <div className="text-sm text-zinc-200">
      {groups.map((g) => {
        const groupTokens = g.items.reduce((a, i) => a + i.tokenEstimate, 0);
        const isCollapsed = collapsed[g.origin];
        return (
          <div key={g.origin} className="mb-1">
            <button
              type="button"
              onClick={() =>
                setCollapsed((c) => ({ ...c, [g.origin]: !c[g.origin] }))
              }
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-zinc-800/50 text-left"
            >
              <span className="flex items-center gap-2">
                <span className="text-zinc-500 text-xs">{isCollapsed ? '▸' : '▾'}</span>
                <OriginBadge origin={g.origin} />
                <span className="font-medium">{g.label}</span>
                <span className="text-zinc-500 text-xs">({g.items.length})</span>
              </span>
              <span className="text-zinc-500 text-xs">{fmtTokens(groupTokens)}</span>
            </button>
            {!isCollapsed && (
              <ul>
                {g.items.length === 0 ? (
                  <li className="px-6 py-1 text-zinc-500 text-xs italic">
                    {g.origin === 'hook-capture'
                      ? 'No dynamic capture (skipped or unavailable).'
                      : 'Empty.'}
                  </li>
                ) : (
                  g.items.map((it) => {
                    const indented = !!it.parentId;
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(it.id)}
                          className={clsx(
                            'w-full text-left px-3 py-1 flex items-center justify-between gap-2 truncate',
                            indented && 'pl-8',
                            selectedId === it.id
                              ? 'bg-blue-600/20 text-blue-100'
                              : 'hover:bg-zinc-800/50',
                          )}
                          title={it.title}
                        >
                          <span className="truncate text-xs">{shortTitle(it.title, 60)}</span>
                          <span className="text-zinc-500 text-[10px] tabular-nums">
                            {fmtTokens(it.tokenEstimate)}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
