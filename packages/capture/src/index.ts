import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { basename } from 'node:path';
import type { Injection, ImportEdge, Snapshot, NeighborFile } from '@cccv/shared';
import { discoverMemoryFiles, discoverRules, discoverNeighbors, type DiscoveredFile } from './static/walker';
import {
  MAX_IMPORT_DEPTH,
  resolveImports,
  type ResolvedImport,
} from './static/imports';
import { loadSettingsLayers, mergeSettings } from './static/settings';
import { discoverSkills } from './static/skills';
import { runDynamicCapture, type DynamicCaptureResult } from './dynamic/sdk-runner';
import { estimateTokens } from './tokens';

export { runDynamicCapture };
export type { DynamicCaptureResult };

function id(parts: string[]): string {
  return createHash('sha256').update(parts.join('::')).digest('hex').slice(0, 16);
}

/**
 * Hook output is typically JSON shaped like
 *   `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}`
 * For UI we want the additionalContext text. Fall back to raw output if unparseable.
 */
function parseHookOutput(raw: string): string {
  if (!raw) return '';
  try {
    const obj = JSON.parse(raw) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    if (typeof obj?.hookSpecificOutput?.additionalContext === 'string') {
      return obj.hookSpecificOutput.additionalContext;
    }
  } catch {
    // not JSON; treat as plain text
  }
  return raw;
}

