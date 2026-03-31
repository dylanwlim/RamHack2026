import { PageTransitionShell } from "@/components/page-transition-shell";
import { PrescriberClient } from "@/components/search/prescriber-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";

type PrescriberPageProps = {
  searchParams: Promise<{
    query?: string;
    id?: string;
    location?: string;
  }>;
};

export default async function PrescriberPage({ searchParams }: PrescriberPageProps) {
  const params = await searchParams;

  return (
    <>
      <SiteNavbar />
      <PageTransitionShell>
        <PrescriberClient
          initialQuery={params.query}
          initialMatchId={params.id}
          initialLocation={params.location}
        />
      </PageTransitionShell>
      <SiteFooter />
    </>
  );
}
