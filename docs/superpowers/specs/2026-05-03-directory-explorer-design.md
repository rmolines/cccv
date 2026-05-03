# Directory-style explorer for cccv

**Date**: 2026-05-03
**Status**: Approved (brainstorming)
**Replaces**: current origin-grouped tree in `packages/ui/src/components/Tree.tsx`

## Goal

Make it visually obvious **which files are injected into a Claude Code session, where they live on disk, and what each one means** — by adopting the layout language of the official Claude Code docs (`/claude-directory` and `/context-window`).

The current tree groups items by capture origin (`fs-static`, `hook-capture`, `parsed-runtime`). This is faithful to how cccv captures, but unfaithful to how a user thinks about their setup. A user thinks "my project CLAUDE.md", "my global rules", "the SessionStart hook" — not "fs-static item #4". The new layout maps onto the user's mental model.

## Non-goals

- In-app editing (already decided: delegated to chat).
- Token-budget bar (option A from the original framing — separate spec).
- Comparison view between Project and Global side-by-side.
- Rendering the default content of files that don't exist (we describe them; we don't fabricate content).
- Replacing the capture engine. The engine already produces what we need; the spec is a pure UI/data-shape change with one capture-engine extension (extra real files).

## Shape

Three tabs at the top of the left pane: **Project / Global / Runtime**.

- **Project tab** is anchored at `<cwd>/`. Shows a canonical skeleton (always-present nodes from the docs) merged with extras actually found on disk under cwd.
- **Global tab** is anchored at `~/`. Same idea: canonical skeleton merged with real extras under `~/.claude/`.
- **Runtime tab** is *not* a filesystem. It groups items the cccv capture engine reconstructed (SessionStart hook output, merged settings layers, discovered skills, plugins). Flat sections, no tree.

Selecting any node renders a rich detail pane on the right that follows the docs' template (badge, "WHEN IT LOADS", description, tips, content preview).

## Data model

### New: canonical knowledge base

A new file `packages/shared/src/canonical-kb.ts` exports two trees:

```ts
type CanonicalNode = {
  /** path relative to the tab's anchor */
  relPath: string;
  type: 'file' | 'folder';
  /** which kind of disk badge to apply when the file exists */
  expectedBadge: 'committed' | 'gitignored' | 'local';
  /** does presence in the user's session inject content into context? */
  injects: boolean;
  oneLiner: string;
  /** rendered above the description, blue callout style */
  when: string;
  description: string;
  tips: string[];
  children?: CanonicalNode[];
};

export const CANONICAL_PROJECT: CanonicalNode;  // anchored at <cwd>/
export const CANONICAL_GLOBAL: CanonicalNode;   // anchored at ~/
```

Content for `oneLiner / when / description / tips` is paraphrased from
`https://code.claude.com/docs/en/claude-directory`. ~30 entries total. We treat
this as evergreen reference material — copying it is cheap, and the docs page
itself is the source of truth.

### Extended: existing `Injection` type

`packages/shared/src/types.ts` already has `Injection`. We add no new fields to
it — instead, the UI computes a derived **node model** by merging:

1. The canonical KB (skeleton).
2. The `Injection[]` already produced by `captureSnapshot`.
3. Extra disk listings under `<cwd>` and `~/.claude/` to find files **not** covered by either of the above (so a custom `~/.claude/output-styles/concise.md` shows up).

Merging happens in a new selector in the UI store (`packages/ui/src/store.ts`).

### Capture engine extension: extra real files

`captureSnapshot` today returns the things that are *injected* plus a few
candidates (AGENTS.md). We extend it once: it should also return a flat list
of "neighbor" files — non-injected configs that live under `<cwd>/.claude/`
and `~/.claude/`, so the UI can render them as real-but-not-injected nodes.

New field on `Snapshot`:

```ts
type NeighborFile = {
  /** absolute path */
  path: string;
  scope: 'project' | 'global';
  /** size in bytes; we don't read content unless requested */
  size: number;
};

type Snapshot = {
  // ...existing fields
  neighbors: NeighborFile[];
};
```