async function expandFileWithImports(
  file: DiscoveredFile,
  baseInjections: Injection[],
  ancestors: Set<string>,
  depth: number,
  warnings: string[],
): Promise<{ injection: Injection; childIds: string[] }> {
  const injectionId = id(['fs-static', file.path]);
  const edges: ImportEdge[] = [];
  const childIds: string[] = [];

  if (file.autoLoaded && depth <= MAX_IMPORT_DEPTH) {
    const ancestorsForChildren = new Set(ancestors);
    ancestorsForChildren.add(file.path);
    let resolved: ResolvedImport[] = [];
    try {
      resolved = await resolveImports(file.path, file.content, ancestors);
    } catch (err) {
      warnings.push(
        `Failed to resolve imports of ${file.path}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    for (const r of resolved) {
      edges.push(r.edge);
      if (r.edge.cycle) {
        warnings.push(`Import cycle detected: ${r.edge.from} → ${r.edge.to}`);
        continue;
      }
      if (!r.edge.resolved) {
        warnings.push(`Unresolved @import: ${r.edge.to} (from ${r.edge.from})`);
        continue;
      }
      if (depth + 1 > MAX_IMPORT_DEPTH) {
        warnings.push(`Max import depth ${MAX_IMPORT_DEPTH} exceeded at ${r.edge.to}`);
        continue;
      }
      const childFile: DiscoveredFile = {
        path: r.absolute!,
        category: 'memory',
        autoLoaded: true,
        content: r.content!,
      };
      const child = await expandFileWithImports(
        childFile,
        baseInjections,
        ancestorsForChildren,
        depth + 1,
        warnings,
      );
      child.injection.parentId = injectionId;
      baseInjections.push(child.injection);
      childIds.push(child.injection.id);
    }
  }

  const injection: Injection = {
    id: injectionId,
    origin: 'fs-static',
    title: file.path,
    source: { path: file.path },
    content: file.content,
    tokenEstimate: estimateTokens(file.content),
    imports: edges.length ? edges : undefined,
  };
  return { injection, childIds };
}

export type CaptureSnapshotOptions = {
  cwd: string;
  /** Skip the dynamic SDK session. Useful for tests or when no auth is available. */
  skipDynamic?: boolean;
};

export async function captureSnapshot(
  opts: CaptureSnapshotOptions,
): Promise<Snapshot> {
  const { cwd, skipDynamic = false } = opts;
  const warnings: string[] = [];
  const injections: Injection[] = [];

  // ---- Static: memory files + their @imports ----
  // Two passes so candidate (not auto-loaded) entries don't duplicate files
  // that are actually pulled in via @import from an auto-loaded ancestor.
  const memoryFiles = await discoverMemoryFiles(cwd);
  const importedPaths = new Set<string>();
  for (const f of memoryFiles) {
    if (!f.autoLoaded) continue;
    const before = injections.length;
    const { injection } = await expandFileWithImports(
      f,
      injections,
      new Set([f.path]),
      1,
      warnings,
    );
    injections.push(injection);
    // Children appended by expandFileWithImports live in [before, injections.length-1]
    for (let i = before; i < injections.length; i++) {
      const path = injections[i]?.source.path;
      if (path) importedPaths.add(path);
    }
  }
  for (const f of memoryFiles) {
    if (f.autoLoaded) continue;
    if (importedPaths.has(f.path)) continue; // already shown as an @import child
    injections.push({
      id: id(['fs-static-candidate', f.path]),
      origin: 'fs-static',
      title: `${basename(f.path)} (not auto-loaded)`,
      source: { path: f.path },
      content: f.content,
      tokenEstimate: estimateTokens(f.content),
    });
    if (f.notLoadedReason) warnings.push(`${f.path}: ${f.notLoadedReason}`);
  }

  // ---- Static: rules ----
  const rules = await discoverRules(cwd);
  for (const r of rules) {
    injections.push({
      id: id(['fs-static-rule', r.path]),
      origin: 'fs-static',
      title: `rule: ${basename(r.path)}${r.autoLoaded ? '' : ' (path-scoped)'}`,
      source: { path: r.path },
      content: r.content,
      tokenEstimate: estimateTokens(r.content),
    });
    if (!r.autoLoaded && r.notLoadedReason) {
      warnings.push(`${r.path}: ${r.notLoadedReason}`);
    }
  }

  // ---- Parsed-runtime: skills ----
  const skills = await discoverSkills(cwd);
  for (const s of skills) {
    const content = `name: ${s.name}\ndescription: ${s.description}\n\n(source: ${s.source}${s.plugin ? ` / ${s.plugin}` : ''})`;
    injections.push({
      id: id(['skill', s.path]),
      origin: 'parsed-runtime',
      title: `skill: ${s.name}`,
      source: { path: s.path, plugin: s.plugin },
      content,
      tokenEstimate: estimateTokens(content),
    });
  }

  // ---- Parsed-runtime: settings (informational only) ----
  const layers = await loadSettingsLayers(cwd);
  const merged = mergeSettings(layers);
  for (const layer of layers) {
    if (!layer.exists) continue;
    if (layer.parseError) {
      warnings.push(`Settings layer ${layer.name} (${layer.path}) failed to parse: ${layer.parseError}`);
      continue;
    }
    const content = JSON.stringify(layer.content, null, 2);
    injections.push({
      id: id(['settings', layer.path]),
      origin: 'parsed-runtime',
      title: `settings: ${layer.name}`,
      source: { path: layer.path },
      content,
      tokenEstimate: estimateTokens(content),
    });
  }
  // Summary of merged hooks
  const hookCount = Object.values(merged.hooks).reduce((acc, arr) => acc + arr.length, 0);
  if (hookCount > 0) {
    const summary = JSON.stringify(merged.hooks, null, 2);
    injections.push({
      id: id(['settings', 'merged-hooks']),
      origin: 'parsed-runtime',
      title: `merged hooks (${hookCount})`,
      source: {},
      content: summary,
      tokenEstimate: estimateTokens(summary),
    });
  }

  // ---- Dynamic: actual SessionStart capture ----
  if (!skipDynamic) {
    let result: DynamicCaptureResult | null = null;
    try {
      result = await runDynamicCapture({ cwd });
    } catch (err) {
      warnings.push(
        `Dynamic capture skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (result) {
      warnings.push(...result.warnings);

      // Each settings-defined SessionStart hook's actual injected content.
      // hook_name from CC is generic (e.g. "SessionStart:startup") so we
      // append a short hookId disambiguator and stash the full id in source
      // so the user can correlate with settings.json `hooks` entries.
      for (const r of result.hookResponses) {
        const content = parseHookOutput(r.output);
        if (!content.trim()) continue;
        const idShort = r.hookId ? r.hookId.slice(0, 8) : 'unknown';
        injections.push({
          id: id(['hook-capture', r.hookId || `anon-${injections.length}`]),
          origin: 'hook-capture',
          title: `${r.hookName} [${idShort}]`,
          source: { hookName: r.hookName },
          content,
          tokenEstimate: estimateTokens(content),
        });
      }

      // Init: tools, mcp servers, plugins — what the runtime exposes to the model
      if (result.init) {
        const init = result.init;
        const toolsContent = init.tools.join('\n');
        injections.push({
          id: id(['hook-capture', 'init', 'tools']),
          origin: 'hook-capture',
          title: `runtime tools (${init.tools.length})`,
          source: { hookName: 'init.tools' },
          content: toolsContent,
          tokenEstimate: estimateTokens(toolsContent),
        });
        if (init.mcpServers && init.mcpServers.length) {
          const mcpContent = JSON.stringify(init.mcpServers, null, 2);
          injections.push({
            id: id(['hook-capture', 'init', 'mcp']),
            origin: 'hook-capture',
            title: `mcp servers (${init.mcpServers.length})`,
            source: { hookName: 'init.mcpServers' },
            content: mcpContent,
            tokenEstimate: estimateTokens(mcpContent),
          });
        }
        if (init.plugins && init.plugins.length) {
          const pluginsContent = JSON.stringify(init.plugins, null, 2);
          injections.push({
            id: id(['hook-capture', 'init', 'plugins']),
            origin: 'hook-capture',
            title: `plugins (${init.plugins.length})`,
            source: { hookName: 'init.plugins' },
            content: pluginsContent,
            tokenEstimate: estimateTokens(pluginsContent),
          });
        }
      } else if (result.hookResponses.length === 0) {
        warnings.push('Dynamic capture returned no hook responses or init');
      }
    }
  }

  const totalTokens = injections.reduce((acc, i) => acc + i.tokenEstimate, 0);

  // ---- Neighbors: non-injected files in .claude/ ----
  // Surface them in the directory tree as "extra real" entries. Bodies are
  // loaded on demand via /api/file when the user actually opens one.
  let neighbors: NeighborFile[] = [];
  try {
    neighbors = await discoverNeighbors(cwd);
  } catch (err) {
    warnings.push(
      `Neighbor discovery failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    capturedAt: new Date().toISOString(),
    cwd,
    home: homedir(),
    injections,
    totalTokens,
    warnings,
    neighbors,
  };
}
