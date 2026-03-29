"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ControlledCombobox } from "@/components/search/controlled-combobox";
import {
  findSupportedOption,
  medicationOptions,
  resolveInitialOption,
  type SearchOption,
} from "@/lib/search-options";

export function MedicationQueryForm({
  action,
  initialQuery = "",
  submitLabel,
  helper,
}: {
  action: string;
  initialQuery?: string;
  submitLabel: string;
  helper: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedOption, setSelectedOption] = useState<SearchOption | null>(() =>
    resolveInitialOption(medicationOptions, initialQuery),
  );
  const [query, setQuery] = useState(
    resolveInitialOption(medicationOptions, initialQuery)?.label || initialQuery,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextOption = resolveInitialOption(medicationOptions, initialQuery);
    setSelectedOption(nextOption);
    setQuery(nextOption?.label || initialQuery);
  }, [initialQuery]);

  return (
    <form
      className="surface-panel rounded-[2rem] p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();

        const resolvedOption = selectedOption || findSupportedOption(medicationOptions, query);
        setError(resolvedOption ? null : "Choose a supported medication from the list.");

        if (!resolvedOption) {
          return;
        }

        const params = new URLSearchParams({ query: resolvedOption.value.trim() });
        startTransition(() => {
          router.push(`${action}?${params.toString()}`);
        });
      }}
    >
      <ControlledCombobox
        label="Medication"
        placeholder="Select a medication"
        options={medicationOptions}
        value={query}
        selectedOptionId={selectedOption?.id || null}
        onValueChange={(nextValue) => {
          setQuery(nextValue);
          setError(null);

          if (
            selectedOption &&
            nextValue.trim().toLowerCase() !== selectedOption.label.trim().toLowerCase()
          ) {
            setSelectedOption(null);
          }
        }}
        onSelect={(option) => {
          setSelectedOption(option);
          setQuery(option.label);
          setError(null);
        }}
        emptyMessage="No supported medications match that search yet."
        error={error}
      />

      <p className="mt-4 text-sm leading-6 text-slate-600">{helper}</p>

      <button
        type="submit"
        disabled={isPending}
        className="template-button-primary mt-5 disabled:cursor-wait disabled:opacity-70"
      >
        {isPending ? "Loading..." : submitLabel}
      </button>
    </form>
  );
}
