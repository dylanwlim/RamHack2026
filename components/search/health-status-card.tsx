"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createPharmaPathClient, type HealthResponse } from "@/lib/pharmapath-client";

const client = createPharmaPathClient();

function StatusRow({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-slate-200/90 bg-white/92 px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span
        className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${
          good ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function HealthStatusCard() {
  const [payload, setPayload] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    client
      .getHealth()
      .then((result) => {
        if (cancelled) {
          return;
        }

        setPayload(result);
        setError(null);
      })
      .catch((reason: Error) => {
        if (cancelled) {
          return;
        }

        setError(reason.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div id="health" className="surface-panel h-full rounded-[2rem] p-6 sm:p-7">
      <span className="eyebrow-label">Health status</span>
      <p className="mt-4 max-w-md text-sm leading-6 text-slate-600">
        Live route and integration checks from <code className="font-mono text-[0.82em]">/api/health</code>,
        kept here so the search views stay focused on patient and medication questions.
      </p>
      {payload ? (
        <div className="mt-5 space-y-3">
          <StatusRow label="Route status" value={payload.status} good={payload.status === "ok"} />
          <StatusRow
            label="Google Maps key"
            value={payload.google_api_configured ? "configured" : "missing"}
            good={Boolean(payload.google_api_configured)}
          />
          <StatusRow
            label="openFDA key"
            value={payload.openfda_api_key_configured ? "configured" : "optional / missing"}
            good={Boolean(payload.openfda_api_key_configured)}
          />
        </div>
      ) : error ? (
        <p className="mt-5 text-sm leading-6 text-rose-700">{error}</p>
      ) : (
        <div className="mt-5 flex items-center gap-3 text-sm text-slate-500">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Checking route status...
        </div>
      )}
    </div>
  );
}
