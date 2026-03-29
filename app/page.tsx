import { FAQSection } from "@/components/marketing/faq-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { WorkflowShowcase } from "@/components/marketing/workflow-showcase";
import { PageTransitionShell } from "@/components/page-transition-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";
import { homeFaqs } from "@/lib/content";

export default function Page() {
  return (
    <>
      <SiteNavbar />
      <PageTransitionShell>
        <HeroSection />
        <WorkflowShowcase />
        <FAQSection faqs={homeFaqs} />
      </PageTransitionShell>
      <SiteFooter />
    </>
  );
}