Implementation: a new `discoverNeighbors()` in
`packages/capture/src/static/walker.ts` lists the contents of
`<cwd>/.claude/` and `~/.claude/` (one level deep, plus `rules/`, `skills/`,
`commands/`, `agents/`, `output-styles/`, `themes/`) without reading file
bodies. Bodies are loaded on-demand by the existing `/api/file` endpoint.

## UI

### Top-level layout

```
┌─ header ─────────────────────────────────────────────────────┐
│ cccv  /Users/.../cccv          12.4k tok • 18 inj   [Refresh]│
├─ tab bar ────────────────────────────────────────────────────┤
│ [Project]  [Global]  [Runtime]                               │
├─ split pane ─────────────────────────────────────────────────┤
│ left (320px)             │ right (flex)                      │
│   tree or section list   │   detail pane (sticky breadcrumb) │
└──────────────────────────┴───────────────────────────────────┘
```

Header keeps current behavior (cwd, total tokens, refresh button, error
banner, warnings banner).

### Left pane — Project / Global tab tree

Renders the canonical KB tree, merged with reality:

| Node state | Visual |
|---|---|
| Canonical + exists + injects | normal icon, ✅ marker, normal text color |
| Canonical + exists + does not inject | normal icon, no marker, slightly muted text |
| Canonical + missing | dashed icon outline, dimmed text, no marker |
| Extra real (not in canonical KB) | normal icon, small `+` indicator before the label |

Indentation follows directory structure. Folders are expand/collapse. Default
state: top-level anchor (`your-project/` or `~/`) and `.claude/` start
expanded; everything else collapsed.

Each leaf shows: icon · label · token count (if injected) on the right.

Selection highlights the row. Clicking a folder also opens its detail pane
(folders have entries in the canonical KB too).

### Left pane — Runtime tab

Flat sections, each with a header and a list:

- **SessionStart hooks** — items from `origin: 'hook-capture'`. Title format
  `<hookName> [<hookId-first-8>]` (already implemented).
- **Merged settings** — items from `origin: 'parsed-runtime'` whose title
  includes "settings:".
- **Discovered skills** — items from `origin: 'parsed-runtime'` whose title
  includes "skill:".
- **Plugins** — items from `origin: 'parsed-runtime'` whose title includes
  "plugin:".

If a section is empty, it shows a single muted line:
`No <name> captured (skipped or unavailable)`.

### Right pane — detail

When a node is selected, the right pane renders:

1. **Breadcrumb**: e.g. `your-project / .claude / settings.json`. Clicking a
   crumb selects that ancestor.
2. **Title row**: type icon · label · status badges. Badges:
   - `COMMITTED` / `GITIGNORED` / `LOCAL` — from canonical KB or inferred
   - `INJECTED` (green) / `NOT INJECTED` (zinc) — from snapshot
   - `MISSING` (dashed, dim) — file is in canonical KB but not on disk
3. **`oneLiner`** — single grey line under the title.
4. **WHEN IT LOADS** — blue-bordered callout with the `when` text.
5. **DESCRIPTION** — paragraph.
6. **TIPS** — bulleted list (only present for canonical entries).
7. **Imports** — existing edge list (only when relevant).
8. **Content viewer**:
   - For real, readable files: existing rendered/source toggle, JSON pretty,
     CodeMirror source, copy actions.
   - For canonical-but-missing nodes: a placeholder card saying *"This file
     does not exist yet. The canonical description above is what would apply
     if you created it."* No content body.
   - For folders: list of immediate children (clickable rows).

### Existing components reused

- `Viewer.tsx` body (rendered/source/JSON pretty) is extracted into a child
  component `ViewerBody.tsx` so the new detail pane can host it without
  duplicating logic.
- `CopyActions.tsx` reused unchanged.
- `OriginBadge.tsx` retired — replaced by status badges described above.
- `WarningsBanner.tsx` reused unchanged.

### Components to create

- `packages/ui/src/components/TabBar.tsx` — three-tab switcher (Project / Global / Runtime).
- `packages/ui/src/components/DirectoryTree.tsx` — recursive tree for Project & Global tabs.
- `packages/ui/src/components/RuntimeList.tsx` — flat sectioned list for Runtime tab.
- `packages/ui/src/components/DetailPane.tsx` — right-side renderer (breadcrumb, badges, callouts, body).
- `packages/ui/src/components/StatusBadge.tsx` — single badge primitive.
- `packages/ui/src/components/ViewerBody.tsx` — extracted from current Viewer.

