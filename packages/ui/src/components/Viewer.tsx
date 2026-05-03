import { useMemo } from 'react';
import type { Injection } from '@cccv/shared';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { json as jsonLang } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { marked } from 'marked';
import clsx from 'clsx';
import { OriginBadge } from './OriginBadge';
import { CopyActions } from './CopyActions';

function detectContent(text: string): { kind: 'json'; pretty: string } | { kind: 'markdown' } {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return { kind: 'markdown' };
  try {
    const parsed = JSON.parse(trimmed);
    return { kind: 'json', pretty: JSON.stringify(parsed, null, 2) };
  } catch {
    return { kind: 'markdown' };
  }
}

type Props = {
  injection: Injection | null;
  viewMode: 'rendered' | 'source';
  onChangeViewMode: (m: 'rendered' | 'source') => void;
};

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

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function Viewer({ injection, viewMode, onChangeViewMode }: Props) {
  const detected = useMemo(
    () => (injection ? detectContent(injection.content) : null),
    [injection],
  );
  const isJson = detected?.kind === 'json';
  const sourceText = isJson && detected ? detected.pretty : injection?.content ?? '';
  const html = useMemo(() => {
    if (!injection || viewMode !== 'rendered') return '';
    if (detected?.kind === 'json') {
      const escaped = detected.pretty
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<pre class="json-pretty"><code>${escaped}</code></pre>`;
    }
    try {
      return marked.parse(injection.content, { async: false }) as string;
    } catch {
      return '';
    }
  }, [injection, viewMode, detected]);

  if (!injection) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Select an injection on the left to view its content.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-900/40">
        <OriginBadge origin={injection.origin} />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-zinc-100 truncate" title={injection.title}>
            {injection.title}
          </div>
          {injection.source.path && (
            <div className="text-[11px] text-zinc-500 truncate font-mono" title={injection.source.path}>
              {injection.source.path}
            </div>
          )}
        </div>
        <span
          className="text-xs text-zinc-400 tabular-nums"
          title={`${injection.tokenEstimate} tokens (estimate)`}
        >
          {fmtTokens(injection.tokenEstimate)} tok
        </span>
        <div className="inline-flex border border-zinc-700 rounded text-xs overflow-hidden">
          <button
            type="button"
            onClick={() => onChangeViewMode('rendered')}
            className={clsx(
              'px-2 py-0.5',
              viewMode === 'rendered' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800',
            )}
          >
            rendered
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('source')}
            className={clsx(
              'px-2 py-0.5 border-l border-zinc-700',
              viewMode === 'source' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800',
            )}
          >
            source
          </button>
        </div>
        <CopyActions injection={injection} />
      </div>

      {injection.imports && injection.imports.length > 0 && (
        <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/20 text-xs">
          <div className="text-zinc-500 mb-1">Imports:</div>
          <ul className="space-y-1">
            {injection.imports.map((e) => (
              <li
                key={`${e.from}::${e.to}`}
                className={clsx(
                  'font-mono truncate',
                  e.cycle
                    ? 'text-amber-400'
                    : !e.resolved
                      ? 'text-red-400'
                      : 'text-emerald-400',
                )}
                title={e.to}
              >
                {e.cycle ? '↻ cycle: ' : !e.resolved ? '✗ missing: ' : '→ '}
                {e.to}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {viewMode === 'rendered' ? (
          <div
            className="prose-md px-6 py-4 max-w-3xl mx-auto text-zinc-200"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: marked output, content is local
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
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
        )}
      </div>
    </div>
  );
}
