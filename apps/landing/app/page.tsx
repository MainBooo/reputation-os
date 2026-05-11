import AlertsSection from '@/components/AlertsSection'
import CTASection from '@/components/CTASection'
import ComparisonSection from '@/components/ComparisonSection'
import FAQSection, { faqs } from '@/components/FAQSection'
import FeaturesSection from '@/components/FeaturesSection'
import HeroSection from '@/components/HeroSection'
import HowItWorksSection from '@/components/HowItWorksSection'
import LandingFooter from '@/components/LandingFooter'
import LandingHeader from '@/components/LandingHeader'
import PricingSection from '@/components/PricingSection'
import ProblemSection from '@/components/ProblemSection'
import ProductPreviewSection from '@/components/ProductPreviewSection'
import SourcesSection from '@/components/SourcesSection'

const siteUrl = 'https://reputationos.generationweb.ru'

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Reputation OS',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: siteUrl,
    description: 'Reputation OS собирает отзывы, рейтинги, упоминания и сигналы из карт, каталогов, сайтов с отзывами и web-источников в единый Inbox, показывает статусы сбора и оповещает о новых репутационных рисках.',
    offers: {
      '@type': 'Offer',
      price: '990',
      priceCurrency: 'RUB',
      availability: 'https://schema.org/InStock'
    }
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Generation Web',
    url: 'https://generationweb.ru',
    brand: {
      '@type': 'Brand',
      name: 'Reputation OS'
    },
    sameAs: ['https://t.me/max92pole']
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingHeader />
      <main>
        <HeroSection />
        <ProblemSection />
        <AlertsSection />
        <ProductPreviewSection />
        <ComparisonSection />
        <HowItWorksSection />
        <SourcesSection />
        <FeaturesSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <LandingFooter />
    </>
  )
}
