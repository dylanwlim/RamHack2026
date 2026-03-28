import { cn } from "@/lib/utils";

type Signal = {
  level: "steadier" | "mixed" | "higher-friction";
  label: string;
  confidence_label?: string;
};

export function formatDisplayDate(value?: string | null) {
  if (!value) {
    return "Unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return "Unavailable";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMiles(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return "Distance unavailable";
  }

  return `${value < 10 ? value.toFixed(1) : value.toFixed(0)} mi`;
}

export function SignalBadge({
  signal,
  className,
}: {
  signal: Signal;
  className?: string;
}) {
  return (
    <span className={cn("signal-chip", className)} data-level={signal.level}>
      <span>{signal.label}</span>
      {signal.confidence_label ? (
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs">{signal.confidence_label}</span>
      ) : null}
    </span>
  );
}

export function MetricPill({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3", className)}>
      <div className="text-[0.72rem] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-medium tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

export function CalloutList({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700 sm:text-base">
          <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#156d95]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function TagList({
  items,
  emptyLabel = "Unavailable",
}: {
  items: string[];
  emptyLabel?: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function EmptyState({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="surface-panel rounded-[2rem] p-8 text-left">
      <span className="eyebrow-label">{eyebrow}</span>
      <h2 className="mt-5 text-2xl tracking-tight text-slate-900">{title}</h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{body}</p>
    </div>
  );
}
