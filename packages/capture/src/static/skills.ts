import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile, readdir, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { parse as parseYaml } from 'yaml';

const HOME = homedir();

export type DiscoveredSkill = {
  /** Skill name from frontmatter */
  name: string;
  /** Description from frontmatter */
  description: string;
  /** Absolute path to SKILL.md */
  path: string;
  /** Source: which root contained it */
  source: 'plugin-cache' | 'user' | 'project';
  /** Plugin name if source === 'plugin-cache' */
  plugin?: string;
};

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
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

function parseFrontmatter(text: string): Record<string, unknown> | null {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const raw = text.slice(3, end).trim();
  try {
    const fm = parseYaml(raw);
    return typeof fm === 'object' && fm !== null ? (fm as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function findSkillFiles(dir: string): Promise<string[]> {
  // SKILL.md or skill.md anywhere under dir, but only one level deep per common convention
  // (skills/<skill-name>/SKILL.md). Scan up to depth 4 to be permissive.
  const out: string[] = [];
  async function recurse(d: string, depth: number) {
    if (depth > 4) return;
    let entries: Dirent[];
    try {
      entries = (await readdir(d, { withFileTypes: true })) as Dirent[];
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) {
        await recurse(full, depth + 1);
      } else if (e.isFile() && /^skill\.md$/i.test(e.name)) {
        out.push(full);
      }
    }
  }
  await recurse(dir, 0);
  return out;
}

export async function discoverSkills(cwd: string): Promise<DiscoveredSkill[]> {
  const out: DiscoveredSkill[] = [];

  // Plugin cache: ~/.claude/plugins/cache/*/skills/
  const pluginCacheRoot = join(HOME, '.claude', 'plugins', 'cache');
  if (await dirExists(pluginCacheRoot)) {
    let plugins: Dirent[] = [];
    try {
      plugins = (await readdir(pluginCacheRoot, { withFileTypes: true })) as Dirent[];
    } catch {
      plugins = [];
    }
    for (const p of plugins) {
      if (!p.isDirectory()) continue;
      const skillsDir = join(pluginCacheRoot, p.name, 'skills');
      if (!(await dirExists(skillsDir))) continue;
      for (const file of await findSkillFiles(skillsDir)) {
        const content = (await tryRead(file)) ?? '';
        const fm = parseFrontmatter(content);
        if (!fm || typeof fm.name !== 'string') continue;
        out.push({
          name: String(fm.name),
          description: typeof fm.description === 'string' ? fm.description : '',
          path: file,
          source: 'plugin-cache',
          plugin: p.name,
        });
      }
    }
  }

  // User skills: ~/.claude/skills/
  const userSkills = join(HOME, '.claude', 'skills');
  if (await dirExists(userSkills)) {
    for (const file of await findSkillFiles(userSkills)) {
      const content = (await tryRead(file)) ?? '';
      const fm = parseFrontmatter(content);
      if (!fm || typeof fm.name !== 'string') continue;
      out.push({
        name: String(fm.name),
        description: typeof fm.description === 'string' ? fm.description : '',
        path: file,
        source: 'user',
      });
    }
  }

  // Project skills: <cwd>/.claude/skills/
  const projectSkills = join(cwd, '.claude', 'skills');
  if (await dirExists(projectSkills)) {
    for (const file of await findSkillFiles(projectSkills)) {
      const content = (await tryRead(file)) ?? '';
      const fm = parseFrontmatter(content);
      if (!fm || typeof fm.name !== 'string') continue;
      out.push({
        name: String(fm.name),
        description: typeof fm.description === 'string' ? fm.description : '',
        path: file,
        source: 'project',
      });
    }
  }

  return out;
}
