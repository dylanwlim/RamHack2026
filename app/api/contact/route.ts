import { NextResponse } from "next/server";
import { Resend } from "resend";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL?.trim() || "contact@pharmapath.org";
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 320;
const MAX_SUBJECT_LENGTH = 140;
const MAX_MESSAGE_LENGTH = 4000;

interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  website?: string;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeLine(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeMessage(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  return origin === new URL(request.url).origin;
}

function getLogErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: "Unknown error" };
  }

  const details = error as {
    message?: unknown;
    statusCode?: unknown;
    name?: unknown;
  };

  return {
    message: typeof details.message === "string" ? details.message : "Unknown error",
    statusCode: typeof details.statusCode === "number" ? details.statusCode : null,
    name: typeof details.name === "string" ? details.name : null,
  };
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Cross-site form posts are not allowed." }, { status: 403 });
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Record<string, unknown>).name !== "string" ||
      typeof (body as Record<string, unknown>).email !== "string" ||
      typeof (body as Record<string, unknown>).subject !== "string" ||
      typeof (body as Record<string, unknown>).message !== "string"
    ) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { website } = body as ContactPayload;
    if (typeof website === "string" && website.trim()) {
      return NextResponse.json({ error: "Unable to process that submission." }, { status: 400 });
    }

    const name = normalizeLine((body as ContactPayload).name, MAX_NAME_LENGTH);
    const email = normalizeLine((body as ContactPayload).email, MAX_EMAIL_LENGTH).toLowerCase();
    const subject = normalizeLine((body as ContactPayload).subject, MAX_SUBJECT_LENGTH);
    const message = normalizeMessage((body as ContactPayload).message);

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    if (message.trim().length < 10) {
      return NextResponse.json({ error: "Message must be at least 10 characters." }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          error: "Inline email delivery is temporarily unavailable. Use the direct email fallback.",
          fallbackEmail: CONTACT_EMAIL,
          fallbackMode: "mailto",
        },
        { status: 503 },
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from: "PharmaPath Contact <onboarding@resend.dev>",
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `[PharmaPath Contact] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #156d95;">New message from PharmaPath</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 80px; vertical-align: top;"><strong>Name</strong></td>
              <td style="padding: 8px 0; color: #202020;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Email</strong></td>
              <td style="padding: 8px 0; color: #202020;">${escapeHtml(email)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Subject</strong></td>
              <td style="padding: 8px 0; color: #202020;">${escapeHtml(subject)}</td>
            </tr>
          </table>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; color: #202020; white-space: pre-wrap;">${escapeHtml(message)}</div>
        </div>
      `,
    });

    if (result.error || !result.data?.id) {
      const errorDetails = result.error
        ? {
            message: result.error.message,
            statusCode: result.error.statusCode,
            name: result.error.name,
          }
        : { message: "Missing Resend message id", statusCode: null, name: null };

      console.error("[contact] send failed", errorDetails);
      return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[contact] send error", getLogErrorDetails(error));
    return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 500 });
  }
}
