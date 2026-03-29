"use client";

import type { MedicationSearchOption } from "@/lib/medications/client";
import { cn } from "@/lib/utils";

export function MedicationStrengthField({
  option,
  value,
  onChange,
  error,
}: {
  option: MedicationSearchOption | null;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}) {
  if (!option) {
    return null;
  }

  const hasMultipleStrengths = option.strengths.length > 1;
  const helper = option.demoOnly
    ? `Simulated demo medication • ${option.simulatedUserCount || 0} seeded demo users`
    : [option.formulation, option.dosageForm].filter(Boolean).join(" • ");

  return (
    <label className="space-y-2">
      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Strength</span>
      <select
        className={cn(
          "search-select-control",
          error && "border-rose-300 ring-4 ring-rose-500/10",
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {hasMultipleStrengths ? <option value="">Select strength</option> : null}
        {option.strengths.map((strength) => (
          <option key={strength.id} value={strength.value}>
            {strength.label}
          </option>
        ))}
      </select>
      {helper ? <p className="text-xs leading-5 text-slate-500">{helper}</p> : null}
      {error ? <p className="text-sm leading-6 text-rose-600">{error}</p> : null}
    </label>
  );
}
