import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Trash2, Users } from 'lucide-react'
import TableTeamsModal from '../components/TableTeamsModal'
import TableIcon from '../components/TableIcon'
import TableIconPicker from '../components/TableIconPicker'
import { normalizeTableIcon, suggestTableIconFromName } from '../lib/tableIcons'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import WorkspaceHeader, { type WorkspaceTab } from '../components/WorkspaceHeader'
import DataActions from '../components/DataActions'
import MembersTeamsPanel from '../components/MembersTeamsPanel'
import WorkspaceSettingsPanel from '../components/WorkspaceSettingsPanel'
import EditableName from '../components/EditableName'
import NameModal from '../components/NameModal'
import ImportDataModal from '../components/ImportDataModal'
import {
  getUserWorkspaces,
  getWorkspaceBases,
  createBase,
  upsertBase,
  upsertBaseAsync,
  deleteBase,
  repairWorkspaceForUser,
} from '../lib/storage'
import {
  assignBaseTeams,
  filterBasesForMember,
  getAccessibleTables,
  getMemberForUser,
  getWorkspaceTeams,
  hasFullWorkspaceAccess,
  isWorkspaceAccountOwner,
} from '../lib/members'
import { sheetsToTables } from '../lib/importSpreadsheet'
import { canCreateBase } from '../lib/planLimits'
import { createId } from '../lib/id'
import { baseUrl } from '../lib/lastTable'
import type { Base, Workspace } from '../types'
import type { ParsedSheet } from '../lib/importSpreadsheet'

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { user } = useAuth()
  const { cacheVersion, ready } = useData()
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [bases, setBases] = useState<Base[]>([])
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('bases')
  const [showCreateBase, setShowCreateBase] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [newBaseName, setNewBaseName] = useState('')
  const [showNewBaseIconPicker, setShowNewBaseIconPicker] = useState(false)
  const [iconPickerBaseId, setIconPickerBaseId] = useState<string | null>(null)
  const [showBaseTeamsId, setShowBaseTeamsId] = useState<string | null>(null)
  const [baseTeamIds, setBaseTeamIds] = useState<string[]>([])

  const member = workspace && user
    ? getMemberForUser(workspace.id, user.userId, user.email)
    : undefined
  const hasFullAccess = workspace && user
    ? hasFullWorkspaceAccess(workspace, user.userId, user.email, workspace.id)
    : false
  const isAccountOwner = workspace && user
    ? isWorkspaceAccountOwner(workspace, user.userId)
    : false
  const canRemoveMembers = hasFullAccess
  const visibleBases = workspace && user
    ? filterBasesForMember(bases, workspace, workspace.id, user.userId, user.email, member)
    : bases
  const iconPickerBase = iconPickerBaseId
    ? visibleBases.find((base) => base.id === iconPickerBaseId)
    : undefined
  const baseTeamsTarget = showBaseTeamsId
    ? bases.find((base) => base.id === showBaseTeamsId)
    : undefined
  const workspaceTeams = workspaceId ? getWorkspaceTeams(workspaceId) : []

  useEffect(() => {
    if (!user || !workspaceId || !ready) return
    const found = getUserWorkspaces(user.userId, user.email).find((w) => w.id === workspaceId)
    if (!found) {
      navigate('/app')
      return
    }
    const member = getMemberForUser(workspaceId, user.userId, user.email)
    if (member?.status === 'blocked') {
      navigate('/app')
      return
    }
    const repaired = repairWorkspaceForUser(found, { id: user.userId, email: user.email, name: user.name })
    setWorkspace(repaired)
  }, [user, workspaceId, navigate, ready])

  useEffect(() => {
    if (!workspaceId) return
    setBases(getWorkspaceBases(workspaceId))
  }, [workspaceId, cacheVersion])

  function refreshBases() {
    if (workspaceId) setBases(getWorkspaceBases(workspaceId))
  }

  function handleCreateBase() {
    if (!hasFullAccess || !workspaceId || !user) return
    const check = canCreateBase(workspaceId, user.plan)
    if (!check.ok) {
      alert(check.error)
      return
    }
    setShowCreateBase(true)
  }

  function handleConfirmCreateBase(name: string) {
    if (!user || !workspaceId || !hasFullAccess) return
    const check = canCreateBase(workspaceId, user.plan)
    if (!check.ok) {
      alert(check.error)
      return
    }
    setNewBaseName(name)
    setShowCreateBase(false)
    setShowNewBaseIconPicker(true)
  }

  async function handleCreateBaseWithIcon(icon: string | null) {
    if (!user || !workspaceId || !hasFullAccess || !newBaseName.trim()) return
    const base = createBase(workspaceId, user.userId, newBaseName.trim())
    const withIcon = {
      ...base,
      icon: normalizeTableIcon(icon ?? suggestTableIconFromName(newBaseName)) ?? null,
    }
    await upsertBaseAsync(withIcon)
    refreshBases()
    setNewBaseName('')
    setShowNewBaseIconPicker(false)
    navigate(baseUrl(workspaceId, withIcon.id))
  }

  function handleUpdateBaseIcon(baseId: string, icon: string | null) {
    if (!hasFullAccess) return
    const base = bases.find((item) => item.id === baseId)
    if (!base) return
    upsertBase({ ...base, icon: normalizeTableIcon(icon) ?? null })
    refreshBases()
  }

  function handleRenameBase(baseId: string, name: string) {
    if (!hasFullAccess) return
    const base = bases.find((b) => b.id === baseId)
    if (!base) return
    upsertBase({ ...base, name })
    refreshBases()
  }

  function handleDeleteBase(e: React.MouseEvent, baseId: string) {
    e.stopPropagation()
    if (!hasFullAccess) return
    if (!confirm('Delete this database and all its data?')) return
    deleteBase(baseId)
    refreshBases()
  }

  async function handleImport(sheets: ParsedSheet[], baseName?: string) {
    if (!user || !workspaceId || !baseName || !hasFullAccess) return
    const check = canCreateBase(workspaceId, user.plan)
    if (!check.ok) {
      alert(check.error)
      return
    }
    const base: Base = {
      id: createId(),
      workspaceId,
      userId: user.userId,
      name: baseName,
      icon: normalizeTableIcon(suggestTableIconFromName(baseName)) ?? null,
      tables: sheetsToTables(sheets),
      createdAt: new Date().toISOString(),
    }
    await upsertBaseAsync(base)
    refreshBases()
    navigate(baseUrl(workspaceId, base.id))
  }

  function handleAction(actionId: string) {
    if (!hasFullAccess) return
    if (actionId === 'create-base') handleCreateBase()
    if (actionId === 'import') setShowImport(true)
  }

  if (!workspace || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-app-muted">Loading workspace…</p>
      </div>
    )
  }

  return (
    <>
      <WorkspaceHeader
        workspaceName={workspace.name}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        planId={user.plan}
      />

      <main className="flex-1 overflow-y-auto p-8">
        {activeTab === 'bases' && (
          <div className="max-w-3xl">
            {hasFullAccess ? (
              <DataActions onAction={handleAction} />
            ) : (
              <p className="text-sm text-app-faint mb-6">
                Open a database below to view or edit data based on your role.
              </p>
            )}

            {visibleBases.length > 0 && (
              <div className={hasFullAccess ? 'mt-12' : ''}>
                <h2 className="text-sm font-semibold text-app-faint uppercase tracking-wider mb-4">
                  Your Databases
                </h2>
                <div className="space-y-2">
                  {visibleBases.map((base) => {
                    const accessibleTableCount = getAccessibleTables(
                      member,
                      base.tables,
                      hasFullAccess,
                    ).length
                    return (
                    <div
                      key={base.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(baseUrl(workspaceId!, base.id))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') navigate(baseUrl(workspaceId!, base.id))
                      }}
                      className="group flex items-center gap-4 px-4 py-3 rounded-xl border border-app-border bg-app-surface hover:border-app-border-strong hover:bg-app-surface-hover cursor-pointer transition-all"
                    >
                      <div
                        className="w-9 h-9 rounded-lg bg-app-surface-active flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {hasFullAccess ? (
                          <button
                            type="button"
                            onClick={() => setIconPickerBaseId(base.id)}
                            className="w-full h-full flex items-center justify-center rounded-lg hover:bg-app-surface-hover transition-colors"
                            title="Change database logo"
                            aria-label={`Change logo for ${base.name}`}
                          >
                            <TableIcon icon={base.icon} size="md" />
                          </button>
                        ) : (
                          <TableIcon icon={base.icon} size="md" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                        {hasFullAccess ? (
                          <EditableName
                            value={base.name}
                            onChange={(name) => handleRenameBase(base.id, name)}
                            placeholder="Base name"
                            className="text-sm font-medium text-app-text"
                            inputClassName="text-sm"
                          />
                        ) : (
                          <p className="text-sm font-medium text-app-text">{base.name}</p>
                        )}
                        <p className="text-xs text-app-faint mt-0.5">
                          {accessibleTableCount} table{accessibleTableCount !== 1 ? 's' : ''} · {base.id.slice(0, 8)}
                        </p>
                      </div>
                      {hasFullAccess && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setBaseTeamIds(base.teamIds ?? [])
                              setShowBaseTeamsId(base.id)
                            }}
                            className="p-1.5 text-app-faint hover:text-brand-400"
                            aria-label="Database team access"
                            title="Team access"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteBase(e, base.id)}
                            className="p-1.5 text-app-faint hover:text-red-400"
                            aria-label="Delete base"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              </div>
            )}

            {bases.length > 0 && visibleBases.length === 0 && (
              <p className="text-sm text-app-faint mt-6">
                You don&apos;t have access to any databases in this workspace yet.
              </p>
            )}
          </div>
        )}

        {activeTab === 'members-teams' && (
          <MembersTeamsPanel
            workspace={workspace}
            bases={bases}
            canManageMembers={hasFullAccess}
            canRemoveMembers={canRemoveMembers}
            canInvite={hasFullAccess}
            canManageTeams={hasFullAccess}
            onRefresh={refreshBases}
          />
        )}

        {activeTab === 'settings' && (
          <WorkspaceSettingsPanel
            workspace={workspace}
            bases={bases}
            hasFullAccess={hasFullAccess}
            isAccountOwner={isAccountOwner}
            onUpdate={setWorkspace}
          />
        )}

      </main>

      <NameModal
        open={showCreateBase}
        title="Create New Base"
        label="Base name"
        placeholder="e.g. Sales CRM"
        defaultValue={`Base ${bases.length + 1}`}
        onConfirm={handleConfirmCreateBase}
        onClose={() => setShowCreateBase(false)}
      />

      <ImportDataModal
        open={showImport}
        onImport={handleImport}
        onClose={() => setShowImport(false)}
      />

      <TableIconPicker
        open={showNewBaseIconPicker}
        title="Database logo"
        tableName={newBaseName}
        value={suggestTableIconFromName(newBaseName)}
        onSave={handleCreateBaseWithIcon}
        onClose={() => {
          setShowNewBaseIconPicker(false)
          setNewBaseName('')
        }}
      />

      {iconPickerBase && (
        <TableIconPicker
          open
          title="Database logo"
          tableName={iconPickerBase.name}
          value={iconPickerBase.icon}
          onSave={(icon) => {
            handleUpdateBaseIcon(iconPickerBase.id, icon)
            setIconPickerBaseId(null)
          }}
          onClose={() => setIconPickerBaseId(null)}
        />
      )}

      {baseTeamsTarget && workspace && workspaceId && (
        <TableTeamsModal
          tableName={baseTeamsTarget.name}
          title={`Database team access — ${baseTeamsTarget.name}`}
          description="Restrict this entire database to specific teams. Members not in any selected team will not see this database or its tables. Leave empty to allow all workspace members (table-level rules still apply). Admins always have access."
          teams={workspaceTeams}
          selectedTeamIds={baseTeamIds}
          onChange={setBaseTeamIds}
          onClose={() => setShowBaseTeamsId(null)}
          onSave={() => {
            if (!user) return
            const result = assignBaseTeams(
              workspace,
              workspaceId,
              baseTeamsTarget.id,
              baseTeamIds,
              { userId: user.userId, email: user.email },
            )
            if (!result.ok) {
              alert(result.error ?? 'Failed to save team access')
              return
            }
            refreshBases()
            setShowBaseTeamsId(null)
          }}
        />
      )}
    </>
  )
}
