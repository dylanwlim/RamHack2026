"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { firebaseReady, firebaseMessage, status, profileLoading } = useAuth();

  useEffect(() => {
    if (status !== "unauthenticated") {
      return;
    }

    const nextPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [pathname, router, searchParams, status]);

  if (!firebaseReady) {
    return (
      <div className="surface-panel rounded-[2rem] p-8 text-left">
        <div className="flex items-center gap-3 text-slate-900">
          <LockKeyhole className="h-5 w-5 text-[#156d95]" />
          <h2 className="text-2xl tracking-tight">Account access needs Firebase first.</h2>
        </div>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          {firebaseMessage || "Firebase Authentication is not configured yet."}
        </p>
      </div>
    );
  }

  if (status === "loading" || profileLoading || status === "unauthenticated") {
    return (
      <div className="surface-panel flex min-h-[20rem] items-center justify-center rounded-[2rem]">
        <div className="flex items-center gap-3 text-slate-500">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Checking your PharmaPath session...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function SignedOutContributionPrompt({ nextPath }: { nextPath: string }) {
  return (
    <div className="glass-panel rounded-[1.4rem] border border-slate-200/70 px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-[#156d95]/10 p-2 text-[#156d95]">
          <LockKeyhole className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-900">Sign in to contribute a report</div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Crowd reports are tied to contributor history so fresh reports can be weighted by trust and recency.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="action-button-primary text-sm"
            >
              Log in
            </Link>
            <Link
              href={`/register?next=${encodeURIComponent(nextPath)}`}
              className="action-button-secondary text-sm"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
