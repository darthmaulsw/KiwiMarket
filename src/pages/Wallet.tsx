import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

// ─── Types ─────────────────────────────────────────────────────────────────

interface ActivityItem {
  type: string   // bounty_posted / bet_yes / bet_no / payout / fulfilled
  title: string
  amount_sol: number
  is_debit: boolean
  tx_signature: string | null
  created_at: string
}

type FilterType = 'all' | 'bounties' | 'bets' | 'payouts'

// ─── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  const s = Math.floor(d / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const TYPE_META: Record<string, { icon: string; label: (title: string) => string }> = {
  bounty_posted: { icon: '🥝', label: t => `Posted: ${t}` },
  bet_yes:       { icon: '🟢', label: t => `Bet YES on: ${t}` },
  bet_no:        { icon: '🔴', label: t => `Bet NO on: ${t}` },
  payout:        { icon: '💰', label: t => `Won: ${t}` },
  fulfilled:     { icon: '🏆', label: t => `Fulfilled: ${t}` },
}

function filterMatches(item: ActivityItem, filter: FilterType): boolean {
  if (filter === 'all') return true
  if (filter === 'bounties') return item.type === 'bounty_posted'
  if (filter === 'bets') return item.type === 'bet_yes' || item.type === 'bet_no'
  if (filter === 'payouts') return item.type === 'payout' || item.type === 'fulfilled'
  return true
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 10, padding: '14px', display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ ...shimmer, width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ ...shimmer, height: 13, width: '60%', marginBottom: 6 }} />
        <div style={{ ...shimmer, height: 11, width: '40%' }} />
      </div>
      <div style={{ ...shimmer, width: 70, height: 14 }} />
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function Wallet() {
  const { publicKey, connected, disconnect } = useWallet()
  const { connection } = useConnection()

  const [balance, setBalance] = useState<number | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')

  const wallet = publicKey?.toBase58() ?? ''

  // SOL balance polling
  useEffect(() => {
    if (!publicKey) return
    const fetchBalance = () => {
      connection.getBalance(publicKey)
        .then(l => setBalance(l / LAMPORTS_PER_SOL))
        .catch(() => {})
    }
    fetchBalance()
    const id = setInterval(fetchBalance, 10_000)
    return () => clearInterval(id)
  }, [publicKey, connection])

  const loadActivity = useCallback(async () => {
    if (!wallet) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/profile/${wallet}/activity`)
      if (!res.ok) throw new Error(res.statusText)
      setActivity(await res.json())
    } catch {
      setLoadError('Something went wrong — tap to retry')
    } finally {
      setLoading(false)
    }
  }, [wallet])

  useEffect(() => { loadActivity() }, [loadActivity])

  if (!connected) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '60px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>👛</div>
        <h2 style={{ color: '#f3f4f6', fontSize: 20, fontWeight: 700 }}>My Wallet</h2>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Connect your wallet to see your balance and activity.</p>
        <WalletMultiButton />
      </div>
    )
  }

  // Derived stats from activity
  const totalEarned = activity
    .filter(a => !a.is_debit)
    .reduce((s, a) => s + a.amount_sol, 0)

  const totalSpent = activity
    .filter(a => a.is_debit)
    .reduce((s, a) => s + a.amount_sol, 0)

  const netPnl = totalEarned - totalSpent
  const pnlPositive = netPnl >= 0

  const filtered = activity.filter(a => filterMatches(a, filter))

  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px 0' }}>

        {/* Page title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h1 style={{ color: '#f3f4f6', fontSize: 20, fontWeight: 700 }}>My Wallet</h1>
          <button onClick={disconnect} style={{
            background: 'transparent', border: '1px solid #374151',
            color: '#9ca3af', fontSize: 12, borderRadius: 8,
            padding: '5px 12px', cursor: 'pointer',
          }}>
            Disconnect
          </button>
        </div>

        {/* Error banner */}
        {loadError && (
          <div
            onClick={loadActivity}
            style={{
              background: '#1c0505', border: '1px solid #7f1d1d',
              borderRadius: 10, padding: '10px 14px',
              color: '#fca5a5', fontSize: 13, marginBottom: 12, cursor: 'pointer',
            }}
          >
            ⚠️ {loadError}
          </div>
        )}

        {/* Balance card */}
        <div style={{ ...card, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 6 }}>SOL Balance</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ color: '#4ade80', fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {balance !== null ? balance.toFixed(4) : '—'}
                </span>
                <span style={{ color: '#9ca3af', fontSize: 15 }}>SOL</span>
              </div>
              <div style={{ color: '#4b5563', fontSize: 11, marginTop: 2 }}>devnet</div>
            </div>
            <a
              href="https://faucet.solana.com"
              target="_blank"
              rel="noreferrer"
              style={{
                background: '#1e3a5f', border: '1px solid #1d4ed8',
                borderRadius: 8, color: '#60a5fa', fontSize: 12,
                padding: '6px 12px', textDecoration: 'none', fontWeight: 500,
                display: 'inline-block',
              }}
            >
              Get devnet SOL ↗
            </a>
          </div>
        </div>

        {/* P&L stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={statCard}>
            <div style={{ color: '#4ade80', fontSize: 14, fontWeight: 700, marginBottom: 1 }}>
              +{totalEarned.toFixed(4)}
            </div>
            <div style={{ color: '#6b7280', fontSize: 10 }}>Total Earned</div>
          </div>
          <div style={statCard}>
            <div style={{ color: '#f87171', fontSize: 14, fontWeight: 700, marginBottom: 1 }}>
              -{totalSpent.toFixed(4)}
            </div>
            <div style={{ color: '#6b7280', fontSize: 10 }}>Total Spent</div>
          </div>
          <div style={statCard}>
            <div style={{ color: pnlPositive ? '#4ade80' : '#f87171', fontSize: 14, fontWeight: 700, marginBottom: 1 }}>
              {pnlPositive ? '+' : ''}{netPnl.toFixed(4)}
            </div>
            <div style={{ color: '#6b7280', fontSize: 10 }}>Net P&L</div>
          </div>
        </div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {(['all', 'bounties', 'bets', 'payouts'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: 20,
                background: filter === f ? '#22c55e' : '#1f2937',
                border: filter === f ? 'none' : '1px solid #374151',
                color: filter === f ? '#000' : '#9ca3af',
                fontSize: 12, fontWeight: filter === f ? 700 : 400,
                cursor: 'pointer', transition: 'all 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Activity feed */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 10, paddingTop: 40, paddingBottom: 24, color: '#6b7280', textAlign: 'center',
          }}>
            <span style={{ fontSize: 36 }}>🥝</span>
            <p style={{ fontSize: 14 }}>
              {activity.length === 0
                ? 'No KiwiMarket activity yet. Post or bet on a bounty! 🥝'
                : 'No activity in this category.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
            {filtered.map((a, i) => {
              const meta = TYPE_META[a.type] ?? { icon: '•', label: (t: string) => t }
              return (
                <div
                  key={i}
                  style={{
                    background: '#111827', border: '1px solid #1f2937',
                    borderRadius: 10, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#0f172a', border: '1px solid #1f2937',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {meta.icon}
                  </div>

                  {/* Description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: '#f3f4f6', fontSize: 13, fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {meta.label(a.title)}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
                      <span style={{ color: '#4b5563', fontSize: 11 }}>{timeAgo(a.created_at)}</span>
                      {a.tx_signature && (
                        <a
                          href={`https://explorer.solana.com/tx/${a.tx_signature}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#4ade80', fontSize: 11 }}
                        >
                          View tx ↗
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div style={{
                    color: a.is_debit ? '#f87171' : '#4ade80',
                    fontSize: 14, fontWeight: 700, flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {a.is_debit ? '-' : '+'}{a.amount_sol.toFixed(4)} SOL
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 14,
  padding: '16px',
}

const statCard: React.CSSProperties = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 10,
  padding: '12px 8px',
  textAlign: 'center',
}

const shimmer: React.CSSProperties = {
  background: 'linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s infinite',
  borderRadius: 6,
}
