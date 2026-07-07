export function parseDateTimeValue(value: string): Date | null {
  if (!value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function formatHoursMinutes12(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours % 12 || 12
  return `${h12}:${pad2(minutes)} ${period}`
}

export function parseDateDisplay(value: string): Date | null {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const day = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10) - 1
  const year = Number.parseInt(match[3], 10)
  const date = new Date(year, month, day)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null
  }
  return date
}

export function parseDateOnlyValue(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return date
    }
    return null
  }
  return parseDateDisplay(trimmed) ?? parseDateTimeValue(trimmed)
}

export function formatDateStorage(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function formatDateDisplay(value: string): string {
  const date = parseDateOnlyValue(value)
  if (!date) return value.trim()
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
}

export function commitDateInput(text: string, fallback = ''): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const parsed = parseDateDisplay(trimmed) ?? parseDateOnlyValue(trimmed)
  if (!parsed) return fallback || trimmed
  return formatDateStorage(parsed)
}

export function parseTime12h(value: string): { hours: number; minutes: number } | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampmMatch) {
    let hours = Number.parseInt(ampmMatch[1], 10)
    const minutes = Number.parseInt(ampmMatch[2], 10)
    const pm = ampmMatch[3].toUpperCase() === 'PM'
    if (hours < 1 || hours > 12 || minutes > 59) return null
    if (hours === 12) hours = pm ? 12 : 0
    else if (pm) hours += 12
    return { hours, minutes }
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    const hours = Number.parseInt(match24[1], 10)
    const minutes = Number.parseInt(match24[2], 10)
    if (hours > 23 || minutes > 59) return null
    return { hours, minutes }
  }

  return null
}

export function parseTimeStorage(value: string): { hours: number; minutes: number } | null {
  return parseTime12h(value)
}

export function formatTimeStorage(hours: number, minutes: number): string {
  return `${pad2(hours)}:${pad2(minutes)}`
}

export function formatTimeDisplay(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const parsed = parseTimeStorage(trimmed)
  if (parsed) return formatHoursMinutes12(parsed.hours, parsed.minutes)
  const date = parseDateTimeValue(trimmed)
  if (date) return formatHoursMinutes12(date.getHours(), date.getMinutes())
  return trimmed
}

export function commitTimeInput(text: string, fallback = ''): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const parsed = parseTime12h(trimmed)
  if (!parsed) return fallback || trimmed
  return formatTimeStorage(parsed.hours, parsed.minutes)
}

/** Legacy combined date+time display. */
export function formatDateTimeDisplay(value: string): string {
  if (!value.trim()) return ''
  const datePart = formatDateDisplay(value)
  const timePart = formatTimeDisplay(value)
  const date = parseDateOnlyValue(value)
  if (date && !parseTimeStorage(value) && !value.includes('T')) return datePart
  return timePart ? `${datePart} ${timePart}` : datePart
}

export function mergeDateTimeToIso(
  dateText: string,
  timeText: string,
  fallbackIso = '',
): string {
  const datePart = dateText.trim()
  const timePart = timeText.trim()
  if (!datePart && !timePart) return ''

  const existing = parseDateTimeValue(fallbackIso)
  const parsedDate = datePart ? parseDateDisplay(datePart) ?? parseDateOnlyValue(datePart) : null
  const parsedTime = timePart ? parseTime12h(timePart) : null

  if (!parsedDate && !parsedTime) return fallbackIso

  const base =
    parsedDate ??
    (existing
      ? new Date(existing.getFullYear(), existing.getMonth(), existing.getDate())
      : null)

  if (!base) return fallbackIso

  const hours = parsedTime?.hours ?? existing?.getHours() ?? 0
  const minutes = parsedTime?.minutes ?? existing?.getMinutes() ?? 0
  base.setHours(hours, minutes, 0, 0)
  return base.toISOString()
}

export function parsePastedDateTime(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const slashMatch = trimmed.match(
    /^(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+(\d{1,2}:\d{2}\s*(?:AM|PM)))?$/i,
  )
  if (slashMatch) {
    const iso = mergeDateTimeToIso(slashMatch[1], slashMatch[2] ?? '', '')
    if (iso) return iso
  }

  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? trimmed : date.toISOString()
}

export function parsePastedDate(value: string): string {
  return commitDateInput(value, value.trim())
}

export function parsePastedTime(value: string): string {
  return commitTimeInput(value, value.trim())
}
