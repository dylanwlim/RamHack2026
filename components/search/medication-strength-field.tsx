"use client";

import { useId } from "react";
import type { MedicationSearchOption } from "@/lib/medications/client";
import { cn } from "@/lib/utils";

export function MedicationStrengthField({
  option,
  value,
  onChange,
  error,
  className,
  showWhenEmpty = false,
  resolvedValue,
  helperText,
}: {
  option: MedicationSearchOption | null;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  className?: string;
  showWhenEmpty?: boolean;
  resolvedValue?: string | null;
  helperText?: string | null;
}) {
  const helperId = useId();
  const displayValue = resolvedValue?.trim() || "";

  if (!option && !showWhenEmpty && !displayValue) {
    return null;
  }

  const strengths = option?.strengths || [];
  const hasMultipleStrengths = strengths.length > 1;
  const defaultHelper = option
    ? option.demoOnly
      ? `Simulated demo medication • ${option.simulatedUserCount || 0} seeded demo users`
      : Array.from(new Set([option.formulation, option.dosageForm].filter(Boolean))).join(" • ")
    : null;
  const helper = helperText ?? defaultHelper;

  return (
    <label className={cn("search-field-stack", className)}>
      <span className="search-field-label">Strength</span>
      {option ? (
        <select
          className={cn(
            "search-select-control",
            error && "border-rose-300 ring-4 ring-rose-500/10",
          )}
          value={value}
          aria-describedby={helper ? helperId : undefined}
          onChange={(event) => onChange(event.target.value)}
        >
          {hasMultipleStrengths ? <option value="">Select strength</option> : null}
          {strengths.map((strength) => (
            <option key={strength.id} value={strength.value}>
              {strength.label}
            </option>
          ))}
        </select>
      ) : displayValue ? (
        <div
          aria-describedby={helper ? helperId : undefined}
          aria-readonly="true"
          className={cn(
            "search-select-control flex items-center bg-slate-50/85 pr-4 text-slate-900",
            error && "border-rose-300 ring-4 ring-rose-500/10",
          )}
          title={displayValue}
        >
          <span className="truncate">{displayValue}</span>
        </div>
      ) : (
        <select
          className={cn(
            "search-select-control",
            error && "border-rose-300 ring-4 ring-rose-500/10",
          )}
          value=""
          disabled
          aria-describedby={helper ? helperId : undefined}
          onChange={() => undefined}
        >
          <option value="">Select strength</option>
        </select>
      )}
      <div className="search-field-helper-slot">
        {helper ? (
          <p
            id={helperId}
            className={cn(
              "search-field-helper",
              !option && !displayValue && "text-slate-400",
            )}
          >
            {helper}
          </p>
        ) : null}
        {error ? <p className="search-field-error">{error}</p> : null}
      </div>
    </label>
  );
}
