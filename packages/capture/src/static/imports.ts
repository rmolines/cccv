import { homedir } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import type { ImportEdge } from '@cccv/shared';

export const MAX_IMPORT_DEPTH = 5;

const IMPORT_RE = /(?<![A-Za-z0-9_/.-])@([^\s]+\.md)\b/g;

export function extractImportSpecs(content: string): string[] {
  const specs: string[] = [];
  for (const m of content.matchAll(IMPORT_RE)) {
    if (m[1]) specs.push(m[1]);
  }
  return specs;
}

export function resolveImportPath(spec: string, fromFile: string): string {
  if (spec.startsWith('~/') || spec === '~') {
    return resolve(homedir(), spec.slice(2));
  }
  if (isAbsolute(spec)) return resolve(spec);
  return resolve(dirname(fromFile), spec);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}

export type ResolvedImport = {
  edge: ImportEdge;
  /** Absolute path, present only when resolved && !cycle */
  absolute?: string;
  /** Content of the imported file, present only when resolved && !cycle */
  content?: string;
};

/**
 * Resolve all @imports in a file's content. Pure function over ancestor set
 * so callers can implement BFS/DFS cycle detection.
 */
export async function resolveImports(
  fromFile: string,
  content: string,
  ancestorAbsolutePaths: Set<string>,
): Promise<ResolvedImport[]> {
  const specs = extractImportSpecs(content);
  const out: ResolvedImport[] = [];
  for (const spec of specs) {
    const abs = resolveImportPath(spec, fromFile);
    if (ancestorAbsolutePaths.has(abs)) {
      out.push({
        edge: { from: fromFile, to: abs, resolved: true, cycle: true },
      });
      continue;
    }
    const exists = await fileExists(abs);
    if (!exists) {
      out.push({ edge: { from: fromFile, to: abs, resolved: false } });
      continue;
    }
    const fileContent = await readFile(abs, 'utf8');
    out.push({
      edge: { from: fromFile, to: abs, resolved: true },
      absolute: abs,
      content: fileContent,
    });
  }
  return out;
}