### Components to retire

- `Tree.tsx` (replaced by `DirectoryTree` + `RuntimeList`).
- `OriginBadge.tsx`.
- `Viewer.tsx` becomes a thin wrapper or is absorbed into `DetailPane`.

## State

Store changes (`packages/ui/src/store.ts`):

```ts
type Tab = 'project' | 'global' | 'runtime';

type Selection =
  | { kind: 'canonical', tab: Tab, relPath: string }
  | { kind: 'injection', id: string }
  | { kind: 'neighbor', path: string };

interface UiState {
  // ...existing
  tab: Tab;
  selection: Selection | null;
  setTab(t: Tab): void;
  select(sel: Selection | null): void;
  // existing setSnapshot, viewMode, etc. stay
}
```

Default tab: `project`. Default selection: first canonical node that exists
in the project tab (typically `CLAUDE.md`).

Tab + selection are persisted in `sessionStorage` so refresh keeps the user's
spot.

**Selection-to-content join**: a `canonical` selection identifies a node in
the KB tree; the detail pane joins that node to an `Injection` (by matching
absolute path) and to a `NeighborFile` (same join) on render. The KB always
supplies `oneLiner / when / description / tips`; the injection (if any)
supplies the content body, token estimate, and imports; the neighbor (if any)
supplies the on-disk content fallback. A `neighbor` selection skips the KB
join entirely (no canonical metadata).

## Routes / API

No new server routes. Existing endpoints suffice:

- `/api/snapshot` — same response shape, with `neighbors` field added.
- `/api/file?path=…` — already exists, used by `DetailPane` to fetch neighbor
  bodies on demand.
- `/api/events` (SSE) — unchanged.

## Build sequence

A natural order, not strict steps:

1. **Capture extension** (cheap, isolated): add `discoverNeighbors()` and
   `Snapshot.neighbors`. One walker function, type changes propagated.
2. **Canonical KB**: write `packages/shared/src/canonical-kb.ts` with the ~30
   entries. Largely a copy-paste-and-paraphrase pass over the docs.
3. **Store rework**: introduce `tab` + `Selection` discriminated union.
4. **DirectoryTree + StatusBadge**: render a Project tab purely from
   canonical + injections + neighbors. Do not wire Global or Runtime yet.
5. **DetailPane**: render badge / when / description / tips / content body
   for the three selection kinds. Reuses extracted `ViewerBody`.
6. **TabBar**: wire Global tab (same component, different anchor) and
   Runtime tab (`RuntimeList`).
7. **Cleanup**: delete `Tree.tsx`, `OriginBadge.tsx`, retire `Viewer.tsx` if
   absorbed.
8. **Tests**:
   - `discoverNeighbors` walker — uses temp-dir pattern from existing tests.
   - canonical KB shape — basic snapshot test that the tree is well-formed.
   - UI: smoke render for each tab via Preview MCP screenshots.

Existing capture and server tests should keep passing without changes.

## Risks / decisions to reverse cheaply

- **Canonical KB content drifts** as the docs change. Mitigation: small
  comment at top of `canonical-kb.ts` linking the source URL and noting it
  needs a periodic eyeball. Acceptable risk; rewriting from the doc is a
  10-minute job.
- **Extra-real surface gets noisy** in repos with weird `.claude/` content.
  Mitigation: cap depth at 1 inside `rules/`, `skills/`, etc., and skip
  obvious junk (`.DS_Store`). Same as existing walkers do.
- **Folder-as-detail-target** might feel off in some cases. If a user clicks
  `.claude/skills/` they get the canonical description, not a list of their
  skills. Mitigation: the detail body for folders shows a child list, so
  they can navigate further with one click.

## Open questions deferred to later

- A "context-window" stacked-bar visualization (the original option A) is
  still a good idea — separate spec, after this lands.
- Hot-reload of canonical KB if we ever externalize it. Out of scope; it's
  a TS module today.
