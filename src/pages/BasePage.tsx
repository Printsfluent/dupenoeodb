import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Table2, Upload } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import SpreadsheetGrid from '../components/SpreadsheetGrid'
import EditableName from '../components/EditableName'
import NameModal from '../components/NameModal'
import ImportDataModal from '../components/ImportDataModal'
import { getWorkspaceBases, getWorkspaces, upsertBase } from '../lib/storage'
import {
  canEditFieldsInWorkspace,
  canEditInWorkspace,
  getMemberForUser,
  hasFullWorkspaceAccess,
  memberCanAccessTable,
} from '../lib/members'
import { repairWorkspaceForUser } from '../lib/storage'
import { sheetsToTables } from '../lib/importSpreadsheet'
import { createId } from '../lib/id'
import { canAddRows, canAddTables } from '../lib/planLimits'
import type { Base, Table } from '../types'
import type { ParsedSheet } from '../lib/importSpreadsheet'

export default function BasePage() {
  const { workspaceId, baseId } = useParams<{ workspaceId: string; baseId: string }>()
  const { user } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [base, setBase] = useState<Base | null>(null)
  const [activeTableId, setActiveTableId] = useState<string | null>(null)
  const [showNewTable, setShowNewTable] = useState(false)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    if (!user || !workspaceId || !baseId) return
    const found = getWorkspaceBases(workspaceId).find((b) => b.id === baseId)
    if (!found) {
      navigate(`/app/w/${workspaceId}`)
      return
    }
    setBase(found)
    setActiveTableId((prev) => prev ?? found.tables[0]?.id ?? null)
  }, [user, workspaceId, baseId, navigate])

  function saveBase(updated: Base) {
    upsertBase(updated)
    setBase(updated)
  }

  function renameBase(name: string) {
    if (!base) return
    saveBase({ ...base, name })
  }

  function updateTable(table: Table) {
    if (!base) return
    saveBase({
      ...base,
      tables: base.tables.map((t) => (t.id === table.id ? table : t)),
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
    const col = createId()
    const table: Table = {
      id: createId(),
      name,
      columns: [{ id: col, name: 'Title', type: 'singleLineText' }],
      rows: [],
    }
    const updated = { ...base, tables: [...base.tables, table] }
    saveBase(updated)
    setActiveTableId(table.id)
    setShowNewTable(false)
  }

  if (!base) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const rawWorkspace = getWorkspaces().find((w) => w.id === workspaceId)
  const workspace = rawWorkspace && user
    ? repairWorkspaceForUser(rawWorkspace, { id: user.userId, email: user.email, name: user.name })
    : rawWorkspace
  const hasFullAccess = workspace && user
    ? hasFullWorkspaceAccess(workspace, user.userId, user.email, workspace.id)
    : false
  const canEdit = workspace && user
    ? canEditInWorkspace(workspace, user.userId, user.email, workspace.id)
    : false
  const canEditFields = workspace && user
    ? canEditFieldsInWorkspace(workspace, user.userId, user.email, workspace.id)
    : false
  const member = workspace && user
    ? getMemberForUser(workspace.id, user.userId, user.email)
    : undefined

  const visibleTables = hasFullAccess
    ? base.tables
    : base.tables.filter((t) => memberCanAccessTable(member, t.id, false))

  const activeTable = visibleTables.find((t) => t.id === activeTableId)
    ?? visibleTables[0]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="shrink-0 border-b border-app-border bg-app-bg">
        <div className="flex items-center h-12 px-4 gap-3">
          <button
            type="button"
            onClick={() => navigate(`/app/w/${workspaceId}`)}
            className="inline-flex items-center gap-1.5 text-sm text-app-faint hover:text-app-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span className="text-app-faint">/</span>
          {hasFullAccess ? (
            <EditableName
              value={base.name}
              onChange={renameBase}
              placeholder="Base name"
              className="text-sm font-medium text-app-text"
              inputClassName="text-sm"
              dark={theme === 'dark'}
            />
          ) : (
            <span className="text-sm font-medium text-app-text">{base.name}</span>
          )}
        </div>

        <div className="flex items-center gap-1 px-4 overflow-x-auto">
          {visibleTables.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => setActiveTableId(table.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTableId === table.id
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-app-faint hover:text-app-muted'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              {table.name}
            </button>
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
            You don&apos;t have access to any tables in this base.
          </div>
        ) : activeTable ? (
          <SpreadsheetGrid
            table={activeTable}
            onChange={updateTable}
            readOnly={!canEdit}
            canEditFields={canEditFields}
            canModifySchema={hasFullAccess}
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
        placeholder="e.g. Customers"
        defaultValue={`Table ${base.tables.length + 1}`}
        onConfirm={handleConfirmNewTable}
        onClose={() => setShowNewTable(false)}
      />

      <ImportDataModal
        open={showImport}
        title="Import Tables"
        mode="tables"
        onImport={(sheets) => handleImportTables(sheets)}
        onClose={() => setShowImport(false)}
      />
    </div>
  )
}
