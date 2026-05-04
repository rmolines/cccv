import { describe, expect, test } from 'bun:test';
import {
  CANONICAL_GLOBAL,
  CANONICAL_PROJECT,
  type CanonicalNode,
  findCanonical,
  walkCanonical,
} from './canonical-kb';

function* allNodes(root: CanonicalNode): Generator<CanonicalNode> {
  yield* walkCanonical(root);
}

describe('canonical KB shape', () => {
  test('CANONICAL_PROJECT is a folder anchored at the project root', () => {
    expect(CANONICAL_PROJECT.type).toBe('folder');
    expect(CANONICAL_PROJECT.relPath).toBe('');
    expect(CANONICAL_PROJECT.children).toBeDefined();
    expect((CANONICAL_PROJECT.children ?? []).length).toBeGreaterThan(0);
  });

  test('CANONICAL_GLOBAL is a folder anchored at the home root', () => {
    expect(CANONICAL_GLOBAL.type).toBe('folder');
    expect(CANONICAL_GLOBAL.relPath).toBe('');
    expect(CANONICAL_GLOBAL.label).toContain('~');
    expect((CANONICAL_GLOBAL.children ?? []).length).toBeGreaterThan(0);
  });

  test('every node has a non-empty oneLiner under 120 chars', () => {
    for (const root of [CANONICAL_PROJECT, CANONICAL_GLOBAL]) {
      for (const n of allNodes(root)) {
        expect(n.oneLiner.length).toBeGreaterThan(0);
        expect(n.oneLiner.length).toBeLessThanOrEqual(120);
      }
    }
  });

  test('every node has a non-empty when and description', () => {
    for (const root of [CANONICAL_PROJECT, CANONICAL_GLOBAL]) {
      for (const n of allNodes(root)) {
        expect(n.when.length).toBeGreaterThan(0);
        expect(n.description.length).toBeGreaterThan(20);
      }
    }
  });

  test('relPath uniqueness within each tree', () => {
    for (const root of [CANONICAL_PROJECT, CANONICAL_GLOBAL]) {
      const seen = new Set<string>();
      for (const n of allNodes(root)) {
        if (seen.has(n.relPath)) throw new Error(`duplicate relPath: ${n.relPath}`);
        seen.add(n.relPath);
      }
    }
  });

  test('findCanonical finds CLAUDE.md in project tree', () => {
    const found = findCanonical(CANONICAL_PROJECT, 'CLAUDE.md');
    expect(found).not.toBeNull();
    expect(found?.label).toBe('CLAUDE.md');
    expect(found?.injects).toBe(true);
  });

  test('findCanonical returns null for unknown path', () => {
    expect(findCanonical(CANONICAL_PROJECT, 'does-not-exist.md')).toBeNull();
  });

  test('global tree includes ~/.claude/CLAUDE.md as injecting', () => {
    const claudeMd = findCanonical(CANONICAL_GLOBAL, '.claude/CLAUDE.md');
    expect(claudeMd).not.toBeNull();
    expect(claudeMd?.injects).toBe(true);
  });

  test('every folder with children has only file/folder leaves', () => {
    for (const root of [CANONICAL_PROJECT, CANONICAL_GLOBAL]) {
      for (const n of allNodes(root)) {
        if (n.children) {
          for (const c of n.children) {
            expect(['file', 'folder']).toContain(c.type);
          }
        }
      }
    }
  });
});
