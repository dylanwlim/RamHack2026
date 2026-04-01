"use client";

import { type FormEvent, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Mail,
  Send,
} from "lucide-react";
import { PageTransitionShell } from "@/components/page-transition-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";

const inboxAddress = "contact@pharmapath.org";
const subjectChoices = [
  "Product feedback",
  "Bug or broken flow",
  "Feature request",
  "Medication data concern",
  "Partnership or pilot",
  "Something else",
];
const processNotes = [
  "Messages land in the PharmaPath inbox rather than a shared teammate mailbox.",
  "Data-quality and bug reports are treated as direct product fixes, not support noise.",
  "If the inline submit path is unavailable, the form opens a direct email fallback instead.",
];

type ContactDraft = {
  fullName: string;
  emailAddress: string;
  subjectLine: string;
  details: string;
  website: string;
};

type ContactReply = {
  error?: string;
  fallbackEmail?: string;
  fallbackMode?: "mailto";
};

type SubmissionState = "idle" | "submitting" | "sent" | "failed";

const blankDraft: ContactDraft = {
  fullName: "",
  emailAddress: "",
  subjectLine: "",
  details: "",
  website: "",
};

function composeFallbackHref(draft: ContactDraft, email: string) {
  const mailSubject = draft.subjectLine.trim() || "PharmaPath contact";
  const mailBody = [
    `Name: ${draft.fullName.trim() || "Not provided"}`,
    `Email: ${draft.emailAddress.trim() || "Not provided"}`,
    "",
    draft.details.trim(),
  ].join("\n");

  return `mailto:${email}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
}

function updateDraftField(
  previous: ContactDraft,
  field: keyof ContactDraft,
  value: string,
) {
  return {
    ...previous,
    [field]: value,
  };
}

export default function ContactPage() {
  const [draft, setDraft] = useState<ContactDraft>(blankDraft);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [failureMessage, setFailureMessage] = useState("");

  const controlClass =
    "w-full rounded-[1.1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-[#156d95]/50 focus:ring-2 focus:ring-[#156d95]/10";
  const fieldLabelClass = "mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-600";

  function setField(field: keyof ContactDraft, value: string) {
    setDraft((previous) => updateDraftField(previous, field, value));
  }

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionState("submitting");
    setFailureMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: draft.fullName,
          email: draft.emailAddress,
          subject: draft.subjectLine,
          message: draft.details,
          website: draft.website,
        }),
      });

      const payload = (await response.json()) as ContactReply;

      if (!response.ok) {
        if (payload.fallbackMode === "mailto" && payload.fallbackEmail) {
          window.location.assign(composeFallbackHref(draft, payload.fallbackEmail));
          setSubmissionState("idle");
          return;
        }

        setFailureMessage(payload.error ?? "The message could not be sent right now.");
        setSubmissionState("failed");
        return;
      }

      setDraft(blankDraft);
      setSubmissionState("sent");
    } catch {
      setFailureMessage("Network error. Check the connection and try again.");
      setSubmissionState("failed");
    }
  }

  return (
    <>
      <SiteNavbar />
      <PageTransitionShell>
        <section className="px-4 pb-14 pt-28 sm:px-6 lg:px-8">
          <div className="site-shell grid gap-8 lg:grid-cols-[0.94fr_1.06fr] lg:items-end">
            <div>
              <span className="eyebrow-label">Contact</span>
              <h1 className="mt-6 text-[2.9rem] leading-tight tracking-tight text-slate-950 sm:text-[3.45rem]">
                Send a product note without guessing who owns the inbox.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Use this page for bugs, feature requests, data issues, or partnership outreach.
                The flow stays direct, and if inline delivery is unavailable the fallback opens a
                prefilled email instead of dropping the message.
              </p>
            </div>

            <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#156d95]/10">
                  <Mail className="h-5 w-5 text-[#156d95]" strokeWidth={1.75} />
                </span>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Direct inbox
                  </div>
                  <a
                    href={`mailto:${inboxAddress}`}
                    className="mt-1 inline-block text-base font-medium text-slate-950 underline-offset-2 hover:underline"
                  >
                    {inboxAddress}
                  </a>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Use the direct inbox if you need to forward screenshots, logs, or a longer thread
                from another system.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 lg:px-8">
          <div className="site-shell grid gap-8 lg:grid-cols-[1fr_0.56fr] lg:items-start">
            <div className="surface-panel rounded-[2rem] p-6 sm:p-8">
              {submissionState === "sent" ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-500" strokeWidth={1.5} />
                  <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
                    Note received
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                    The message is on its way to PharmaPath now. Use the button below if you want
                    to send another one immediately.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmissionState("idle")}
                    className="action-button-secondary mt-8 text-sm"
                  >
                    Send another note
                  </button>
                </div>
              ) : (
                <form onSubmit={(event) => void submitDraft(event)} className="space-y-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="contact-full-name" className={fieldLabelClass}>
                        Name
                      </label>
                      <input
                        id="contact-full-name"
                        type="text"
                        autoComplete="name"
                        value={draft.fullName}
                        onChange={(event) => setField("fullName", event.target.value)}
                        placeholder="Your name"
                        required
                        className={controlClass}
                      />
                    </div>

                    <div>
                      <label htmlFor="contact-email-address" className={fieldLabelClass}>
                        Email
                      </label>
                      <input
                        id="contact-email-address"
                        type="email"
                        autoComplete="email"
                        value={draft.emailAddress}
                        onChange={(event) => setField("emailAddress", event.target.value)}
                        placeholder="you@example.com"
                        required
                        className={controlClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-subject-line" className={fieldLabelClass}>
                      Subject
                    </label>
                    <select
                      id="contact-subject-line"
                      value={draft.subjectLine}
                      onChange={(event) => setField("subjectLine", event.target.value)}
                      required
                      className={controlClass}
                    >
                      <option value="" disabled>
                        Choose the closest fit
                      </option>
                      {subjectChoices.map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="hidden" aria-hidden>
                    <label htmlFor="contact-website-field">Website</label>
                    <input
                      id="contact-website-field"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={draft.website}
                      onChange={(event) => setField("website", event.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-details" className={fieldLabelClass}>
                      Message
                    </label>
                    <textarea
                      id="contact-details"
                      rows={7}
                      value={draft.details}
                      onChange={(event) => setField("details", event.target.value)}
                      placeholder="Describe the issue, request, or context that would make the next step easier."
                      minLength={10}
                      required
                      className={`${controlClass} resize-none`}
                    />
                  </div>

                  {submissionState === "failed" && failureMessage ? (
                    <div className="flex items-start gap-3 rounded-[1.2rem] border border-rose-200 bg-rose-50/80 px-4 py-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-rose-500" />
                      <p className="text-sm leading-6 text-rose-700">{failureMessage}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm leading-6 text-slate-500">
                      PharmaPath does not use this form to promise response timing or medication
                      availability.
                    </p>
                    <button
                      type="submit"
                      disabled={submissionState === "submitting"}
                      className="action-button-primary inline-flex items-center gap-2 text-sm disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" strokeWidth={1.75} />
                      {submissionState === "submitting" ? "Sending note..." : "Send note"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-[2rem] border border-slate-200/80 bg-slate-50/80 p-6">
                <span className="eyebrow-label">What to expect</span>
                <ul className="mt-5 space-y-3">
                  {processNotes.map((note) => (
                    <li
                      key={note}
                      className="flex items-start gap-3 text-sm leading-6 text-slate-700"
                    >
                      <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#156d95]/60" />
                      {note}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="surface-panel rounded-[2rem] p-6">
                <span className="eyebrow-label">Best use</span>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  This page is for product communication. Clinical questions still require direct
                  pharmacy confirmation and clinician judgment.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </PageTransitionShell>
      <SiteFooter />
    </>
  );
}
