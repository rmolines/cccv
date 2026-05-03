import { readFile, stat } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export type SettingsLayer = {
  /** Logical name */
  name:
    | 'managed'
    | 'user'
    | 'user-local'
    | 'project'
    | 'project-local';
  /** Absolute path */
  path: string;
  /** Parsed JSON content; null if missing or invalid */
  content: Record<string, unknown> | null;
  /** Parse error message, if any */
  parseError?: string;
  /** True if file existed */
  exists: boolean;
};

const HOME = homedir();

function managedPath(): string {
  switch (platform()) {
    case 'darwin':
      return '/Library/Application Support/ClaudeCode/managed-settings.json';
    case 'win32':
      return 'C:\\ProgramData\\ClaudeCode\\managed-settings.json';
    default:
      return '/etc/claude-code/managed-settings.json';
  }
}

async function readLayer(
  name: SettingsLayer['name'],
  path: string,
): Promise<SettingsLayer> {
  let exists = false;
  try {
    exists = (await stat(path)).isFile();
  } catch {
    return { name, path, content: null, exists: false };
  }
  if (!exists) return { name, path, content: null, exists: false };
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw);
    return { name, path, content: parsed, exists: true };
  } catch (err) {
    return {
      name,
      path,
      content: null,
      exists: true,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function loadSettingsLayers(cwd: string): Promise<SettingsLayer[]> {
  return Promise.all([
    readLayer('managed', managedPath()),
    readLayer('user', join(HOME, '.claude', 'settings.json')),
    readLayer('user-local', join(HOME, '.claude', 'settings.local.json')),
    readLayer('project', join(cwd, '.claude', 'settings.json')),
    readLayer('project-local', join(cwd, '.claude', 'settings.local.json')),
  ]);
}

export type MergedSettings = {
  hooks: Record<string, unknown[]>; // event → array (concatenated across layers)
  mcpServers: Record<string, unknown>; // last-wins by name
  outputStyle?: string;
  model?: string;
  /** Per-array entry: which layer defined it */
  hookOrigins: Array<{ event: string; index: number; layer: SettingsLayer['name'] }>;
};

/**
 * Merge layers in precedence order: arrays concatenate, scalars last-wins
 * with managed > project-local > project > user-local > user precedence
 * (managed has highest precedence per CC docs).
 *
 * For our use case, we WANT to display all hooks from all layers, so we
 * concatenate hooks regardless. For scalars, we apply real precedence.
 */
export function mergeSettings(layers: SettingsLayer[]): MergedSettings {
  const merged: MergedSettings = {
    hooks: {},
    mcpServers: {},
    hookOrigins: [],
  };

  // Process from lowest to highest precedence so higher overrides scalars.
  // Order: user, user-local, project, project-local, managed
  const order: SettingsLayer['name'][] = [
    'user',
    'user-local',
    'project',
    'project-local',
    'managed',
  ];
  const byName = new Map(layers.map((l) => [l.name, l] as const));

  for (const name of order) {
    const layer = byName.get(name);
    if (!layer || !layer.content) continue;
    const c = layer.content;

    // hooks: concat
    if (c.hooks && typeof c.hooks === 'object') {
      for (const [event, entries] of Object.entries(c.hooks as Record<string, unknown>)) {
        if (!Array.isArray(entries)) continue;
        const cur = merged.hooks[event] ?? [];
        for (const entry of entries) {
          merged.hookOrigins.push({ event, index: cur.length, layer: name });
          cur.push(entry);
        }
        merged.hooks[event] = cur;
      }
    }

    // mcpServers: last-wins per name
    if (c.mcpServers && typeof c.mcpServers === 'object') {
      Object.assign(merged.mcpServers, c.mcpServers as Record<string, unknown>);
    }

    if (typeof c.outputStyle === 'string') merged.outputStyle = c.outputStyle;
    if (typeof c.model === 'string') merged.model = c.model;
  }

  return merged;
}
