import { Suspense } from "react";
import { DrugDetailClient } from "@/components/search/drug-detail-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";

export default function DrugPage() {
  return (
    <>
      <SiteNavbar />
      <main>
        <Suspense fallback={<div className="px-6 py-32 text-center text-slate-500">Loading drug detail...</div>}>
          <DrugDetailClient />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
