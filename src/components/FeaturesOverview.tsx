import {
  Database, Upload, UserPlus, Share2, Columns, GitBranch,
  Filter, ArrowUpDown, Layers, Webhook, Zap, Command,
} from 'lucide-react'

const categories = [
  {
    title: 'Data Integration and Connectivity',
    features: [
      { icon: Database, label: 'Connect external DB' },
      { icon: Upload, label: 'Import' },
    ],
  },
  {
    title: 'Collaboration',
    features: [
      { icon: UserPlus, label: 'Invite Team' },
      { icon: Share2, label: 'Share Project' },
    ],
  },
  {
    title: 'Schema Management',
    features: [
      { icon: Columns, label: 'Multi Fields Edit' },
      { icon: GitBranch, label: 'ERD' },
    ],
  },
  {
    title: 'Table Operations',
    features: [
      { icon: Filter, label: 'Filter' },
      { icon: ArrowUpDown, label: 'Sort' },
      { icon: Layers, label: 'Group By' },
    ],
  },
  {
    title: 'Integrations and Automations',
    features: [
      { icon: Zap, label: 'APIs' },
      { icon: Webhook, label: 'Web-hooks' },
    ],
  },
  {
    title: 'Quick Actions',
    features: [
      { icon: Command, label: 'Cmd+J' },
      { icon: Command, label: 'Cmd+K' },
      { icon: Command, label: 'Cmd+L' },
    ],
  },
]

export default function FeaturesOverview() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Features Overview
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Dive deep into our platform to uncover its powerful capabilities.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <div
              key={cat.title}
              className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 dark:bg-gray-900 dark:border-gray-800 hover:shadow-md transition-shadow"
            >
              <h3 className="text-sm font-bold text-gray-900 mb-4">{cat.title}</h3>
              <div className="flex flex-wrap gap-2">
                {cat.features.map((feat) => {
                  const Icon = feat.icon
                  return (
                    <span
                      key={feat.label}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-xs font-medium text-gray-600 border border-gray-100"
                    >
                      <Icon className="w-3.5 h-3.5 text-brand-500" />
                      {feat.label}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
