import { Database, LayoutGrid, Code2 } from 'lucide-react'

const steps = [
  {
    icon: Database,
    title: 'Connect Your Data',
    desc: 'Start from scratch or connect any Postgres, MySQL, or SQLite database in minutes.',
  },
  {
    icon: LayoutGrid,
    title: 'Organize with Views',
    desc: 'Switch between Grid, Kanban, Gallery, Form, and Calendar views to match your workflow.',
  },
  {
    icon: Code2,
    title: 'Integrate & Automate',
    desc: 'Access your data through REST APIs, webhooks, or SQL — build automations with confidence.',
  },
]

export default function HowItWorks() {
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            How It Works — A Quick Overview
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            BaseFlow provides an intuitive spreadsheet interface for creating online databases,
            either from scratch or by connecting to any Postgres/MySQL. Access your data through
            interactive UIs like Kanban, Form, and Gallery, or via API and SQL.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={step.title} className="relative text-center p-8">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-brand-200 to-transparent" />
                )}
                <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-5">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-brand-500 uppercase tracking-wider mb-2">
                  Step {i + 1}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
