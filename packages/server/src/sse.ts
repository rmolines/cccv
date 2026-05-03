import type { SsePatch } from '@cccv/shared';

type Client = {
  id: number;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

/** Trivial in-process pub/sub for SSE clients. */
export class SseHub {
  private clients = new Map<number, Client>();
  private nextId = 1;
  private encoder = new TextEncoder();

  newStream(): Response {
    const id = this.nextId++;
    let registered = false;
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.clients.set(id, { id, controller });
        registered = true;
        // initial comment to flush headers
        controller.enqueue(this.encoder.encode(`: connected\n\n`));
      },
      cancel: () => {
        if (registered) this.clients.delete(id);
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  publish(event: SsePatch): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    const bytes = this.encoder.encode(payload);
    for (const c of this.clients.values()) {
      try {
        c.controller.enqueue(bytes);
      } catch {
        this.clients.delete(c.id);
      }
    }
  }

  size(): number {
    return this.clients.size;
  }
}
