import { describe, expect, test } from 'bun:test';
import { mergeSettings, type SettingsLayer } from './settings';

function layer(
  name: SettingsLayer['name'],
  content: Record<string, unknown> | null,
): SettingsLayer {
  return { name, path: `/fake/${name}`, content, exists: content !== null };
}

describe('mergeSettings', () => {
  test('concatenates hooks across layers', () => {
    const layers: SettingsLayer[] = [
      layer('user', { hooks: { SessionStart: [{ a: 1 }] } }),
      layer('project', { hooks: { SessionStart: [{ b: 2 }] } }),
    ];
    const merged = mergeSettings(layers);
    expect(merged.hooks.SessionStart).toEqual([{ a: 1 }, { b: 2 }]);
  });

  test('hookOrigins records which layer each entry came from', () => {
    const layers: SettingsLayer[] = [
      layer('user', { hooks: { SessionStart: [{ a: 1 }] } }),
      layer('project', { hooks: { SessionStart: [{ b: 2 }, { c: 3 }] } }),
    ];
    const merged = mergeSettings(layers);
    expect(merged.hookOrigins).toEqual([
      { event: 'SessionStart', index: 0, layer: 'user' },
      { event: 'SessionStart', index: 1, layer: 'project' },
      { event: 'SessionStart', index: 2, layer: 'project' },
    ]);
  });

  test('mcpServers last-wins by name', () => {
    const layers: SettingsLayer[] = [
      layer('user', { mcpServers: { foo: { url: 'a' } } }),
      layer('project', { mcpServers: { foo: { url: 'b' }, bar: { url: 'c' } } }),
    ];
    const merged = mergeSettings(layers);
    expect(merged.mcpServers).toEqual({
      foo: { url: 'b' },
      bar: { url: 'c' },
    });
  });

  test('scalar outputStyle: managed overrides project overrides user', () => {
    const layers: SettingsLayer[] = [
      layer('user', { outputStyle: 'a' }),
      layer('project', { outputStyle: 'b' }),
      layer('managed', { outputStyle: 'managed-wins' }),
    ];
    const merged = mergeSettings(layers);
    expect(merged.outputStyle).toBe('managed-wins');
  });

  test('handles missing layers gracefully', () => {
    const layers: SettingsLayer[] = [
      layer('user', null),
      layer('project', { hooks: { SessionStart: [{ x: 1 }] } }),
    ];
    const merged = mergeSettings(layers);
    expect(merged.hooks.SessionStart).toEqual([{ x: 1 }]);
  });

  test('handles invalid hooks (not array)', () => {
    const layers: SettingsLayer[] = [
      layer('user', { hooks: { SessionStart: 'not-an-array' } }),
    ];
    const merged = mergeSettings(layers);
    expect(merged.hooks.SessionStart).toBeUndefined();
  });
});
