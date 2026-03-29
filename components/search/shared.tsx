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

  const miles = value as number;
  return `${miles < 10 ? miles.toFixed(1) : miles.toFixed(0)} mi`;
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
        <span className="text-[11px] uppercase tracking-[0.12em] opacity-70">
          {signal.confidence_label}
        </span>
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
    <div
      className={cn(
        "rounded-lg border border-black/5 bg-white/78 px-4 py-3 shadow-[0_1px_1px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
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
        <span key={item} className="flat-chip">
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
