import type { ColumnType, SelectOption } from '../types'
import { normalizeColumnType } from './fieldTypes'
import { createId } from './id'

export const SELECT_COLOR_KEYS = [
  'green',
  'red',
  'blue',
  'yellow',
  'purple',
  'orange',
  'pink',
  'cyan',
  'gray',
] as const

export type SelectColorKey = (typeof SELECT_COLOR_KEYS)[number]

export const SELECT_COLOR_STYLES: Record<
  SelectColorKey,
  { dark: { bg: string; text: string; border: string }; light: { bg: string; text: string; border: string } }
> = {
  green: {
    dark: { bg: 'rgba(34,197,94,0.18)', text: '#4ade80', border: 'rgba(34,197,94,0.35)' },
    light: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  },
  red: {
    dark: { bg: 'rgba(239,68,68,0.18)', text: '#f87171', border: 'rgba(239,68,68,0.35)' },
    light: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  },
  blue: {
    dark: { bg: 'rgba(59,130,246,0.18)', text: '#60a5fa', border: 'rgba(59,130,246,0.35)' },
    light: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  },
  yellow: {
    dark: { bg: 'rgba(234,179,8,0.18)', text: '#facc15', border: 'rgba(234,179,8,0.35)' },
    light: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  },
  purple: {
    dark: { bg: 'rgba(168,85,247,0.18)', text: '#c084fc', border: 'rgba(168,85,247,0.35)' },
    light: { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
  },
  orange: {
    dark: { bg: 'rgba(249,115,22,0.18)', text: '#fb923c', border: 'rgba(249,115,22,0.35)' },
    light: { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  },
  pink: {
    dark: { bg: 'rgba(236,72,153,0.18)', text: '#f472b6', border: 'rgba(236,72,153,0.35)' },
    light: { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  },
  cyan: {
    dark: { bg: 'rgba(6,182,212,0.18)', text: '#22d3ee', border: 'rgba(6,182,212,0.35)' },
    light: { bg: '#cffafe', text: '#155e75', border: '#67e8f9' },
  },
  gray: {
    dark: { bg: 'rgba(113,113,122,0.2)', text: '#a1a1aa', border: 'rgba(113,113,122,0.4)' },
    light: { bg: '#f4f4f5', text: '#52525b', border: '#d4d4d8' },
  },
}

export function defaultSelectOptions(): SelectOption[] {
  return [
    { id: createId(), label: 'ACTIVE', color: 'green' },
    { id: createId(), label: 'BANNED', color: 'red' },
    { id: createId(), label: 'UNKNOWN', color: 'blue' },
  ]
}

export function nextSelectColor(index: number): SelectColorKey {
  return SELECT_COLOR_KEYS[index % SELECT_COLOR_KEYS.length]
}

export function cycleSelectColor(current: string): SelectColorKey {
  const idx = SELECT_COLOR_KEYS.indexOf(current as SelectColorKey)
  return SELECT_COLOR_KEYS[(idx + 1) % SELECT_COLOR_KEYS.length]
}

export function findSelectOption(options: SelectOption[] | undefined, idOrLabel: string) {
  if (!options?.length || !idOrLabel) return undefined
  return (
    options.find((o) => o.id === idOrLabel) ??
    options.find((o) => o.label === idOrLabel)
  )
}

export function parseMultiSelectValue(raw: string): string[] {
  if (!raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === 'string')
  } catch {
    /* fallback */
  }
  return raw.split('|').map((s) => s.trim()).filter(Boolean)
}

export function serializeMultiSelectValue(ids: string[]): string {
  return ids.length ? JSON.stringify(ids) : ''
}

export function sortSelectOptions(options: SelectOption[], alphabetize: boolean) {
  if (!alphabetize) return options
  return [...options].sort((a, b) => a.label.localeCompare(b.label))
}

export function getSelectBadgeStyle(colorKey: string, dark: boolean) {
  const key = (SELECT_COLOR_KEYS.includes(colorKey as SelectColorKey) ? colorKey : 'gray') as SelectColorKey
  return dark ? SELECT_COLOR_STYLES[key].dark : SELECT_COLOR_STYLES[key].light
}

export function getDefaultCellValue(column: { type: ColumnType; defaultValue?: string }): string {
  if (!column.defaultValue?.trim()) return ''
  const normalized = normalizeColumnType(column.type)
  if (normalized === 'singleSelect') return column.defaultValue
  if (normalized === 'multiSelect') {
    const ids = column.defaultValue.split('|').filter(Boolean)
    return serializeMultiSelectValue(ids)
  }
  return ''
}
