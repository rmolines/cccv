---
name: cccv
description: Local inspector for everything that lands in a Claude Code session before you type
colors:
  surface-app: "#09090b"
  surface-panel: "#18181b"
  surface-raised: "#27272a"
  border-strong: "#3f3f46"
  border-subtle: "#27272a"
  text-primary: "#f4f4f5"
  text-secondary: "#e4e4e7"
  text-tertiary: "#a1a1aa"
  text-muted: "#71717a"
  ok: "#6ee7b7"
  ok-bg: "#14532d"
  warn: "#fcd34d"
  warn-bg: "#78350f"
  err: "#fca5a5"
  err-bg: "#7f1d1d"
  info: "#7dd3fc"
  info-bg: "#0c4a6e"
  selection: "#2563eb"
  link: "#60a5fa"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.78125rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
rounded:
  sm: "3px"
  md: "4px"
  lg: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-bordered:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
    typography: "{typography.label}"
  button-bordered-hover:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  button-segmented:
    backgroundColor: "transparent"
    textColor: "{colors.text-tertiary}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
    typography: "{typography.label}"
  button-segmented-active:
    backgroundColor: "{colors.border-strong}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-status:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-tertiary}"
    rounded: "{rounded.md}"
    padding: "2px 6px"
    typography: "{typography.label}"
  row-tree:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    padding: "4px 12px"
    typography: "{typography.label}"
  row-tree-hover:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
  row-tree-selected:
    backgroundColor: "{colors.selection}"
    textColor: "{colors.text-primary}"
---

# Design System: cccv

## 1. Overview

**Creative North Star: "The Glass Box"**

cccv is a transparent housing around something normally invisible: the pile
of files Claude Code injects into your session before you say a word. The
job of the interface is to be glass — to disappear so the contents read
clearly. The chrome must be quiet enough that you forget it is there; the
content must be sharp enough that you cannot miss what is wrong with it.

The aesthetic borrows from the terminal more than from the web: zinc-on-zinc
backgrounds, monospace where paths and structure live, proportional sans
where prose lives, status carried by small badges with text labels rather
than colored auras. There is no animation that does not signal a state
change. There is no decoration. The only "delight" is the relief of finding
the file that was poisoning your session.

**Key Characteristics:**

- Single dark surface, three near-zinc shades for hierarchy (app, panel, raised).
- Text is the loudest element on every screen.
- Status colors used in <5% of any view, always paired with a text label.
- Monospace for paths, content, and structural metadata; sans for prose and UI labels.
- No shadows. Elevation comes from 1px borders and a one-step background lift.

## 2. Colors

A near-monochrome zinc palette carrying all UI chrome, plus a small set of
muted status accents (emerald, amber, red, sky) that appear only on badges
and inline indicators. One accent (blue) marks the user's current selection.

### Primary
- **Selection Blue** (`#2563eb` at 20% opacity for fill, `#60a5fa` for links): the only chromatic accent in the chrome. Marks the row the user is currently reading and renders inline links inside markdown content.

### Neutral
- **App Black** (`#09090b`, zinc-950): the outermost surface. Body background, header background extension.
- **Panel Black** (`#18181b`, zinc-900): one shade up. Sidebar, secondary panels, callout fills (with /20 opacity).
- **Raised Black** (`#27272a`, zinc-800): one shade up again. Hover states, button hover backgrounds, tabs, button-segmented active state, badge fills.
- **Strong Border** (`#3f3f46`, zinc-700): the only visible border weight. Used for buttons, segmented controls, panel separators when a 1px line is needed.
- **Subtle Border** (`#27272a`, zinc-800): the same value as Raised Black but used as a near-invisible separator between header / banner / split-pane regions.
- **Text Primary** (`#f4f4f5`, zinc-100): the loudest text. Headlines, currently-selected row label.
- **Text Secondary** (`#e4e4e7`, zinc-200): default body text.
- **Text Tertiary** (`#a1a1aa`, zinc-400): secondary information — token counts, metadata, table headers.
- **Text Muted** (`#71717a`, zinc-500): de-emphasized text — labels, timestamps, "no data" placeholders, dimmed canonical-missing nodes.

### Status
- **OK** (`#6ee7b7` text on `#14532d` at 40% fill): success states — copy success, resolved imports, "INJECTED" badge.
- **Warn** (`#fcd34d` text on `#78350f` at 20% fill): warnings banner, cycle imports, "MISSING" badge for canonical placeholders.
- **Err** (`#fca5a5` text on `#7f1d1d` at 30% fill): error banner, copy failure, unresolved imports.
- **Info** (`#7dd3fc` text on `#0c4a6e` at 40% fill): informational callouts — the "WHEN IT LOADS" panel border and tint.

