import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';

export type WatcherOptions = {
  /** Paths or glob patterns to watch */
  paths: string[];
  onChange: (path: string) => void;
};

/**
 * Lightweight wrapper around chokidar with sane defaults for our use case.
 * Watches CLAUDE.md files, settings.json files, and rules dirs. Re-key
 * watcher when allowlist changes.
 */
export function createWatcher(opts: WatcherOptions): { close: () => Promise<void> } {
  const watcher: FSWatcher = chokidar.watch(opts.paths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    // ignore dotfiles inside watched dirs except CLAUDE.local.md / .claude/*
    ignored: (file) => /\/(node_modules|\.git)(\/|$)/.test(file),
  });

  watcher.on('change', (p: string) => opts.onChange(p));
  watcher.on('add', (p: string) => opts.onChange(p));
  watcher.on('unlink', (p: string) => opts.onChange(p));

  return {
    close: () => watcher.close(),
  };
}
