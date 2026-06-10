import type { User } from '../types'
import { getUsers } from './storage'

export function searchSheetFlowUsers(
  query: string,
  options?: { excludeUserIds?: string[]; limit?: number },
): User[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const exclude = new Set(options?.excludeUserIds ?? [])
  const limit = options?.limit ?? 12

  return getUsers()
    .filter((user) => !exclude.has(user.id))
    .filter(
      (user) =>
        user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q),
    )
    .slice(0, limit)
}
