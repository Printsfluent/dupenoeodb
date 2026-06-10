import { useState, useEffect, useCallback } from 'react'
import { useData } from '../context/DataContext'
import { getPendingInvitesForUser, getPendingInviteCount } from '../lib/invites'
import type { WorkspaceInvite } from '../types'

export function usePendingInvites(userId: string | undefined, email: string | undefined) {
  const { cacheVersion } = useData()
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])

  const refresh = useCallback(() => {
    if (userId && email) {
      setInvites(getPendingInvitesForUser(userId, email))
    } else {
      setInvites([])
    }
  }, [userId, email])

  useEffect(() => {
    refresh()
  }, [refresh, cacheVersion])

  return {
    invites,
    count: invites.length,
    refresh,
  }
}

export function useInviteCount(userId: string | undefined, email: string | undefined) {
  const { cacheVersion } = useData()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (userId && email) {
      setCount(getPendingInviteCount(userId, email))
    } else {
      setCount(0)
    }
  }, [userId, email, cacheVersion])

  return {
    count,
    refresh: () => userId && email && setCount(getPendingInviteCount(userId, email)),
  }
}
