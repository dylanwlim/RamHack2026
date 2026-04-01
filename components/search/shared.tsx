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

export function formatRecallClassification(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^class\s+/i, "");
  return normalized ? `Class ${normalized}` : null;
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
        "rounded-[1.05rem] border border-black/5 bg-white/82 px-3.5 py-3 shadow-[0_1px_1px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      <div className="text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-[1.35rem] font-medium tracking-tight tabular-nums text-slate-900">{value}</div>
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
    <ul className={cn("space-y-2.5", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700">
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
    <div className="surface-panel rounded-[1.85rem] p-6 text-left sm:p-7">
      <span className="eyebrow-label">{eyebrow}</span>
      <h2 className="mt-4 text-[1.75rem] tracking-tight text-balance text-slate-900 sm:text-[1.95rem]">{title}</h2>
      <p className="mt-3 max-w-2xl text-[0.98rem] leading-7 text-slate-600">{body}</p>
    </div>
  );
}
