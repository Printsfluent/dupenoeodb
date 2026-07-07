import { useEffect, useState } from 'react'
import { Cloud, CloudOff, Loader2 } from 'lucide-react'
import {
  getBackgroundSyncState,
  subscribeBackgroundSync,
  type BackgroundSyncStatus,
} from '../lib/backgroundCloudSync'
import { isFirebaseConfigured } from '../lib/firebase'

function statusLabel(status: BackgroundSyncStatus, message: string) {
  if (message) return message
  switch (status) {
    case 'pending':
      return 'Cloud sync queued'
    case 'syncing':
      return 'Syncing to cloud…'
    case 'synced':
      return 'Cloud backup up to date'
    case 'error':
      return 'Cloud sync failed'
    default:
      return ''
  }
}

export default function CloudSyncIndicator() {
  const [state, setState] = useState(getBackgroundSyncState)

  useEffect(() => {
    return subscribeBackgroundSync(() => setState(getBackgroundSyncState()))
  }, [])

  if (!isFirebaseConfigured()) return null

  const { status, statusMessage } = state
  if (status === 'idle') return null

  const label = statusLabel(status, statusMessage)
  const isError = status === 'error'
  const isActive = status === 'pending' || status === 'syncing'

  return (
    <div
      className={`shrink-0 px-4 py-1.5 border-b text-[11px] flex items-center justify-center gap-2 ${
        isError
          ? 'bg-red-950/30 border-red-900/40 text-red-200'
          : status === 'synced'
            ? 'bg-green-950/25 border-green-900/35 text-green-200'
            : 'bg-brand-950/30 border-brand-900/35 text-brand-200'
      }`}
      title={label}
    >
      {isError ? (
        <CloudOff className="w-3.5 h-3.5 shrink-0" />
      ) : isActive ? (
        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
      ) : (
        <Cloud className="w-3.5 h-3.5 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </div>
  )
}
