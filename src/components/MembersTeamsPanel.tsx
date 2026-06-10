import { useState, useEffect } from 'react'
import {
  Search, UserPlus, Plus, MoreVertical, X, Shield, Table2,
} from 'lucide-react'
import type { Base, MemberRole, PlanId, Team, Workspace, WorkspaceMember } from '../types'
import { getInitials, pickWorkspaceColor } from '../lib/colors'
import { getUserAvatarEmoji } from '../lib/storage'
import { PLAN_OPTIONS } from '../lib/plans'
import { getMemberPlan, updateMemberPlan } from '../lib/planAdmin'
import UserAvatar from './UserAvatar'
import PlanBadge from './PlanBadge'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import {
  sendWorkspaceInvite,
  blockMember,
  createTeam,
  getWorkspaceMembers,
  getWorkspaceTeams,
  removeMember,
  setMemberRole as updateMemberRole,
  setMemberTableAccess,
  unblockMember,
} from '../lib/members'

interface MembersTeamsPanelProps {
  workspace: Workspace
  bases: Base[]
  isOwner: boolean
  onRefresh: () => void
}

const roleLabels: Record<MemberRole, string> = {
  owner: 'Owner',
  creator: 'Creator',
  viewer: 'Viewer',
  no_access: 'No Access',
}

const roleColors: Record<MemberRole, string> = {
  owner: 'bg-purple-900/40 text-purple-300 border-purple-800',
  creator: 'bg-blue-900/40 text-blue-300 border-blue-800',
  viewer: 'bg-gray-800 text-gray-300 border-gray-700',
  no_access: 'bg-red-900/40 text-red-300 border-red-800',
}

