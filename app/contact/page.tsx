"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Send, CheckCircle, AlertCircle } from "lucide-react";
import { PageTransitionShell } from "@/components/page-transition-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";
import { motionEase, motionTiming } from "@/lib/motion";

const DIRECT_EMAIL = "contact@pharmapath.org";

const subjects = [
  "General feedback",
  "Bug report",
  "Feature request",
  "Data accuracy concern",
  "Partnership inquiry",
  "Other",
];

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
}

interface ContactResponse {
  error?: string;
  fallbackEmail?: string;
  fallbackMode?: "mailto";
}

const empty: FormState = { name: "", email: "", subject: "", message: "", website: "" };

function buildMailtoHref(form: FormState, email: string) {
  const subject = form.subject.trim() || "PharmaPath contact";
  const body = [
    `Name: ${form.name.trim() || "Not provided"}`,
    `Email: ${form.email.trim() || "Not provided"}`,
    "",
    form.message.trim(),
  ].join("\n");

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(empty);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = (await res.json()) as ContactResponse;

      if (!res.ok) {
        if (data.fallbackMode === "mailto" && data.fallbackEmail) {
          window.location.assign(buildMailtoHref(form, data.fallbackEmail));
          setStatus("idle");
          setErrorMsg("");
          return;
        }

        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      setStatus("success");
      setForm(empty);
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  const inputClass =
    "w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-[#156d95]/50 focus:ring-2 focus:ring-[#156d95]/10";

  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

  return (
    <>
      <SiteNavbar />
      <PageTransitionShell>
        {/* Hero */}
        <section className="px-4 pb-16 pt-28 sm:px-6 lg:px-8">
          <div className="site-shell">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: motionTiming.base, ease: motionEase.standard }}
            >
              <span className="eyebrow-label">Contact Us</span>
              <h1 className="mt-6 text-[2.9rem] leading-tight tracking-tight text-slate-950 sm:text-[3.5rem]">
                We&apos;d love to hear from you.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Have feedback, a bug to report, or a question about PharmaPath? Use the form below
                or email us directly.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Main content */}
        <section className="px-4 pb-24 sm:px-6 lg:px-8">
          <div className="site-shell grid gap-8 lg:grid-cols-[1fr_0.55fr] lg:items-start">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: motionTiming.base,
                delay: 0.1,
                ease: motionEase.standard,
              }}
              className="surface-panel rounded-[2rem] p-6 sm:p-8"
            >
              {status === "success" ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: motionTiming.base, ease: motionEase.reveal }}
                  className="flex flex-col items-center py-12 text-center"
                >
                  <CheckCircle className="h-12 w-12 text-emerald-500" strokeWidth={1.5} />
                  <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
                    Message sent
                  </h2>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
                    Thanks for reaching out. We&apos;ll get back to you as soon as we can.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus("idle")}
                    className="action-button-secondary mt-8 text-sm"
                  >
                    Send another message
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="contact-name" className={labelClass}>
                        Name
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        autoComplete="name"
                        placeholder="Your name"
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        required
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className={labelClass}>
                        Email
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        required
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-subject" className={labelClass}>
                      Subject
                    </label>
                    <select
                      id="contact-subject"
                      value={form.subject}
                      onChange={(e) => update("subject", e.target.value)}
                      required
                      className={inputClass}
                    >
                      <option value="" disabled>
                        Select a subject
                      </option>
                      {subjects.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="contact-website" className="sr-only">
                      Website
                    </label>
                    <input
                      id="contact-website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={form.website}
                      onChange={(e) => update("website", e.target.value)}
                      className="hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-message" className={labelClass}>
                      Message
                    </label>
                    <textarea
                      id="contact-message"
                      rows={6}
                      placeholder="Tell us what's on your mind…"
                      value={form.message}
                      onChange={(e) => update("message", e.target.value)}
                      required
                      minLength={10}
                      className={`${inputClass} resize-none`}
                    />
                  </div>

                  {status === "error" && errorMsg && (
                    <div className="flex items-start gap-3 rounded-[1rem] border border-rose-200 bg-rose-50/70 px-4 py-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-rose-500" />
                      <p className="text-sm leading-5 text-rose-700">{errorMsg}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="action-button-primary flex w-full items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" strokeWidth={1.75} />
                    {status === "sending" ? "Sending…" : "Send message"}
                  </button>
                </form>
              )}
            </motion.div>

            {/* Sidebar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: motionTiming.base,
                delay: 0.2,
                ease: motionEase.standard,
              }}
              className="space-y-4"
            >
              {/* Direct email */}
              <div className="surface-panel rounded-[2rem] p-6">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#156d95]/10">
                    <Mail className="h-4.5 w-4.5 text-[#156d95]" strokeWidth={1.75} />
                  </span>
                  <span className="eyebrow-label">Direct email</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Prefer to write directly? Reach us at:
                </p>
                <a
                  href={`mailto:${DIRECT_EMAIL}`}
                  className="mt-2 inline-block text-sm font-medium text-[#156d95] underline-offset-2 hover:underline"
                >
                  {DIRECT_EMAIL}
                </a>
              </div>

              {/* What to expect */}
              <div className="rounded-[2rem] border border-slate-200/80 bg-slate-50/70 p-6">
                <span className="eyebrow-label">What to expect</span>
                <ul className="mt-4 space-y-3">
                  {[
                    "We read every message personally.",
                    "Bug reports help us improve data accuracy.",
                    "Feature requests are reviewed each sprint.",
                    "We aim to reply within 1–2 business days.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                      <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#156d95]/60" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </section>
      </PageTransitionShell>
      <SiteFooter />
    </>
  );
}
