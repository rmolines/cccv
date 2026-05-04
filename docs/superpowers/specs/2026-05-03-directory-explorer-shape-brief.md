# Shape Brief: Directory-style explorer

**Date**: 2026-05-03
**Status**: Pending user confirmation
**Companion**: [`2026-05-03-directory-explorer-design.md`](./2026-05-03-directory-explorer-design.md) (the spec)
**Anchors**: [`PRODUCT.md`](../../../PRODUCT.md), [`DESIGN.md`](../../../DESIGN.md), [`DESIGN.json`](../../../DESIGN.json)

## 1. Feature Summary

Replace cccv's origin-grouped tree with a directory-style explorer fronted by
three tabs (`Project / Global / Runtime`). Project and Global render a
canonical filesystem skeleton merged with real on-disk extras, with missing
files dimmed and named. The detail pane gains badge / when-it-loads /
description / tips metadata pulled from a static knowledge base, so the user
always sees *why* a file loads — not just what it contains. Runtime keeps
the dynamic captures (SessionStart hooks, merged settings, discovered skills,
plugins) that don't fit the filesystem metaphor.

## 2. Primary User Action

**Click a row → read its content.** The audit loop is *scan tree → click
suspect → read content → spot the bad line → know the exact path*. Every
other affordance is scaffolding around that one motion.

## 3. Design Direction

- **Color strategy:** Restrained (DESIGN.md default; no surface override).
  95% zinc, status accents <5%, Selection Blue reserved for the focused row.
- **Scene sentence:** *"Dev sozinho num escritório à noite, brilho do monitor
  baixo, caçando o arquivo que tá fazendo o agente alucinar. Scaneia a árvore,
  abre um arquivo, lê devagar, acha a linha. A sala é calma; o trabalho é
  preciso."* This forces dark mode, quiet chrome, content-first reading.
- **Anchor references:**
  - **Linear** — sidebar density, three-letter tab semantics, the way info
    architecture shows hierarchy without ornament.
  - **Charles Proxy** — read-first dev-tool feel, comfort with raw bytes, no
    chrome that explains itself.
  - **VS Code Explorer + Outline** — canonical filesystem tree with status
    decorations (modifications, problems) overlaid without rebuilding the
    tree.
