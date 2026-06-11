import { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Upload } from 'lucide-react'
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
  const [base, setBase] = useState<Base | null>(null)
  const [activeTableId, setActiveTableId] = useState<string | null>(null)
  const [showNewTable, setShowNewTable] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showTableTeams, setShowTableTeams] = useState(false)
  const [tableTeamIds, setTableTeamIds] = useState<string[]>([])
  const [iconPickerTableId, setIconPickerTableId] = useState<string | null>(null)
  const [newTableName, setNewTableName] = useState('')
  const [showNewTableIconPicker, setShowNewTableIconPicker] = useState(false)
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

  useEffect(() => {
    if (!user || !baseId) return

    const found =
      (workspaceId ? getWorkspaceBases(workspaceId).find((b) => b.id === baseId) : undefined)
      ?? getWorkspaces()
          .map((ws) => getWorkspaceBases(ws.id).find((b) => b.id === baseId))
          .find((base) => base !== undefined)

    const activeWorkspaceId = workspaceId ?? found?.workspaceId
    const workspaceHome = activeWorkspaceId ? `/app/w/${activeWorkspaceId}` : '/app'

    if (!found) {
      navigate(workspaceHome)
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
    const accessible = getAccessibleTables(currentMember, found.tables, bypass)
    setBase(found)
    setActiveTableId((prev) => {
      if (prev && accessible.some((table) => table.id === prev)) return prev
      return accessible[0]?.id ?? null
    })
  }, [user, workspaceId, baseId, navigate, cacheVersion, workspace])

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
    setActiveTableId(imported[0]?.id ?? activeTableId)
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
    setActiveTableId(table.id)
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

  const visibleTables = getAccessibleTables(member, base.tables, hasFullAccess)

  const activeTable = visibleTables.find((t) => t.id === activeTableId)
    ?? visibleTables[0]
  const iconPickerTable = iconPickerTableId
    ? visibleTables.find((table) => table.id === iconPickerTableId)
    : undefined
  const backWorkspaceId = workspaceId ?? base.workspaceId
  const backHref = backWorkspaceId ? `/app/w/${backWorkspaceId}` : '/app'

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="shrink-0 border-b border-app-border bg-app-bg relative z-20">
        <div className="flex items-center h-12 px-4 gap-3 min-w-0">
          <Link
            to={backHref}
            className="inline-flex items-center gap-1.5 shrink-0 text-sm text-app-faint hover:text-app-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <span className="shrink-0 text-app-faint">/</span>
          <div className="min-w-0">
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
        </div>

        <div className="flex items-center gap-1 px-4 overflow-x-auto">
          {visibleTables.map((table) => (
            <div
              key={table.id}
              className={`inline-flex items-center gap-1 border-b-2 transition-colors whitespace-nowrap ${
                activeTableId === table.id
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-app-faint'
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
                onClick={() => setActiveTableId(table.id)}
                className={`px-2 py-2.5 text-sm font-medium hover:text-app-muted transition-colors ${
                  activeTableId === table.id ? 'text-brand-600 dark:text-brand-400' : ''
                }`}
              >
                {table.name}
              </button>
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
          <div className="flex items-center justify-center h-full text-app-faint text-sm">
            You don&apos;t have access to any tables in this database.
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
        tableName={newTableName}
        value={suggestTableIconFromName(newTableName)}
        onSave={handleCreateNewTableWithIcon}
        onClose={() => {
          setShowNewTableIconPicker(false)
          setNewTableName('')
        }}
      />

      {iconPickerTable && (
        <TableIconPicker
          open
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
