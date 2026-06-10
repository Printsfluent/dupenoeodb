import { Database, Users, Settings } from 'lucide-react'
import PlanBadge from './PlanBadge'
import type { PlanId } from '../types'

const tabs = [
  { id: 'bases', label: 'Bases', icon: Database },
  { id: 'members-teams', label: 'Members & Teams', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

export type WorkspaceTab = (typeof tabs)[number]['id']

interface WorkspaceHeaderProps {
  workspaceName: string
  activeTab: WorkspaceTab
  onTabChange: (tab: WorkspaceTab) => void
  planId?: PlanId
}

export default function WorkspaceHeader({ workspaceName, activeTab, onTabChange, planId }: WorkspaceHeaderProps) {
  return (
    <header className="shrink-0 border-b border-app-border bg-app-bg">
      <div className="flex items-center gap-3 px-6 h-14">
        <h1 className="text-sm font-bold tracking-wide text-app-text uppercase">{workspaceName}</h1>
        <PlanBadge planId={planId} />
      </div>

      <nav className="flex items-center gap-1 px-6">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-app-faint hover:text-app-muted'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
