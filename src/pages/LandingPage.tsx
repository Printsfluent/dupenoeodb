import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import TrustedBy from '../components/TrustedBy'
import HowItWorks from '../components/HowItWorks'
import ViewsSection from '../components/ViewsSection'
import UseCases from '../components/UseCases'
import WhySection from '../components/WhySection'
import FairSource from '../components/FairSource'
import FeaturesOverview from '../components/FeaturesOverview'
import FeatureShowcase from '../components/FeatureShowcase'
import HighlightSections from '../components/HighlightSections'
import Newsletter from '../components/Newsletter'
import Footer from '../components/Footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <Hero />
        <TrustedBy />
        <HowItWorks />
        <ViewsSection />
        <UseCases />
        <WhySection />
        <FairSource />
        <FeaturesOverview />
        <FeatureShowcase />
        <HighlightSections />
        <Newsletter />
      </main>
      <Footer />
    </div>
  )
}
