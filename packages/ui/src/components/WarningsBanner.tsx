import { useState } from 'react';

export function WarningsBanner({ warnings }: { warnings: string[] }) {
  const [open, setOpen] = useState(false);
  if (!warnings.length) return null;
  return (
    <div className="border-b border-amber-800/40 bg-amber-900/20 text-amber-200 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-amber-900/30"
      >
        <span>
          ⚠ {warnings.length} warning{warnings.length === 1 ? '' : 's'}
        </span>
        <span>{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <ul className="px-6 py-2 space-y-1 max-h-48 overflow-auto">
          {warnings.map((w, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: warnings are append-only and identical contents are valid
              key={`${i}-${w}`}
              className="font-mono whitespace-pre-wrap break-all"
            >
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
