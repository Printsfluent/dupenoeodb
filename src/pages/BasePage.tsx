import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
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
import { getWorkspaceBases, getWorkspaces, upsertBase } from '../lib/storage'
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
import { getCache } from '../lib/dataStore'
import { isFirebaseConfigured } from '../lib/firebase'
import { sheetsToTables } from '../lib/importSpreadsheet'
import { createId } from '../lib/id'
import { canAddRows, canAddTables } from '../lib/planLimits'
import type { Base, Table } from '../types'
import type { ParsedSheet } from '../lib/importSpreadsheet'

export default function BasePage() {
  const { workspaceId, baseId } = useParams<{ workspaceId: string; baseId: string }>()
  const { user } = useAuth()
  const { ready, cacheVersion } = useData()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
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
    setSearchParams((prev) => {
      const current = prev.get('table')
      if ((tableId ?? null) === (current ?? null)) return prev
      const next = new URLSearchParams(prev)
      if (tableId) next.set('table', tableId)
      else next.delete('table')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const visibleTables = useMemo(() => {
    if (!base) return []
    return getAccessibleTables(member, base.tables, hasFullAccess)
  }, [base, member, hasFullAccess, cacheVersion])

  const activeTableId = useMemo(() => {
    if (tableParam && visibleTables.some((table) => table.id === tableParam)) return tableParam
    return visibleTables[0]?.id ?? null
  }, [tableParam, visibleTables])

  useEffect(() => {
    seededTableUrlRef.current = false
  }, [baseId])

  useEffect(() => {
    if (!base || tableParam || seededTableUrlRef.current) return
    const fallback = visibleTables[0]?.id
    if (!fallback) return
    seededTableUrlRef.current = true
    selectActiveTable(fallback)
  }, [base, tableParam, visibleTables, selectActiveTable])

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
    setBase(found)
  }, [user, workspaceId, baseId, navigate, cacheVersion, workspace, location.pathname, ready])

  function saveBase(updated: Base) {
    upsertBase(updated)
    setBase(updated)
  }

  function renameBase(name: string) {
    if (!base || !canManageSchema) return
    saveBase({ ...base, name })
  }

  function updateTable(table: Table) {
    if (!base) return
    const previous = base.tables.find((item) => item.id === table.id)
    if (previous && isTableStructureChange(previous, table) && !canManageSchema) {
      toast.error('Only workspace admins can change fields, columns, or table structure')
      return
    }
    saveBase({
      ...base,
      tables: base.tables.map((t) => (t.id === table.id ? table : t)),
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

  function deleteTable(tableId: string, tableName: string) {
    if (!base || !hasFullAccess) return
    if (!confirm(`Delete table "${tableName}" and all its data?`)) return
    const remaining = base.tables.filter((table) => table.id !== tableId)
    saveBase({ ...base, tables: remaining })
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
    selectActiveTable(imported[0]?.id ?? activeTableId)
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
    const col = createId()
    const table: Table = {
      id: createId(),
      name: newTableName.trim(),
      icon: normalizeTableIcon(icon ?? suggestTableIconFromName(newTableName)) ?? null,
      columns: [{ id: col, name: 'Title', type: 'singleLineText' }],
      rows: [],
    }
    const updated = { ...base, tables: [...base.tables, table] }
    saveBase(updated)
    selectActiveTable(table.id)
    setNewTableName('')
    setShowNewTableIconPicker(false)
  }

  if (!base) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const workspaceTeams = workspaceId ? getWorkspaceTeams(workspaceId) : []

  const activeTable = visibleTables.find((t) => t.id === activeTableId)
    ?? visibleTables[0]
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

      <header className="sticky top-12 z-40 shrink-0 bg-app-bg border-b border-app-border">
        <div className="flex items-center gap-1 px-4 overflow-x-auto">
          {visibleTables.map((table) => (
            <div
              key={table.id}
              className={`group/tab relative inline-flex items-center gap-1 border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTableId === table.id
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-app-faint hover:text-app-muted'
              }`}
            >
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setIconPickerTableId(table.id)}
                  className="ml-2 p-1 rounded hover:bg-app-surface-active transition-colors"
                  title="Change table logo"
                  aria-label={`Change logo for ${table.name}`}
                >
                  <TableIcon icon={table.icon} size="xs" />
                </button>
              ) : (
                <span className="ml-2">
                  <TableIcon icon={table.icon} size="xs" />
                </span>
              )}
              <button
                type="button"
                onClick={() => selectActiveTable(table.id)}
                className={`px-2 py-2.5 text-sm font-medium hover:text-app-muted transition-colors ${
                  activeTableId === table.id ? 'text-brand-600 dark:text-brand-400' : ''
                }`}
              >
                {table.name}
              </button>
              {hasFullAccess && (
                <button
                  type="button"
                  onClick={() => deleteTable(table.id, table.name)}
                  className={`mr-1 p-1 rounded text-app-faint hover:text-red-400 transition-all ${
                    activeTableId === table.id
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
          ))}
          {hasFullAccess && (
            <>
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-1 px-3 py-2.5 text-sm text-app-faint hover:text-brand-400 transition-colors"
              >
                <Upload className="w-4 h-4" />
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
                className="inline-flex items-center gap-1 px-3 py-2.5 text-sm text-app-faint hover:text-brand-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New table
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden bg-app-bg">
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
