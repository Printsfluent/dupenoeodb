import type { ColumnType } from '../types'
import { normalizeColumnType } from './fieldTypes'

export function extractLinkHref(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`

  return null
}

export function isLinkValue(value: string, type?: ColumnType): boolean {
  if (extractLinkHref(value)) return true
  const normalized = type ? normalizeColumnType(type) : null
  return normalized === 'attachment' && Boolean(extractLinkHref(value))
}

export function openLink(value: string) {
  const href = extractLinkHref(value)
  if (!href) return false
  window.open(href, '_blank', 'noopener,noreferrer')
  return true
}
