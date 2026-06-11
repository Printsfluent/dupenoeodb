import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import {
  SOCIAL_LOGOS,
  TABLE_EMOJIS,
  formatSocialTableIcon,
  normalizeTableIcon,
  parseTableIcon,
  suggestTableIconFromName,
} from '../lib/tableIcons'
import TableIcon from './TableIcon'

interface TableIconPickerProps {
  open: boolean
  tableName: string
  value?: string | null
  onSave: (icon: string | null) => void
  onClose: () => void
}

type PickerTab = 'social' | 'emoji'

export default function TableIconPicker({
  open,
  tableName,
  value,
  onSave,
  onClose,
}: TableIconPickerProps) {
  const [tab, setTab] = useState<PickerTab>('social')
  const [selected, setSelected] = useState<string | null>(value ?? null)
  const [query, setQuery] = useState('')
  const [customEmoji, setCustomEmoji] = useState('')

  useEffect(() => {
    if (!open) return
    setSelected(value ?? null)
    setQuery('')
    setCustomEmoji('')
    const parsed = parseTableIcon(value)
    setTab(parsed.type === 'emoji' ? 'emoji' : 'social')
  }, [open, value])

  const suggestion = useMemo(() => suggestTableIconFromName(tableName), [tableName])

  const filteredSocial = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SOCIAL_LOGOS
    return SOCIAL_LOGOS.filter(
      (logo) =>
        logo.label.toLowerCase().includes(q) ||
        logo.id.includes(q) ||
        logo.keywords.some((keyword) => keyword.includes(q)),
    )
  }, [query])

  if (!open) return null

  function handleSave() {
    onSave(selected ? normalizeTableIcon(selected) ?? null : null)
  }

  function applySuggestion() {
    if (!suggestion) return
    setSelected(suggestion)
    setTab(parseTableIcon(suggestion).type === 'emoji' ? 'emoji' : 'social')
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-xl border border-app-border bg-app-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
          <div>
            <h3 className="text-sm font-semibold text-app-text">Table logo</h3>
            <p className="text-xs text-app-faint mt-0.5 truncate max-w-[280px]">{tableName || 'Untitled table'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-app-faint hover:text-app-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-app-border bg-app-input px-3 py-2.5">
            <TableIcon icon={selected} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-app-text">Preview</p>
              <p className="text-xs text-app-faint">
                {selected ? 'Custom logo selected' : 'Default table icon'}
              </p>
            </div>
            {selected && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs text-app-faint hover:text-app-muted"
              >
                Clear
              </button>
            )}
          </div>

          {suggestion && suggestion !== selected && (
            <button
              type="button"
              onClick={applySuggestion}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/15 text-left transition-colors"
            >
              <TableIcon icon={suggestion} size="md" />
              <div>
                <p className="text-sm text-app-text">Suggested for this table name</p>
                <p className="text-xs text-app-faint">Tap to use this logo</p>
              </div>
            </button>
          )}

          <div className="flex gap-1 p-1 rounded-lg bg-app-input border border-app-border">
            <button
              type="button"
              onClick={() => setTab('social')}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
                tab === 'social' ? 'bg-app-surface text-app-text shadow-sm' : 'text-app-faint hover:text-app-muted'
              }`}
            >
              Social logos
            </button>
            <button
              type="button"
              onClick={() => setTab('emoji')}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
                tab === 'emoji' ? 'bg-app-surface text-app-text shadow-sm' : 'text-app-faint hover:text-app-muted'
              }`}
            >
              Emojis
            </button>
          </div>

          {tab === 'social' && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Instagram, TikTok, YouTube…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-app-input border border-app-border text-sm text-app-text placeholder:text-app-faint focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-1">
                {filteredSocial.map((logo) => {
                  const iconValue = formatSocialTableIcon(logo.id)
                  const isSelected = selected === iconValue
                  return (
                    <button
                      key={logo.id}
                      type="button"
                      onClick={() => setSelected(iconValue)}
                      title={logo.label}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-brand-500 bg-brand-500/10'
                          : 'border-app-border hover:border-app-border-strong hover:bg-app-surface-hover'
                      }`}
                    >
                      <TableIcon icon={iconValue} size="md" />
                      <span className="text-[10px] text-app-faint truncate w-full text-center">{logo.label}</span>
                    </button>
                  )
                })}
              </div>
              {filteredSocial.length === 0 && (
                <p className="text-sm text-app-faint text-center py-6">No logos match your search</p>
              )}
            </>
          )}

          {tab === 'emoji' && (
            <>
              <div className="grid grid-cols-8 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {TABLE_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => { setSelected(emoji); setCustomEmoji('') }}
                    className={`h-9 rounded-lg text-lg hover:bg-app-surface-active transition-colors ${
                      selected === emoji ? 'bg-brand-500/20 ring-1 ring-brand-500' : ''
                    }`}
                    aria-label={`Use ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-app-faint mb-1.5">Custom emoji</label>
                <input
                  value={customEmoji}
                  onChange={(e) => {
                    const next = e.target.value
                    setCustomEmoji(next)
                    const emoji = [...next.trim()][0]
                    if (emoji && /\p{Extended_Pictographic}/u.test(emoji)) {
                      setSelected(emoji)
                    }
                  }}
                  placeholder="Paste any emoji"
                  className="w-full px-3 py-2 rounded-lg bg-app-input border border-app-border text-sm text-app-text placeholder:text-app-faint focus:outline-none focus:border-brand-500"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-app-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-app-border text-sm text-app-faint hover:bg-app-surface-active"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2 rounded-lg bg-brand-500 text-sm font-medium text-white hover:bg-brand-600"
          >
            Save logo
          </button>
        </div>
      </div>
    </div>
  )
}
