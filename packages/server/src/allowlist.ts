import { homedir } from 'node:os';
import { realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const HOME = homedir();
const CC_USER_DIR = `${HOME}${sep}.claude`;

export type Allowlist = {
  roots: string[];
};

async function safeRealpath(p: string): Promise<string> {
  try {
    return await realpath(p);
  } catch {
    return p;
  }
}

/** Build allowlist with each root real-resolved (handles symlinks like /var → /private/var on macOS). */
export async function buildResolvedAllowlist(cwd: string): Promise<Allowlist> {
  const al = buildAllowlist(cwd);
  const real = await Promise.all(al.roots.map(safeRealpath));
  return { roots: Array.from(new Set([...al.roots, ...real])) };
}

/**
 * Build the read allowlist for a given cwd. Includes ~/.claude and the
 * cwd. Parents of cwd up to home are included only when cwd is under
 * home (so memory files in ancestor dirs can be served). When cwd is
 * outside home (e.g. tmpdirs in /var on macOS), we limit to just cwd
 * to avoid exposing unrelated parts of the filesystem.
 */
export function buildAllowlist(cwd: string): Allowlist {
  const absCwd = resolve(cwd);
  const roots: string[] = [CC_USER_DIR];
  if (!roots.includes(absCwd)) roots.push(absCwd);

  if (absCwd === HOME || absCwd.startsWith(`${HOME}${sep}`)) {
    let cur = absCwd;
    while (cur !== HOME) {
      const parent = cur.split(sep).slice(0, -1).join(sep) || sep;
      if (parent === cur) break;
      cur = parent;
      if (!roots.includes(cur)) roots.push(cur);
      if (cur === HOME) break;
    }
  }
  return { roots };
}

/**
 * Resolve the requested path through the filesystem (following symlinks)
 * and verify the resulting absolute path is contained in one of the
 * allowlist roots. Returns the resolved real path on success.
 *
 * Throws an Error if the path is outside the allowlist or doesn't exist.
 */
export async function authorizePath(
  requested: string,
  allowlist: Allowlist,
): Promise<string> {
  if (typeof requested !== 'string' || requested.length === 0) {
    throw new Error('path required');
  }
  const abs = resolve(requested);
  let real: string;
  try {
    real = await realpath(abs);
  } catch {
    throw new Error('path not found');
  }
  for (const root of allowlist.roots) {
    if (real === root || real.startsWith(`${root}${sep}`)) return real;
  }
  throw new Error('path outside allowlist');
}
