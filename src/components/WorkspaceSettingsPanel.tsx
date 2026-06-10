import { useState, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
import type { Base, PlanId, Workspace } from '../types'
import { getInitials } from '../lib/colors'
import { copyToClipboard } from '../lib/copy'
import { assignUserPlan, getUsers, upsertWorkspace } from '../lib/storage'
import { PLAN_OPTIONS } from '../lib/plans'
import { memberLeaveWorkspace } from '../lib/members'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useNavigate } from 'react-router-dom'

interface WorkspaceSettingsPanelProps {
  workspace: Workspace
  bases: Base[]
  isOwner: boolean
  onUpdate: (workspace: Workspace) => void
}

function CopyId({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const ok = await copyToClipboard(value)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-300 font-mono truncate">{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-app-surface-active shrink-0"
        title="Copy ID"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  )
}

export default function WorkspaceSettingsPanel({
  workspace,
  bases,
  isOwner,
  onUpdate,
}: WorkspaceSettingsPanelProps) {
  const { user, refreshProfile } = useAuth()
  const { cacheVersion } = useData()
  const [allUsers, setAllUsers] = useState(() => getUsers())

  useEffect(() => {
    setAllUsers(getUsers())
  }, [cacheVersion])
  const navigate = useNavigate()
  const [name, setName] = useState(workspace.name)
  const [allowLeave, setAllowLeave] = useState(workspace.settings.allowMembersToLeave)

  function saveName() {
    if (!name.trim()) return
    const updated = { ...workspace, name: name.trim() }
    upsertWorkspace(updated)
    onUpdate(updated)
  }

  function saveLeaveSetting(checked: boolean) {
    const updated = {
      ...workspace,
      settings: { ...workspace.settings, allowMembersToLeave: checked },
    }
    upsertWorkspace(updated)
    setAllowLeave(checked)
    onUpdate(updated)
  }

  function refreshUsers() {
    setAllUsers(getUsers())
  }

  function handleUserPlanChange(userId: string, email: string, plan: PlanId) {
    const result = assignUserPlan(userId, email, plan, true)
    if (!result.ok) {
      alert(result.error)
      return
    }
    if (userId === user?.userId) refreshProfile()
    refreshUsers()
  }

  function handleLeave() {
    if (!user) return
    if (!workspace.settings.allowMembersToLeave) {
      alert('The workspace owner has disabled leaving. Contact the owner to be removed.')
      return
    }
    if (!confirm('Leave this workspace? You will lose access unless re-invited.')) return
    const result = memberLeaveWorkspace(workspace.id, user.userId)
    if (result.ok) navigate('/app')
    else alert(result.error)
  }

  const allTables = bases.flatMap((b) =>
    b.tables.map((t) => ({ table: t, baseName: b.name, baseId: b.id })),
  )

  return (
    <div className="max-w-2xl space-y-8">
      <section className="rounded-xl border border-app-border bg-app-surface p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Workspace Appearance</h2>
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-lg flex items-center justify-center text-lg font-bold text-white shrink-0"
            style={{ backgroundColor: workspace.color }}
          >
            {getInitials(workspace.name)}
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="ws-name" className="text-xs font-medium text-gray-400">Name</label>
                <span className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
                  Workspace ID: {workspace.slug}
                </span>
              </div>
              {isOwner ? (
                <input
                  id="ws-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={saveName}
                  className="w-full px-3 py-2.5 rounded-lg bg-app-input border border-app-border text-white focus:outline-none focus:border-brand-500"
                />
              ) : (
                <p className="text-white">{workspace.name}</p>
              )}
            </div>
            <CopyId label="Full workspace ID" value={workspace.id} />
            <CopyId label="Workspace slug" value={workspace.slug} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-app-border bg-app-surface p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Tables & IDs</h2>
        {allTables.length === 0 ? (
          <p className="text-sm text-gray-500">No tables yet. Create a base to see table IDs here.</p>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {allTables.map(({ table, baseName, baseId }) => (
              <div key={table.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm text-white font-medium">{table.name}</p>
                <p className="text-xs text-gray-500 mb-2">{baseName}</p>
                <CopyId label="Table ID" value={table.id} />
                <CopyId label="Base ID" value={baseId} />
              </div>
            ))}
          </div>
        )}
      </section>

      {isOwner && (
        <section className="rounded-xl border border-app-border bg-app-surface p-6">
          <h2 className="text-sm font-semibold text-white mb-1">User Plans</h2>
          <p className="text-xs text-gray-500 mb-4">
            Upgrade or downgrade any account. Changes apply immediately across all workspaces.
          </p>
          {allUsers.length === 0 ? (
            <p className="text-sm text-gray-500">No registered users yet.</p>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {allUsers.map((account) => (
                <div key={account.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{account.name}</p>
                    <p className="text-xs text-gray-500 truncate">{account.email}</p>
                  </div>
                  <select
                    value={account.plan ?? 'free'}
                    onChange={(e) => handleUserPlanChange(account.id, account.email, e.target.value as PlanId)}
                    className="px-2 py-1.5 rounded-lg text-xs font-medium border border-app-border-strong bg-app-input text-gray-300 cursor-pointer shrink-0"
                  >
                    {PLAN_OPTIONS.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {isOwner && (
        <section className="rounded-xl border border-app-border bg-app-surface p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Member Policy</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowLeave}
              onChange={(e) => saveLeaveSetting(e.target.checked)}
              className="mt-1 rounded border-gray-600"
            />
            <div>
              <p className="text-sm text-white">Allow members to leave on their own</p>
              <p className="text-xs text-gray-500 mt-1">
                When disabled, only you (the owner) can remove or block member access.
              </p>
            </div>
          </label>
        </section>
      )}

      {!isOwner && (
        <section className="rounded-xl border border-red-900/40 bg-app-surface p-6">
          <h2 className="text-sm font-semibold text-red-400 mb-2">Danger Zone</h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white">Leave this workspace</p>
              <p className="text-xs text-gray-500 mt-1">
                {workspace.settings.allowMembersToLeave
                  ? 'You will no longer have access unless re-invited.'
                  : 'Leaving is disabled by the workspace owner.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLeave}
              disabled={!workspace.settings.allowMembersToLeave}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-900/50 hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              Leave Workspace
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
