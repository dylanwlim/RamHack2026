"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { MedicationCombobox } from "@/components/search/medication-combobox";
import { MedicationStrengthField } from "@/components/search/medication-strength-field";
import {
  resolveMedicationOption,
  type MedicationSearchOption,
} from "@/lib/medications/client";
import { buildMedicationQueryLabel } from "@/lib/medications/selection";

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
  const [selectedOption, setSelectedOption] = useState<MedicationSearchOption | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [selectedStrength, setSelectedStrength] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [strengthError, setStrengthError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setSelectedOption(null);
    setSelectedStrength("");
    setQuery(initialQuery);
    setError(null);
    setStrengthError(null);

    if (!initialQuery) {
      return () => {
        cancelled = true;
      };
    }

    void resolveMedicationOption(initialQuery)
      .then((option) => {
        if (cancelled || !option) {
          return;
        }

        setSelectedOption(option);
        setQuery(option.label);
        setSelectedStrength(option.matchedStrength || (option.strengths.length === 1 ? option.strengths[0].value : ""));
      })
      .catch(() => {
        if (!cancelled) {
          setQuery(initialQuery);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialQuery]);

  return (
    <form
      className="surface-panel rounded-[2rem] p-5 sm:p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setIsResolving(true);
        try {
          const resolvedOption = selectedOption || (await resolveMedicationOption(query));
          const resolvedStrength =
            selectedStrength ||
            resolvedOption?.matchedStrength ||
            (resolvedOption?.strengths.length === 1 ? resolvedOption.strengths[0].value : "");

          setError(
            resolvedOption ? null : "Choose a medication from the search results.",
          );
          setStrengthError(
            resolvedOption && resolvedOption.strengths.length > 1 && !resolvedStrength
              ? "Choose a specific strength before searching."
              : null,
          );

          if (!resolvedOption || (resolvedOption.strengths.length > 1 && !resolvedStrength)) {
            return;
          }

          setSelectedOption(resolvedOption);
          setQuery(resolvedOption.label);
          setSelectedStrength(resolvedStrength);
          const params = new URLSearchParams({
            query: buildMedicationQueryLabel(resolvedOption, resolvedStrength),
          });
          startTransition(() => {
            router.push(`${action}?${params.toString()}`);
          });
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Unable to search medications right now.");
        } finally {
          setIsResolving(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1.55fr_0.95fr]">
        <MedicationCombobox
          label="Medication"
          placeholder="Search medication options"
          value={query}
          selectedOptionId={selectedOption?.id || null}
          onValueChange={(nextValue) => {
            setQuery(nextValue);
            setError(null);
            setStrengthError(null);

            if (
              selectedOption &&
              nextValue.trim().toLowerCase() !== selectedOption.label.trim().toLowerCase()
            ) {
              setSelectedOption(null);
              setSelectedStrength("");
            }
          }}
          onSelect={(option) => {
            setSelectedOption(option);
            setQuery(option.label);
            setSelectedStrength(
              option.matchedStrength || (option.strengths.length === 1 ? option.strengths[0].value : ""),
            );
            setError(null);
            setStrengthError(null);
          }}
          emptyMessage="No medication options match that search yet."
          error={error}
        />

        <MedicationStrengthField
          option={selectedOption}
          value={selectedStrength}
          onChange={(nextValue) => {
            setSelectedStrength(nextValue);
            setStrengthError(null);
          }}
          error={strengthError}
        />
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{helper}</p>

      <button
        type="submit"
        disabled={isPending || isResolving}
        className="action-button-primary relative z-40 mt-5 disabled:cursor-wait disabled:opacity-70"
      >
        {isPending || isResolving ? "Loading..." : submitLabel}
      </button>
    </form>
  );
}
