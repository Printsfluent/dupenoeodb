import { Smartphone, TrendingUp, PenTool, Network } from 'lucide-react'
import { APP_NAME } from '../lib/brand'

const highlights = [
  {
    icon: PenTool,
    title: 'Craft Your Database With Ease',
    desc: 'Use our multi-field edit functionality to craft tables in one go. Add columns, set types, and configure relationships without writing a single line of code.',
    align: 'left' as const,
  },
  {
    icon: Smartphone,
    title: 'Anytime, Anywhere',
    desc: 'Effortlessly view and edit your data anytime, anywhere, from your smartphone with our responsive views. Your database travels with you.',
    align: 'right' as const,
  },
  {
    icon: TrendingUp,
    title: 'Scale to Millions of Rows!',
    desc: `Simply use our hosted database or bring your own Postgres/MySQL. ${APP_NAME} handles millions of rows without breaking a sweat — no enterprise sales call required.`,
    align: 'left' as const,
  },
  {
    icon: Network,
    title: 'Easy Schema Visualisation & Control',
    desc: 'Gain deep insight into your database structure with our ERD View. Understand relationships, manage schemas, and stay in full control of your data model.',
    align: 'right' as const,
  },
]

export default function HighlightSections() {
  return (
    <>
      {highlights.map((item, i) => {
        const Icon = item.icon
        const isLeft = item.align === 'left'
        return (
          <section
            key={item.title}
            className={`py-20 sm:py-24 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className={`grid lg:grid-cols-2 gap-12 items-center ${isLeft ? '' : 'lg:[direction:rtl]'}`}>
                <div className={isLeft ? '' : 'lg:[direction:ltr]'}>
                  <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                    {item.title}
                  </h2>
                  <p className="text-gray-600 leading-relaxed text-lg">{item.desc}</p>
                </div>
                <div className={`rounded-2xl border border-gray-200 bg-white p-8 shadow-lg ${isLeft ? '' : 'lg:[direction:ltr]'}`}>
                  <HighlightVisual index={i} />
                </div>
              </div>
            </div>
          </section>
        )
      })}
    </>
  )
}

function HighlightVisual({ index }: { index: number }) {
  const visuals = [
    <div key="craft" className="space-y-3">
      {['Name — Text', 'Email — Email', 'Status — Select', 'Created — DateTime'].map((field) => (
        <div key={field} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
          <div className="w-2 h-2 rounded-full bg-brand-400" />
          <span className="text-sm text-gray-700">{field}</span>
        </div>
      ))}
    </div>,
    <div key="mobile" className="mx-auto w-48 rounded-3xl border-4 border-gray-800 bg-white p-3 shadow-xl">
      <div className="rounded-2xl bg-gray-50 p-3 space-y-2">
        <div className="h-2 w-16 bg-gray-200 rounded" />
        <div className="h-8 bg-brand-50 rounded-lg border border-brand-100" />
        <div className="h-8 bg-white rounded-lg border border-gray-100" />
        <div className="h-8 bg-white rounded-lg border border-gray-100" />
      </div>
    </div>,
    <div key="scale" className="text-center">
      <div className="text-5xl font-extrabold text-brand-500 mb-2">2.4M</div>
      <div className="text-sm text-gray-500">rows processed seamlessly</div>
      <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-brand-400 to-brand-600" />
      </div>
    </div>,
    <div key="erd" className="flex flex-col items-center gap-4">
      <div className="px-6 py-2 rounded-lg bg-brand-50 border border-brand-200 text-sm font-medium text-brand-700">
        customers
      </div>
      <div className="w-px h-6 bg-brand-300" />
      <div className="flex gap-8">
        <div className="px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600">orders</div>
        <div className="px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600">invoices</div>
      </div>
    </div>,
  ]

  return visuals[index]
}
