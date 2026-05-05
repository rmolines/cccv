import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { switchCwd } from '../api';
import { useStore } from '../store';

const RECENTS_KEY = 'cccv:recent-cwds:v1';
const MAX_RECENTS = 5;

function loadRecents(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecents(list: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function pushRecent(path: string): string[] {
  const current = loadRecents();
  const next = [path, ...current.filter((p) => p !== path)].slice(0, MAX_RECENTS);
  saveRecents(next);
  return next;
}

/**
 * Header path display + popover that swaps the server's current cwd.
 *
 * Click the path → popover with a free-text input pre-filled with the
 * current cwd plus up to 5 recently-visited paths from localStorage. Submit
 * (Enter or `Open`) calls `/api/switch-cwd`; the resulting snapshot lands
 * on the next SSE `snapshot.replaced` event so no in-component state needs
 * to track it.
 */
export function PathPicker({ cwd }: { cwd: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(cwd);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recents, setRecents] = useState<string[]>(() => loadRecents());
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Pre-fill the input when the cwd prop changes (initial load + post-swap).
  useEffect(() => {
    if (!open) setValue(cwd);
  }, [cwd, open]);

  // Focus the input when the popover opens.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  // Click-outside + Escape close the popover.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function submit(path: string): Promise<void> {
    const trimmed = path.trim();
    if (!trimmed) {
      setError('Path required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const snap = await switchCwd(trimmed);
      useStore.getState().setSnapshot(snap);
      // Drop selections from the previous cwd; defaults will rehydrate.
      const st = useStore.getState();
      st.select(null);
      // Reset every tab's selection (simplest is to clear all then rely on the
      // defaulting effects in App.tsx to refill on next visit).
      // We don't have a bulk reset, so set the active tab's selection to null
      // and the default-effect handles the rest on tab switch.
      setRecents(pushRecent(trimmed));
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex-1 min-w-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Click to switch project"
        className={clsx(
          'w-full flex items-center gap-1.5 text-zinc-500 text-[11px] font-mono truncate text-left',
          'hover:text-zinc-300 transition-colors',
        )}
      >
        <span className="truncate">{cwd}</span>
        <span aria-hidden className="text-zinc-600 text-[10px] shrink-0">▾</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Switch project"
          className="absolute left-0 top-full mt-2 w-[420px] z-50 bg-zinc-900 border border-zinc-700 rounded shadow-lg p-3 flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-[10.5px] uppercase tracking-wider text-zinc-500 font-semibold">
              Project path
            </label>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit(value);
              }}
              placeholder="/absolute/path/to/repo"
              className={clsx(
                'w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono text-zinc-100',
                'focus:outline-none focus:border-blue-600',
              )}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>

          {recents.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="text-[10.5px] uppercase tracking-wider text-zinc-500 font-semibold">
                Recent
              </div>
              <ul className="flex flex-col">
                {recents.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => void submit(p)}
                      disabled={submitting}
                      className={clsx(
                        'w-full text-left px-2 py-1 rounded text-[11px] font-mono truncate',
                        'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                      title={p}
                    >
                      {p}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="text-[11px] text-red-300 bg-red-900/30 border border-red-800/40 rounded px-2 py-1.5">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit(value)}
              disabled={submitting}
              className={clsx(
                'text-xs px-3 py-1 rounded border transition-colors',
                'border-blue-700 bg-blue-700/30 text-blue-100 hover:bg-blue-700/50',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {submitting ? 'Opening…' : 'Open'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
