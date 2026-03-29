"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  const [query, setQuery] = useState(initialQuery);

  return (
    <form
      className="surface-panel rounded-[2rem] p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const params = new URLSearchParams({ query: query.trim() });
        startTransition(() => {
          router.push(`${action}?${params.toString()}`);
        });
      }}
    >
      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Medication</span>
        <input
          className="h-14 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-[#156d95] focus:ring-4 focus:ring-[#156d95]/10"
          placeholder="Wegovy"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          required
        />
      </label>

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
