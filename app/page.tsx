import { FAQSection } from "@/components/marketing/faq-section";
import { AccessScaleSection } from "@/components/marketing/access-scale";
import { DataRail } from "@/components/marketing/data-rail";
import { HeroSection } from "@/components/marketing/hero-section";
import { WorkflowShowcase } from "@/components/marketing/workflow-showcase";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";
import { homeFaqs } from "@/lib/content";

export default function Page() {
  return (
    <>
      <SiteNavbar />
      <main>
        <HeroSection />
        <AccessScaleSection />
        <WorkflowShowcase />
        <DataRail />
        <FAQSection faqs={homeFaqs} />
      </main>
      <SiteFooter />
    </>
  );
}