- **Visual probe step:** skipped (Claude Code harness has no native image
  generation, per shape's capability gate).

## 4. Scope

- **Fidelity:** production-ready.
- **Breadth:** whole surface — header (kept), tab bar (new), tree pane (new),
  detail pane (new, absorbs and extends current Viewer).
- **Interactivity:** shipped-quality interactive. Click, hover, focus,
  expand/collapse, copy, keyboard nav, SSE-driven updates.
- **Time intent:** polish until it ships. This is the v2 of the UI surface.

## 5. Layout Strategy

```
┌─ header ─────────────────────────────────────────────────────┐
│ cccv  /Users/.../cccv          12.4k tok • 18 inj   [Refresh]│
├─ tab bar ────────────────────────────────────────────────────┤
│ Project  Global  Runtime          ← bottom-border 2px blue on active │
├─ split pane ─────────────────────────────────────────────────┤
│ left 320px              │ right flex                          │
│   tree or section list  │   detail pane                       │
└─────────────────────────┴────────────────────────────────────┘
```

- **Vertical rhythm:** 16px between detail-pane sections; 4–8px inside the
  tree. The detail pane breathes; the tree is dense.
- **Hierarchy ordering** (top → bottom in detail pane):
  1. Breadcrumb (mono, muted)
  2. Title row (icon · headline label · status badges)
  3. `oneLiner` (single grey line)
  4. `WHEN IT LOADS` callout (info-tinted; the only place info blue appears)
  5. `DESCRIPTION` paragraph (body, secondary)
  6. `TIPS` bullets (body, tertiary)
  7. `Imports` list (mono; only when relevant)
  8. Content viewer (existing rendered/source/json with copy actions)
- **Tree density:** label-typography rows, 4px vertical padding, 12px lateral
  padding, 16px indent per level. Token count right-aligned in muted tabular
  numerals.
- **Selection emphasis:** background fills with Selection Blue at 20%
  opacity. No left-border stripe, no bold text. The blue says it.

## 6. Key States

### Tree row

| State | Visual |
|---|---|
| Canonical + exists + injects | solid icon, ✅ marker, secondary text, token suffix in muted |
| Canonical + exists + non-injecting | solid icon, no marker, secondary text, no suffix |
| Canonical + missing | dashed icon, muted text, no marker, no suffix |
| Extra real (not in canonical KB) | solid icon, leading `+` glyph, secondary text |
| Hover (any) | background → surface-raised; text → primary |
| Selected | background → selection at 20%; text → primary |
| Focus-visible (keyboard) | 1px selection-blue outline, 1px offset, on top of any other state |
| Empty section (Runtime tabs only) | single muted line: `No <section> captured (skipped or unavailable)` |

### Detail pane

| State | What renders |
|---|---|
| Default (file selected) | full stack: breadcrumb → title → badges → oneLiner → callout → description → tips → imports? → content viewer |
| Canonical missing | same metadata, but content viewer replaced by a placeholder card: *"This file does not exist yet. The description above is what would apply if you created it."* |
| Folder selected | metadata as above; below the description, a clickable child list (icon · label · token-if-injected) replaces the content viewer |
| Loading / SSE refresh | content stays visible; no spinner. A 1px top progress bar at most. |
| File unreadable / capture error | content area shows an inline `err` block with the path and a `Copy path` button |
| Selection vanished after refresh | placeholder: *"The previously selected item is no longer in this snapshot."* + a button to clear selection |
| Initial load (no snapshot yet) | left pane shows `Capturing context…`; right pane shows the empty placeholder |

### Tab bar

| State | Visual |
|---|---|
| Default (inactive) | text-tertiary, transparent bottom border |
| Hover | text-secondary |
| Active | text-primary, 2px Selection Blue bottom border |
| Disabled (e.g. Runtime when capture skipped) | text-muted, no hover, tooltip explains why |

## 7. Interaction Model

- **Single click on a row** selects it and populates the detail pane. No
  double-click semantics.
- **Click on a folder row** selects the folder (detail shows its description
  + child list). The folder does *not* expand on this click.
- **Click on the chevron** (or the folder icon when collapsed) toggles
  expand/collapse without changing selection.
- **Click on a tab** switches scope and restores the last selection within
  that tab (persisted in `sessionStorage`). First entry into a tab selects
  the first canonical-and-existing node.
- **Click on a breadcrumb crumb** selects that ancestor.
- **Keyboard:**
  - `Tab` cycles header → tab bar → tree → detail pane controls.
  - `Enter` / `Space` activates a row.
  - `Escape` clears selection (detail pane returns to placeholder).
  - Arrow-key tree navigation is a v2 nice-to-have, not in this brief.
- **Copy buttons:** 1.2s flash on success/error, no toast, no lingering
  banner. Per the celebration budget in DESIGN.md.
- **SSE updates:** tree mutates in place. If the currently-selected row
  vanishes from the snapshot, the detail pane swaps to the
  *selection-vanished* placeholder; the tree does not auto-jump.

## 8. Content Requirements

### Fixed labels (English; cccv UI stays English)

- Tabs: `Project` · `Global` · `Runtime`.
- Status badges: `COMMITTED` · `GITIGNORED` · `LOCAL` · `INJECTED` · `NOT INJECTED` · `MISSING`.
- Section titles in detail pane: `WHEN IT LOADS` · `DESCRIPTION` · `TIPS` · `IMPORTS`.
- Runtime sections: `SessionStart hooks` · `Merged settings` · `Discovered skills` · `Plugins`.

### Empty / edge messages (final copy)

- Empty Runtime section: `No <section> captured (skipped or unavailable).`
- Canonical missing placeholder: `This file does not exist yet. The description above is what would apply if you created it.`
- Selection vanished after SSE refresh: `The previously selected item is no longer in this snapshot.`
- Unreadable file: `Could not read this file. Path copied below if you want to inspect it directly.`

### Canonical KB content shape

- ~30 entries total across `CANONICAL_PROJECT` and `CANONICAL_GLOBAL`.
- Per entry: `oneLiner` ≤80 chars; `when` 1–2 sentences; `description` ~60–100
  words; `tips` 2–5 bullets ≤120 chars each.
- Voice: terminal-adjacent, factual, second-person ("Loaded into context at
  the start of every session"). No marketing, no exclamation marks, no
  rhetorical questions.
- Source: paraphrased from the official `code.claude.com/docs/en/claude-directory`
  page. Single-line comment at the top of `canonical-kb.ts` links the source
  and notes that periodic eyeballing is required.

### Numeric formats

- Token suffix: existing `fmtTokens` (`680` / `1.2k` / `12k`). Tabular
  numerals, muted color, right-aligned.
- Breadcrumb separator: ` / ` (space-slash-space).

## 9. Recommended References (for craft)

These impeccable reference files are most relevant to this surface:

- **`spatial-design.md`** — split-pane proportions, tree-row density, detail-
  pane vertical rhythm. The split is 320 / flex; revisit only if it cramps
  long folder labels.
- **`interaction-design.md`** — tab semantics, click-vs-expand on folders,
  keyboard activation, SSE update behavior.
- **`cognitive-load.md`** — making canonical-missing nodes legible without
  drowning the tree; how much metadata before the content viewer is too
  much.
- **`clarify.md`** — pass on every label, empty-state message, and KB entry.
- **`ux-writing.md`** — voice rules for the canonical KB entries (the
  oneLiner / when / description / tips quartet must read consistently).

## 10. Open Questions (resolve during craft)

- **Settings double-surface:** `parsed-runtime` settings appear in the
  Runtime tab as `Merged settings`, but should the Project/Global
  `settings.json` rows also annotate "merged with N other layers"? Spec
  defaults to Runtime-only; reconsider when the detail pane is rendering and
  the redundancy is concrete.
- **Folder children that are all canonical-missing:** show the dimmed
  children in the folder's detail-pane child list (transparent / honest), or
  hide them (clean / less noisy)? Lean transparent; validate visually during
  craft.
- **Deep `.claude/skills/` trees:** rely on default-collapsed folders, or cap
  display depth at 2 with an "expand more" affordance? Default-collapsed
  should suffice for typical setups; raise this only if a real user has a
  truly pathological tree.
- **Refresh affordance during SSE updates:** should the existing `Refresh`
  button stay clickable mid-stream, or grey out? Today it greys via
  `loading`. Likely keep that behavior; flag if it feels off.
