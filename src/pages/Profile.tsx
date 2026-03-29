import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

// ─── Types ─────────────────────────────────────────────────────────────────

interface ProfileStats {
  bounties_posted: number
  bounties_fulfilled: number
  bets_won: number
  bets_total: number
  total_earned_sol: number
  total_spent_sol: number
  net_pnl_sol: number
}

interface ProfileBountyItem {
  id: number
  title: string
  reward_sol: number
  status: string
  expiry_at: string
  bet_count: number
  created_at: string
}

interface ProfileBetItem {
  id: number
  bounty_id: number
  bounty_title: string
  side: string
  amount_sol: number
  outcome: string
  payout_sol: number
  tx_signature: string | null
  created_at: string
}

interface ProfileFulfilledItem {
  bounty_id: number
  title: string
  reward_sol: number
  reasoning: string | null
  fulfilled_at: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function abbrev(w: string) {
  return w.length < 8 ? w : `${w.slice(0, 4)}…${w.slice(-4)}`
}

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  const ms = Math.max(d, 0)
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function txLink(sig: string | null) {
  if (!sig) return null
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  open:      { background: '#14532d', color: '#4ade80', border: '1px solid #166534' },
  fulfilled: { background: '#1c1a00', color: '#fbbf24', border: '1px solid #854d0e' },
  expired:   { background: '#1f2937', color: '#6b7280', border: '1px solid #374151' },
  resolved:  { background: '#1e3a5f', color: '#60a5fa', border: '1px solid #1d4ed8' },
}

const OUTCOME_STYLE: Record<string, React.CSSProperties> = {
  won:     { background: '#14532d', color: '#4ade80', border: '1px solid #166534' },
  lost:    { background: '#1c0a0a', color: '#f87171', border: '1px solid #7f1d1d' },
  pending: { background: '#1c1a00', color: '#fbbf24', border: '1px solid #854d0e' },
  expired: { background: '#1f2937', color: '#6b7280', border: '1px solid #374151' },
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 10, padding: '14px', display: 'flex', gap: 10 }}>
      <div style={{ ...shimmer, flex: 1, height: 14 }} />
      <div style={{ ...shimmer, width: 60, height: 14 }} />
    </div>
  )
}

// ─── Tab sub-components ────────────────────────────────────────────────────

