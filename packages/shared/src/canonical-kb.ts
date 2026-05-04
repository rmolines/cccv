/**
 * Canonical knowledge base of the Claude Code .claude/ directory.
 *
 * Source: paraphrased from https://code.claude.com/docs/en/claude-directory
 * Last reviewed: 2026-05-03
 *
 * Maintenance note: this is evergreen reference content. When the doc
 * changes shape (new files added, behaviors revised), re-eyeball and
 * update the entries here. Voice is terminal-adjacent and second-person —
 * see PRODUCT.md / DESIGN.md for the project tone rules.
 */

export type CanonicalBadge = 'committed' | 'gitignored' | 'local';

export type CanonicalNode = {
  /** Path relative to the tab's anchor (`<cwd>/` for project, `~/` for global). */
  relPath: string;
  /** Display name shown in the tree (usually the basename of relPath). */
  label: string;
  type: 'file' | 'folder';
  /** Disk-state classification when the entry exists. */
  expectedBadge: CanonicalBadge;
  /** Whether the entry's content is auto-injected into a fresh Claude Code session. */
  injects: boolean;
  /** Single-line summary, ≤80 chars. */
  oneLiner: string;
  /** When the file is loaded into context. 1–2 sentences. */
  when: string;
  /** Description paragraph, ~60–100 words, terminal-adjacent voice. */
  description: string;
  /** Bullet tips, 2–5 entries, each ≤120 chars. */
  tips: string[];
  /** Children (folders only). */
  children?: CanonicalNode[];
};

/* ---------- PROJECT (anchored at <cwd>/) ---------- */

