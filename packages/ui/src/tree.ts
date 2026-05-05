import {
  CANONICAL_GLOBAL,
  CANONICAL_PROJECT,
  type CanonicalNode,
  type Injection,
  type NeighborFile,
  type Snapshot,
} from '@cccv/shared';

/**
 * A node in the rendered directory tree. Wraps the optional canonical
 * metadata, the optional matching `Injection` (if the file is auto-loaded
 * into context), and the optional matching `NeighborFile` (if the entry
 * exists on disk but is not injected). At least one of `canonical`,
 * `injection`, or `neighbor` is always present.
 */
export type TreeNode = {
  /** Stable id, used for keys and selection routing. */
  key: string;
  label: string;
  /** Absolute path on disk, when known. */
  absPath?: string;
  /** Path relative to the tab anchor, used for breadcrumbs. */
  relPath: string;
  type: 'file' | 'folder';
  /** True if the entry is present in the canonical KB skeleton. */
  fromCanonical: boolean;
  /** True if the entry is present on disk (real). */
  exists: boolean;
  /** True if the entry's content currently lands in context. */
  injected: boolean;
  canonical?: CanonicalNode;
  injection?: Injection;
  neighbor?: NeighborFile;
  children?: TreeNode[];
  /** Token total for this node (own injection or sum across children). */
  tokens: number;
  /** Indent depth, root is 0. */
  depth: number;
};

export type DirectoryTab = 'project' | 'global';

/* ---------- helpers ---------- */

function joinAbsPath(anchor: string, rel: string): string {
  if (!rel) return anchor;
  return `${anchor.replace(/\/$/, '')}/${rel}`;
}

function findInjectionByPath(injections: Injection[], absPath: string): Injection | undefined {
  return injections.find((i) => i.source.path === absPath);
}

function tokensFromInjections(injections: Injection[], absPath: string): number {
  let sum = 0;
  for (const inj of injections) {
    if (inj.source.path === absPath) sum += inj.tokenEstimate;
    if (inj.source.path?.startsWith(`${absPath}/`)) sum += inj.tokenEstimate;
  }
  return sum;
}

function hasOnDisk(injections: Injection[], neighbors: NeighborFile[], absPath: string): boolean {
  if (neighbors.some((n) => n.path === absPath)) return true;
  // Auto-loaded memory files might be on disk but not in neighbors (we listed
  // them as injections instead). Treat any injection backed by a real path
  // as "exists".
  return injections.some((i) => i.source.path === absPath);
}

/**
 * Build the tree for a single directory tab (Project or Global).
 *
 * Strategy:
 *   1. Render the canonical skeleton for the tab.
 *   2. Annotate each canonical node with its injection / neighbor / existence.
 *   3. For folder-typed canonical nodes, append "extra real" children from
 *      the neighbor list that the canonical KB doesn't cover.
 *   4. Recurse one level for folders that are not in the canonical KB but
 *      live under known parents (e.g. ~/.claude/<extra-folder>/).
 */
