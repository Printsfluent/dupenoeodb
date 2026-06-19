import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { ArrowLeft, Plus, Upload, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import SpreadsheetGrid from '../components/SpreadsheetGrid'
import EditableName from '../components/EditableName'
import NameModal from '../components/NameModal'
import ImportDataModal from '../components/ImportDataModal'
import TableTeamsModal from '../components/TableTeamsModal'
import TableIcon from '../components/TableIcon'
import TableIconPicker from '../components/TableIconPicker'
import { normalizeTableIcon, suggestTableIconFromName } from '../lib/tableIcons'
import { createBlankTable, getWorkspaceBases, getWorkspaces, upsertBase } from '../lib/storage'
import {
  assignBaseTeams,
  assignTableTeams,
  canEditInWorkspace,
  canModifyTableSchemaInWorkspace,
  getAccessibleTables,
  getMemberForUser,
  getWorkspaceTeams,
  memberCanAccessBase,
  migrateWorkspaceMemberRoles,
} from '../lib/members'
import { isTableStructureChange } from '../lib/tableSchema'
import { useToast } from '../context/ToastContext'
import { repairWorkspaceForUser } from '../lib/storage'
import { getCache, setBases } from '../lib/dataStore'
import { isFirebaseConfigured, getFirestoreDb } from '../lib/firebase'
import { COL, ensureBaseInCache } from '../lib/firestoreSync'
import { isBaseNewer, stampBase } from '../lib/baseUpdated'
import { resolveBaseConflict } from '../lib/baseMerge'
import { rememberLastTable } from '../lib/lastTable'
import { normalizeBase } from '../lib/tableSchema'
import { sheetsToTables } from '../lib/importSpreadsheet'
import { canAddRows, canAddTables } from '../lib/planLimits'
import type { Base, Table } from '../types'
import type { ParsedSheet } from '../lib/importSpreadsheet'

export default function BasePage() {
  const { workspaceId, baseId } = useParams<{ workspaceId: string; baseId: string }>()
  const { user } = useAuth()
  const { ready, cacheVersion } = useData()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const tableParam = searchParams.get('table')
  const leavingRef = useRef(false)
  const seededTableUrlRef = useRef(false)
  const [base, setBase] = useState<Base | null>(null)
  const [showNewTable, setShowNewTable] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showTableTeams, setShowTableTeams] = useState(false)
  const [showBaseTeams, setShowBaseTeams] = useState(false)
  const [tableTeamIds, setTableTeamIds] = useState<string[]>([])
  const [baseTeamIds, setBaseTeamIds] = useState<string[]>([])
  const [iconPickerTableId, setIconPickerTableId] = useState<string | null>(null)
  const [newTableName, setNewTableName] = useState('')
  const [showNewTableIconPicker, setShowNewTableIconPicker] = useState(false)
  const [showBaseIconPicker, setShowBaseIconPicker] = useState(false)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const toast = useToast()

  const rawWorkspace = getWorkspaces().find((w) => w.id === workspaceId)
  const workspace = useMemo(() => {
    if (!rawWorkspace || !user || !ready) return rawWorkspace
    return repairWorkspaceForUser(rawWorkspace, {
      id: user.userId,
      email: user.email,
      name: user.name,
    })
  }, [rawWorkspace, user, ready])

  const canManageSchema =
    workspace && user
      ? canModifyTableSchemaInWorkspace(workspace, user.userId, user.email, workspace.id)
      : false
  const hasFullAccess = canManageSchema
  const canEdit =
    workspace && user
      ? canEditInWorkspace(workspace, user.userId, user.email, workspace.id)
      : false
  const member = workspace && user
    ? getMemberForUser(workspace.id, user.userId, user.email)
    : undefined

  useEffect(() => {
    if (!workspaceId) return
    migrateWorkspaceMemberRoles(workspaceId)
  }, [workspaceId, cacheVersion])

  const goBackToWorkspace = useCallback(() => {
    leavingRef.current = true
    const targetId = workspaceId ?? base?.workspaceId
    if (targetId) {
      navigate(`/app/w/${targetId}`, { replace: true })
      return
    }
    navigate('/app', { replace: true })
  }, [navigate, workspaceId, base?.workspaceId])

  const selectActiveTable = useCallback((tableId: string | null) => {
    setSelectedTableId(tableId)
    const next = new URLSearchParams(searchParams)
    if (tableId) next.set('table', tableId)
    else next.delete('table')
    const search = next.toString()
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '' },
      { replace: true },
    )
  }, [navigate, location.pathname, searchParams])

  const visibleTables = useMemo(() => {
    if (!base) return []
    return getAccessibleTables(member, base.tables, hasFullAccess)
  }, [base, member, hasFullAccess, cacheVersion])

  const activeTableId = useMemo(() => {
    if (selectedTableId && visibleTables.some((table) => table.id === selectedTableId)) {
      return selectedTableId
    }
    if (tableParam && visibleTables.some((table) => table.id === tableParam)) return tableParam
    return visibleTables[0]?.id ?? null
  }, [selectedTableId, tableParam, visibleTables])

  useEffect(() => {
    setSelectedTableId(null)
    seededTableUrlRef.current = false
  }, [baseId])

  useEffect(() => {
    if (tableParam && visibleTables.some((table) => table.id === tableParam)) {
      setSelectedTableId(tableParam)
    }
  }, [tableParam, visibleTables])

  useEffect(() => {
    if (!base || tableParam || seededTableUrlRef.current) return
    const fallback = visibleTables[0]?.id
    if (!fallback) return
    seededTableUrlRef.current = true
    selectActiveTable(fallback)
  }, [base, tableParam, visibleTables, selectActiveTable])

  useEffect(() => {
    if (!baseId || !activeTableId) return
    rememberLastTable(baseId, activeTableId)
  }, [baseId, activeTableId])

  useEffect(() => {
    if (!baseId || !isFirebaseConfigured() || !user || !ready) return

    void ensureBaseInCache(baseId)

    const firestore = getFirestoreDb()
    return onSnapshot(
      doc(firestore, COL.bases, baseId),
      (snapshot) => {
        if (!snapshot.exists() || snapshot.metadata.hasPendingWrites) return
        const remote = normalizeBase({ id: snapshot.id, ...snapshot.data() } as Base)
        const cached = getCache().bases.find((item) => item.id === baseId)
        if (!cached) {
          setBases([remote])
          return
        }
        if (isBaseNewer(cached, remote)) return
        const next = isBaseNewer(remote, cached) ? remote : resolveBaseConflict(cached, remote)
        setBases([next])
      },
      (error) => console.warn('Firestore base listener:', error),
    )
  }, [baseId, user, ready])

  useEffect(() => {
    if (leavingRef.current) return
    if (!location.pathname.includes('/bases/')) return
    if (!user || !baseId || !ready) return

    const found =
      (workspaceId ? getWorkspaceBases(workspaceId).find((b) => b.id === baseId) : undefined)
      ?? getWorkspaces()
          .map((ws) => getWorkspaceBases(ws.id).find((b) => b.id === baseId))
          .find((base) => base !== undefined)

    const activeWorkspaceId = workspaceId ?? found?.workspaceId
    const workspaceHome = activeWorkspaceId ? `/app/w/${activeWorkspaceId}` : '/app'

    if (!found) {
      const cacheHasBases = getCache().bases.length > 0
      if (!isFirebaseConfigured() || cacheHasBases) {
        navigate(workspaceHome)
      }
      return
    }

    const currentMember = getMemberForUser(found.workspaceId, user.userId, user.email)
    const accessWorkspace =
      workspace ?? getWorkspaces().find((w) => w.id === found.workspaceId)
    const bypass = accessWorkspace
      ? canModifyTableSchemaInWorkspace(
          accessWorkspace,
          user.userId,
          user.email,
          accessWorkspace.id,
        )
      : false
    if (!memberCanAccessBase(currentMember, found, { bypassForAdmin: bypass })) {
      navigate(workspaceHome)
      return
    }
    setBase((prev) => {
      if (prev?.id === found.id && isBaseNewer(prev, found)) return prev
      return found
    })
  }, [user, workspaceId, baseId, navigate, cacheVersion, workspace, location.pathname, ready])

  function saveBase(updated: Base) {
    const stamped = stampBase(updated)
    upsertBase(stamped)
    setBase(stamped)
  }

  function renameBase(name: string) {
    if (!base || !canManageSchema) return
    saveBase({ ...base, name })
  }

  function updateTable(table: Table) {
    if (!base || !baseId) return
    if (activeTableId && table.id !== activeTableId) return
    const latest =
      getWorkspaceBases(base.workspaceId).find((item) => item.id === baseId)
      ?? getCache().bases.find((item) => item.id === baseId)
      ?? base
    const previous = latest.tables.find((item) => item.id === table.id)
    if (previous && isTableStructureChange(previous, table) && !canManageSchema) {
      toast.error('Only workspace admins can change fields, columns, or table structure')
      return
    }
    saveBase({
      ...latest,
      tables: latest.tables.map((t) => (t.id === table.id ? table : t)),
    })
  }

  function updateTableIcon(tableId: string, icon: string | null) {
    if (!base || !canEdit) return
    saveBase({
      ...base,
      tables: base.tables.map((table) =>
        table.id === tableId ? { ...table, icon: normalizeTableIcon(icon) ?? null } : table,
      ),
    })
  }

  function updateBaseIcon(icon: string | null) {
    if (!base || !canEdit) return
    saveBase({ ...base, icon: normalizeTableIcon(icon) ?? null })
  }

  function renameTable(tableId: string, name: string) {
    if (!base || !canManageSchema || !name.trim()) return
    const latest =
      getWorkspaceBases(base.workspaceId).find((item) => item.id === base.id)
      ?? getCache().bases.find((item) => item.id === base.id)
      ?? base
    saveBase({
      ...latest,
      tables: latest.tables.map((table) =>
        table.id === tableId ? { ...table, name: name.trim() } : table,
      ),
    })
  }

  function deleteTable(tableId: string, tableName: string) {
    if (!base || !hasFullAccess) return
    if (!confirm(`Delete table "${tableName}" and all its data?`)) return
    const latest =
      getWorkspaceBases(base.workspaceId).find((item) => item.id === base.id)
      ?? getCache().bases.find((item) => item.id === base.id)
      ?? base
    const remaining = latest.tables.filter((table) => table.id !== tableId)
    saveBase({ ...latest, tables: remaining })
    if (activeTableId === tableId) {
      const accessible = getAccessibleTables(member, remaining, hasFullAccess)
      selectActiveTable(accessible[0]?.id ?? null)
    }
    toast.success(`Deleted ${tableName}`)
  }

  function handleImportTables(sheets: ParsedSheet[]) {
    if (!base || !user || !hasFullAccess) return
    const check = canAddTables(base.tables.length, sheets.length, user.plan)
    if (!check.ok) {
      alert(check.error)
      return
    }
    const imported = sheetsToTables(sheets)
    const updated = { ...base, tables: [...base.tables, ...imported] }
    saveBase(updated)
  }

  function handleConfirmNewTable(name: string) {
    if (!base || !user || !hasFullAccess) return
    const check = canAddTables(base.tables.length, 1, user.plan)
    if (!check.ok) {
      alert(check.error)
      return
    }
    setNewTableName(name)
    setShowNewTable(false)
    setShowNewTableIconPicker(true)
  }

  function handleCreateNewTableWithIcon(icon: string | null) {
    if (!base || !user || !hasFullAccess || !newTableName.trim()) return
    const table: Table = {
      ...createBlankTable(newTableName),
      icon: normalizeTableIcon(icon ?? suggestTableIconFromName(newTableName)) ?? null,
    }
    const latest =
      getWorkspaceBases(base.workspaceId).find((item) => item.id === base.id)
      ?? getCache().bases.find((item) => item.id === base.id)
      ?? base
    const updated = { ...latest, tables: [...latest.tables, table] }
    saveBase(updated)
    setNewTableName('')
    setShowNewTableIconPicker(false)
    toast.success(`Created ${table.name}`)
  }

  if (!base) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const workspaceTeams = workspaceId ? getWorkspaceTeams(workspaceId) : []

  const activeTable = activeTableId
    ? visibleTables.find((t) => t.id === activeTableId)
    : visibleTables[0]
  const iconPickerTable = iconPickerTableId
    ? visibleTables.find((table) => table.id === iconPickerTableId)
    : undefined
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <nav className="sticky top-0 z-50 shrink-0 flex items-center h-12 px-4 gap-3 min-w-0 border-b border-app-border bg-app-bg">
        <button
          type="button"
          onClick={goBackToWorkspace}
          className="inline-flex items-center gap-1.5 shrink-0 text-sm text-app-faint hover:text-app-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 pointer-events-none" />
          Back
        </button>
        <span className="shrink-0 text-app-faint">/</span>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setShowBaseIconPicker(true)}
            className="shrink-0 p-1 rounded hover:bg-app-surface-active transition-colors"
            title="Change database logo"
            aria-label={`Change logo for ${base.name}`}
          >
            <TableIcon icon={base.icon} size="sm" />
          </button>
        ) : (
          <span className="shrink-0">
            <TableIcon icon={base.icon} size="sm" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {hasFullAccess ? (
            <EditableName
              value={base.name}
              onChange={renameBase}
              placeholder="Base name"
              className="text-sm font-medium text-app-text"
              inputClassName="text-sm"
            />
          ) : (
            <span className="text-sm font-medium text-app-text truncate block">{base.name}</span>
          )}
        </div>
        {hasFullAccess && (
          <button
            type="button"
            onClick={() => {
              setBaseTeamIds(base.teamIds ?? [])
              setShowBaseTeams(true)
            }}
            className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg text-app-faint hover:text-app-muted hover:bg-app-surface-active transition-colors"
            title="Team access for this database"
          >
            <Users className="w-3.5 h-3.5" />
            Team access{(base.teamIds?.length ?? 0) > 0 ? ` (${base.teamIds!.length})` : ''}
          </button>
        )}
      </nav>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <aside className="w-52 shrink-0 border-r border-app-border bg-app-bg flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2">
            <span className="text-[10px] font-semibold tracking-widest text-app-faint uppercase">
              Tables
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5 scrollbar-thin">
            {visibleTables.map((table) => {
              const isActive = activeTableId === table.id
              return (
                <div
                  key={table.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectActiveTable(table.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      selectActiveTable(table.id)
                    }
                  }}
                  className={`group/tab relative flex items-center gap-1 rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                      : 'text-app-faint hover:bg-app-surface-active hover:text-app-muted'
                  }`}
                >
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setIconPickerTableId(table.id)
                      }}
                      className="ml-1.5 p-1 rounded hover:bg-app-surface-active transition-colors shrink-0"
                      title="Change table logo"
                      aria-label={`Change logo for ${table.name}`}
                    >
                      <TableIcon icon={table.icon} size="xs" />
                    </button>
                  ) : (
                    <span className="ml-1.5 shrink-0">
                      <TableIcon icon={table.icon} size="xs" />
                    </span>
                  )}
                  {canManageSchema && isActive ? (
                    <div
                      className="flex-1 min-w-0 px-1 py-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <EditableName
                        value={table.name}
                        onChange={(name) => renameTable(table.id, name)}
                        placeholder="Table name"
                        className={`text-sm font-medium ${
                          isActive ? 'text-brand-600 dark:text-brand-400' : ''
                        }`}
                        inputClassName="text-sm"
                      />
                    </div>
                  ) : (
                    <span
                      className={`flex-1 min-w-0 px-1 py-2 text-sm font-medium truncate ${
                        isActive ? 'text-brand-600 dark:text-brand-400' : ''
                      }`}
                    >
                      {table.name}
                    </span>
                  )}
                  {hasFullAccess && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        deleteTable(table.id, table.name)
                      }}
                      className={`mr-1 p-1 rounded text-app-faint hover:text-red-400 transition-all shrink-0 ${
                        isActive
                          ? 'opacity-70 hover:opacity-100'
                          : 'opacity-0 group-hover/tab:opacity-100'
                      }`}
                      title={`Delete ${table.name}`}
                      aria-label={`Delete ${table.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {hasFullAccess && (
            <div className="shrink-0 border-t border-app-border p-2 space-y-0.5">
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="w-full inline-flex items-center gap-2 px-2.5 py-2 text-sm text-app-faint hover:text-brand-400 hover:bg-app-surface-active rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4 shrink-0" />
                Import
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!user) return
                  const check = canAddTables(base.tables.length, 1, user.plan)
                  if (!check.ok) {
                    alert(check.error)
                    return
                  }
                  setShowNewTable(true)
                }}
                className="w-full inline-flex items-center gap-2 px-2.5 py-2 text-sm text-app-faint hover:text-brand-400 hover:bg-app-surface-active rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 shrink-0" />
                New table
              </button>
            </div>
          )}
        </aside>

        <main className="flex-1 min-h-0 overflow-hidden flex flex-col bg-app-bg">
        {visibleTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-app-faint text-sm">
            {base.tables.length === 0 && hasFullAccess ? (
              <>
                <p>No tables in this database yet.</p>
                <button
                  type="button"
                  onClick={() => setShowNewTable(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-brand-400 border border-brand-500/40 hover:bg-brand-500/10 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New table
                </button>
              </>
            ) : (
              <p>You don&apos;t have access to any tables in this database.</p>
            )}
          </div>
        ) : activeTable ? (
          <SpreadsheetGrid
            key={activeTable.id}
            table={activeTable}
            onChange={updateTable}
            readOnly={!canEdit}
            canEditFields={canManageSchema}
            canModifySchema={canManageSchema}
            isWorkspaceAdmin={canManageSchema}
            onManageTableTeams={
              hasFullAccess
                ? () => {
                    setTableTeamIds(activeTable.teamIds ?? [])
                    setShowTableTeams(true)
                  }
                : undefined
            }
            tableTeamCount={activeTable.teamIds?.length ?? 0}
            onAddRow={() => {
              if (!user || !activeTable || !canEdit) return false
              const check = canAddRows(activeTable.rows.length, 1, user.plan)
              if (!check.ok) {
                alert(check.error)
                return false
              }
              return true
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-app-faint text-sm">
            Select or create a table to get started
          </div>
        )}
      </main>
      </div>

      <NameModal
        open={showNewTable}
        title="New Table"
        label="Table name"
        placeholder="e.g. Instagram Leads"
        defaultValue={`Table ${base.tables.length + 1}`}
        onConfirm={handleConfirmNewTable}
        onClose={() => setShowNewTable(false)}
      />

      <TableIconPicker
        open={showNewTableIconPicker}
        title="Table logo"
        tableName={newTableName}
        value={suggestTableIconFromName(newTableName)}
        onSave={handleCreateNewTableWithIcon}
        onClose={() => {
          setShowNewTableIconPicker(false)
          setNewTableName('')
        }}
      />

      <TableIconPicker
        open={showBaseIconPicker}
        title="Database logo"
        tableName={base.name}
        value={base.icon}
        onSave={(icon) => {
          updateBaseIcon(icon)
          setShowBaseIconPicker(false)
        }}
        onClose={() => setShowBaseIconPicker(false)}
      />

      {iconPickerTable && (
        <TableIconPicker
          open
          title="Table logo"
          tableName={iconPickerTable.name}
          value={iconPickerTable.icon}
          onSave={(icon) => {
            updateTableIcon(iconPickerTable.id, icon)
            setIconPickerTableId(null)
          }}
          onClose={() => setIconPickerTableId(null)}
        />
      )}

      <ImportDataModal
        open={showImport}
        title="Import Tables"
        mode="tables"
        onImport={(sheets) => handleImportTables(sheets)}
        onClose={() => setShowImport(false)}
      />

      {showBaseTeams && workspace && workspaceId && baseId && (
        <TableTeamsModal
          tableName={base.name}
          title={`Database team access — ${base.name}`}
          description="Restrict this entire database to specific teams. Members not in any selected team will not see this database or its tables. Leave empty to allow all workspace members (table-level rules still apply). Admins always have access."
          teams={workspaceTeams}
          selectedTeamIds={baseTeamIds}
          onChange={setBaseTeamIds}
          onClose={() => setShowBaseTeams(false)}
          onSave={() => {
            if (!user) return
            const result = assignBaseTeams(
              workspace,
              workspaceId,
              baseId,
              baseTeamIds,
              { userId: user.userId, email: user.email },
            )
            if (!result.ok) {
              toast.error(result.error ?? 'Failed to save team access')
              return
            }
            setBase({ ...base, teamIds: baseTeamIds })
            setShowBaseTeams(false)
            toast.success('Database team access updated')
          }}
        />
      )}

      {showTableTeams && activeTable && workspace && workspaceId && baseId && (
        <TableTeamsModal
          tableName={activeTable.name}
          teams={workspaceTeams}
          selectedTeamIds={tableTeamIds}
          onChange={setTableTeamIds}
          onClose={() => setShowTableTeams(false)}
          onSave={() => {
            if (!user) return
            const result = assignTableTeams(
              workspace,
              workspaceId,
              baseId,
              activeTable.id,
              tableTeamIds,
              { userId: user.userId, email: user.email },
            )
            if (!result.ok) {
              toast.error(result.error ?? 'Failed to save team access')
              return
            }
            setBase({
              ...base,
              tables: base.tables.map((table) =>
                table.id === activeTable.id ? { ...table, teamIds: tableTeamIds } : table,
              ),
            })
            setShowTableTeams(false)
            toast.success('Table team access updated')
          }}
        />
      )}
    </div>
  )
}
