import type { LucideIcon } from 'lucide-react'
import {
  Type, AlignLeft, Hash, Percent, Paperclip, SquareCheck,
  Star, Palette, Calendar, Clock, Shapes, MapPin, Braces, User,
  ListChecks, CircleChevronDown,
} from 'lucide-react'
import type { ColumnType } from '../types'

export interface FieldTypeOption {
  value: ColumnType
  label: string
  icon: LucideIcon
  group: 'basic' | 'advanced'
}

export const FIELD_TYPE_OPTIONS: FieldTypeOption[] = [
  { value: 'singleLineText', label: 'Single line text', icon: Type, group: 'basic' },
  { value: 'longText', label: 'Long text', icon: AlignLeft, group: 'basic' },
  { value: 'number', label: 'Number', icon: Hash, group: 'basic' },
  { value: 'autoNumber', label: 'Auto number', icon: Hash, group: 'basic' },
  { value: 'decimal', label: 'Decimal', icon: Percent, group: 'basic' },
  { value: 'attachment', label: 'Attachment', icon: Paperclip, group: 'basic' },
  { value: 'checkbox', label: 'Checkbox', icon: SquareCheck, group: 'basic' },
  { value: 'singleSelect', label: 'Single select', icon: CircleChevronDown, group: 'basic' },
  { value: 'multiSelect', label: 'Multi select', icon: ListChecks, group: 'basic' },
  { value: 'rating', label: 'Rating', icon: Star, group: 'advanced' },
  { value: 'colour', label: 'Colour', icon: Palette, group: 'advanced' },
  { value: 'date', label: 'Date', icon: Calendar, group: 'advanced' },
  { value: 'time', label: 'Time', icon: Clock, group: 'advanced' },
  { value: 'geometry', label: 'Geometry', icon: Shapes, group: 'advanced' },
  { value: 'geoData', label: 'Geo data', icon: MapPin, group: 'advanced' },
  { value: 'json', label: 'JSON', icon: Braces, group: 'advanced' },
  { value: 'user', label: 'User', icon: User, group: 'advanced' },
]

const LEGACY_TYPE_MAP: Record<string, ColumnType> = {
  text: 'singleLineText',
  select: 'singleSelect',
}

const LEGACY_LABELS: Partial<Record<ColumnType, string>> = {
  dateTime: 'Date & time',
}

export function isSelectFieldType(type: ColumnType): boolean {
  const normalized = normalizeColumnType(type)
  return normalized === 'singleSelect' || normalized === 'multiSelect'
}

export function normalizeColumnType(type: ColumnType): ColumnType {
  return LEGACY_TYPE_MAP[type] ?? type
}

export function getFieldTypeLabel(type: ColumnType): string {
  const normalized = normalizeColumnType(type)
  const legacy = LEGACY_LABELS[normalized]
  if (legacy) return legacy
  return FIELD_TYPE_OPTIONS.find((option) => option.value === normalized)?.label ?? 'Single line text'
}

export function getFieldTypeOption(type: ColumnType): FieldTypeOption {
  const normalized = normalizeColumnType(type)
  if (normalized === 'dateTime') {
    return { value: 'dateTime', label: 'Date & time', icon: Calendar, group: 'advanced' }
  }
  return FIELD_TYPE_OPTIONS.find((option) => option.value === normalized) ?? FIELD_TYPE_OPTIONS[0]
}
