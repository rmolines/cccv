import clsx from 'clsx';

type Tone = 'neutral' | 'ok' | 'warn' | 'err' | 'info';

const TONE_CLS: Record<Tone, string> = {
  neutral: 'bg-zinc-800 text-zinc-400',
  ok: 'bg-emerald-900/40 text-emerald-300',
  warn: 'bg-amber-900/30 text-amber-300',
  err: 'bg-red-900/40 text-red-300',
  info: 'bg-sky-900/40 text-sky-300',
};

export function StatusBadge({
  label,
  tone = 'neutral',
  title,
}: {
  label: string;
  tone?: Tone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center rounded text-[10.5px] font-semibold tracking-wider uppercase px-1.5 py-[2px] leading-none',
        TONE_CLS[tone],
      )}
    >
      {label}
    </span>
  );
}
