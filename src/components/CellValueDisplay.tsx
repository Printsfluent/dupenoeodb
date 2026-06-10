import { Paperclip, Star, User, MapPin, Braces } from 'lucide-react'
import type { ColumnType } from '../types'
import { normalizeColumnType } from '../lib/fieldTypes'
import { formatDateTimeDisplay } from '../lib/dates'
import { extractLinkHref } from '../lib/links'

interface CellValueDisplayProps {
  type: ColumnType
  value: string
  dark?: boolean
  emptyText: string
  cellText: string
}

export default function CellValueDisplay({
  type,
  value,
  dark,
  emptyText,
  cellText,
}: CellValueDisplayProps) {
  const normalized = normalizeColumnType(type)
  const linkHref = extractLinkHref(value)

  if (!value) {
    return <span className={emptyText}>Empty</span>
  }

  if (linkHref) {
    return (
      <span className="text-brand-400 underline decoration-brand-400/50 underline-offset-2">
        {value}
      </span>
    )
  }

  switch (normalized) {
    case 'checkbox':
      return (
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded border ${
          value === 'true' || value === '1' || value.toLowerCase() === 'yes'
            ? 'bg-brand-500 border-brand-500 text-white'
            : dark ? 'border-app-border-strong bg-app-surface' : 'border-gray-300 bg-white'
        }`}>
          {(value === 'true' || value === '1' || value.toLowerCase() === 'yes') && (
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </span>
      )

    case 'rating': {
      const rating = Math.min(5, Math.max(0, parseInt(value, 10) || 0))
      return (
        <span className="inline-flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-3.5 h-3.5 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`}
            />
          ))}
        </span>
      )
    }

    case 'colour':
      return (
        <span className="inline-flex items-center gap-2">
          <span
            className="w-4 h-4 rounded border border-app-border-strong shrink-0"
            style={{ backgroundColor: value.startsWith('#') ? value : `#${value}` }}
          />
          <span className={cellText}>{value}</span>
        </span>
      )

    case 'attachment':
      return (
        <span className={`inline-flex items-center gap-1.5 ${cellText}`}>
          <Paperclip className="w-3.5 h-3.5 text-gray-500" />
          {value}
        </span>
      )

    case 'user':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
          dark ? 'bg-app-surface-active text-gray-300' : 'bg-gray-100 text-gray-700'
        }`}>
          <User className="w-3 h-3" />
          {value}
        </span>
      )

    case 'geoData':
      return (
        <span className={`inline-flex items-center gap-1.5 ${cellText}`}>
          <MapPin className="w-3.5 h-3.5 text-brand-400" />
          {value}
        </span>
      )

    case 'json':
      return (
        <span className={`inline-flex items-center gap-1.5 font-mono text-xs ${cellText}`}>
          <Braces className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span className="truncate max-w-[140px]">{value}</span>
        </span>
      )

    case 'autoNumber':
      return <span className={`${cellText} text-gray-500 tabular-nums`}>{value}</span>

    case 'longText':
      return <span className={`${cellText} line-clamp-2`}>{value}</span>

    case 'decimal':
    case 'number':
      return <span className={`${cellText} tabular-nums`}>{value}</span>

    case 'dateTime':
      return <span className={cellText}>{formatDateTimeDisplay(value)}</span>

    case 'geometry':
      return <span className={`${cellText} font-mono text-xs`}>{value}</span>

    default:
      if (value === 'Active' || value === 'Lead' || value === 'Churned') {
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
            value === 'Active' ? 'bg-green-900/50 text-green-400'
              : value === 'Lead' ? 'bg-blue-900/50 text-blue-400'
                : value === 'Churned' ? 'bg-red-900/50 text-red-400'
                  : dark ? 'bg-app-surface-active text-gray-400' : 'bg-gray-100 text-gray-600'
          }`}>
            {value}
          </span>
        )
      }
      return <span className={cellText}>{value}</span>
  }
}