export const CANONICAL_PROJECT: CanonicalNode = {
  relPath: '',
  label: 'your-project/',
  type: 'folder',
  expectedBadge: 'committed',
  injects: false,
  oneLiner: 'The repository Claude Code is operating on.',
  when: 'The current working directory of the Claude Code session.',
  description:
    'The project root. Claude Code reads a small set of files from here at session start (CLAUDE.md, .mcp.json, AGENTS.md), and it reads everything inside .claude/ for project-scoped configuration, rules, skills, commands, agents, and local memory.',
  tips: [
    'Most files in this tree should be committed so the team shares them; .claude/settings.local.json is the notable exception.',
    'Drag-and-drop the project root into Claude Code to attach it to a session.',
  ],
  children: [
    {
      relPath: 'CLAUDE.md',
      label: 'CLAUDE.md',
      type: 'file',
      expectedBadge: 'committed',
      injects: true,
      oneLiner: 'Project instructions Claude reads every session.',
      when: 'Loaded into context at the start of every session in this project.',
      description:
        'Project-specific instructions that shape how Claude works in this repository. Conventions, common commands, and architectural context live here so Claude operates with the same assumptions your team does. Reads as guidance, not enforcement: for guaranteed behavior, use hooks or permissions.',
      tips: [
        'Target under 200 lines. Longer files still load in full but adherence drops as size grows.',
        'If something only matters for specific tasks, move it to a skill or a path-scoped rule.',
        'List the commands you run most (build, test, format) so Claude knows them without you spelling them out.',
        'Run /memory inside a session to open and edit this file.',
        'Also works at .claude/CLAUDE.md if you prefer to keep the project root clean.',
      ],
    },
    {
      relPath: '.mcp.json',
      label: '.mcp.json',
      type: 'file',
      expectedBadge: 'committed',
      injects: false,
      oneLiner: 'Project-scoped MCP servers, shared with your team.',
      when: 'Servers connect when the session begins; tool schemas are deferred and load on demand via tool search.',
      description:
        'Configures Model Context Protocol servers that give Claude access to external tools (databases, APIs, browsers). This file holds the project-scoped servers your whole team uses. Personal servers go in ~/.claude.json instead.',
      tips: [
        'Use environment variable references for secrets: ${GITHUB_TOKEN}.',
        'Lives at the project root, not inside .claude/.',
        'For servers only you need, run claude mcp add --scope user. That writes to ~/.claude.json.',
      ],
    },
    {
      relPath: '.worktreeinclude',
      label: '.worktreeinclude',
      type: 'file',
      expectedBadge: 'committed',
      injects: false,
      oneLiner: 'Gitignored files to copy into new worktrees.',
      when: 'Read when Claude creates a git worktree (--worktree flag, EnterWorktree tool, or subagent isolation).',
      description:
        'Lists gitignored files to copy from your main repository into each new worktree. Worktrees are fresh checkouts, so untracked files like .env are missing by default. Patterns use .gitignore syntax. Only files that match a pattern AND are gitignored get copied; tracked files are never duplicated.',
      tips: [
        'Lives at the project root, not inside .claude/.',
        'Git-only: WorktreeCreate hooks for other VCSes do not read this file.',
        'Also applies to parallel sessions in the desktop app.',
      ],
    },
    {
      relPath: 'AGENTS.md',
      label: 'AGENTS.md',
      type: 'file',
      expectedBadge: 'committed',
      injects: false,
      oneLiner: 'Cross-tool agent instructions; only injected if @-imported.',
      when: 'Not auto-loaded by Claude Code. Loads only when CLAUDE.md (or another loaded file) imports it via @AGENTS.md.',
      description:
        'A community-standard file for agent instructions that several tools recognize. Claude Code does not load it automatically. To inject its content you must reference it via @AGENTS.md from CLAUDE.md or another auto-loaded file.',
      tips: [
        'If you keep AGENTS.md as the source of truth, add @AGENTS.md to CLAUDE.md so it actually loads.',
        'cccv shows AGENTS.md as a candidate when it is not imported, with a warning explaining why.',
      ],
    },
    {
      relPath: '.claude',
      label: '.claude/',
      type: 'folder',
      expectedBadge: 'committed',
      injects: false,
      oneLiner: 'Project-level configuration, rules, and extensions.',
      when: 'Contents are read at session start; specific subfiles load conditionally.',
      description:
        'Everything Claude Code reads that is specific to this project. Most files here are meant to be committed so your team shares them. Some, like settings.local.json, are gitignored by default. Each file badge below shows which.',
      tips: [
        'Commit most of this directory; the gitignored exceptions are clearly badged.',
        'Run claude /config from inside a session to interactively edit several of these.',
      ],
      children: [
        {
          relPath: '.claude/settings.json',
          label: 'settings.json',
          type: 'file',
          expectedBadge: 'committed',
          injects: false,
          oneLiner: 'Permissions, hooks, and configuration.',
          when: 'Overrides the global ~/.claude/settings.json. Local settings, CLI flags, and managed settings still override this.',
          description:
            'Settings that Claude Code applies directly. Permissions control which commands and tools Claude can use. Hooks run your scripts at specific points in a session. Unlike CLAUDE.md, which Claude reads as guidance, these are enforced: they are configuration, not instruction.',
          tips: [
            'Bash permission patterns support wildcards: Bash(npm test *) matches any command starting with npm test.',
            'Array settings like permissions.allow combine across all scopes; scalar settings like model use the most specific value.',
          ],
        },
        {
          relPath: '.claude/settings.local.json',
          label: 'settings.local.json',
          type: 'file',
          expectedBadge: 'gitignored',
          injects: false,
          oneLiner: 'Your personal settings overrides for this project.',
          when: 'Highest of the user-editable settings files; only CLI flags and managed settings still take precedence.',
          description:
            'Personal settings that take precedence over the project defaults. Same JSON format as settings.json but not committed. Use this when you need different permissions or defaults than the team config.',
          tips: [
            'Same schema as settings.json. Arrays combine across scopes; scalars use the local value.',
            'Claude Code adds this file to ~/.config/git/ignore the first time it writes one.',
          ],
        },
        {
          relPath: '.claude/rules',
          label: 'rules/',
          type: 'folder',
          expectedBadge: 'committed',
          injects: true,
          oneLiner: 'Topic-scoped instructions, optionally gated by file paths.',
          when: 'Rules without paths: load at session start. Rules with paths: load when a matching file enters context.',
          description:
            'Project instructions split into topic files that can load conditionally based on file paths. A rule without paths: frontmatter loads at session start like CLAUDE.md. A rule with paths: loads only when Claude reads a matching file. Like CLAUDE.md, rules are guidance, not enforcement: for guaranteed behavior use hooks or permissions.',
          tips: [
            'Use paths: frontmatter with globs to scope rules to directories or file types.',
            'Subdirectories work: .claude/rules/frontend/react.md is discovered automatically.',
            'When CLAUDE.md approaches 200 lines, start splitting it into rules.',
          ],
        },
        {
          relPath: '.claude/skills',
          label: 'skills/',
          type: 'folder',
          expectedBadge: 'committed',
          injects: true,
          oneLiner: 'Reusable prompts you or Claude invoke by name.',
          when: 'Invoked with /skill-name, or auto-invoked by Claude when a task matches the skill description.',
          description:
            'Each skill is a folder containing SKILL.md plus any supporting files. By default both you and Claude can invoke a skill. Frontmatter controls invocability: disable-model-invocation: true for user-only workflows like /deploy, or user-invocable: false to hide from the / menu while keeping it Claude-invocable.',
          tips: [
            'Skills accept arguments: /deploy staging passes "staging" as $ARGUMENTS.',
            'The description frontmatter determines when Claude auto-invokes the skill.',
            'Bundle reference docs alongside SKILL.md. Claude can read them by name.',
          ],
        },
        {
          relPath: '.claude/commands',
          label: 'commands/',
          type: 'folder',
          expectedBadge: 'committed',
          injects: false,
          oneLiner: 'Single-file prompts invoked with /name.',
          when: 'User types /command-name. Claude can also auto-invoke if the description frontmatter matches.',
          description:
            'A file at commands/deploy.md creates /deploy. Skills and commands are now the same mechanism. For new workflows, use skills instead so you can bundle supporting files.',
          tips: [
            'Use $ARGUMENTS in the file to accept parameters: /fix-issue 123.',
            'If a skill and command share a name, the skill takes precedence.',
            'New entries should usually be skills rather than commands.',
          ],
        },
        {
          relPath: '.claude/output-styles',
          label: 'output-styles/',
          type: 'folder',
          expectedBadge: 'committed',
          injects: false,
          oneLiner: 'Project-scoped output styles, if your team shares any.',
          when: 'Applied at session start when selected via the outputStyle setting.',
          description:
            'Output styles are usually personal, so most live in ~/.claude/output-styles/. Put one here only if your team shares a style, like a review mode everyone uses.',
          tips: [
            'Most teams leave this empty and keep output styles in the global ~/.claude/output-styles/.',
          ],
        },
        {
          relPath: '.claude/agents',
          label: 'agents/',
          type: 'folder',
          expectedBadge: 'committed',
          injects: false,
          oneLiner: 'Specialized subagents with their own context window.',
          when: 'A subagent runs in its own context window when you or Claude invoke it.',
          description:
            'Each markdown file defines a subagent with its own system prompt, tool access, and optionally its own model. Subagents run in a fresh context window, keeping the main conversation clean. Useful for parallel work or isolated tasks.',
          tips: [
            'Each agent gets a fresh context window, separate from your main session.',
            'Restrict tool access per agent with the tools: frontmatter field.',
            'Type @ and pick an agent from autocomplete to delegate directly.',
          ],
        },
        {
          relPath: '.claude/agent-memory',
          label: 'agent-memory/',
          type: 'folder',
          expectedBadge: 'committed',
          injects: false,
          oneLiner: 'Subagent persistent memory, separate from main-session auto memory.',
          when: 'First 200 lines of each subagent\'s MEMORY.md (capped at 25KB) load into the subagent system prompt when it runs.',
          description:
            'Subagents with memory: project in their frontmatter get a dedicated memory directory here. This is distinct from the main-session auto memory at ~/.claude/projects/. Each subagent reads and writes its own MEMORY.md, not yours.',
          tips: [
            'Only created for subagents that opt in via memory: frontmatter.',
            'Use memory: local to write to .claude/agent-memory-local/ and keep it out of git.',
            'Use memory: user to share memory across projects. That writes to ~/.claude/agent-memory/.',
          ],
        },
      ],
    },
  ],
};

