import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useData } from '../context/DataContext'

export default function RestoreRecordsPanel() {
  const { localMode, tryRecoverData } = useData()
  const [recovering, setRecovering] = useState(false)

  async function handleRestore() {
    setRecovering(true)
    try {
      await tryRecoverData()
    } finally {
      setRecovering(false)
    }
  }

  return (
    <section className="rounded-xl border border-app-border bg-app-surface p-6">
      <h2 className="text-sm font-semibold text-app-text mb-1">Restore records</h2>
      <p className="text-xs text-app-faint mb-4">
        Scan this browser for older copies of your data — local storage, IndexedDB, and offline
        cache. Use this if rows disappeared after a refresh. Works best on the same device where
        you last edited the data.
      </p>
      {localMode && (
        <p className="text-xs text-brand-300 mb-4">
          Demo mode — recovery scans browser storage on this device only.
        </p>
      )}
      <button
        type="button"
        disabled={recovering}
        onClick={handleRestore}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-60"
      >
        <RotateCcw className={`w-4 h-4 ${recovering ? 'animate-spin' : ''}`} />
        {recovering ? 'Scanning…' : 'Restore records'}
      </button>
    </section>
  )
}
