import { useState } from 'react'
import { X } from 'lucide-react'
import { isValidProfileEmoji, normalizeProfileEmoji, PROFILE_EMOJIS } from '../lib/avatar'
import UserAvatar from './UserAvatar'

interface AvatarPickerProps {
  name: string
  currentEmoji?: string
  onSave: (emoji: string | null) => void
  onClose: () => void
}

export default function AvatarPicker({ name, currentEmoji, onSave, onClose }: AvatarPickerProps) {
  const [selected, setSelected] = useState<string | null>(currentEmoji ?? null)
  const [custom, setCustom] = useState('')
  const [error, setError] = useState('')

  function handleCustomChange(value: string) {
    setCustom(value)
    setError('')
    if (!value.trim()) {
      setSelected(null)
      return
    }
    const emoji = normalizeProfileEmoji(value)
    if (isValidProfileEmoji(emoji)) setSelected(emoji)
  }

  function handleSave() {
    if (custom.trim() && !isValidProfileEmoji(normalizeProfileEmoji(custom))) {
      setError('Enter a single emoji')
      return
    }
    onSave(selected)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-app-surface border border-app-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
          <h3 className="text-sm font-semibold text-app-text">Profile picture</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-app-faint hover:text-app-muted"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={name} emoji={selected ?? undefined} size="lg" />
            <div>
              <p className="text-sm font-medium text-app-text">{name}</p>
              <p className="text-xs text-app-faint">Pick an emoji or use your initials</p>
            </div>
          </div>

          <div className="grid grid-cols-8 gap-1.5">
            {PROFILE_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => { setSelected(emoji); setCustom(''); setError('') }}
                className={`h-9 rounded-lg text-lg hover:bg-app-surface-active transition-colors ${
                  selected === emoji ? 'bg-brand-500/20 ring-1 ring-brand-500' : ''
                }`}
                aria-label={`Use ${emoji} as profile picture`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-app-faint mb-1.5">Or paste any emoji</label>
            <input
              value={custom}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder="e.g. 🎸"
              className="app-input-field px-3 py-2 text-sm"
            />
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          </div>

          <button
            type="button"
            onClick={() => { setSelected(null); setCustom(''); setError('') }}
            className="text-xs text-app-faint hover:text-app-muted"
          >
            Use initials instead
          </button>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-app-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 app-btn-ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2 rounded-lg bg-brand-500 text-sm font-medium text-white hover:bg-brand-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
