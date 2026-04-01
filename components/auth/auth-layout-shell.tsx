import type { ReactNode } from "react";
import { ShieldCheck, Stethoscope, Users } from "lucide-react";
import { SiteBrand } from "@/components/site-brand";
import { combinedSurfaceLabel } from "@/lib/surface-labels";

function Logo() {
  return <SiteBrand />;
}

const testimonial = {
  quote:
    "PharmaPath keeps the nearby pharmacy search credible by separating live search results, medication context, and community reporting instead of blurring them together.",
  author: "Dylan Lim",
  role: "Hackathon Product Lead",
  company: "RamHack 2026",
};

const stats = [
  { value: "Live", label: "Nearby pharmacy discovery" },
  { value: "Weighted", label: "Crowd reports by trust + recency" },
  { value: "Truthful", label: "No false stock claims" },
];

const features = [
  { icon: ShieldCheck, label: "Trust-weighted reports" },
  { icon: Stethoscope, label: combinedSurfaceLabel },
  { icon: Users, label: "Contributor profiles" },
];

export function AuthLayoutShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#e8f4fa] via-[#f5f7fb] to-[#eef8f5] lg:flex lg:w-1/2">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-[#156d95]/12 blur-3xl animate-gradient" />
          <div
            className="absolute -right-20 bottom-1/4 h-96 w-96 rounded-full bg-[#23a386]/10 blur-3xl animate-gradient"
            style={{ animationDelay: "-7s" }}
          />
        </div>

        <div className="relative z-10 flex w-full flex-col justify-between p-12">
          <Logo />

          <div className="space-y-8">
            <blockquote className="space-y-4">
              <p className="text-2xl font-medium leading-relaxed text-slate-950 text-balance">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <footer className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/75 font-medium text-slate-700 shadow-sm">
                  {testimonial.author
                    .split(" ")
                    .map((token) => token[0])
                    .join("")}
                </div>
                <div>
                  <p className="font-medium text-slate-950">
                    {testimonial.author}
                  </p>
                  <p className="text-sm text-slate-600">
                    {testimonial.role} at {testimonial.company}
                  </p>
                </div>
              </footer>
            </blockquote>

            <div className="flex gap-8 border-t border-slate-200 pt-8">
              {stats.map((stat) => (
                <div key={stat.label} className="max-w-[9rem]">
                  <p className="text-2xl font-bold text-slate-950">
                    {stat.value}
                  </p>
                  <p className="text-sm text-slate-600">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-6">
            {features.map((feature) => (
              <div
                key={feature.label}
                className="flex items-center gap-2 text-slate-600"
              >
                <feature.icon className="h-4 w-4" />
                <span className="text-sm">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="flex flex-1 flex-col">
        <div className="p-6 pb-0 lg:hidden">
          <Logo />
        </div>

        <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