export function buildDirectoryTree(
  tab: DirectoryTab,
  snapshot: Snapshot,
  homeDir: string,
): TreeNode {
  const root = tab === 'project' ? CANONICAL_PROJECT : CANONICAL_GLOBAL;
  const anchor = tab === 'project' ? snapshot.cwd : homeDir;
  const scope = tab;
  const neighbors = snapshot.neighbors.filter((n) => n.scope === scope);
  const injections = snapshot.injections;

  function buildFromCanonical(node: CanonicalNode, depth: number): TreeNode {
    const absPath = joinAbsPath(anchor, node.relPath);
    const injection = findInjectionByPath(injections, absPath);
    const neighbor = neighbors.find((n) => n.path === absPath);

    const out: TreeNode = {
      key: `canonical:${tab}:${node.relPath || '.'}`,
      label: node.label,
      absPath,
      relPath: node.relPath,
      type: node.type,
      fromCanonical: true,
      // Tentative; for folders we update from descendants below.
      exists: injection !== undefined || neighbor !== undefined ||
        hasOnDisk(injections, neighbors, absPath),
      injected: !!injection,
      canonical: node,
      injection,
      neighbor,
      tokens: 0,
      depth,
    };

    const childNodes: TreeNode[] = [];
    const coveredPaths = new Set<string>();

    if (node.children) {
      for (const child of node.children) {
        const built = buildFromCanonical(child, depth + 1);
        if (built.absPath) coveredPaths.add(built.absPath);
        childNodes.push(built);
      }
    }

    // Append extra real entries that live directly under this folder but are
    // NOT in the canonical KB.
    if (node.type === 'folder' && absPath) {
      const prefix = `${absPath}/`;
      const directChildren = neighbors.filter((n) => {
        if (!n.path.startsWith(prefix)) return false;
        const tail = n.path.slice(prefix.length);
        return !tail.includes('/') && !coveredPaths.has(n.path);
      });
      for (const n of directChildren) {
        childNodes.push(buildFromNeighbor(n, depth + 1));
      }
      // Sort: canonical entries keep their order, extras alpha after them.
      const canonicalCount = node.children?.length ?? 0;
      const canonicalSlice = childNodes.slice(0, canonicalCount);
      const extraSlice = childNodes.slice(canonicalCount).sort((a, b) =>
        a.label.localeCompare(b.label),
      );
      out.children = [...canonicalSlice, ...extraSlice];
    } else if (childNodes.length > 0) {
      out.children = childNodes;
    }

    // Folders exist whenever any descendant exists, OR when the anchor itself
    // is the folder (root nodes always exist — that is the cwd / home).
    if (node.type === 'folder') {
      const anyChildExists = (out.children ?? []).some((c) => c.exists);
      out.exists = out.exists || anyChildExists || node.relPath === '';
    }

    // Sum tokens for folders; leaves use their own injection if any.
    if (out.children && out.children.length > 0) {
      out.tokens = out.children.reduce((acc, c) => acc + c.tokens, 0);
      if (injection) out.tokens += injection.tokenEstimate;
    } else if (injection) {
      out.tokens = injection.tokenEstimate;
    } else {
      out.tokens = tokensFromInjections(injections, absPath);
    }
    return out;
  }

  function buildFromNeighbor(n: NeighborFile, depth: number): TreeNode {
    const relPath = n.path.startsWith(anchor) ? n.path.slice(anchor.length).replace(/^\//, '') : n.path;
    const injection = findInjectionByPath(injections, n.path);
    const out: TreeNode = {
      key: `neighbor:${tab}:${n.path}`,
      label: n.path.split('/').pop() ?? n.path,
      absPath: n.path,
      relPath,
      type: n.isDirectory ? 'folder' : 'file',
      fromCanonical: false,
      exists: true,
      injected: !!injection,
      injection,
      neighbor: n,
      tokens: injection?.tokenEstimate ?? 0,
      depth,
    };
    // Children of an extra folder: only if we already listed one-level-deep entries.
    if (n.isDirectory) {
      const prefix = `${n.path}/`;
      const directKids = neighbors.filter((other) => {
        if (!other.path.startsWith(prefix)) return false;
        const tail = other.path.slice(prefix.length);
        return !tail.includes('/');
      });
      if (directKids.length > 0) {
        out.children = directKids
          .map((k) => buildFromNeighbor(k, depth + 1))
          .sort((a, b) => a.label.localeCompare(b.label));
        out.tokens = out.children.reduce((acc, c) => acc + c.tokens, 0);
      }
    }
    return out;
  }

  return buildFromCanonical(root, 0);
}

/* ---------- runtime tab ---------- */

export type RuntimeSection = {
  key: string;
  label: string;
  empty: string;
  items: Injection[];
};

/**
 * Group runtime/dynamic captures into sections. Static fs items don't
 * appear here — they belong to the directory tabs.
 */
export function buildRuntimeSections(snapshot: Snapshot): RuntimeSection[] {
  const hookCaptures = snapshot.injections.filter((i) => i.origin === 'hook-capture');
  const parsed = snapshot.injections.filter((i) => i.origin === 'parsed-runtime');

  const sessionStart = hookCaptures.filter((i) => !i.title.startsWith('runtime tools') && !i.title.startsWith('mcp servers') && !i.title.startsWith('plugins '));
  const runtimeTools = hookCaptures.filter((i) => i.title.startsWith('runtime tools') || i.title.startsWith('mcp servers') || i.title.startsWith('plugins '));
  const settings = parsed.filter((i) => i.title.startsWith('settings:') || i.title.startsWith('merged hooks'));
  const skills = parsed.filter((i) => i.title.startsWith('skill:'));

  return [
    {
      key: 'sessionstart-hooks',
      label: 'SessionStart hooks',
      empty: 'No SessionStart hook output captured (skipped or unavailable).',
      items: sessionStart,
    },
    {
      key: 'merged-settings',
      label: 'Merged settings',
      empty: 'No settings layers captured.',
      items: settings,
    },
    {
      key: 'discovered-skills',
      label: 'Discovered skills',
      empty: 'No skills discovered.',
      items: skills,
    },
    {
      key: 'runtime-tools',
      label: 'Runtime tools, MCP servers, plugins',
      empty: 'No runtime tool list captured.',
      items: runtimeTools,
    },
  ];
}

/* ---------- injected tab ---------- */

export type InjectedSection = {
  key: 'project' | 'global' | 'runtime';
  label: string;
  empty: string;
  /** Items already sorted by tokenEstimate desc. */
  items: Injection[];
  /** Sum of tokens for this section. */
  tokens: number;
};

/**
 * Build the flat sectioned list shown in the "Injected" tab. Includes
 * every injection that actually lands in context: candidates flagged with
 * "(not auto-loaded)" or "(path-scoped)" in their titles by the capture
 * engine are filtered out. Inside each section, items are sorted by
 * tokenEstimate descending so the heaviest contributors read first.
 */
export function buildInjectedSections(
  snapshot: Snapshot,
): { sections: InjectedSection[]; maxTokens: number } {
  const isInjected = (i: Injection): boolean =>
    !i.title.includes('(not auto-loaded)') && !i.title.includes('(path-scoped)');

  const injected = snapshot.injections.filter(isInjected);

  const cwdPrefix = `${snapshot.cwd}/`;
  const homePrefix = `${snapshot.home}/`;

  const project: Injection[] = [];
  const global: Injection[] = [];
  const runtime: Injection[] = [];

  for (const inj of injected) {
    if (inj.origin === 'fs-static') {
      const p = inj.source.path;
      if (p?.startsWith(cwdPrefix)) project.push(inj);
      else if (p?.startsWith(homePrefix)) global.push(inj);
      else project.push(inj);
    } else {
      runtime.push(inj);
    }
  }

  const sortDesc = (arr: Injection[]) =>
    [...arr].sort((a, b) => b.tokenEstimate - a.tokenEstimate);

  const sections: InjectedSection[] = [
    {
      key: 'project',
      label: 'Project',
      empty: 'Nothing from this project is currently injected.',
      items: sortDesc(project),
      tokens: project.reduce((acc, i) => acc + i.tokenEstimate, 0),
    },
    {
      key: 'global',
      label: 'Global',
      empty: 'Nothing from ~/.claude/ is currently injected.',
      items: sortDesc(global),
      tokens: global.reduce((acc, i) => acc + i.tokenEstimate, 0),
    },
    {
      key: 'runtime',
      label: 'Runtime',
      empty: 'No runtime captures (skipped or unavailable).',
      items: sortDesc(runtime),
      tokens: runtime.reduce((acc, i) => acc + i.tokenEstimate, 0),
    },
  ];

  const maxTokens = injected.reduce((acc, i) => Math.max(acc, i.tokenEstimate), 0);
  return { sections, maxTokens };
}

/* ---------- selection resolution ---------- */

import type { Selection } from './store';

/**
 * Look up the actively selected `TreeNode` (for directory tabs) or
 * `Injection` (for the runtime tab) given the snapshot, the active tab,
 * and the selection record.
 */
export function resolveSelection(
  snapshot: Snapshot,
  tab: 'project' | 'global' | 'runtime' | 'injected',
  selection: Selection,
  homeDir: string,
):
  | { kind: 'tree-node'; node: TreeNode }
  | { kind: 'injection'; injection: Injection }
  | null {
  if (!selection) return null;

  if (selection.kind === 'injection') {
    const inj = snapshot.injections.find((i) => i.id === selection.id);
    return inj ? { kind: 'injection', injection: inj } : null;
  }

  if (tab === 'runtime' || tab === 'injected') return null; // these tabs only carry 'injection' selections

  const root = buildDirectoryTree(tab, snapshot, homeDir);
  const sel = selection;
  function findInTree(n: TreeNode): TreeNode | null {
    if (sel?.kind === 'canonical' && n.relPath === sel.relPath && n.fromCanonical) return n;
    if (sel?.kind === 'neighbor' && n.absPath === sel.path) return n;
    if (n.children) {
      for (const c of n.children) {
        const hit = findInTree(c);
        if (hit) return hit;
      }
    }
    return null;
  }
  const node = findInTree(root);
  return node ? { kind: 'tree-node', node } : null;
}

/**
 * Given an absolute path, figure out which directory tab it belongs to and
 * the most specific selection that points at it. Returns `null` if the
 * path isn't part of either canonical tree or a known neighbor.
 *
 * Used when `@-import` hyperlinks navigate cross-tab: the tree row needs
 * to highlight, which requires a `canonical` or `neighbor` selection
 * (not just `injection`).
 */
export function selectionForAbsPath(
  snapshot: Snapshot,
  absPath: string,
): { tab: DirectoryTab; selection: Selection } | null {
  const tryTab = (tab: DirectoryTab): { tab: DirectoryTab; selection: Selection } | null => {
    const root = buildDirectoryTree(tab, snapshot, snapshot.home);
    function find(n: TreeNode): TreeNode | null {
      if (n.absPath === absPath) return n;
      if (n.children) {
        for (const c of n.children) {
          const hit = find(c);
          if (hit) return hit;
        }
      }
      return null;
    }
    const node = find(root);
    if (!node) return null;
    if (node.fromCanonical) {
      return { tab, selection: { kind: 'canonical', tab, relPath: node.relPath } };
    }
    return { tab, selection: { kind: 'neighbor', tab, path: absPath } };
  };

  return tryTab('project') ?? tryTab('global');
}

/** First "good" default selection within a directory tab — the first existing
 *  injectable file (typically CLAUDE.md). Falls back to root if none exist. */
export function defaultDirectorySelection(
  tab: DirectoryTab,
  snapshot: Snapshot,
  homeDir: string,
): Selection {
  const root = buildDirectoryTree(tab, snapshot, homeDir);
  function find(n: TreeNode): TreeNode | null {
    if (n.type === 'file' && n.exists && n.injected) return n;
    if (n.children) {
      for (const c of n.children) {
        const hit = find(c);
        if (hit) return hit;
      }
    }
    return null;
  }
  const target = find(root);
  if (target?.fromCanonical) {
    return { kind: 'canonical', tab, relPath: target.relPath };
  }
  if (target?.absPath) {
    return { kind: 'neighbor', tab, path: target.absPath };
  }
  // Fall back to selecting the root folder itself.
  return { kind: 'canonical', tab, relPath: '' };
}
