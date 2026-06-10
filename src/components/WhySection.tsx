import { Shield, Heart, TrendingUp, Zap, Users, Sparkles } from 'lucide-react'

const reasons = [
  {
    icon: Shield,
    title: 'BaseFlow Is Redefining Data Ownership For Customers',
    desc: 'Using no-code solutions shouldn\'t mean you have no direct access to the data and have artificial glass ceilings imposed on your data capabilities.',
  },
  {
    icon: Heart,
    title: 'BaseFlow Values Customers of all Sizes',
    desc: 'With strong fair code ethos — BaseFlow caters to businesses of all sizes & shapes. Be it Agencies, Startups, Small Medium Businesses and Enterprises.',
  },
  {
    icon: TrendingUp,
    title: 'BaseFlow Scales Millions of Rows — No Need to "Talk to Sales"',
    desc: 'While other platforms limit high-volume no-code databases to enterprise plans, many BaseFlow customers are already dealing in millions of rows with ease.',
  },
  {
    icon: Zap,
    title: 'BaseFlow Provides High API Throughput',
    desc: 'Streamline and automate with confidence; BaseFlow has your back. Rely on robust infrastructure to drive your operations smoothly and efficiently.',
  },
  {
    icon: Users,
    title: 'BaseFlow is A Community Driven Fair Source Product',
    desc: 'Dive into a world of community-driven innovation with BaseFlow. Experience the power of collective intelligence as enthusiasts and experts come together.',
  },
  {
    icon: Sparkles,
    title: 'BaseFlow Is The New No-Code Paradigm',
    desc: 'Embrace a new paradigm in no-code that helps businesses to solve all their no-code needs while owning all of their data.',
  },
]

export default function WhySection() {
  return (
    <section id="why" className="py-20 sm:py-28 bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Why BaseFlow?
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            A new no-code paradigm that offers you data sovereignty, unprecedented scale,
            and exceptional value as a customer.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map((reason) => {
            const Icon = reason.icon
            return (
              <div
                key={reason.title}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-300 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white mb-2 leading-snug">{reason.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{reason.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
