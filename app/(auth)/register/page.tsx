"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { PasswordMatch } from "@/components/auth/password-match";
import {
  AuthButton,
  AuthInput,
  AuthLabel,
} from "@/components/auth/auth-primitives";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrength } from "@/components/auth/password-strength";
import { useAuth } from "@/lib/auth/auth-context";

function parseLocationInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      defaultLocationLabel: "",
      city: "",
      state: "",
      zipCode: "",
    };
  }

  const zipMatch = trimmed.match(/^\d{5}$/);
  if (zipMatch) {
    return {
      defaultLocationLabel: trimmed,
      city: "",
      state: "",
      zipCode: trimmed,
    };
  }

  const [city = "", state = ""] = trimmed.split(",").map((token) => token.trim());
  return {
    defaultLocationLabel: trimmed,
    city,
    state,
    zipCode: "",
  };
}

function getNextPath(searchParams: URLSearchParams) {
  const next = searchParams.get("next");
  return next && next.startsWith("/") ? next : "/profile";
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-slate-500">Loading registration…</div>}>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getNextPath(searchParams);
  const { firebaseReady, firebaseMessage, signUp, status } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      setErrors({ form: firebaseMessage || "Firebase authentication is not configured." });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const nextErrors: Record<string, string> = {};

    if (!firstName) nextErrors.firstName = "First name is required";
    if (!lastName) nextErrors.lastName = "Last name is required";
    if (!email) {
      nextErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Invalid email address";
    }
    if (!password) {
      nextErrors.password = "Password is required";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters";
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setTimeout(() => errorSummaryRef.current?.focus(), 100);
      return;
    }

    try {
      setIsLoading(true);
      const displayName = `${firstName} ${lastName}`.trim();
      const locationFields = parseLocationInput(location);

      await signUp({
        email,
        password,
        displayName,
        firstName,
        lastName,
        ...locationFields,
      });

      router.replace(nextPath);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Unable to create the account right now." });
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
          Create an account
        </h1>
        <p className="text-slate-600">
          Create a PharmaPath contributor profile so your reports can build trust over time instead
          of counting like anonymous one-off votes.
        </p>
      </div>

      <div className="glass-panel p-4">
        <p className="text-sm leading-6 text-slate-700">
          New reports start with very light influence. As your contribution history grows, your
          reports can move the crowd signal more, but never without a cap.
        </p>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-slate-500">Set up your contributor profile</span>
        </div>
      </div>

      {errorList.length > 0 ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="register-error-title"
          className="rounded-lg border border-rose-200 bg-rose-50 p-4 animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div className="space-y-1">
              <p id="register-error-title" className="font-medium text-rose-700">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <AuthLabel htmlFor="firstName">First name</AuthLabel>
          <AuthInput
            id="firstName"
            name="firstName"
            placeholder="Jordan"
            autoComplete="given-name"
            disabled={isLoading}
          />
            {errors.firstName ? (
              <p className="text-sm text-rose-600 animate-in fade-in slide-in-from-top-1">
                {errors.firstName}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <AuthLabel htmlFor="lastName">Last name</AuthLabel>
            <AuthInput
              id="lastName"
              name="lastName"
              placeholder="Patel"
              autoComplete="family-name"
              disabled={isLoading}
            />
            {errors.lastName ? (
              <p className="text-sm text-rose-600 animate-in fade-in slide-in-from-top-1">
                {errors.lastName}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <AuthLabel htmlFor="email">Email</AuthLabel>
          <AuthInput
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isLoading}
          />
          {errors.email ? (
            <p className="text-sm text-rose-600 animate-in fade-in slide-in-from-top-1">{errors.email}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <AuthLabel htmlFor="location">Home ZIP or city <span className="font-normal text-slate-500">(optional)</span></AuthLabel>
          <AuthInput
            id="location"
            name="location"
            placeholder="10011 or Brooklyn, NY"
            autoComplete="postal-code"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <AuthLabel htmlFor="password">Password</AuthLabel>
          <PasswordInput
            id="password"
            name="password"
            placeholder="Create a password"
            autoComplete="new-password"
            disabled={isLoading}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <PasswordStrength password={password} />
          {errors.password ? (
            <p className="text-sm text-rose-600 animate-in fade-in slide-in-from-top-1">
              {errors.password}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <AuthLabel htmlFor="confirmPassword">Confirm password</AuthLabel>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Confirm your password"
            autoComplete="new-password"
            disabled={isLoading}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.currentTarget.value)}
          />
          <PasswordMatch password={password} confirmPassword={confirmPassword} />
          {errors.confirmPassword ? (
            <p className="text-sm text-rose-600 animate-in fade-in slide-in-from-top-1">
              {errors.confirmPassword}
            </p>
          ) : null}
        </div>

        <AuthButton
          type="submit"
          className="h-12 w-full hover:scale-[1.02] active:scale-[0.98]"
          disabled={isLoading}
        >
          {isLoading ? "Creating account..." : "Create account"}
        </AuthButton>

        <p className="text-center text-xs text-slate-500">
          By creating an account, you agree to use crowd reports responsibly and avoid claiming that
          local inventory is guaranteed without direct pharmacy confirmation.
        </p>
      </form>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          href={`/login${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next") || "")}` : ""}`}
          className="text-slate-950 underline underline-offset-4 transition-colors hover:text-[#156d95]"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
