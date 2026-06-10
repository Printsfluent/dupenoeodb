import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Table2, Trash2 } from 'lucide-react'
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
  canRemoveWorkspaceMembers,
  getMemberForUser,
  hasFullWorkspaceAccess,
  isWorkspaceAccountOwner,
} from '../lib/members'
import { sheetsToTables } from '../lib/importSpreadsheet'
import { canCreateBase } from '../lib/planLimits'
import { createId } from '../lib/id'
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

  const hasFullAccess = workspace && user
    ? hasFullWorkspaceAccess(workspace, user.userId, user.email, workspace.id)
    : false
  const isAccountOwner = workspace && user
    ? isWorkspaceAccountOwner(workspace, user.userId)
    : false
  const canRemoveMembers = workspace && user
    ? canRemoveWorkspaceMembers(workspace, user.userId, user.email, workspace.id)
    : false

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

  async function handleConfirmCreateBase(name: string) {
    if (!user || !workspaceId || !hasFullAccess) return
    const check = canCreateBase(workspaceId, user.plan)
    if (!check.ok) {
      alert(check.error)
      return
    }
    const base = createBase(workspaceId, user.userId, name)
    await upsertBaseAsync(base)
    refreshBases()
    setShowCreateBase(false)
    navigate(`/app/w/${workspaceId}/bases/${base.id}`)
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
      tables: sheetsToTables(sheets),
      createdAt: new Date().toISOString(),
    }
    await upsertBaseAsync(base)
    refreshBases()
    navigate(`/app/w/${workspaceId}/bases/${base.id}`)
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

            {bases.length > 0 && (
              <div className={hasFullAccess ? 'mt-12' : ''}>
                <h2 className="text-sm font-semibold text-app-faint uppercase tracking-wider mb-4">
                  Your Databases
                </h2>
                <div className="space-y-2">
                  {bases.map((base) => (
                    <div
                      key={base.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/app/w/${workspaceId}/bases/${base.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') navigate(`/app/w/${workspaceId}/bases/${base.id}`)
                      }}
                      className="group flex items-center gap-4 px-4 py-3 rounded-xl border border-app-border bg-app-surface hover:border-app-border-strong hover:bg-app-surface-hover cursor-pointer transition-all"
                    >
                      <div className="w-9 h-9 rounded-lg bg-app-surface-active flex items-center justify-center text-brand-400">
                        <Table2 className="w-4 h-4" />
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
                          {base.tables.length} table{base.tables.length !== 1 ? 's' : ''} · {base.id.slice(0, 8)}
                        </p>
                      </div>
                      {hasFullAccess && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteBase(e, base.id)}
                          className="p-1.5 text-app-faint hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          aria-label="Delete base"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
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
    </>
  )
}
