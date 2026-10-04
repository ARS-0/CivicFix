import { STATUSES, STATUS_COLOR, priorityTone } from '@/lib/constants';

export function StatusBadge({ status }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold" style={{ color: STATUS_COLOR[status], borderColor: STATUS_COLOR[status] + '55', background: STATUS_COLOR[status] + '12' }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[status] }} />{status}
    </span>
  );
}

export function PriorityPill({ score }) {
  const t = priorityTone(score);
  return <span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: t.c }} title="AI priority score">{t.label} {score}</span>;
}

export function Stepper({ status }) {
  const idx = STATUSES.indexOf(status);
  return (
    <ol className="flex w-full items-start" aria-label="Progress">
      {STATUSES.map((s, i) => (
        <li key={s} className="relative flex flex-1 flex-col items-center text-center">
          {i > 0 && <span className="absolute right-1/2 top-3 h-0.5 w-full" style={{ background: i <= idx ? '#14503C' : '#D8DDD2' }} />}
          <span className="relative z-10 grid h-6 w-6 place-items-center rounded-full border-2 text-[11px] font-bold" style={{ background: i <= idx ? '#14503C' : '#fff', borderColor: i <= idx ? '#14503C' : '#D8DDD2', color: i <= idx ? '#fff' : '#5B6770' }}>{i < idx ? '✓' : ''}</span>
          <span className={`mt-1.5 text-[11px] leading-tight sm:text-xs ${i === idx ? 'font-bold' : 'text-mute'}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
}
