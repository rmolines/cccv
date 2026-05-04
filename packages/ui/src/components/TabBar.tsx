import clsx from 'clsx';
import type { Tab } from '../store';

const TABS: { key: Tab; label: string }[] = [
  { key: 'project', label: 'Project' },
  { key: 'global', label: 'Global' },
  { key: 'runtime', label: 'Runtime' },
];

export function TabBar({
  active,
  onChange,
  counts,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  counts: Record<Tab, number>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Context scopes"
      className="flex border-b border-zinc-800 bg-zinc-900/40"
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            type="button"
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={clsx(
              'flex-1 px-3 py-2 text-xs font-medium tracking-wide transition-colors',
              'border-b-2 border-transparent flex items-center justify-center gap-2',
              isActive
                ? 'text-zinc-100 border-blue-600'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            <span>{t.label}</span>
            <span
              className={clsx(
                'text-[10.5px] tabular-nums',
                isActive ? 'text-zinc-400' : 'text-zinc-600',
              )}
            >
              {counts[t.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