export default function MembersTeamsPanel({
  workspace,
  bases,
  isOwner,
  onRefresh,
}: MembersTeamsPanelProps) {
  const { user, refreshProfile } = useAuth()
  const { cacheVersion } = useData()
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<WorkspaceMember[]>(() => getWorkspaceMembers(workspace.id))
  const [teams, setTeams] = useState<Team[]>(() => getWorkspaceTeams(workspace.id))
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [showTableAccess, setShowTableAccess] = useState<WorkspaceMember | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const [memberEmail, setMemberEmail] = useState('')
  const [memberTeamIds, setMemberTeamIds] = useState<string[]>([])
  const [memberRole, setMemberRole] = useState<MemberRole>('viewer')
  const [teamName, setTeamName] = useState('')
  const [addError, setAddError] = useState('')

  const allTables = bases.flatMap((b) => b.tables.map((t) => ({ ...t, baseName: b.name })))

  function refresh() {
    setMembers(getWorkspaceMembers(workspace.id))
    setTeams(getWorkspaceTeams(workspace.id))
    onRefresh()
  }

  useEffect(() => {
    refresh()
  }, [workspace.id, cacheVersion])

  const filteredMembers = members.filter((m) => {
    const q = search.toLowerCase()
    const inSearch =
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      teams.filter((t) => m.teamIds.includes(t.id)).some((t) => t.name.toLowerCase().includes(q))
    const inTeam = !selectedTeamId || m.teamIds.includes(selectedTeamId)
    return inSearch && inTeam
  })

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setAddError('')
    const result = sendWorkspaceInvite(
      workspace.id,
      memberEmail,
      memberTeamIds,
      memberRole,
      { id: user.userId, name: user.name, email: user.email },
    )
    if (!result.ok) {
      setAddError(result.error ?? 'Failed to send invite')
      return
    }
    setMemberEmail('')
    setMemberTeamIds([])
    setMemberRole('viewer')
    setShowAddMember(false)
    refresh()
  }

  function handleAddTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!teamName.trim()) return
    createTeam(workspace.id, teamName, workspace.ownerId, teams.length)
    setTeamName('')
    setShowAddTeam(false)
    refresh()
  }

  function handleRoleChange(member: WorkspaceMember, role: MemberRole) {
    if (!isOwner || member.role === 'owner') return
    updateMemberRole(member.id, role)
    refresh()
  }

  function handleSaveTableAccess(tableIds: string[]) {
    if (!showTableAccess || !isOwner) return
    setMemberTableAccess(showTableAccess.id, tableIds)
    setShowTableAccess(null)
    refresh()
  }

  function handlePlanChange(member: WorkspaceMember, plan: PlanId) {
    if (!isOwner) return
    const result = updateMemberPlan(member, plan)
    if (!result.ok) {
      alert(result.error)
      return
    }
    if (member.userId === user?.userId) refreshProfile()
    refresh()
  }

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members or teams"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-app-surface border border-app-border text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-app-border-strong"
          />
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAddTeam(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-brand-500/50 text-brand-400 text-sm font-medium hover:bg-brand-500/10"
            >
              <Plus className="w-4 h-4" />
              New Team
            </button>
            <button
              type="button"
              onClick={() => setShowAddMember(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
            >
              <UserPlus className="w-4 h-4" />
              Send Invite
            </button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase px-1">Teams</p>
          <button
            type="button"
            onClick={() => setSelectedTeamId(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              !selectedTeamId ? 'bg-app-surface-active text-white' : 'text-gray-400 hover:bg-app-surface-hover'
            }`}
          >
            All members
          </button>
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => setSelectedTeamId(team.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedTeamId === team.id ? 'bg-app-surface-active text-white' : 'text-gray-400 hover:bg-app-surface-hover'
              }`}
            >
              <div
                className="w-6 h-6 rounded text-xs font-bold flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: team.color }}
              >
                {getInitials(team.name)}
              </div>
              <span className="truncate flex-1">{team.name}</span>
              <span className="text-xs text-gray-600">{team.memberIds.length}</span>
            </button>
          ))}
          {teams.length === 0 && (
            <p className="text-xs text-gray-600 px-3 py-2">No teams yet</p>
          )}
        </div>

        <div className="rounded-xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface border-b border-app-border text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Teams</th>
                <th className="px-4 py-3 font-medium">Access</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Tables</th>
                {isOwner && <th className="px-4 py-3 font-medium w-10" />}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id} className="border-b border-app-border hover:bg-app-surface/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={member.name}
                        emoji={getUserAvatarEmoji(member.userId, member.email)}
                        color={pickWorkspaceColor(member.email.length)}
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-white">{member.name}</span>
                          {member.role === 'owner' && <Shield className="w-3 h-3 text-purple-400" />}
                        </div>
                        <span className="text-xs text-gray-500">{member.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {member.teamIds.length === 0 ? (
                        <span className="text-xs text-gray-600">—</span>
                      ) : (
                        member.teamIds.map((tid) => {
                          const team = teams.find((t) => t.id === tid)
                          return team ? (
                            <span key={tid} className="px-2 py-0.5 rounded text-xs bg-app-surface-active text-gray-400">
                              {team.name}
                            </span>
                          ) : null
                        })
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {member.status === 'pending' ? (
                      <span className="inline-flex px-2 py-1 rounded-lg text-xs font-medium border bg-amber-900/30 text-amber-300 border-amber-800">
                        Invite pending
                      </span>
                    ) : isOwner && member.role !== 'owner' ? (
                      <select
                        value={member.status === 'blocked' ? 'no_access' : member.role}
                        onChange={(e) => handleRoleChange(member, e.target.value as MemberRole)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium border bg-transparent cursor-pointer ${roleColors[member.status === 'blocked' ? 'no_access' : member.role]}`}
                      >
                        <option value="creator">Creator</option>
                        <option value="viewer">Viewer</option>
                        <option value="no_access">No Access</option>
                      </select>
                    ) : (
                      <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium border ${roleColors[member.role]}`}>
                        {roleLabels[member.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isOwner ? (
                      <select
                        value={getMemberPlan(member)}
                        onChange={(e) => handlePlanChange(member, e.target.value as PlanId)}
                        className="px-2 py-1 rounded-lg text-xs font-medium border border-app-border-strong bg-app-input text-gray-300 cursor-pointer"
                      >
                        {PLAN_OPTIONS.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <PlanBadge planId={getMemberPlan(member)} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {member.role === 'owner' ? (
                      <span className="text-xs text-gray-500">All tables</span>
                    ) : member.status === 'pending' ? (
                      <span className="text-xs text-gray-600">Awaiting acceptance</span>
                    ) : isOwner ? (
                      <button
                        type="button"
                        onClick={() => setShowTableAccess(member)}
                        className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
                      >
                        <Table2 className="w-3.5 h-3.5" />
                        {member.tableAccess.length === 0
                          ? 'Assign tables'
                          : `${member.tableAccess.length} table${member.tableAccess.length !== 1 ? 's' : ''}`}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {member.tableAccess.length} table{member.tableAccess.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 relative">
                      {member.role !== 'owner' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                            className="p-1 text-gray-500 hover:text-gray-300"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {menuOpen === member.id && (
                            <div className="absolute right-4 top-full z-20 mt-1 py-1 rounded-lg bg-app-surface-active border border-app-border-strong shadow-xl min-w-[140px]">
                              {member.status === 'blocked' ? (
                                <button
                                  type="button"
                                  onClick={() => { unblockMember(member.id); setMenuOpen(null); refresh() }}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-app-surface-hover"
                                >
                                  Unblock access
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => { blockMember(member.id); setMenuOpen(null); refresh() }}
                                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-app-surface-hover"
                                >
                                  Block access
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => { removeMember(member.id); setMenuOpen(null); refresh() }}
                                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-app-surface-hover"
                              >
                                Remove member
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMembers.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-12">No members found</p>
          )}
        </div>
      </div>

      {showAddMember && isOwner && (
        <Modal title="Send Workspace Invite" onClose={() => setShowAddMember(false)}>
          <form onSubmit={handleAddMember} className="space-y-4">
            <p className="text-xs text-gray-500">
              They&apos;ll receive an in-app notification to accept the invite. No email is sent.
            </p>
            {addError && <p className="text-sm text-red-400">{addError}</p>}
            <Field label="Email address">
              <input
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="member@example.com"
                required
                className={inputClass}
              />
            </Field>
            <Field label="Add to team">
              <select
                multiple
                value={memberTeamIds}
                onChange={(e) =>
                  setMemberTeamIds(Array.from(e.target.selectedOptions, (o) => o.value))
                }
                className={`${inputClass} min-h-[80px]`}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Hold Cmd/Ctrl to select multiple teams</p>
            </Field>
            <Field label="Access level">
              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value as MemberRole)}
                className={inputClass}
              >
                <option value="creator">Creator</option>
                <option value="viewer">Viewer</option>
              </select>
            </Field>
            <ModalActions onCancel={() => setShowAddMember(false)} submitLabel="Send Invite" />
          </form>
        </Modal>
      )}

      {showAddTeam && isOwner && (
        <Modal title="New Team" onClose={() => setShowAddTeam(false)}>
          <form onSubmit={handleAddTeam} className="space-y-4">
            <Field label="Team name">
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Marketing"
                required
                className={inputClass}
              />
            </Field>
            <ModalActions onCancel={() => setShowAddTeam(false)} submitLabel="Create Team" />
          </form>
        </Modal>
      )}

      {showTableAccess && isOwner && (
        <Modal
          title={`Table access — ${showTableAccess.name}`}
          onClose={() => setShowTableAccess(null)}
        >
          <p className="text-xs text-gray-500 mb-4">
            Select which tables this member can access. Only the workspace owner can assign table access.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {allTables.length === 0 ? (
              <p className="text-sm text-gray-500">No tables in this workspace yet.</p>
            ) : (
              allTables.map((table) => (
                <label
                  key={table.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-app-surface-active cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={showTableAccess.tableAccess.includes(table.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...showTableAccess.tableAccess, table.id]
                        : showTableAccess.tableAccess.filter((id) => id !== table.id)
                      setShowTableAccess({ ...showTableAccess, tableAccess: next })
                    }}
                    className="rounded border-gray-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{table.name}</p>
                    <p className="text-xs text-gray-500">{table.baseName} · {table.id.slice(0, 8)}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowTableAccess(null)}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-app-surface-active"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveTableAccess(showTableAccess.tableAccess)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-500 hover:bg-brand-600"
            >
              Save access
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

const inputClass =
  'w-full px-3 py-2.5 rounded-lg bg-app-input border border-app-border text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-md rounded-xl border border-app-border bg-app-surface shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function ModalActions({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-app-surface-active">
        Cancel
      </button>
      <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-500 hover:bg-brand-600">
        {submitLabel}
      </button>
    </div>
  )
}
