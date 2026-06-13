import { Paperclip, Star, User, MapPin, Braces } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ColumnType, SelectOption } from '../types'
import { normalizeColumnType } from '../lib/fieldTypes'
import { findSelectOption, parseMultiSelectValue } from '../lib/selectOptions'
import SelectOptionBadge from './SelectOptionBadge'
import { formatDateTimeDisplay } from '../lib/dates'
import { extractLinkHref } from '../lib/links'

interface CellValueDisplayProps {
  type: ColumnType
  value: string
  options?: SelectOption[]
  colorCodeOptions?: boolean
  dark?: boolean
  emptyText: string
  cellText: string
  highlightQuery?: string
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function HighlightText({
  text,
  query,
  className,
}: {
  text: string
  query?: string
  className?: string
}) {
  if (!query?.trim()) return <span className={className}>{text}</span>

  const parts = text.split(new RegExp(`(${escapeRegExp(query.trim())})`, 'gi'))
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark key={`${part}-${index}`} className="bg-brand-500/30 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </span>
  )
}

function renderHighlighted(text: string, query: string | undefined, className?: string): ReactNode {
  return <HighlightText text={text} query={query} className={className} />
}

export default function CellValueDisplay({
  type,
  value,
  options = [],
  colorCodeOptions = true,
  dark,
  emptyText: _emptyText,
  cellText,
  highlightQuery,
}: CellValueDisplayProps) {
  const normalized = normalizeColumnType(type)
  const linkHref = extractLinkHref(value)

  if (!value) {
    return null
  }

  if (linkHref) {
    return (
      <span className="text-brand-400 underline decoration-brand-400/50 underline-offset-2">
        {renderHighlighted(value, highlightQuery)}
      </span>
    )
  }

  switch (normalized) {
    case 'checkbox':
      return (
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded border ${
          value === 'true' || value === '1' || value.toLowerCase() === 'yes'
            ? 'bg-brand-500 border-brand-500 text-white'
            : 'border-app-border-strong bg-app-surface'
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
              className={`w-3.5 h-3.5 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-app-faint'}`}
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
          <span className={cellText}>{renderHighlighted(value, highlightQuery)}</span>
        </span>
      )

    case 'attachment':
      return (
        <span className={`inline-flex items-center gap-1.5 ${cellText}`}>
          <Paperclip className="w-3.5 h-3.5 text-app-faint" />
          {renderHighlighted(value, highlightQuery)}
        </span>
      )

    case 'user':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-app-surface-active text-app-muted">
          <User className="w-3 h-3" />
          {renderHighlighted(value, highlightQuery)}
        </span>
      )

    case 'geoData':
      return (
        <span className={`inline-flex items-center gap-1.5 ${cellText}`}>
          <MapPin className="w-3.5 h-3.5 text-brand-400" />
          {renderHighlighted(value, highlightQuery)}
        </span>
      )

    case 'json':
      return (
        <span className={`inline-flex items-center gap-1.5 font-mono text-xs ${cellText}`}>
          <Braces className="w-3.5 h-3.5 text-app-faint shrink-0" />
          <span className="truncate max-w-[140px]">{renderHighlighted(value, highlightQuery)}</span>
        </span>
      )

    case 'autoNumber':
      return <span className={`${cellText} text-app-faint tabular-nums`}>{renderHighlighted(value, highlightQuery)}</span>

    case 'longText':
      return <span className={`${cellText} line-clamp-2`}>{renderHighlighted(value, highlightQuery)}</span>

    case 'decimal':
    case 'number':
      return <span className={`${cellText} tabular-nums`}>{renderHighlighted(value, highlightQuery)}</span>

    case 'dateTime':
      return <span className={cellText}>{renderHighlighted(formatDateTimeDisplay(value), highlightQuery)}</span>

    case 'geometry':
      return <span className={`${cellText} font-mono text-xs`}>{renderHighlighted(value, highlightQuery)}</span>

    case 'singleSelect': {
      const option = findSelectOption(options, value)
      if (!option) return <span className={cellText}>{renderHighlighted(value, highlightQuery)}</span>
      return colorCodeOptions ? (
        <SelectOptionBadge label={option.label} color={option.color} dark={dark} />
      ) : (
        <span className={cellText}>{renderHighlighted(option.label, highlightQuery)}</span>
      )
    }

    case 'multiSelect': {
      const ids = parseMultiSelectValue(value)
      if (!ids.length) return null
      return (
        <span className="inline-flex flex-wrap gap-1">
          {ids.map((id) => {
            const option = findSelectOption(options, id)
            if (!option) return <span key={id} className={cellText}>{renderHighlighted(id, highlightQuery)}</span>
            return colorCodeOptions ? (
              <SelectOptionBadge key={id} label={option.label} color={option.color} dark={dark} compact />
            ) : (
              <span key={id} className={`${cellText} text-xs`}>{renderHighlighted(option.label, highlightQuery)}</span>
            )
          })}
        </span>
      )
    }

    default:
      if (value === 'Active' || value === 'Lead' || value === 'Churned') {
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
            value === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
              : value === 'Lead' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400'
                : value === 'Churned' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                  : 'bg-app-surface-active text-app-faint'
          }`}>
            {renderHighlighted(value, highlightQuery)}
          </span>
        )
      }
      return <span className={cellText}>{renderHighlighted(value, highlightQuery)}</span>
  }
}
