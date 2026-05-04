export type Origin = 'fs-static' | 'hook-capture' | 'parsed-runtime';

export type ImportEdge = {
  from: string;
  to: string;
  resolved: boolean;
  cycle?: boolean;
};

export type InjectionSource = {
  path?: string;
  hookName?: string;
  plugin?: string;
};

export type Injection = {
  id: string;
  origin: Origin;
  title: string;
  source: InjectionSource;
  content: string;
  tokenEstimate: number;
  imports?: ImportEdge[];
  parentId?: string;
};

export type NeighborScope = 'project' | 'global';

/**
 * Files in or under .claude/ that are NOT injected into context but ARE part
 * of the directory the user is auditing. Surfaced in the directory tree as
 * "extra real" rows so the explorer matches the doc skeleton without hiding
 * the user's actual on-disk content.
 */
export type NeighborFile = {
  /** Absolute path on disk */
  path: string;
  scope: NeighborScope;
  /** Size in bytes; bodies are loaded on demand via /api/file */
  size: number;
  /** True when the entry is a directory (e.g. .claude/output-styles/). */
  isDirectory: boolean;
};

export type Snapshot = {
  capturedAt: string;
  cwd: string;
  /** User home directory (anchor for the Global tab). */
  home: string;
  injections: Injection[];
  totalTokens: number;
  warnings: string[];
  neighbors: NeighborFile[];
};

export type SsePatch =
  | { kind: 'snapshot.replaced'; snapshot: Snapshot }
  | { kind: 'injection.updated'; injection: Injection }
  | { kind: 'injection.removed'; id: string }
  | { kind: 'warning.added'; message: string };
