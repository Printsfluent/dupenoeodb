export function parseDateTimeValue(value: string): Date | null {
  if (!value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateDisplay(value: string): string {
  const date = parseDateTimeValue(value)
  if (!date) return value.trim()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

export function formatTimeDisplay(value: string): string {
  const date = parseDateTimeValue(value)
  if (!date) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Display date and time on separate lines — dd/mm/yyyy and 24h HH:mm. */
export function formatDateTimeDisplay(value: string): string {
  if (!value.trim()) return ''
  const date = parseDateTimeValue(value)
  if (!date) return value
  const datePart = formatDateDisplay(value)
  const timePart = formatTimeDisplay(value)
  return timePart ? `${datePart} ${timePart}` : datePart
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

export function parseTimeDisplay(value: string): { hours: number; minutes: number } | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
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
  const parsedDate = datePart ? parseDateDisplay(datePart) : null
  const parsedTime = timePart ? parseTimeDisplay(timePart) : null

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
    /^(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+(\d{1,2}:\d{2}))?$/,
  )
  if (slashMatch) {
    const iso = mergeDateTimeToIso(slashMatch[1], slashMatch[2] ?? '', '')
    if (iso) return iso
  }

  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? trimmed : date.toISOString()
}
