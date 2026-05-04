import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { json as jsonLang } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { marked } from 'marked';

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
 * Renders the body of an injected (or arbitrary) text artifact, with
 * rendered/source toggle handling done by the caller. Detects JSON and
 * pretty-prints it; everything else goes through marked.
 */
export function ViewerBody({
  content,
  viewMode,
}: {
  content: string;
  viewMode: 'rendered' | 'source';
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

  if (viewMode === 'rendered') {
    return (
      <div
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
