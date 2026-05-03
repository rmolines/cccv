# Product

## Register

product

## Users

Developers using Claude Code who suspect the agent is hallucinating, drifting,
or misbehaving because of *something inside* one of the files being auto-injected
into its context (memory files, settings, rules, skills, hook output, runtime
captures). They are technical, comfortable in a terminal, and want to read the
actual content that the model sees — not a summary of it. They reach for cccv
when "Claude is acting weird and I want to know why."

## Product Purpose

cccv (Claude Code Context Visualizer) is a local desktop-resident inspector for
everything that lands in a Claude Code session before the user types their first
message. It captures memory files, `@import` chains, settings layers, discovered
skills/plugins, and SessionStart hook output, then renders each item as readable
content with full provenance: where it lives on disk, why it loaded, and how it
relates to the others.

The value is **content audit**: the user reads the actual injected text, finds
the bad instruction (obsolete, contradictory, off-scope, badly worded, leaking
from a parent path), and walks away with the exact path to fix in chat. Token
weight is a secondary signal — useful as a "this file is doing a lot" cue, but
the goal is to read, not to balance budgets.

Success: a user who walked in confused about why Claude was misbehaving walks out
in a few minutes pointing at a specific file and a specific line.

## Brand Personality

Three words: **honest, diagnostic, unpretentious**.

Voice is terminal-adjacent and technical. The tool addresses developers who would
rather see a path and a stack trace than be soothed. It does not over-explain,
does not celebrate, does not market itself inside its own UI. When something is
missing, it says so plainly. When a file is suspicious, it shows the file —
it does not editorialize.

Emotional goal is confidence followed by mild relief: "I can finally see what's
actually happening" → "found it."

## Anti-references

cccv should not feel like:

- **Multi-widget telemetry dashboards** (Datadog, Splunk, New Relic) — many small
  panels competing for attention, color-coded heatmaps, KPI tiles. cccv is a
  reading tool, not a monitoring board.
- **Marketing-shaped product surfaces** — gradient heroes, illustration mascots,
  big animated hero copy. cccv has zero pages aimed at convincing anyone of
  anything.
- **Gamified dev tooling** — confetti, achievement toasts, anthropomorphized
  mascots, motivational empty states. cccv is for someone who is mildly annoyed
  and wants to fix something.
- **Linter UIs that hide content behind chrome** — collapsible drawers nesting
  three levels deep, severity color-bars dominating the layout, content visible
  only through a small viewport. The content is the product.

## Design Principles

1. **Read first, browse second.** The tree exists to find files; reading those
   files is what closes the loop. Optimize for "I clicked something, now I am
   reading it." Breadcrumbs, badges, and metadata are scaffolding around the
   content, not the headline.

2. **Honest over flattering.** Show real state. If a canonical file is missing,
   show it dimmed and say "this would load if you created it." If a `@import`
   is unresolved, say so in plain language. Do not invent placeholder content,
   do not soften warnings, do not pretend the user has a tidier setup than
   they do.

3. **Diagnostic, not decorative.** Every UI element earns its place by helping
   the user audit. Color carries status; motion carries state change; spacing
   carries hierarchy. Anything purely ornamental gets cut.

4. **Show provenance.** Every byte the user reads is traceable to a file path
   on disk and a "why it loaded" explanation. Audit is a chain of evidence —
   the UI must never present content without anchoring it to a source.

5. **Local trust.** cccv runs on the user's machine, reads their files, never
   leaves. The UI should reflect that — no cloud chrome, no telemetry banners,
   no auth flows, no "share this view" social affordances.

## Accessibility & Inclusion

- WCAG AA contrast minimum for all text and interactive elements.
- Dark scheme default (matches developer environments and reduces eye strain
  for long content reads). Light scheme not in scope for the first pass.
- Status never encoded by color alone — every badge has a text label and a
  shape/icon affordance, so red-green color blindness and screen-reader users
  get the same information.
- Monospace font for paths, content, and token counts. The reading body uses a
  proportional sans by default but offers a "source" mode that switches to
  monospace.
- Keyboard navigation: Tab order follows visual order; Enter activates rows;
  Escape clears selection. Arrow-key tree navigation is a nice-to-have, not a
  blocking requirement for v1.
- All injected content is selectable and copyable as plain text — no canvas,
  no shadow DOM tricks that block selection.