function BountiesTab({ items, navigate }: { items: ProfileBountyItem[]; navigate: (p: string) => void }) {
  if (items.length === 0) {
    return (
      <div style={emptyState}>
        <span style={{ fontSize: 36 }}>🥝</span>
        <p>You haven't posted any bounties yet. Post your first one! 🥝</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
      {items.map(b => {
        const s = STATUS_STYLE[b.status] ?? STATUS_STYLE.open
        return (
          <div
            key={b.id}
            onClick={() => navigate(`/bounty/${b.id}`)}
            style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 10, padding: '13px 14px', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: '#f3f4f6', fontSize: 13, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{b.title}</span>
              <span style={{ ...badge, ...s, fontSize: 10, flexShrink: 0 }}>{b.status.toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#4ade80', fontSize: 12 }}>🥝 {b.reward_sol.toFixed(4)} SOL</span>
              <span style={{ color: '#6b7280', fontSize: 12 }}>{b.bet_count} bet{b.bet_count !== 1 ? 's' : ''}</span>
              <span style={{ color: '#4b5563', fontSize: 11, marginLeft: 'auto' }}>{timeAgo(b.created_at)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BetsTab({ items, navigate }: { items: ProfileBetItem[]; navigate: (p: string) => void }) {
  if (items.length === 0) {
    return (
      <div style={emptyState}>
        <span style={{ fontSize: 36 }}>🥝</span>
        <p>You haven't placed any bets yet. Find a bounty! 🥝</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
      {items.map(b => {
        const os = OUTCOME_STYLE[b.outcome] ?? OUTCOME_STYLE.pending
        const sideStyle: React.CSSProperties = b.side === 'YES'
          ? { background: '#14532d', color: '#4ade80', border: '1px solid #166534' }
          : { background: '#1c0a0a', color: '#f87171', border: '1px solid #7f1d1d' }
        return (
          <div
            key={b.id}
            onClick={() => navigate(`/bounty/${b.bounty_id}`)}
            style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 10, padding: '13px 14px', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: '#f3f4f6', fontSize: 13, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{b.bounty_title}</span>
              <span style={{ ...badge, ...os, fontSize: 10, flexShrink: 0 }}>{b.outcome.toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ ...badge, ...sideStyle, fontSize: 10 }}>{b.side}</span>
              <span style={{ color: '#f3f4f6', fontSize: 12 }}>{b.amount_sol.toFixed(4)} SOL</span>
              {b.outcome === 'won' && b.payout_sol > 0 && (
                <span style={{ color: '#4ade80', fontSize: 12 }}>→ +{b.payout_sol.toFixed(4)} SOL</span>
              )}
              <span style={{ color: '#4b5563', fontSize: 11, marginLeft: 'auto' }}>{timeAgo(b.created_at)}</span>
            </div>
            {b.tx_signature && (
              <a
                href={txLink(b.tx_signature)!}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ color: '#4ade80', fontSize: 11, display: 'inline-block', marginTop: 6 }}
              >
                View tx ↗
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FulfilledTab({ items, navigate }: { items: ProfileFulfilledItem[]; navigate: (p: string) => void }) {
  if (items.length === 0) {
    return (
      <div style={emptyState}>
        <span style={{ fontSize: 36 }}>🥝</span>
        <p>You haven't fulfilled any bounties yet. Go find one! 🥝</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
      {items.map(b => (
        <div
          key={b.bounty_id}
          onClick={() => navigate(`/bounty/${b.bounty_id}`)}
          style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 10, padding: '13px 14px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: '#f3f4f6', fontSize: 13, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{b.title}</span>
            <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>+{b.reward_sol.toFixed(4)} SOL</span>
          </div>
          {b.reasoning && (
            <div style={{ color: '#9ca3af', fontSize: 12, lineHeight: 1.5, marginTop: 8, fontStyle: 'italic' }}>
              "{b.reasoning}"
            </div>
          )}
          <div style={{ color: '#4b5563', fontSize: 11, marginTop: 6 }}>{timeAgo(b.fulfilled_at)}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function Profile() {
  const { publicKey, connected, disconnect } = useWallet()
  const { connection } = useConnection()
  const navigate = useNavigate()

  const [balance, setBalance] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'bounties' | 'bets' | 'fulfilled'>('bounties')

  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [myBounties, setMyBounties] = useState<ProfileBountyItem[]>([])
  const [myBets, setMyBets] = useState<ProfileBetItem[]>([])
  const [myFulfilled, setMyFulfilled] = useState<ProfileFulfilledItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const wallet = publicKey?.toBase58() ?? ''

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // SOL balance
  useEffect(() => {
    if (!publicKey) return
    connection.getBalance(publicKey)
      .then(l => setBalance(l / LAMPORTS_PER_SOL))
      .catch(() => {})
  }, [publicKey, connection])

  const loadProfile = useCallback(async () => {
    if (!wallet) return
    setLoading(true)
    setLoadError(null)
    try {
      const [s, b, bets, f] = await Promise.all([
        fetch(`/profile/${wallet}`).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() }),
        fetch(`/profile/${wallet}/bounties`).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() }),
        fetch(`/profile/${wallet}/bets`).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() }),
        fetch(`/profile/${wallet}/fulfilled`).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() }),
      ])
      setStats(s)
      setMyBounties(b)
      setMyBets(bets)
      setMyFulfilled(f)
    } catch {
      setLoadError('Something went wrong — tap to retry')
    } finally {
      setLoading(false)
    }
  }, [wallet])

  useEffect(() => { loadProfile() }, [loadProfile])

  if (!connected) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '60px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>🥝</div>
        <h2 style={{ color: '#f3f4f6', fontSize: 20, fontWeight: 700 }}>My Profile</h2>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Connect your Phantom wallet to view your profile 🥝</p>
        <WalletMultiButton />
      </div>
    )
  }

  function copyAddress() {
    navigator.clipboard.writeText(wallet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px 0' }}>

        {/* Page title + disconnect */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h1 style={{ color: '#f3f4f6', fontSize: 20, fontWeight: 700 }}>My Profile</h1>
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
            onClick={loadProfile}
            style={{
              background: '#1c0505', border: '1px solid #7f1d1d',
              borderRadius: 10, padding: '10px 14px',
              color: '#fca5a5', fontSize: 13, marginBottom: 12, cursor: 'pointer',
            }}
          >
            ⚠️ {loadError}
          </div>
        )}

        {/* Header card */}
        <div style={{ ...card, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Avatar */}
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#14532d', border: '2px solid #166534',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, flexShrink: 0,
            }}>
              🥝
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Full address + copy */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{
                  color: '#f3f4f6', fontSize: 11, fontFamily: 'monospace',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {wallet}
                </span>
                <button onClick={copyAddress} style={{
                  background: copied ? '#14532d' : '#1f2937',
                  border: `1px solid ${copied ? '#166534' : '#374151'}`,
                  borderRadius: 6, color: copied ? '#4ade80' : '#9ca3af',
                  fontSize: 11, padding: '2px 8px', cursor: 'pointer', flexShrink: 0,
                  transition: 'all 0.2s',
                }}>
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <div style={{ color: '#6b7280', fontSize: 12, fontFamily: 'monospace' }}>
                {abbrev(wallet)}
              </div>
            </div>
          </div>

          {/* SOL balance */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ color: '#4ade80', fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {balance !== null ? balance.toFixed(4) : '—'}
            </span>
            <span style={{ color: '#9ca3af', fontSize: 15 }}>SOL</span>
            <span style={{ color: '#4b5563', fontSize: 11 }}>devnet</span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Posted', value: stats ? String(stats.bounties_posted) : '—' },
            { label: 'Fulfilled', value: stats ? String(stats.bounties_fulfilled) : '—' },
            { label: 'Bets Won', value: stats ? `${stats.bets_won}/${stats.bets_total}` : '—', green: true },
            { label: 'Earned', value: stats ? `${stats.total_earned_sol.toFixed(2)}` : '—', sub: 'SOL', green: true },
          ].map(s => (
            <div key={s.label} style={{
              background: '#111827', border: '1px solid #1f2937',
              borderRadius: 10, padding: '12px 8px', textAlign: 'center',
            }}>
              <div style={{ color: s.green ? '#4ade80' : '#f3f4f6', fontSize: 15, fontWeight: 700, marginBottom: 1 }}>
                {s.value}
                {s.sub && <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 2 }}>{s.sub}</span>}
              </div>
              <div style={{ color: '#6b7280', fontSize: 10 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 12,
          background: '#111827', borderRadius: 10, padding: 4,
          border: '1px solid #1f2937',
        }}>
          {(['bounties', 'bets', 'fulfilled'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 7, border: 'none',
                background: activeTab === tab ? '#1f2937' : 'transparent',
                color: activeTab === tab ? '#f3f4f6' : '#6b7280',
                fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {tab === 'bounties' ? 'My Bounties' : tab === 'bets' ? 'My Bets' : 'Fulfilled'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonRow /><SkeletonRow /><SkeletonRow />
          </div>
        ) : activeTab === 'bounties' ? (
          <BountiesTab items={myBounties} navigate={navigate} />
        ) : activeTab === 'bets' ? (
          <BetsTab items={myBets} navigate={navigate} />
        ) : (
          <FulfilledTab items={myFulfilled} navigate={navigate} />
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

const badge: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 6,
  fontWeight: 600,
  display: 'inline-block',
}

const emptyState: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  paddingTop: 40,
  paddingBottom: 24,
  color: '#6b7280',
  fontSize: 14,
  textAlign: 'center',
}

const shimmer: React.CSSProperties = {
  background: 'linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s infinite',
  borderRadius: 6,
}
