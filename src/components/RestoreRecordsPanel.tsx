import { useEffect, useState } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { getCache } from '../lib/dataStore'
import { scanRecoverySources, type RecoveryScanResult } from '../lib/dataRecovery'

function computeWorkspaceIds(userId: string, email: string) {
  const cache = getCache()
  const normalized = email.toLowerCase()
  const owned = cache.workspaces
    .filter((workspace) => workspace.ownerId === userId)
    .map((workspace) => workspace.id)
  const member = cache.members
    .filter(
      (member) =>
        member.status === 'active' &&
        (member.userId === userId || member.email === normalized),
    )
    .map((member) => member.workspaceId)
  return [...new Set([...owned, ...member])]
}

export default function RestoreRecordsPanel() {
  const { user } = useAuth()
  const { localMode, tryRecoverData } = useData()
  const [recovering, setRecovering] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scan, setScan] = useState<RecoveryScanResult | null>(null)

  async function runScan() {
    if (!user) return
    setScanning(true)
    try {
      const result = await scanRecoverySources(computeWorkspaceIds(user.userId, user.email))
      setScan(result)
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    void runScan()
  }, [user?.userId, user?.email])

  async function handleRestore() {
    setRecovering(true)
    try {
      await tryRecoverData()
      await runScan()
    } finally {
      setRecovering(false)
    }
  }

  const canRecover = scan ? scan.bestAvailableRows > scan.currentRows : false

  return (
    <section className="rounded-xl border border-app-border bg-app-surface p-6">
      <h2 className="text-sm font-semibold text-app-text mb-1">Restore records</h2>
      <p className="text-xs text-app-faint mb-3">
        Scan this browser and Firestore for older copies of your data — local storage, IndexedDB,
        offline cache, and the server. Use this if rows disappeared after a refresh.
      </p>

      <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2.5 mb-4">
        <p className="text-xs text-amber-200/90">
          <strong className="font-medium">Safari only?</strong> Stay in this Safari window. Do not
          open SheetFlow in Chrome or clear Safari website data until recovery finishes — your records
          may only exist in this browser.
        </p>
      </div>

      {localMode && (
        <p className="text-xs text-brand-300 mb-4">
          Demo mode — recovery scans browser storage on this device only.
        </p>
      )}

      {scan && (
        <div className="mb-4 rounded-lg border border-app-border bg-app-bg/40 p-3 space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="text-app-muted">
              Loaded now: <strong className="text-app-text">{scan.currentRows}</strong> records
            </span>
            <span className="text-app-muted">
              Best found in this browser:{' '}
              <strong className={canRecover ? 'text-green-400' : 'text-app-text'}>
                {scan.bestAvailableRows}
              </strong>{' '}
              records
            </span>
          </div>
          {scan.sources.length > 0 && (
            <ul className="text-[11px] text-app-faint space-y-0.5 max-h-32 overflow-y-auto">
              {scan.sources.map((item) => (
                <li key={item.source} className="flex justify-between gap-3">
                  <span>{item.source}</span>
                  <span className="tabular-nums text-app-muted">{item.rowCount}</span>
                </li>
              ))}
            </ul>
          )}
          {canRecover && (
            <p className="text-xs text-green-400/90">
              {scan.bestAvailableRows - scan.currentRows} missing record
              {scan.bestAvailableRows - scan.currentRows === 1 ? '' : 's'} can be restored from this
              browser.
            </p>
          )}
          {!canRecover && scan.bestAvailableRows > 0 && scan.bestAvailableRows === scan.currentRows && (
            <p className="text-xs text-app-faint">
              No richer copy was found in this browser. If you had more rows before, they may already
              have been overwritten here.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={scanning}
          onClick={runScan}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-app-border-strong text-app-muted text-sm font-medium hover:bg-app-surface-hover disabled:opacity-60"
        >
          <Search className={`w-4 h-4 ${scanning ? 'animate-pulse' : ''}`} />
          {scanning ? 'Scanning…' : 'Scan again'}
        </button>
        <button
          type="button"
          disabled={recovering || scanning}
          onClick={handleRestore}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-60"
        >
          <RotateCcw className={`w-4 h-4 ${recovering ? 'animate-spin' : ''}`} />
          {recovering ? 'Restoring…' : 'Restore records'}
        </button>
      </div>
    </section>
  )
}
