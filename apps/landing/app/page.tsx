import CTASection from '@/components/CTASection'
import CommandCenterSection from '@/components/CommandCenterSection'
import FAQSection, { faqs } from '@/components/FAQSection'
import FeaturesSection from '@/components/FeaturesSection'
import HeroSection from '@/components/HeroSection'
import HowItWorksSection from '@/components/HowItWorksSection'
import LandingFooter from '@/components/LandingFooter'
import LandingHeader from '@/components/LandingHeader'
import PricingSection from '@/components/PricingSection'
import TrustLogosSection from '@/components/TrustLogosSection'

const siteUrl = 'https://reputationos.generationweb.ru'

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Reputation OS',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: siteUrl,
    description: 'Reputation OS — операционная система для управления отзывами, рейтингами, упоминаниями и репутационными рисками бизнеса.',
    offers: {
      '@type': 'Offer',
      price: '3990',
      priceCurrency: 'RUB',
      availability: 'https://schema.org/InStock'
    }
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  }
]

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="landing-shell">
        <div className="space-noise" />
        <LandingHeader />
        <main>
          <HeroSection />
          <TrustLogosSection />
          <FeaturesSection />
          <CommandCenterSection />
          <HowItWorksSection />
          <PricingSection />
          <FAQSection />
          <CTASection />
        </main>
        <LandingFooter />
      </div>
    </>
  )
}
