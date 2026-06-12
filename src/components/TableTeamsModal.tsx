import { X } from 'lucide-react'
import type { Team } from '../types'
import { getInitials } from '../lib/colors'

interface TableTeamsModalProps {
  tableName: string
  title?: string
  description?: string
  teams: Team[]
  selectedTeamIds: string[]
  onChange: (teamIds: string[]) => void
  onSave: () => void
  onClose: () => void
}

export default function TableTeamsModal({
  tableName,
  title,
  description,
  teams,
  selectedTeamIds,
  onChange,
  onSave,
  onClose,
}: TableTeamsModalProps) {
  const modalTitle = title ?? `Team access — ${tableName}`
  const modalDescription =
    description ??
    'Restrict this table to specific teams. Members not in any selected team will not see this table. Leave empty to allow all workspace members. Admins always have access.'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-md rounded-xl border border-app-border bg-app-surface shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h3 className="text-sm font-semibold text-app-text">{modalTitle}</h3>
          <button type="button" onClick={onClose} className="p-1 text-app-faint hover:text-app-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-xs text-app-faint mb-4 leading-relaxed">{modalDescription}</p>
          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {teams.length === 0 ? (
              <p className="text-sm text-app-faint">No teams yet. Create teams in Members &amp; Teams first.</p>
            ) : (
              teams.map((team) => (
                <label
                  key={team.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-app-surface-active cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTeamIds.includes(team.id)}
                    onChange={(e) => {
                      onChange(
                        e.target.checked
                          ? [...selectedTeamIds, team.id]
                          : selectedTeamIds.filter((id) => id !== team.id),
                      )
                    }}
                    className="rounded border-gray-600"
                  />
                  <span
                    className="w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: team.color }}
                  >
                    {getInitials(team.name)}
                  </span>
                  <span className="text-sm text-app-text">{team.name}</span>
                </label>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-app-faint hover:bg-app-surface-active"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-500 hover:bg-brand-600"
            >
              Save teams
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
