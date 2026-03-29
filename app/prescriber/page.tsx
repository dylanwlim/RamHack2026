import { Suspense } from "react";
import { PageTransitionShell } from "@/components/page-transition-shell";
import { PrescriberClient } from "@/components/search/prescriber-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";

export default function PrescriberPage() {
  return (
    <>
      <SiteNavbar />
      <PageTransitionShell>
        <Suspense fallback={<div className="px-6 py-32 text-center text-slate-500">Loading...</div>}>
          <PrescriberClient />
        </Suspense>
      </PageTransitionShell>
      <SiteFooter />
    </>
  );
}
