import { useState, useEffect } from 'react'
import {
  Search, UserPlus, Plus, MoreVertical, X, Shield, Table2, Users,
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
  sendWorkspaceInviteToUser,
  blockMember,
  cancelWorkspaceInviteAsync,
  createTeam,
  getWorkspaceMembers,
  getWorkspaceTeams,
  isWorkspaceCreatorMember,
  removeMember,
  assignMemberTeams,
  setMemberRole as updateMemberRole,
  setMemberTableAccess,
  unblockMember,
} from '../lib/members'
import { ROLE_DESCRIPTIONS, roleLabel } from '../lib/roles'
import { searchSheetFlowUsers } from '../lib/userSearch'
import { useToast } from '../context/ToastContext'
import type { User } from '../types'

interface MembersTeamsPanelProps {
  workspace: Workspace
  bases: Base[]
  canManageMembers: boolean
  canRemoveMembers: boolean
  canInvite: boolean
  canManageTeams: boolean
  onRefresh: () => void
}

const roleColors: Record<MemberRole, string> = {
  owner: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800',
  admin: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
  creator: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
  editor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
  viewer: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-app-muted dark:border-gray-700',
  no_access: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
}

export default function MembersTeamsPanel({
  workspace,
  bases,
  canManageMembers,
  canRemoveMembers,
  canInvite,
  canManageTeams,
  onRefresh,
}: MembersTeamsPanelProps) {
  const { user, refreshProfile } = useAuth()
  const { cacheVersion } = useData()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<WorkspaceMember[]>(() => getWorkspaceMembers(workspace.id))
  const [teams, setTeams] = useState<Team[]>(() => getWorkspaceTeams(workspace.id))
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [showTableAccess, setShowTableAccess] = useState<WorkspaceMember | null>(null)
  const [showTeamAssign, setShowTeamAssign] = useState<WorkspaceMember | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null)

  const [userQuery, setUserQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [memberTeamIds, setMemberTeamIds] = useState<string[]>([])
  const [memberRole, setMemberRole] = useState<MemberRole>('viewer')
  const [teamName, setTeamName] = useState('')
  const [addError, setAddError] = useState('')

  const allTables = bases.flatMap((b) => b.tables.map((t) => ({ ...t, baseName: b.name })))

  function memberActor() {
    if (!user) return undefined
    return {
      workspace,
      userId: user.userId,
      email: user.email,
      workspaceId: workspace.id,
    }
  }

  function refresh() {
    setMembers(getWorkspaceMembers(workspace.id))
    setTeams(getWorkspaceTeams(workspace.id))
    onRefresh()
  }

  async function handleCancelInvite(memberId: string) {
    const actor = memberActor()
    if (!actor) return
    setCancelingInviteId(memberId)
    const result = await cancelWorkspaceInviteAsync(memberId, actor)
    setCancelingInviteId(null)
    if (result.ok) {
      refresh()
    } else if (result.error) {
      toast.error(result.error)
    }
  }

  const memberUserIds = new Set(
    members.filter((m) => m.userId && m.status !== 'left').map((m) => m.userId as string),
  )
  const userSuggestions = searchSheetFlowUsers(userQuery, {
    excludeUserIds: user ? [user.userId, ...memberUserIds] : [...memberUserIds],
  })

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
    if (!selectedUser) {
      setAddError('Select a user to invite')
      return
    }
    const result = sendWorkspaceInviteToUser(
      workspace.id,
      selectedUser.id,
      memberTeamIds,
      memberRole,
      { id: user.userId, name: user.name, email: user.email },
    )
    if (!result.ok) {
      setAddError(result.error ?? 'Failed to send invite')
      return
    }
    setUserQuery('')
    setSelectedUser(null)
    setMemberTeamIds([])
    setMemberRole('viewer')
    setShowAddMember(false)
    toast.success(`Invite sent to ${selectedUser.name}`)
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
    if (!canManageMembers || isWorkspaceCreatorMember(workspace, member)) return
    if (!user) return
    updateMemberRole(member.id, role, { id: user.userId, name: user.name })
    refresh()
  }

  function handleSaveTableAccess(tableIds: string[]) {
    if (!showTableAccess || !canManageMembers) return
    setMemberTableAccess(showTableAccess.id, tableIds)
    setShowTableAccess(null)
    refresh()
  }

  function handleSaveTeamAssign(teamIds: string[]) {
    if (!showTeamAssign || !user || (!canManageMembers && !canManageTeams)) return
    const result = assignMemberTeams(
      workspace,
      workspace.id,
      showTeamAssign.id,
      teamIds,
      { userId: user.userId, email: user.email },
    )
    if (!result.ok) {
      toast.error(result.error ?? 'Failed to assign teams')
      return
    }
    setShowTeamAssign(null)
    toast.success('Teams updated')
    refresh()
  }

  function handlePlanChange(member: WorkspaceMember, plan: PlanId) {
    if (!canManageMembers) return
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members or teams"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-app-surface border border-app-border text-sm text-app-muted placeholder:text-app-faint focus:outline-none focus:border-app-border-strong"
          />
        </div>
        {(canInvite || canManageTeams) && (
          <div className="flex gap-2">
            {canManageTeams && (
              <button
                type="button"
                onClick={() => setShowAddTeam(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-brand-500/50 text-brand-400 text-sm font-medium hover:bg-brand-500/10"
              >
                <Plus className="w-4 h-4" />
                New Team
              </button>
            )}
            {canInvite && (
              <button
                type="button"
                onClick={() => setShowAddMember(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
              >
                <UserPlus className="w-4 h-4" />
                Send Invite
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold tracking-widest text-app-faint uppercase px-1">Teams</p>
          <button
            type="button"
            onClick={() => setSelectedTeamId(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              !selectedTeamId ? 'bg-app-surface-active text-app-text' : 'text-app-faint hover:bg-app-surface-hover'
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
                selectedTeamId === team.id ? 'bg-app-surface-active text-app-text' : 'text-app-faint hover:bg-app-surface-hover'
              }`}
            >
              <div
                className="w-6 h-6 rounded text-xs font-bold flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: team.color }}
              >
                {getInitials(team.name)}
              </div>
              <span className="truncate flex-1">{team.name}</span>
              <span className="text-xs text-app-faint">{team.memberIds.length}</span>
            </button>
          ))}
          {teams.length === 0 && (
            <p className="text-xs text-app-faint px-3 py-2">No teams yet</p>
          )}
        </div>

        <div className="rounded-xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface border-b border-app-border text-left text-xs text-app-faint uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Teams</th>
                <th className="px-4 py-3 font-medium">Access</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Tables</th>
                {(canRemoveMembers || canInvite) && <th className="px-4 py-3 font-medium w-10" />}
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
                          <span className="font-medium text-app-text">{member.name}</span>
                          {isWorkspaceCreatorMember(workspace, member) && (
                            <span title="Workspace admin (creator)">
                              <Shield className="w-3 h-3 text-purple-400" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-app-faint">{member.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {member.status === 'left' ? (
                      <span className="text-xs text-app-faint">—</span>
                    ) : canManageMembers || canManageTeams ? (
                      <button
                        type="button"
                        onClick={() => setShowTeamAssign(member)}
                        className="text-left w-full group/teams"
                      >
                        {member.teamIds.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-brand-400 group-hover/teams:text-brand-300">
                            <Users className="w-3.5 h-3.5" />
                            Assign teams
                          </span>
                        ) : (
                          <span className="inline-flex flex-wrap items-center gap-1">
                            {member.teamIds.map((tid) => {
                              const team = teams.find((t) => t.id === tid)
                              return team ? (
                                <span
                                  key={tid}
                                  className="px-2 py-0.5 rounded text-xs bg-app-surface-active text-app-faint group-hover/teams:bg-app-surface-hover"
                                >
                                  {team.name}
                                </span>
                              ) : null
                            })}
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {member.teamIds.length === 0 ? (
                          <span className="text-xs text-app-faint">—</span>
                        ) : (
                          member.teamIds.map((tid) => {
                            const team = teams.find((t) => t.id === tid)
                            return team ? (
                              <span key={tid} className="px-2 py-0.5 rounded text-xs bg-app-surface-active text-app-faint">
                                {team.name}
                              </span>
                            ) : null
                          })
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {member.status === 'pending' ? (
                      <span className="inline-flex px-2 py-1 rounded-lg text-xs font-medium border bg-amber-900/30 text-amber-300 border-amber-800">
                        Invite pending
                      </span>
                    ) : canManageMembers && !isWorkspaceCreatorMember(workspace, member) ? (
                      <select
                        value={
                          member.status === 'blocked'
                            ? 'no_access'
                            : member.role === 'creator' || member.role === 'owner'
                              ? 'admin'
                              : member.role
                        }
                        onChange={(e) => handleRoleChange(member, e.target.value as MemberRole)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium border bg-transparent cursor-pointer ${roleColors[member.status === 'blocked' ? 'no_access' : member.role]}`}
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                        <option value="no_access">No Access</option>
                      </select>
                    ) : (
                      <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium border ${roleColors[member.role]}`}>
                        {roleLabel(member.role)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManageMembers ? (
                      <select
                        value={getMemberPlan(member)}
                        onChange={(e) => handlePlanChange(member, e.target.value as PlanId)}
                        className="px-2 py-1 rounded-lg text-xs font-medium border border-app-border-strong bg-app-input text-app-muted cursor-pointer"
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
                    {isWorkspaceCreatorMember(workspace, member) ? (
                      <span className="text-xs text-app-faint">All tables</span>
                    ) : member.status === 'pending' ? (
                      <span className="text-xs text-app-faint">Awaiting acceptance</span>
                    ) : canManageMembers ? (
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
                      <span className="text-xs text-app-faint">
                        {member.tableAccess.length} table{member.tableAccess.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </td>
                  {(canRemoveMembers || canInvite) && (
                    <td className="px-4 py-3 relative">
                      {member.status === 'pending' && canInvite ? (
                        <button
                          type="button"
                          disabled={cancelingInviteId === member.id}
                          onClick={() => handleCancelInvite(member.id)}
                          className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          {cancelingInviteId === member.id ? 'Canceling…' : 'Cancel invite'}
                        </button>
                      ) : canRemoveMembers && !isWorkspaceCreatorMember(workspace, member) ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                            className="p-1 text-app-faint hover:text-app-muted"
                            aria-label="Member actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {menuOpen === member.id && (
                            <div className="absolute right-4 top-full z-20 mt-1 py-1 rounded-lg bg-app-surface-active border border-app-border-strong shadow-xl min-w-[140px]">
                              {member.status === 'blocked' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    unblockMember(member.id, memberActor())
                                    setMenuOpen(null)
                                    refresh()
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-app-muted hover:bg-app-surface-hover"
                                >
                                  Unblock access
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    blockMember(member.id, memberActor())
                                    setMenuOpen(null)
                                    refresh()
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-app-surface-hover"
                                >
                                  Block access
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  removeMember(member.id, memberActor())
                                  setMenuOpen(null)
                                  refresh()
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-app-surface-hover"
                              >
                                Remove member
                              </button>
                            </div>
                          )}
                        </>
                      ) : null}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMembers.length === 0 && (
            <p className="text-center text-sm text-app-faint py-12">No members found</p>
          )}
        </div>
      </div>

      {showAddMember && canInvite && (
        <Modal title="Send Workspace Invite" onClose={() => setShowAddMember(false)}>
          <form onSubmit={handleAddMember} className="space-y-4">
            <p className="text-xs text-app-faint leading-relaxed">
              They&apos;ll receive an in-app notification to accept the invite. No email is sent.
              Invites are sent in-app. Choose a role for the user you select below.
            </p>
            {addError && <p className="text-sm text-red-400">{addError}</p>}
            <Field label="Find user">
              {selectedUser ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-app-border bg-app-surface-active">
                  <div>
                    <p className="text-sm font-medium text-app-text">{selectedUser.name}</p>
                    <p className="text-xs text-app-faint">{selectedUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(null)
                      setUserQuery('')
                    }}
                    className="text-xs text-app-faint hover:text-app-muted"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="search"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Search by name or email…"
                    className={inputClass}
                    autoComplete="off"
                  />
                  {userQuery.trim() && (
                    <ul className="absolute z-10 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-app-border bg-app-surface shadow-lg">
                      {userSuggestions.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-app-faint">No users found</li>
                      ) : (
                        userSuggestions.map((candidate) => (
                          <li key={candidate.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUser(candidate)
                                setUserQuery('')
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-app-surface-hover"
                            >
                              <p className="text-sm text-app-text">{candidate.name}</p>
                              <p className="text-xs text-app-faint">{candidate.email}</p>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              )}
            </Field>
            <Field label="Add to team (optional)">
              {teams.length === 0 ? (
                <p className="text-xs text-app-faint py-2">No teams yet — create one first or skip this step.</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto rounded-lg border border-app-border p-2">
                  {teams.map((team) => (
                    <label
                      key={team.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-app-surface-active cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={memberTeamIds.includes(team.id)}
                        onChange={(e) => {
                          setMemberTeamIds((prev) =>
                            e.target.checked
                              ? [...prev, team.id]
                              : prev.filter((id) => id !== team.id),
                          )
                        }}
                        className="rounded border-gray-600"
                      />
                      <span
                        className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: team.color }}
                      >
                        {getInitials(team.name)}
                      </span>
                      <span className="text-sm text-app-muted">{team.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Access level">
              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value as MemberRole)}
                className={inputClass}
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              {memberRole === 'admin' || memberRole === 'editor' || memberRole === 'viewer' ? (
                <p className="text-xs text-app-faint mt-1.5">{ROLE_DESCRIPTIONS[memberRole]}</p>
              ) : null}
            </Field>
            <ModalActions onCancel={() => setShowAddMember(false)} submitLabel="Send Invite" />
          </form>
        </Modal>
      )}

      {showAddTeam && canManageTeams && (
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

      {showTeamAssign && (canManageMembers || canManageTeams) && (
        <Modal
          title={`Teams — ${showTeamAssign.name}`}
          onClose={() => setShowTeamAssign(null)}
        >
          <p className="text-xs text-app-faint mb-4">
            Assign this member to one or more teams. Changes apply immediately for active members.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {teams.length === 0 ? (
              <p className="text-sm text-app-faint">No teams yet. Create a team first.</p>
            ) : (
              teams.map((team) => (
                <label
                  key={team.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-app-surface-active cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={showTeamAssign.teamIds.includes(team.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...showTeamAssign.teamIds, team.id]
                        : showTeamAssign.teamIds.filter((id) => id !== team.id)
                      setShowTeamAssign({ ...showTeamAssign, teamIds: next })
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
              onClick={() => setShowTeamAssign(null)}
              className="px-4 py-2 rounded-lg text-sm text-app-faint hover:bg-app-surface-active"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveTeamAssign(showTeamAssign.teamIds)}
              disabled={teams.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-40"
            >
              Save teams
            </button>
          </div>
        </Modal>
      )}

      {showTableAccess && canManageMembers && (
        <Modal
          title={`Table access — ${showTableAccess.name}`}
          onClose={() => setShowTableAccess(null)}
        >
          <p className="text-xs text-app-faint mb-4">
            Optionally restrict this member to specific tables. For team-wide access, use Team
            access on each table in the database view.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {allTables.length === 0 ? (
              <p className="text-sm text-app-faint">No tables in this workspace yet.</p>
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
                    <p className="text-sm text-app-text truncate">{table.name}</p>
                    <p className="text-xs text-app-faint">{table.baseName} · {table.id.slice(0, 8)}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowTableAccess(null)}
              className="px-4 py-2 rounded-lg text-sm text-app-faint hover:bg-app-surface-active"
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

const inputClass = 'app-input-field px-3 py-2.5'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-md rounded-xl border border-app-border bg-app-surface shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h3 className="text-sm font-semibold text-app-text">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 text-app-faint hover:text-app-muted">
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
      <label className="block text-xs font-medium text-app-faint mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function ModalActions({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 app-btn-ghost">
        Cancel
      </button>
      <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-500 hover:bg-brand-600">
        {submitLabel}
      </button>
    </div>
  )
}
