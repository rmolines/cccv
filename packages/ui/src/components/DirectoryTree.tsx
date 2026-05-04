import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { Snapshot } from '@cccv/shared';
import {
  buildDirectoryTree,
  type DirectoryTab,
  type TreeNode,
} from '../tree';
import type { Selection } from '../store';

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function isSelected(node: TreeNode, sel: Selection): boolean {
  if (!sel) return false;
  if (sel.kind === 'canonical' && node.fromCanonical && sel.relPath === node.relPath) return true;
  if (sel.kind === 'neighbor' && node.absPath === sel.path) return true;
  return false;
}

function nodeToSelection(tab: DirectoryTab, n: TreeNode): Selection {
  if (n.fromCanonical) return { kind: 'canonical', tab, relPath: n.relPath };
  if (n.absPath) return { kind: 'neighbor', tab, path: n.absPath };
  return null;
}

const FOLDER_OPEN = '▾';
const FOLDER_CLOSED = '▸';
const FILE_GLYPH = '·';
const MISSING_GLYPH = '·';

function NodeIcon({ node, expanded }: { node: TreeNode; expanded: boolean }) {
  if (node.type === 'folder') {
    return (
      <span
        aria-hidden
        className={clsx(
          'w-3 inline-block text-center text-[10px] leading-none',
          node.exists ? 'text-zinc-500' : 'text-zinc-700',
        )}
      >
        {expanded ? FOLDER_OPEN : FOLDER_CLOSED}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={clsx(
        'w-3 inline-block text-center text-[10px] leading-none',
        node.exists ? 'text-zinc-500' : 'text-zinc-700',
      )}
    >
      {node.exists ? FILE_GLYPH : MISSING_GLYPH}
    </span>
  );
}

function StateMarker({ node }: { node: TreeNode }) {
  if (node.injected) {
    return (
      <span aria-label="injected" title="Injected into context" className="text-emerald-400 text-[10px] leading-none">
        ●
      </span>
    );
  }
  if (!node.exists && node.fromCanonical) {
    return (
      <span aria-label="missing" title="Canonical entry, not present on disk" className="text-zinc-700 text-[10px] leading-none">
        ○
      </span>
    );
  }
  return <span className="w-2 inline-block" aria-hidden />;
}

function ExtraMarker({ node }: { node: TreeNode }) {
  if (node.fromCanonical) return null;
  return (
    <span aria-label="not in canonical KB" title="Not in the canonical doc skeleton; on-disk extra" className="text-zinc-500 text-[10px] leading-none">
      +
    </span>
  );
}

function TreeRow({
  node,
  expanded,
  selected,
  onSelect,
  onToggle,
}: {
  node: TreeNode;
  expanded: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const indent = node.depth * 16;
  return (
    <div
      className={clsx(
        'group flex items-center gap-2 cursor-pointer text-xs leading-tight transition-colors',
        selected
          ? 'bg-blue-600/20 text-zinc-100'
          : 'text-zinc-200 hover:bg-zinc-800/60 hover:text-zinc-100',
        !node.exists && node.fromCanonical && !selected && 'text-zinc-500',
      )}
      style={{ paddingLeft: indent + 12 }}
    >
      {node.type === 'folder' ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="py-1 pr-1 -ml-1 hover:text-zinc-100"
          aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
        >
          <NodeIcon node={node} expanded={expanded} />
        </button>
      ) : (
        <span className="py-1 pr-1 -ml-1">
          <NodeIcon node={node} expanded={false} />
        </span>
      )}
      <button
        type="button"
        onClick={onSelect}
        title={node.absPath ?? node.label}
        className="flex-1 flex items-center justify-between gap-2 py-1 pr-3 text-left min-w-0"
      >
        <span className="flex items-center gap-1 min-w-0">
          <ExtraMarker node={node} />
          <span
            className={clsx(
              'truncate',
              !node.exists && node.fromCanonical && 'italic',
            )}
          >
            {node.label}
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <StateMarker node={node} />
          {node.tokens > 0 && (
            <span className="text-zinc-500 text-[10px] tabular-nums">
              {fmtTokens(node.tokens)}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

const ALWAYS_EXPANDED_PREFIXES = new Set(['', '.claude']);

function renderSubtree(
  node: TreeNode,
  selection: Selection,
  expandedSet: Set<string>,
  toggle: (key: string) => void,
  onSelectNode: (n: TreeNode) => void,
): React.ReactNode {
  const isExpanded = expandedSet.has(node.key) || ALWAYS_EXPANDED_PREFIXES.has(node.relPath);
  const selected = isSelected(node, selection);

  return (
    <div key={node.key}>
      <TreeRow
        node={node}
        expanded={isExpanded}
        selected={selected}
        onSelect={() => onSelectNode(node)}
        onToggle={() => toggle(node.key)}
      />
      {node.type === 'folder' && isExpanded && node.children && (
        <div role="group">
          {node.children.map((c) => renderSubtree(c, selection, expandedSet, toggle, onSelectNode))}
        </div>
      )}
    </div>
  );
}

export function DirectoryTree({
  tab,
  snapshot,
  selection,
  onSelect,
}: {
  tab: DirectoryTab;
  snapshot: Snapshot;
  selection: Selection;
  onSelect: (sel: Selection) => void;
}) {
  const root = useMemo(
    () => buildDirectoryTree(tab, snapshot, snapshot.home),
    [tab, snapshot],
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Start with anchor and immediate .claude/ open.
    const init = new Set<string>();
    init.add(root.key);
    if (root.children) {
      for (const child of root.children) {
        if (child.label === '.claude/' || child.relPath === '.claude') init.add(child.key);
      }
    }
    return init;
  });

  function toggle(k: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function handleSelect(node: TreeNode) {
    onSelect(nodeToSelection(tab, node));
    if (node.type === 'folder') {
      // Selecting a folder expands it for convenience, but does not collapse.
      setExpanded((prev) => {
        if (prev.has(node.key)) return prev;
        const next = new Set(prev);
        next.add(node.key);
        return next;
      });
    }
  }

  return (
    <div role="tree" aria-label={`${tab} directory`} className="py-1 select-none">
      {renderSubtree(root, selection, expanded, toggle, handleSelect)}
    </div>
  );
}