### Named Rules

**The Five-Percent Rule.** Any single view shows at most 5% of its surface in chromatic color. The remaining 95% is zinc. If a view feels colorful, the design has failed.

**The Selection-Is-Sacred Rule.** Selection Blue is reserved exclusively for the user's currently-focused row. No other element — no button, no chip, no link — uses the same blue at the same intensity. When the user scans the UI for "where am I", the answer is unambiguous.

**The Status-With-Words Rule.** Every colored badge carries a text label that conveys the same meaning. A red badge labeled "Err" is required; an unlabeled red dot is forbidden.

## 3. Typography

**Display Font:** ui-sans-serif (system stack: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif)

**Body Font:** same system sans

**Mono Font:** ui-monospace (SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace)

**Character:** the system sans is the OS default — invisible, familiar, no opinion. The monospace is the developer's default, also OS-stocked. The whole system uses two font families because that is the smallest count that does the job; introducing a display serif or a weighted geometric sans would betray the "terminal-adjacent" voice in PRODUCT.md.

### Hierarchy

- **Display** (700, 1.5rem / 24px, 1.2): page-level headlines. Used in markdown body for `h1`. Rare in the chrome.
- **Headline** (600, 1.125rem / 18px, 1.3): section headers, detail-pane file titles.
- **Title** (600, 1rem / 16px, 1.4): subsection headers, less common.
- **Body** (400, 0.875rem / 14px, 1.6): default UI text and rendered markdown body. Max line length 65–75ch in the reading pane.
- **Label** (500, 0.75rem / 12px, 1.4, 0.01em): button text, badge text, token counts, breadcrumb crumbs.
- **Mono** (400, 12.5px, 1.55): file paths, JSON content, source-mode viewer body, structural metadata.

### Named Rules

**The Mono-For-Truth Rule.** Anything that names a real artifact on disk — a path, an absolute filesystem location, a commit hash, raw injected content — is rendered monospace. Anything that paraphrases or describes uses the sans. Mono is reserved for verbatim truth.

**The Two-Family Rule.** The system has exactly two type families: system sans and system mono. No additional fonts may be introduced. If a design wants more typographic variety, it gets it through weight, size, and color — not new families.

## 4. Elevation

cccv is a flat system. There are no shadows, no glows, no blurred backdrops.
Hierarchy is conveyed by **a single one-step background lift** (zinc-950 →
zinc-900 → zinc-800) and by 1px borders in zinc-700.

The detail pane sits on the same surface plane as the tree; what
distinguishes them is the border between them, not depth. Hover and active
states change the background by exactly one zinc step — not by adding a
shadow. Selection is communicated by a tinted background fill in Selection
Blue at 20% opacity, again with no shadow.

### Named Rules

**The Flat-By-Default Rule.** Surfaces never cast shadows. If an element
needs to feel raised, lift its background one zinc step or wrap it with a
1px zinc-700 border. Never both at the same time, and never a shadow.

**The Three-Surface Rule.** Three background shades suffice for the entire
app: App Black for the outermost canvas, Panel Black for sidebars and
banners, Raised Black for hover and active states. Anything that wants a
fourth shade is asking the wrong question.

## 5. Components

Each component leans on the same small kit: zinc backgrounds, 1px zinc-700
border when an edge is needed, label-weight text, 4px or 6px corner radius.
Components do not introduce new colors or fonts; they recombine the existing
tokens.

### Buttons

- **Shape:** 4px corner radius (`rounded.md`). Square-ish, never pill.
- **Bordered (default):** transparent background, `text-secondary`, `border-strong` 1px, `padding: 4px 8px`, label typography. On hover: background lifts to `surface-raised`, text to `text-primary`.
- **Segmented control (rendered/source toggle):** two cells inside a `border-strong` container, divider is a 1px `border-strong` between cells. Inactive cell: transparent background, `text-tertiary`. Active cell: `border-strong` background fill, `text-primary`. Used only for binary view-mode toggles.
- **Disabled:** border drops to `border-subtle`, text to `text-muted`, no hover.

### Badges

