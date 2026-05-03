import { useState } from 'react';
import type { Injection } from '@cccv/shared';
import clsx from 'clsx';

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function Btn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => Promise<void> | void;
  disabled?: boolean;
}) {
  const [flash, setFlash] = useState<'idle' | 'ok' | 'err'>('idle');
  return (
    <button
      type="button"
      disabled={disabled || flash !== 'idle'}
      onClick={async () => {
        try {
          await onClick();
          setFlash('ok');
        } catch {
          setFlash('err');
        }
        setTimeout(() => setFlash('idle'), 1200);
      }}
      className={clsx(
        'text-xs px-2 py-1 rounded border transition-colors',
        disabled
          ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
          : flash === 'ok'
            ? 'border-emerald-700 bg-emerald-900/40 text-emerald-200'
            : flash === 'err'
              ? 'border-red-700 bg-red-900/40 text-red-200'
              : 'border-zinc-700 hover:bg-zinc-800 text-zinc-200',
      )}
    >
      {flash === 'ok' ? 'Copied' : flash === 'err' ? 'Error' : label}
    </button>
  );
}

export function CopyActions({ injection }: { injection: Injection }) {
  const path = injection.source.path;
  const editable = injection.origin === 'fs-static' && !!path;

  return (
    <div className="flex items-center gap-2">
      <Btn
        label="Copy path"
        disabled={!path}
        onClick={async () => {
          if (!path) throw new Error('no path');
          await copy(path);
        }}
      />
      <Btn
        label="Copy as prompt"
        disabled={!editable}
        onClick={async () => {
          if (!path) throw new Error('no path');
          const t = `Edit \`${path}\`. Current content:\n\n\`\`\`md\n${injection.content}\n\`\`\`\n\nChange:`;
          await copy(t);
        }}
      />
      <Btn
        label="Copy content"
        onClick={async () => {
          await copy(injection.content);
        }}
      />
    </div>
  );
}
