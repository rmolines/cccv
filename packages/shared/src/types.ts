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

export type Snapshot = {
  capturedAt: string;
  cwd: string;
  injections: Injection[];
  totalTokens: number;
  warnings: string[];
};

export type SsePatch =
  | { kind: 'snapshot.replaced'; snapshot: Snapshot }
  | { kind: 'injection.updated'; injection: Injection }
  | { kind: 'injection.removed'; id: string }
  | { kind: 'warning.added'; message: string };
