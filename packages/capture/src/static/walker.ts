import { homedir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { readFile, readdir, stat } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';

const HOME = homedir();
const CC_USER_DIR = join(HOME, '.claude');

export type DiscoveredFile = {
  /** Absolute path on disk */
  path: string;
  /** Display category */
  category: 'memory' | 'rule';
  /** Loaded by Claude Code at session start, vs candidate-only (e.g. AGENTS.md, path-scoped rule) */
  autoLoaded: boolean;
  /** Reason for not being auto-loaded, if applicable */
  notLoadedReason?: string;
  content: string;
};

async function fileExists(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

async function tryRead(p: string): Promise<string | null> {
  try {
    return await readFile(p, 'utf8');
  } catch {
    return null;
  }
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** Walk from `start` upward to home, collecting parent dirs (inclusive). */
function pathToHome(start: string): string[] {
  const dirs: string[] = [];
  let cur = start;
  // Include cwd itself as a parent for memory file lookup
  while (true) {
    dirs.push(cur);
    if (cur === HOME) break;
    const parent = dirname(cur);
    if (parent === cur) break; // hit fs root before home (shouldn't happen if cwd is under home)
    cur = parent;
    // safety: don't walk past root
    if (cur.split(sep).length < 2) break;
  }
  return dirs;
}

/**
 * Discover Claude Code memory files for the given cwd.
 * Auto-loaded: CLAUDE.md (and CLAUDE.local.md) in cwd, ancestors up to home, and ~/.claude/.
 * Candidate (not auto-loaded): AGENTS.md found in those locations.
 */
export async function discoverMemoryFiles(cwd: string): Promise<DiscoveredFile[]> {
  const out: DiscoveredFile[] = [];
  const seen = new Set<string>();

  // Global ~/.claude
  for (const name of ['CLAUDE.md', 'CLAUDE.local.md']) {
    const p = join(CC_USER_DIR, name);
    const c = await tryRead(p);
    if (c !== null && !seen.has(p)) {
      out.push({ path: p, category: 'memory', autoLoaded: true, content: c });
      seen.add(p);
    }
  }
  // AGENTS.md in ~/.claude is a candidate (not loaded directly)
  const globalAgents = join(CC_USER_DIR, 'AGENTS.md');
  if (await fileExists(globalAgents)) {
    const c = (await tryRead(globalAgents))!;
    out.push({
      path: globalAgents,
      category: 'memory',
      autoLoaded: false,
      notLoadedReason: 'AGENTS.md is not loaded by Claude Code unless imported via @AGENTS.md',
      content: c,
    });
  }

  // cwd + ancestors
  for (const dir of pathToHome(cwd)) {
    if (dir === CC_USER_DIR) continue; // already covered
    for (const name of ['CLAUDE.md', 'CLAUDE.local.md']) {
      const p = join(dir, name);
      const c = await tryRead(p);
      if (c !== null && !seen.has(p)) {
        out.push({ path: p, category: 'memory', autoLoaded: true, content: c });
        seen.add(p);
      }
    }
    const agents = join(dir, 'AGENTS.md');
    if (await fileExists(agents) && !seen.has(agents)) {
      const c = (await tryRead(agents))!;
      out.push({
        path: agents,
        category: 'memory',
        autoLoaded: false,
        notLoadedReason: 'AGENTS.md is not loaded by Claude Code unless imported via @AGENTS.md',
        content: c,
      });
      seen.add(agents);
    }
  }

  return out;
}

function parseFrontmatter(text: string): { fm: Record<string, unknown> | null; body: string } {
  if (!text.startsWith('---')) return { fm: null, body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { fm: null, body: text };
  const raw = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\n/, '');
  try {
    const fm = parseYaml(raw);
    return { fm: typeof fm === 'object' && fm !== null ? (fm as Record<string, unknown>) : null, body };
  } catch {
    return { fm: null, body };
  }
}

/**
 * Discover rules. Auto-loaded: rules without `paths` frontmatter (or empty).
 * Path-scoped rules (with `paths` frontmatter) are candidates only — they load on-demand.
 */
export async function discoverRules(cwd: string): Promise<DiscoveredFile[]> {
  const out: DiscoveredFile[] = [];
  const dirs = [join(CC_USER_DIR, 'rules'), join(cwd, '.claude', 'rules')];
  for (const dir of dirs) {
    if (!(await dirExists(dir))) continue;
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const p = join(dir, entry);
      if (!(await fileExists(p))) continue;
      const c = (await tryRead(p))!;
      const { fm } = parseFrontmatter(c);
      const paths = fm && Array.isArray(fm.paths) ? (fm.paths as unknown[]) : [];
      const pathScoped = paths.length > 0;
      out.push({
        path: p,
        category: 'rule',
        autoLoaded: !pathScoped,
        notLoadedReason: pathScoped
          ? 'Rule is path-scoped (frontmatter `paths`), only loads when matched paths are touched'
          : undefined,
        content: c,
      });
    }
  }
  return out;
}
