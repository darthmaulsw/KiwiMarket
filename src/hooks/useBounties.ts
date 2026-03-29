import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../constants/config'

export interface Bounty {
  id: number
  title: string
  description: string
  reward_sol: number
  yes_pool: number
  no_pool: number
  yes_price: number   // 0–1
  no_price: number    // 0–1
  poster_wallet: string
  status: 'open' | 'fulfilled' | 'expired' | 'resolved'
  expiry_at: string   // ISO datetime string
  created_at: string
}

interface UseBountiesResult {
  bounties: Bounty[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useBounties(): UseBountiesResult {
  const [bounties, setBounties] = useState<Bounty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBounties = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/bounties`)
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data: Bounty[] = await res.json()
      setBounties(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bounties')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchBounties()
  }, [fetchBounties])

  // Poll every 5 seconds
  useEffect(() => {
    const id = setInterval(fetchBounties, 5000)
    return () => clearInterval(id)
  }, [fetchBounties])

  return { bounties, loading, error, refetch: fetchBounties }
}
