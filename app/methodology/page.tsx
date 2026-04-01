import { PageTransitionShell } from "@/components/page-transition-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";
import { surfaceNames } from "@/lib/surface-labels";
type SignalTone = "sky" | "emerald" | "amber" | "teal";
type SignalLayer = {
  label: string;
  title: string;
  description: string;
  tone: SignalTone;
};
type SignalToneStyle = {
  cardClass: string;
  dotClass: string;
  labelClass: string;
};
function createSignalToneStyle(
  cardClass: string,
  dotClass: string,
  labelClass: string,
): SignalToneStyle {
  return { cardClass, dotClass, labelClass };
}
const signalToneStyles = {
  sky: createSignalToneStyle("border-sky-200 bg-sky-50", "bg-sky-500", "text-sky-700"),
  emerald: createSignalToneStyle(
    "border-emerald-200 bg-emerald-50",
    "bg-emerald-500",
    "text-emerald-700",
  ),
  amber: createSignalToneStyle(
    "border-amber-200 bg-amber-50",
    "bg-amber-500",
    "text-amber-700",
  ),
  teal: createSignalToneStyle("border-teal-200 bg-teal-50", "bg-teal-500", "text-teal-700"),
} satisfies Record<SignalTone, SignalToneStyle>;
const localSearchLayer: SignalLayer = {
  tone: "sky",
  label: "Local search layer",
  title: "Nearby pharmacy discovery",
  description:
    "PharmaPath resolves the searched place and keeps distance, hours, ratings, and map links attached to that nearby search result set.",
};
const medicationReferenceLayer: SignalLayer = {
  tone: "emerald",
  label: "Medication reference layer",
  title: "Medication family matching",
  description:
    "Medication names are normalized against public reference records so strengths, routes, dosage forms, and manufacturer breadth stay attached to the right family.",
};
const publicSafetyLayer: SignalLayer = {
  tone: "amber",
  label: "Public safety layer",
  title: "Shortage and recall context",
  description:
    "Public shortage and recall records add planning context, but they do not turn into a confirmed claim that a specific pharmacy has the medication on the shelf.",
};
const contributorSignalLayer: SignalLayer = {
  tone: "teal",
  label: "Contributor layer",
  title: "Community signal",
  description:
    "Signed-in contributors can add reports, but those reports stay visibly separate from verified reference data and store-level confirmation.",
};
function getSignalLayers(): SignalLayer[] {
  return Array.of(
    localSearchLayer,
    medicationReferenceLayer,
    publicSafetyLayer,
    contributorSignalLayer,
  );
}
const signalLayers = getSignalLayers();
const interpretationNotes = [
  {
    heading: "Use the nearby list to decide who to call first",
    body: `${surfaceNames.patient} is a routing tool. It helps prioritize outreach order, but it does not promise that the medication is already available.`,
  },
  {
    heading: `Use ${surfaceNames.prescriber} when the question is formulation context`,
    body: `${surfaceNames.prescriber} keeps shortage, recall, manufacturer, and dosage-form evidence together when the question is broader than one store.`,
  },
  {
    heading: "Keep contributor reports in the supporting-evidence bucket",
    body: "Contributor input can sharpen the next question, but it should not replace direct confirmation from the pharmacy.",
  },
];

const explicitClaims = [
  "Nearby pharmacies, distance, hours, ratings, and map links.",
  "Medication family context including strengths, dosage forms, routes, manufacturers, shortage signals, and recall activity.",
  "Contributor reports that stay labeled as contributor context rather than as verified stock.",
];

const manualChecks = [
  "Real-time shelf inventory at a specific store.",
  "Guaranteed same-day pickup or transfer success.",
  "Insurance adjudication, prior authorization, or final patient cost.",
];

const usageRules = [
  "Confirm the exact strength and formulation with the pharmacy before assuming availability.",
  "Use clinician judgment for substitutions, urgency, and treatment changes.",
  "Treat PharmaPath as a routing and context product rather than a guaranteed inventory feed.",
  "Do not rely on PharmaPath alone for emergencies or urgent clinical decisions.",
];

