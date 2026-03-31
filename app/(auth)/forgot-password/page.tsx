"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { AuthButton, AuthInput, AuthLabel } from "@/components/auth/auth-primitives";
import { useAuth } from "@/lib/auth/auth-context";

export default function ForgotPasswordPage() {
  const { firebaseReady, firebaseMessage, sendResetEmail, status } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "authenticated") {
      setIsSubmitted(false);
    }
  }, [status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      inputRef.current?.focus();
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      inputRef.current?.focus();
      return;
    }

    if (!firebaseReady) {
      setError(firebaseMessage || "Account access is temporarily unavailable right now.");
      return;
    }

    try {
      setIsLoading(true);
      await sendResetEmail(email);
      setIsSubmitted(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to send reset email.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#156d95]/10">
            <Mail className="h-8 w-8 text-[#156d95]" />
          </div>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-slate-950">
            Check your email
          </h1>
          <p className="text-slate-600">We sent password reset instructions to</p>
          <p className="font-medium text-slate-950">{email}</p>
        </div>

        <div className="space-y-4">
          <AuthButton
            variant="outline"
            className="h-12 w-full bg-white"
            onClick={() => window.open(`mailto:${email}`, "_self")}
          >
            Open email app
          </AuthButton>

          <p className="text-center text-sm text-slate-600">
            Didn&apos;t receive the email?{" "}
            <button
              type="button"
              onClick={() => setIsSubmitted(false)}
              className="text-slate-950 underline underline-offset-4 transition-colors hover:text-[#156d95]"
            >
              Click to resend
            </button>
          </p>
        </div>

        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance text-slate-950">
          Forgot password?
        </h1>
        <p className="text-slate-600">
          We&apos;ll send reset instructions so you can get back to your contributor profile.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 animate-in fade-in slide-in-from-top-1"
          >
            {error}
          </div>
        ) : null}

        <div className="space-y-2">
          <AuthLabel htmlFor="email">Email</AuthLabel>
          <AuthInput
            ref={inputRef}
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            disabled={isLoading}
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
        </div>

        <AuthButton
          type="submit"
          className="h-12 w-full"
          disabled={isLoading}
        >
          {isLoading ? "Sending..." : "Reset password"}
        </AuthButton>
      </form>

      <Link
        href="/login"
        className="flex items-center justify-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>
    </div>
  );
}