/* ---------- GLOBAL (anchored at ~/) ---------- */

export const CANONICAL_GLOBAL: CanonicalNode = {
  relPath: '',
  label: '~/',
  type: 'folder',
  expectedBadge: 'local',
  injects: false,
  oneLiner: 'Your home directory; .claude/ here applies across all projects.',
  when: 'Files under ~/.claude/ load alongside per-project equivalents.',
  description:
    'The personal counterpart to a project\'s .claude/. Everything here applies to every project you work in and is never committed anywhere.',
  tips: [
    'Keep CLAUDE.md here short. It loads on top of every project\'s CLAUDE.md.',
    'Personal MCP servers live in ~/.claude.json under the projects key.',
  ],
  children: [
    {
      relPath: '.claude.json',
      label: '.claude.json',
      type: 'file',
      expectedBadge: 'local',
      injects: false,
      oneLiner: 'App state and UI preferences.',
      when: 'Read at session start. Claude Code writes back when you change /config or approve trust prompts.',
      description:
        'Holds state that does not belong in settings.json: theme, OAuth session, per-project trust decisions, your personal MCP servers, and UI toggles. Mostly managed through /config rather than edited directly.',
      tips: [
        'IDE toggles like autoConnectIde and externalEditorContext live here, not in settings.json.',
        'The projects key tracks per-project state like trust-dialog acceptance and last-session metrics.',
        'MCP servers here are yours only. Team-shared servers go in .mcp.json at the project root.',
      ],
    },
    {
      relPath: '.claude',
      label: '.claude/',
      type: 'folder',
      expectedBadge: 'local',
      injects: false,
      oneLiner: 'Your personal configuration across all projects.',
      when: 'Read at session start; specific subfiles load conditionally.',
      description:
        'The global counterpart to your project .claude/ directory. Files here apply to every project and are never committed to any repository.',
      tips: [
        'Files here are personal, never committed.',
        'Run claude /config from any session to edit several of these interactively.',
      ],
      children: [
        {
          relPath: '.claude/CLAUDE.md',
          label: 'CLAUDE.md',
          type: 'file',
          expectedBadge: 'local',
          injects: true,
          oneLiner: 'Personal preferences across every project.',
          when: 'Loaded at the start of every session, in every project.',
          description:
            'Your global instruction file. Loaded alongside each project\'s CLAUDE.md, so both are in context together. When instructions conflict, project-level takes priority. Keep it to preferences that apply everywhere: response style, commit format, personal conventions.',
          tips: [
            'Keep it short. It loads into context for every project.',
            'Good for response style, commit format, and personal conventions.',
          ],
        },
        {
          relPath: '.claude/settings.json',
          label: 'settings.json',
          type: 'file',
          expectedBadge: 'local',
          injects: false,
          oneLiner: 'Default settings for all projects.',
          when: 'Your defaults. Project and local settings.json override any keys you also set here.',
          description:
            'Same keys as project settings.json: permissions, hooks, model, environment variables, the rest. Put settings here that you want in every project, like permissions you always allow or a notification hook that runs regardless of project.',
          tips: [
            'Project settings.json overrides any matching keys you set here.',
            'Different from CLAUDE.md, where global and project files are both loaded into context rather than merged key by key.',
          ],
        },
        {
          relPath: '.claude/keybindings.json',
          label: 'keybindings.json',
          type: 'file',
          expectedBadge: 'local',
          injects: false,
          oneLiner: 'Custom keyboard shortcuts.',
          when: 'Read at session start and hot-reloaded when you edit the file.',
          description:
            'Rebind keyboard shortcuts in the interactive CLI. Run /keybindings to create or open this file with a schema reference. Ctrl+C, Ctrl+D, Ctrl+M, and Caps Lock are reserved and cannot be rebound.',
          tips: [
            'Run /keybindings to scaffold this file.',
            'Hot-reloads: no session restart needed.',
          ],
        },
        {
          relPath: '.claude/themes',
          label: 'themes/',
          type: 'folder',
          expectedBadge: 'local',
          injects: false,
          oneLiner: 'Custom color themes.',
          when: 'Read at session start and hot-reloaded when files change. Listed in /theme.',
          description:
            'Each .json file defines a custom color theme: a built-in base preset plus an overrides map of color tokens. Create one interactively with /theme or write the JSON by hand. Selecting a custom theme stores custom:<slug> as your theme preference.',
          tips: [
            'Run /theme to scaffold a theme interactively.',
            'Themes hot-reload: edit the file and the running session picks up changes.',
          ],
        },
        {
          relPath: '.claude/projects',
          label: 'projects/',
          type: 'folder',
          expectedBadge: 'local',
          injects: true,
          oneLiner: 'Auto memory: Claude\'s notes to itself, per project.',
          when: 'MEMORY.md is loaded at session start (first 200 lines / 25KB). Topic files are read on demand.',
          description:
            'Auto memory lets Claude accumulate knowledge across sessions without you writing anything. Claude saves notes as it works: build commands, debugging insights, architecture notes. Each project gets its own memory directory keyed by the repository path.',
          tips: [
            'On by default. Toggle with /memory or autoMemoryEnabled in settings.',
            'MEMORY.md is the index loaded each session; topic files are read on demand.',
            'Plain markdown: edit or delete anytime.',
          ],
        },
        {
          relPath: '.claude/plugins',
          label: 'plugins/',
          type: 'folder',
          expectedBadge: 'local',
          injects: false,
          oneLiner: 'Installed plugin caches and metadata.',
          when: 'Read at session start to enumerate installed plugins; plugin skills/commands load on invocation.',
          description:
            'The cache root for plugins you have installed. Each plugin lives under a subdirectory keyed by source (claude-plugins-official, custom marketplaces). Plugins can ship skills, commands, agents, and hooks; these surface in the Claude Code session when the plugin is enabled.',
          tips: [
            'Manage installed plugins with /plugin.',
            'Plugin skills appear in the Skill picker and are gated by user-invocable / model-invocable frontmatter.',
          ],
        },
        {
          relPath: '.claude/skills',
          label: 'skills/',
          type: 'folder',
          expectedBadge: 'local',
          injects: true,
          oneLiner: 'Personal skills available across every project.',
          when: 'Loaded at session start; invoked with /skill-name or auto-invoked by Claude.',
          description:
            'Same shape as the project skills/ folder, but personal: these skills are available in every session you start. Use this for skills you author for yourself, separate from team-shared ones in a project\'s .claude/skills/.',
          tips: [
            'Personal skills load in every project; project skills load only in their own repo.',
            'Same SKILL.md format as project-scoped skills.',
          ],
        },
        {
          relPath: '.claude/agents',
          label: 'agents/',
          type: 'folder',
          expectedBadge: 'local',
          injects: false,
          oneLiner: 'Personal subagents available in every project.',
          when: 'Each agent runs in its own context window when you @-mention it or Claude delegates to it.',
          description:
            'Same shape as project agents/, but global. Subagents defined here are usable in every session.',
          tips: [
            'For project-scoped agents, use .claude/agents/ inside the repo instead.',
          ],
        },
        {
          relPath: '.claude/output-styles',
          label: 'output-styles/',
          type: 'folder',
          expectedBadge: 'local',
          injects: false,
          oneLiner: 'Personal output styles, applied via the outputStyle setting.',
          when: 'Read at session start when an output style is selected.',
          description:
            'Output styles change how Claude formats responses (concise, verbose, code-only, review-mode). Most styles are personal and live here. Run /output-style to switch styles in a running session.',
          tips: [
            'Use /output-style to switch active style.',
            'Settings.json outputStyle picks the default.',
          ],
        },
        {
          relPath: '.claude/agent-memory',
          label: 'agent-memory/',
          type: 'folder',
          expectedBadge: 'local',
          injects: false,
          oneLiner: 'Cross-project subagent memory.',
          when: 'A subagent\'s MEMORY.md from here loads when that subagent runs in any project.',
          description:
            'Subagents that set memory: user in their frontmatter write here, sharing memory across every project. This contrasts with project-scoped subagent memory at <project>/.claude/agent-memory/.',
          tips: [
            'Use memory: user when you want the subagent to learn across projects.',
          ],
        },
      ],
    },
  ],
};

/* ---------- helpers ---------- */

/** Walk a canonical tree and yield every node depth-first. */
export function* walkCanonical(root: CanonicalNode): Generator<CanonicalNode> {
  yield root;
  if (root.children) {
    for (const c of root.children) yield* walkCanonical(c);
  }
}

/** Find a canonical node by relPath. Returns null if missing. */
export function findCanonical(
  root: CanonicalNode,
  relPath: string,
): CanonicalNode | null {
  for (const node of walkCanonical(root)) {
    if (node.relPath === relPath) return node;
  }
  return null;
}
