import { PlusSquare, Download } from 'lucide-react'

const actions = [
  {
    id: 'create-base',
    icon: PlusSquare,
    iconColor: 'text-brand-400',
    title: 'Create New Base',
    desc: 'Start from scratch. Add tables inside your base.',
  },
  {
    id: 'import',
    icon: Download,
    iconColor: 'text-orange-400',
    title: 'Import Base',
    desc: 'From CSV, TSV, or Excel files.',
  },
]

interface DataActionsProps {
  onAction: (actionId: string) => void
}

export default function DataActions({ onAction }: DataActionsProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">Data Actions</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.id)}
              className="text-left p-5 rounded-xl border border-app-border bg-app-surface hover:border-app-border-strong hover:bg-app-surface-hover cursor-pointer transition-all"
            >
              <Icon className={`w-6 h-6 mb-4 ${action.iconColor}`} />
              <h3 className="text-sm font-semibold text-white mb-1">{action.title}</h3>
              <p className="text-xs text-gray-500">{action.desc}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
