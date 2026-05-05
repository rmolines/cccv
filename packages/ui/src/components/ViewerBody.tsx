import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { json as jsonLang } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { marked } from 'marked';
import type { ImportEdge } from '@cccv/shared';

const cmTheme = EditorView.theme(
  {
    '&': { backgroundColor: 'transparent', color: 'rgb(228 228 231)', fontSize: '13px' },
    '.cm-content': { caretColor: 'rgb(244 244 245)' },
    '.cm-gutters': {
      backgroundColor: 'rgb(24 24 27)',
      color: 'rgb(82 82 91)',
      borderRight: '1px solid rgb(39 39 42)',
    },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(59,130,246,0.3) !important' },
  },
  { dark: true },
);

export type Detected = { kind: 'json'; pretty: string } | { kind: 'markdown' };

export function detectContent(text: string): Detected {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return { kind: 'markdown' };
  try {
    const parsed = JSON.parse(trimmed);
    return { kind: 'json', pretty: JSON.stringify(parsed, null, 2) };
  } catch {
    return { kind: 'markdown' };
  }
}

/**
 * Walk text nodes inside `el` and replace any `@<spec>.md` mentions with
 * anchor elements that carry the absolute target path on a `data-cccv-target`
 * attribute. Skips text inside `<code>` and `<pre>` so we never touch fenced
 * code or inline literals. Only mentions whose spec maps to a resolved
 * `ImportEdge` get linkified — broken/unresolved imports stay as plain text.
 */
function linkifyImports(el: HTMLElement, imports: ImportEdge[]): void {
  if (imports.length === 0) return;
  // Build a lookup keyed by both the textual spec and any tail-suffix that
  // matches the resolved path basename. The capture engine's edge.to is the
  // resolved absolute path; edge.from is the parent file path. We don't have
  // the original spec text here, so we walk the rendered text and for each
  // candidate `@something.md`, attempt to resolve by suffix match.
  const resolvedTargets = imports.filter((e) => e.resolved && !e.cycle).map((e) => e.to);

  function findTargetForSpec(spec: string): string | null {
    // Strip leading slashes so e.g. `@./foo.md` and `@foo.md` both match
    // tail patterns.
    const tail = spec.replace(/^\.\//, '').replace(/^~\//, '').replace(/^\//, '');
    for (const abs of resolvedTargets) {
      if (abs.endsWith(`/${tail}`) || abs.endsWith(tail)) return abs;
    }
    return null;
  }

  const SKIP_TAGS = new Set(['CODE', 'PRE', 'A', 'SCRIPT', 'STYLE']);
  const PATTERN = /(?<![A-Za-z0-9_/.\-])@([^\s<>"'`]+\.md)\b/g;

  function visit(node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName;
      if (SKIP_TAGS.has(tag)) return;
      // Snapshot children before mutating (replaceChild invalidates live list).
      const kids = Array.from(node.childNodes);
      for (const child of kids) visit(child);
      return;
    }
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.nodeValue ?? '';
    if (!text.includes('@')) return;

    PATTERN.lastIndex = 0;
    const fragments: (string | HTMLElement)[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    let matched = false;
    while ((m = PATTERN.exec(text))) {
      const [whole, spec] = m;
      const target = findTargetForSpec(spec ?? '');
      if (!target) continue;
      matched = true;
      if (m.index > lastIndex) fragments.push(text.slice(lastIndex, m.index));
      const a = document.createElement('a');
      a.className = 'cccv-import-link';
      a.dataset.cccvTarget = target;
      a.textContent = whole;
      fragments.push(a);
      lastIndex = m.index + whole.length;
    }
    if (!matched) return;
    if (lastIndex < text.length) fragments.push(text.slice(lastIndex));

    const parent = node.parentNode;
    if (!parent) return;
    const frag = document.createDocumentFragment();
    for (const f of fragments) {
      frag.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
    }
    parent.replaceChild(frag, node);
  }

  visit(el);
}

/**
 * Renders the body of an injected (or arbitrary) text artifact, with
 * rendered/source toggle handling done by the caller. Detects JSON and
 * pretty-prints it; everything else goes through marked.
 *
 * If `imports` and `onNavigate` are supplied, `@<path>.md` mentions in
 * rendered markdown become clickable links that resolve to the import's
 * absolute target and call `onNavigate(target)`.
 */
export function ViewerBody({
  content,
  viewMode,
  imports,
  onNavigate,
}: {
  content: string;
  viewMode: 'rendered' | 'source';
  imports?: ImportEdge[];
  onNavigate?: (absPath: string) => void;
}) {
  const detected = useMemo(() => detectContent(content), [content]);
  const isJson = detected.kind === 'json';
  const sourceText = isJson ? detected.pretty : content;
  const html = useMemo(() => {
    if (viewMode !== 'rendered') return '';
    if (detected.kind === 'json') {
      const escaped = detected.pretty
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<pre class="json-pretty"><code>${escaped}</code></pre>`;
    }
    try {
      return marked.parse(content, { async: false }) as string;
    } catch {
      return '';
    }
  }, [content, viewMode, detected]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Post-process the rendered HTML to turn `@xxx.md` mentions into
  // clickable navigation anchors. Runs after each render so prop changes
  // (content swap, imports change) re-link correctly.
  useEffect(() => {
    if (viewMode !== 'rendered') return;
    if (detected.kind !== 'markdown') return;
    if (!imports || imports.length === 0) return;
    const el = containerRef.current;
    if (!el) return;
    linkifyImports(el, imports);
  }, [html, viewMode, imports, detected]);

  // Delegated click handler so swapping HTML doesn't lose the listener.
  useEffect(() => {
    if (viewMode !== 'rendered') return;
    if (!onNavigate) return;
    const el = containerRef.current;
    if (!el) return;
    function handle(ev: MouseEvent): void {
      let node = ev.target as HTMLElement | null;
      while (node && node !== el) {
        if (node instanceof HTMLAnchorElement && node.dataset.cccvTarget) {
          ev.preventDefault();
          onNavigate?.(node.dataset.cccvTarget);
          return;
        }
        node = node.parentElement;
      }
    }
    el.addEventListener('click', handle);
    return () => el.removeEventListener('click', handle);
  }, [viewMode, onNavigate]);

  if (viewMode === 'rendered') {
    return (
      <div
        ref={containerRef}
        className="prose-md px-6 py-4 max-w-3xl mx-auto text-zinc-200"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: marked output, content is local
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <CodeMirror
      value={sourceText}
      readOnly
      extensions={[isJson ? jsonLang() : markdown(), cmTheme, EditorView.lineWrapping]}
      basicSetup={{
        lineNumbers: true,
        foldGutter: isJson,
        highlightActiveLine: false,
      }}
      theme="dark"
    />
  );
}
