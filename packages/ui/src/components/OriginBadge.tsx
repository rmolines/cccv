import type { Origin } from '@cccv/shared';
import clsx from 'clsx';

const STYLES: Record<Origin, { label: string; cls: string; tooltip: string }> = {
  'fs-static': {
    label: 'fs',
    cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
    tooltip: 'Editable file on disk (CLAUDE.md, @import, rule)',
  },
  'hook-capture': {
    label: 'hook',
    cls: 'bg-sky-900/40 text-sky-300 border-sky-700/40',
    tooltip: 'Captured from a real Claude Code session (transcript / InstructionsLoaded hook)',
  },
  'parsed-runtime': {
    label: 'runtime',
    cls: 'bg-amber-900/40 text-amber-300 border-amber-700/40',
    tooltip: 'Reconstructed from disk (skills, settings) — best-effort, may diverge from actual runtime',
  },
};

export function OriginBadge({ origin }: { origin: Origin }) {
  const s = STYLES[origin];
  return (
    <span
      title={s.tooltip}
      className={clsx(
        'inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded border',
        s.cls,
      )}
    >
      {s.label}
    </span>
  );
}
