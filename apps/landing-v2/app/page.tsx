import Header from '@/components/sections/Header';
import Hero from '@/components/sections/Hero';
import NoiseMarquee from '@/components/sections/NoiseMarquee';
import ProductScene from '@/components/sections/ProductScene';
import FeaturesRail from '@/components/sections/FeaturesRail';
import Metrics from '@/components/sections/Metrics';
import Sources from '@/components/sections/Sources';
import Pricing from '@/components/sections/Pricing';
import FinalCta from '@/components/sections/FinalCta';
import Footer from '@/components/sections/Footer';
import BackgroundMorph from '@/components/providers/BackgroundMorph';

export default function Page() {
  return (
    <main>
      <BackgroundMorph />
      <Header />
      <Hero />
      <NoiseMarquee />
      <ProductScene />
      <FeaturesRail />
      <Metrics />
      <Sources />
      <Pricing />
      <FinalCta />
      <Footer />
    </main>
  );
}
