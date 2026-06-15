import { Nav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { PainPoints } from "@/components/marketing/pain-points";
import { Transition } from "@/components/marketing/transition";
import { Features } from "@/components/marketing/features";
import { Security } from "@/components/marketing/security";
import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { FinalCTA } from "@/components/marketing/final-cta";
import { Footer } from "@/components/marketing/footer";

export default function LandingPage() {
  return (
    <main>
      <Nav />
      <Hero />
      <PainPoints />
      <Transition />
      <Features />
      <Security />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
