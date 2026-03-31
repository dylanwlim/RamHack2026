"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  AuthButton,
  AuthCheckbox,
  AuthInput,
  AuthLabel,
  AuthSectionDivider,
} from "@/components/auth/auth-primitives";
import { PasswordInput } from "@/components/auth/password-input";
import { useAuth } from "@/lib/auth/auth-context";

function getNextPath(searchParams: URLSearchParams) {
  const next = searchParams.get("next");
  return next && next.startsWith("/") ? next : "/profile";
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-slate-500">Loading sign-in…</div>}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getNextPath(searchParams);
  const { firebaseReady, firebaseMessage, signIn, status } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [remember, setRemember] = useState(true);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(nextPath);
    }
  }, [nextPath, router, status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    if (!firebaseReady) {
      setErrors({ form: firebaseMessage || "Account access is temporarily unavailable right now." });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const nextErrors: Record<string, string> = {};

    if (!email) {
      nextErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Invalid email address";
    }

    if (!password) {
      nextErrors.password = "Password is required";
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setTimeout(() => errorSummaryRef.current?.focus(), 100);
      return;
    }

    try {
      setIsLoading(true);
      await signIn({ email, password, remember });
      router.replace(nextPath);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to sign in right now." });
      setTimeout(() => errorSummaryRef.current?.focus(), 100);
    } finally {
      setIsLoading(false);
    }
  }

  const errorList = Object.entries(errors);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance text-slate-950">
          Welcome back
        </h1>
        <p className="text-slate-600">
          Sign in to manage your profile, keep contribution history tied to your account, and report
          what nearby pharmacies are seeing.
        </p>
      </div>

      <div className="glass-panel p-4">
        <p className="text-sm leading-6 text-slate-700">
          Your session unlocks trust-weighted crowd reports, profile settings, recent searches, and
          the ability to help future patients judge whether a pharmacy is worth calling first.
        </p>
      </div>

      <AuthSectionDivider label="Contributor credentials" />

      {errorList.length > 0 ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="login-error-title"
          className="rounded-lg border border-rose-200 bg-rose-50 p-4 animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div className="space-y-1">
              <p id="login-error-title" className="font-medium text-rose-700">
                Please fix the following:
              </p>
              <ul className="space-y-1 text-sm text-rose-700/90">
                {errorList.map(([field, message]) => (
                  <li key={field}>{message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <AuthLabel htmlFor="email">Email</AuthLabel>
          <AuthInput
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isLoading}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "login-email-error" : undefined}
          />
          {errors.email ? (
            <p id="login-email-error" className="text-sm text-rose-600 animate-in fade-in slide-in-from-top-1">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <AuthLabel htmlFor="password">Password</AuthLabel>
            <Link
              href="/forgot-password"
              className="text-sm text-slate-500 underline underline-offset-4 transition-colors hover:text-slate-900"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            disabled={isLoading}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "login-password-error" : undefined}
          />
          {errors.password ? (
            <p
              id="login-password-error"
              className="text-sm text-rose-600 animate-in fade-in slide-in-from-top-1"
            >
              {errors.password}
            </p>
          ) : null}
        </div>

        <AuthCheckbox
          checked={remember}
          onChange={(event) => setRemember(event.currentTarget.checked)}
          label="Keep me signed in on this device"
        />

        <AuthButton
          type="submit"
          className="h-12 w-full"
          disabled={isLoading}
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </AuthButton>
      </form>

      <p className="text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link
          href={`/register${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next") || "")}` : ""}`}
          className="text-slate-950 underline underline-offset-4 transition-colors hover:text-[#156d95]"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
