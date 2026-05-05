import type { Snapshot, SsePatch } from '@cccv/shared';

const base = ''; // same origin

export async function fetchSnapshot(): Promise<Snapshot> {
  const r = await fetch(`${base}/api/snapshot`);
  if (!r.ok) throw new Error(`snapshot ${r.status}`);
  return (await r.json()) as Snapshot;
}

export async function refreshSnapshot(): Promise<Snapshot> {
  const r = await fetch(`${base}/api/refresh`, { method: 'POST' });
  if (!r.ok) throw new Error(`refresh ${r.status}`);
  return (await r.json()) as Snapshot;
}

export async function switchCwd(path: string): Promise<Snapshot> {
  const r = await fetch(`${base}/api/switch-cwd`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!r.ok) {
    let msg = `switch-cwd ${r.status}`;
    try {
      const body = (await r.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return (await r.json()) as Snapshot;
}

export async function fetchFile(path: string): Promise<{ path: string; content: string }> {
  const r = await fetch(`${base}/api/file?path=${encodeURIComponent(path)}`);
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`file ${r.status}: ${body}`);
  }
  return (await r.json()) as { path: string; content: string };
}

export type SseHandler = (patch: SsePatch) => void;

export function subscribeEvents(onPatch: SseHandler): () => void {
  let closed = false;
  let es: EventSource | null = null;
  let retry = 1000;

  function open() {
    if (closed) return;
    es = new EventSource(`${base}/api/events`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as SsePatch;
        onPatch(data);
        retry = 1000; // reset backoff
      } catch {
        // ignore malformed
      }
    };
    es.onerror = () => {
      es?.close();
      es = null;
      if (closed) return;
      setTimeout(open, retry);
      retry = Math.min(retry * 2, 30_000);
    };
  }

  open();
  return () => {
    closed = true;
    es?.close();
  };
}
