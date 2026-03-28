import { Suspense } from "react";
import { PatientResultsClient } from "@/components/search/patient-results-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";

export default function PatientResultsPage() {
  return (
    <>
      <SiteNavbar />
      <main>
        <Suspense fallback={<div className="px-6 py-32 text-center text-slate-500">Loading patient results...</div>}>
          <PatientResultsClient />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