function SignalLayerCard({ layer }: { layer: SignalLayer }) {
  const tone = signalToneStyles[layer.tone];

  return (
    <article className={`rounded-[2rem] border p-6 ${tone.cardClass}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${tone.dotClass}`} />
        <span
          className={`text-xs font-semibold uppercase tracking-[0.18em] ${tone.labelClass}`}
        >
          {layer.label}
        </span>
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">
        {layer.title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        {layer.description}
      </p>
    </article>
  );
}

function BulletList({
  items,
  dotClass,
}: {
  items: string[];
  dotClass: string;
}) {
  return (
    <ul className="mt-4 space-y-3">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-3 text-sm leading-6 text-slate-700"
        >
          <span
            className={`mt-2 h-1.5 w-1.5 flex-none rounded-full ${dotClass}`}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

function SignalLayersSection() {
  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8">
      <div className="site-shell space-y-6">
        <div>
          <span className="eyebrow-label">Signal layers</span>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Each layer stays visible, but each one carries a different
            confidence boundary so nearby routing, public medication evidence,
            and contributor input do not blur together.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {signalLayers.map((layer) => (
            <SignalLayerCard key={layer.title} layer={layer} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MethodologyBoundarySection() {
  return (
    <section className="px-4 pb-16 sm:px-6 lg:px-8">
      <div className="site-shell grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="surface-panel rounded-[2rem] p-6 sm:p-7">
          <span className="eyebrow-label">Claim boundary</span>
          <h2 className="mt-4 text-2xl tracking-tight text-slate-950">
            Useful context belongs in the product. Guarantees do not.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            The interface is intentionally structured so local search,
            medication evidence, contributor context, and unresolved questions
            do not blur into a false inventory promise.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Shown directly
              </span>
              <BulletList items={explicitClaims} dotClass="bg-emerald-500" />
            </div>

            <div className="rounded-[1.5rem] border border-rose-100 bg-rose-50/70 p-5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                Still manual
              </span>
              <BulletList items={manualChecks} dotClass="bg-rose-400" />
            </div>
          </div>
        </div>

        <div className="surface-panel rounded-[2rem] p-6 sm:p-7">
          <span className="eyebrow-label">Responsible use</span>
          <h2 className="mt-4 text-2xl tracking-tight text-slate-950">
            Use the shortlist, then verify the answer.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
            PharmaPath is a routing and context tool. Direct pharmacy
            confirmation, clinician judgment, and urgency assessment still sit
            outside the product.
          </p>
          <BulletList items={usageRules} dotClass="bg-slate-400" />
        </div>
      </div>
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <>
      <SiteNavbar />
      <PageTransitionShell>
        <section className="px-4 pb-14 pt-28 sm:px-6 lg:px-8">
          <div className="site-shell grid gap-8 lg:grid-cols-[0.98fr_1.02fr] lg:items-start">
            <div>
              <span className="eyebrow-label">Methodology</span>
              <h1 className="mt-6 text-[2.9rem] leading-tight tracking-tight text-slate-950 sm:text-[3.45rem]">
                What PharmaPath shows directly, what it infers, and what still
                needs verification.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                PharmaPath is built to shorten the next step without overstating
                certainty. The product keeps local search results, public
                medication context, and still-manual verification clearly
                separated.
              </p>
            </div>

            <div className="surface-panel rounded-[2.2rem] bg-white/94 p-6 shadow-none backdrop-blur-none sm:p-8">
              <span className="eyebrow-label">How to read the product</span>
              <div className="mt-6 space-y-3">
                {interpretationNotes.map((note) => (
                  <div
                    key={note.heading}
                    className="rounded-[1.45rem] border border-slate-200/80 bg-slate-50/70 p-4"
                  >
                    <h2 className="text-sm font-semibold text-slate-900">
                      {note.heading}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {note.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <SignalLayersSection />

        <MethodologyBoundarySection />
      </PageTransitionShell>
      <SiteFooter />
    </>
  );
}
