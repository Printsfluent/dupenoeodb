import { useEffect, useState } from 'react'
import { CloudUpload, RotateCcw, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { getCache } from '../lib/dataStore'
import { scanRecoverySources, type RecoveryScanResult } from '../lib/dataRecovery'
import { syncAllCachedBasesToCloud, type CloudSyncProgress } from '../lib/firestoreSync'

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
  const toast = useToast()
  const [recovering, setRecovering] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
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

  function handleSyncProgress(progress: CloudSyncProgress) {
    if (progress.phase === 'preparing') {
      setSyncStatus(
        progress.baseName ? `${progress.baseName}` : 'Preparing upload…',
      )
      return
    }
    if (progress.phase === 'attachments') {
      const done = progress.attachmentsDone ?? 0
      const total = progress.attachmentsTotal ?? 0
      setSyncStatus(
        total > 0 ? `Uploading attachments (${done}/${total})…` : 'Uploading attachments…',
      )
      return
    }
    if (progress.phase === 'metadata') {
      setSyncStatus(`Uploading ${progress.baseName ?? 'database'} info…`)
      return
    }
    if (progress.phase === 'rows') {
      const total = progress.tablesTotal ?? 1
      const done = (progress.tablesDone ?? 0) + 1
      const part =
        progress.chunkCount && progress.chunkCount > 1
          ? ` part ${(progress.chunkIndex ?? 0) + 1}/${progress.chunkCount}`
          : ''
      setSyncStatus(`Uploading rows: ${progress.tableName ?? 'table'}${part} (table ${done}/${total})…`)
      return
    }
    if (progress.phase === 'done') {
      setSyncStatus('Finishing…')
    }
  }

  async function handleSyncToCloud() {
    setSyncing(true)
    setSyncStatus('Connecting to cloud…')
    try {
      const result = await syncAllCachedBasesToCloud(handleSyncProgress)
      toast.success(
        `Uploaded ${result.rows} records to Firestore. Scan again in a few seconds to confirm.`,
      )
      setSyncStatus(null)
      await runScan()
    } catch (error) {
      console.error('Cloud sync failed:', error)
      const message = error instanceof Error ? error.message : 'Cloud sync failed'
      setSyncStatus(`Failed: ${message}`)
      toast.toast(`${message} — stay in Safari and try again.`, 'info')
    } finally {
      setSyncing(false)
    }
  }

  const canRecover = scan ? scan.bestAvailableRows > scan.currentRows : false
  const needsCloudSync = scan ? scan.currentRows > scan.cloudRows && !localMode : false

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
          open SheetFlow in Chrome or clear Safari website data until your records are synced to the
          cloud — your full copy may only exist in this browser.
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
              Best in this browser:{' '}
              <strong className={canRecover ? 'text-green-400' : 'text-app-text'}>
                {scan.bestAvailableRows}
              </strong>
            </span>
            <span className="text-app-muted">
              Firestore server:{' '}
              <strong className={needsCloudSync ? 'text-amber-400' : 'text-app-text'}>
                {scan.cloudRows}
              </strong>
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
          {needsCloudSync && (
            <p className="text-xs text-amber-300/90">
              Your cloud backup is behind this browser ({scan.cloudRows} vs {scan.currentRows}{' '}
              records). Click <strong>Sync all records to cloud</strong> — rows and attachments upload
              in the background; you can keep working while sync runs.
            </p>
          )}
          {syncStatus && (
            <p className="text-xs text-brand-300/90">{syncStatus}</p>
          )}
          {!canRecover && !needsCloudSync && scan.bestAvailableRows > 0 && (
            <p className="text-xs text-app-faint">
              Local and cloud copies match. No older copy was found in this browser.
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
        {needsCloudSync && (
          <button
            type="button"
            disabled={syncing || scanning}
            onClick={handleSyncToCloud}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-60"
          >
            <CloudUpload className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
            {syncing ? 'Uploading…' : 'Sync all records to cloud'}
          </button>
        )}
        <button
          type="button"
          disabled={recovering || scanning || !canRecover}
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
