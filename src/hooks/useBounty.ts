import { useState, useEffect, useCallback } from 'react'
import type { Bounty } from './useBounties'

interface UseBountyResult {
  bounty: Bounty | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useBounty(id: string | undefined): UseBountyResult {
  const [bounty, setBounty] = useState<Bounty | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBounty = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/bounties/${id}`)
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data: Bounty = await res.json()
      setBounty(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bounty')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchBounty()
  }, [fetchBounty])

  // Poll every 3 seconds for live odds
  useEffect(() => {
    const interval = setInterval(fetchBounty, 3000)
    return () => clearInterval(interval)
  }, [fetchBounty])

  return { bounty, loading, error, refetch: fetchBounty }
}