- **Shape:** 4px corner radius (`rounded.md`). Same as buttons but smaller.
- **Status badges (committed / gitignored / local / injected / not-injected / missing):** background `surface-raised`, text `text-tertiary`, padding `2px 6px`, label typography. The semantic ones (`injected`, `missing`) layer a status-color text on top of a status-color background at low opacity (e.g. `ok-bg` fill, `ok` text), but always carry the literal word.
- **Origin badges are retired** in v2 — replaced by the more specific status badges above.

### Tree rows

- **Default:** transparent background, `text-secondary`, padding `4px 12px`, label typography. Indent each level by 16px.
- **Hover:** background lifts to `surface-raised`, text to `text-primary`.
- **Selected:** background `selection` at 20% opacity, text `text-primary`. The only place Selection Blue appears in the chrome.
- **Right-aligned suffix:** token count when the row represents an injected file, in `text-muted` and tabular-nums.

### Detail pane

- **Background:** `surface-app` (matches the canvas; no internal panel chrome).
- **Header:** breadcrumb in `text-muted` mono, then file title in headline typography, then a row of status badges.
- **WHEN IT LOADS callout:** `info-bg` at 20% opacity background, `info` text, 1px `info` left border (3px wide), padding `12px 16px`, body typography. The only place Info Blue appears.
- **Description:** body typography, `text-secondary`, max line length 75ch.
- **Tips:** bulleted list, body typography, `text-tertiary`, indented 16px.
- **Content body:** existing markdown / JSON-pretty / source viewer, untouched. Lives below the metadata.

### Banners (Warnings / Errors)

- **Warnings:** thin band across full width. `warn-bg` at 20% opacity background, `warn` text, 1px `warn-bg` bottom border, label typography, click to expand list.
- **Errors:** same shape, swap `warn` → `err`.

### Tab bar

- **Style:** three flat cells across the top of the left pane. Active tab: bottom border 2px in `selection`, text `text-primary`. Inactive: transparent border, text `text-tertiary`, hover lifts to `text-secondary`.
- **No icons** in the tab cells — text label only. Three labels: `Project`, `Global`, `Runtime`.

### Imports list

- **Resolved imports:** `ok` text + `→` glyph.
- **Cycle imports:** `warn` text + `↻` glyph.
- **Missing imports:** `err` text + `✗` glyph.
- All in mono typography, indented inside the detail pane below the description.

## 6. Do's and Don'ts

### Do:
- **Do** keep the surface 95% zinc. Status accents are <5% of any view.
- **Do** use Selection Blue *only* for the currently-selected row. Never for buttons, never for chips.
- **Do** label every status badge in plain English (`COMMITTED`, `MISSING`, `INJECTED`). Color is decoration.
- **Do** render every absolute path, file content, and structural identifier in monospace.
- **Do** lift hover and active states by exactly one zinc step. Same shape, same border, same radius.
- **Do** treat warnings and errors as quiet horizontal bands at the top of the canvas. They expand on click; they do not pop.
- **Do** show canonical-but-missing files as dimmed dashed-icon rows with a "MISSING" badge. State-of-the-world honesty over a tidy tree.

### Don't:
- **Don't** add shadows, glows, or blurred backdrops. Hierarchy comes from background lift and 1px borders. Per **The Flat-By-Default Rule**, depth is the wrong metaphor.
- **Don't** introduce a third type family. Two families. System sans, system mono.
- **Don't** turn cccv into a multi-widget telemetry dashboard. No KPI tiles, no heat-mapped grids, no animated meters. The PRODUCT.md anti-reference list calls these out by name (Datadog, Splunk, New Relic) — repeat after me, the content is the product.
- **Don't** decorate empty states with mascots, illustrations, or motivational copy. An empty section says `No <name> captured` in `text-muted` and that is the entire UX.
- **Don't** celebrate. Per PRODUCT.md, no confetti, no toasts on success that linger, no achievement chrome. A 1.2-second flash on the copy button is the entire celebration budget.
- **Don't** use color alone to convey state. The **Status-With-Words Rule** is non-negotiable: every colored badge carries text.
- **Don't** add gradient hero sections, full-bleed marketing imagery, or any chrome that resembles a landing page. cccv has no marketing surfaces, and its UI must not look like one.
- **Don't** nest content behind three levels of collapsibles. Per the PRODUCT.md anti-reference, "linter UIs that hide content behind chrome" is the failure mode. Make the content reachable in two clicks max.
- **Don't** introduce motion that isn't a direct response to a state change. No scroll-driven choreography, no entrance animations, no parallax. Per **The Diagnostic, Not Decorative Principle**.
