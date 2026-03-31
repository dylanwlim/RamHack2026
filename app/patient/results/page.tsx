import { PatientResultsClient } from "@/components/search/patient-results-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";

type PatientResultsPageProps = {
  searchParams: Promise<{
    query?: string;
    location?: string;
    locationPlaceId?: string;
    radiusMiles?: string;
    sortBy?: "best_match" | "distance" | "rating";
    onlyOpenNow?: string;
  }>;
};

export default async function PatientResultsPage({ searchParams }: PatientResultsPageProps) {
  const params = await searchParams;

  return (
    <>
      <SiteNavbar />
      <main>
        <PatientResultsClient
          initialQuery={params.query}
          initialLocation={params.location}
          initialLocationPlaceId={params.locationPlaceId}
          initialRadiusMiles={params.radiusMiles}
          initialSortBy={params.sortBy}
          initialOnlyOpenNow={params.onlyOpenNow}
        />
      </main>
      <SiteFooter />
    </>
  );
}
