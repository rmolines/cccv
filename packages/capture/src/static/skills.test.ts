import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverSkills } from './skills';

async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'cccv-skills-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

describe('discoverSkills', () => {
  test('finds project-level SKILL.md with valid frontmatter', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      const skillDir = join(dir, '.claude', 'skills', 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        '---\nname: my-skill\ndescription: does the thing\n---\n\nbody',
      );
      const skills = await discoverSkills(dir);
      const project = skills.filter((s) => s.source === 'project');
      expect(project).toHaveLength(1);
      expect(project[0]!.name).toBe('my-skill');
      expect(project[0]!.description).toBe('does the thing');
    } finally {
      await cleanup();
    }
  });

  test('skips skills without name in frontmatter', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      const skillDir = join(dir, '.claude', 'skills', 'broken');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '---\ndescription: no name\n---\n');
      const skills = await discoverSkills(dir);
      const project = skills.filter((s) => s.source === 'project');
      expect(project).toEqual([]);
    } finally {
      await cleanup();
    }
  });

  test('returns empty list when no skills in cwd', async () => {
    const { dir, cleanup } = await tempDir();
    try {
      const skills = await discoverSkills(dir);
      const project = skills.filter((s) => s.source === 'project');
      expect(project).toEqual([]);
    } finally {
      await cleanup();
    }
  });
});
