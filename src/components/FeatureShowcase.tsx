import { useState } from 'react'
import { APP_NAME } from '../lib/brand'

const features = [
  {
    id: 'connect',
    label: 'Connect External DataBases',
    title: 'Integrate external databases in minimal steps.',
    desc: 'Connect Postgres, MySQL, SQLite, or use our hosted option. Your data stays where you want it.',
  },
  {
    id: 'import',
    label: 'Import Data',
    title: 'Simplify data import from Airtable, CSV, Excel, and more.',
    desc: 'Migrate your existing spreadsheets and databases in just a few clicks.',
  },
  {
    id: 'invite',
    label: 'Invite Team',
    title: 'Collaborate on data with your team by your side.',
    desc: 'Role-based access control lets you share exactly what each team member needs.',
  },
  {
    id: 'share',
    label: 'Share Project',
    title: 'Collaborate on projects, share insights, and improve productivity.',
    desc: 'Public and private sharing options for views, forms, and entire projects.',
  },
  {
    id: 'fields',
    label: 'Multi Fields Edit',
    title: 'Manage all your fields from a single page.',
    desc: 'Add, rename, reorder, and configure field types without leaving the editor.',
  },
  {
    id: 'erd',
    label: 'ERD Diagram',
    title: 'Easily visualise database schema with ERD View.',
    desc: 'See relationships between tables at a glance with our interactive diagram.',
  },
  {
    id: 'filter',
    label: 'Filter Records',
    title: 'Easily filter and extract insights from your records.',
    desc: 'Powerful filtering with nested conditions, saved views, and quick presets.',
  },
  {
    id: 'api',
    label: 'APIs',
    title: 'Harness the power of APIs for seamless integration.',
    desc: 'Auto-generated REST APIs for every table. Build apps and automations on top of your data.',
  },
]

export default function FeatureShowcase() {
  const [active, setActive] = useState('connect')
  const current = features.find((f) => f.id === active)!

  return (
    <section className="py-20 sm:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2 space-y-1">
            {features.map((feat) => (
              <button
                key={feat.id}
                type="button"
                onClick={() => setActive(feat.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  active === feat.id
                    ? 'bg-brand-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-white hover:text-gray-900'
                }`}
              >
                {feat.label}
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg h-full flex flex-col justify-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{current.title}</h3>
              <p className="text-gray-600 leading-relaxed mb-8">{current.desc}</p>
              <FeatureVisual id={current.id} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function FeatureVisual({ id }: { id: string }) {
  if (id === 'connect') {
    return (
      <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
        <div className="flex-1 p-3 rounded-lg bg-white border border-gray-200 text-center text-xs font-medium text-gray-500">
          Your Postgres
        </div>
        <div className="text-brand-500 font-bold">→</div>
        <div className="flex-1 p-3 rounded-lg bg-brand-50 border border-brand-200 text-center text-xs font-medium text-brand-700">
          {APP_NAME}
        </div>
      </div>
    )
  }

  if (id === 'erd') {
    return (
      <div className="flex items-center justify-center gap-6 p-6">
        {['Users', 'Orders', 'Products'].map((table, i) => (
          <div key={table} className="relative">
            <div className="px-4 py-3 rounded-lg bg-white border-2 border-brand-200 text-sm font-medium text-gray-700 shadow-sm">
              {table}
            </div>
            {i < 2 && (
              <div className="absolute top-1/2 -right-6 w-6 h-px bg-brand-300" />
            )}
          </div>
        ))}
      </div>
    )
  }

  if (id === 'api') {
    return (
      <div className="rounded-lg bg-gray-900 p-4 font-mono text-xs text-green-400 overflow-x-auto">
        <div><span className="text-blue-400">GET</span> /api/v3/tables/orders/records</div>
        <div className="text-gray-500 mt-2">{'{'}</div>
        <div className="pl-4 text-gray-300">&quot;count&quot;: 1,247,</div>
        <div className="pl-4 text-gray-300">&quot;page&quot;: 1,</div>
        <div className="pl-4 text-gray-300">&quot;list&quot;: [...]</div>
        <div className="text-gray-500">{'}'}</div>
      </div>
    )
  }

  return (
    <div className="h-24 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-100 flex items-center justify-center">
      <span className="text-sm text-brand-600 font-medium">Feature preview</span>
    </div>
  )
}
