import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Bounty } from '../hooks/useBounties'

interface BountyCardProps {
  bounty: Bounty
}

function useCountdown(expiryIso: string): string {
  const getRemaining = () => {
    const diff = new Date(expiryIso).getTime() - Date.now()
    if (diff <= 0) return 'Expired'
    const totalSec = Math.floor(diff / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const [remaining, setRemaining] = useState(getRemaining)

  useEffect(() => {
    const id = setInterval(() => setRemaining(getRemaining()), 1000)
    return () => clearInterval(id)
  }, [expiryIso])

  return remaining
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  open:      { background: '#14532d', color: '#4ade80', border: '1px solid #166534' },
  fulfilled: { background: '#1c1a00', color: '#fbbf24', border: '1px solid #854d0e' },
  expired:   { background: '#1f2937', color: '#6b7280', border: '1px solid #374151' },
  resolved:  { background: '#1e3a5f', color: '#60a5fa', border: '1px solid #1d4ed8' },
}

export default function BountyCard({ bounty }: BountyCardProps) {
  const navigate = useNavigate()
  const countdown = useCountdown(bounty.expiry_at)

  const yesPercent = Math.round(bounty.yes_price * 100)
  const noPercent = Math.round(bounty.no_price * 100)
  const statusStyle = STATUS_STYLE[bounty.status] ?? STATUS_STYLE.open

  const shortWallet = `${bounty.poster_wallet.slice(0, 4)}…${bounty.poster_wallet.slice(-4)}`

  return (
    <div
      style={{
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: 14,
        padding: '16px 16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Top row: wallet + status badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}>{shortWallet}</span>
        <span
          style={{
            fontSize: 10,
            padding: '2px 9px',
            borderRadius: 8,
            fontWeight: 600,
            textTransform: 'uppercase',
            ...statusStyle,
          }}
        >
          {bounty.status}
        </span>
      </div>

      {/* Title */}
      <p
        style={{
          color: '#f3f4f6',
          fontSize: 15,
          fontWeight: 600,
          lineHeight: 1.45,
          margin: 0,
        }}
      >
        {bounty.title}
      </p>

      {/* Reward + countdown */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            background: '#14532d',
            color: '#4ade80',
            fontSize: 12,
            padding: '3px 10px',
            borderRadius: 8,
            fontWeight: 600,
            border: '1px solid #166534',
          }}
        >
          🥝 {bounty.reward_sol.toFixed(4)} SOL
        </span>
        <span
          style={{
            color: countdown === 'Expired' ? '#6b7280' : '#fbbf24',
            fontSize: 12,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          ⏱ {countdown}
        </span>
      </div>

      {/* Odds bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
          <span style={{ color: '#4ade80', fontWeight: 600 }}>{yesPercent}% YES</span>
          <span style={{ color: '#f87171', fontWeight: 600 }}>{noPercent}% NO</span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 6,
            background: '#374151',
            overflow: 'hidden',
          }}
        >
          {/* YES fill */}
          <div
            style={{
              height: '100%',
              width: `${yesPercent}%`,
              background: 'linear-gradient(90deg, #22c55e, #4ade80)',
              borderRadius: 6,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        {/* NO fill shown as a right-aligned overlay via flex trick */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 3 }}>
          <span style={{ color: '#374151' }}>
            {bounty.yes_pool.toFixed(4)} SOL pool
          </span>
          <span style={{ color: '#374151' }}>
            {bounty.no_pool.toFixed(4)} SOL pool
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button
          disabled={bounty.status !== 'open'}
          onClick={() => navigate(`/bounty/${bounty.id}?side=YES`)}
          style={{
            flex: 1,
            padding: '9px 0',
            background: bounty.status === 'open' ? '#22c55e' : '#1f2937',
            border: 'none',
            borderRadius: 10,
            color: bounty.status === 'open' ? '#000' : '#4b5563',
            fontSize: 13,
            fontWeight: 700,
            cursor: bounty.status === 'open' ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          Bet YES
        </button>
        <button
          disabled={bounty.status !== 'open'}
          onClick={() => navigate(`/bounty/${bounty.id}?side=NO`)}
          style={{
            flex: 1,
            padding: '9px 0',
            background: 'transparent',
            border: `1px solid ${bounty.status === 'open' ? '#f87171' : '#374151'}`,
            borderRadius: 10,
            color: bounty.status === 'open' ? '#f87171' : '#4b5563',
            fontSize: 13,
            fontWeight: 700,
            cursor: bounty.status === 'open' ? 'pointer' : 'not-allowed',
            transition: 'border-color 0.15s, color 0.15s',
          }}
        >
          Bet NO
        </button>
      </div>
    </div>
  )
}
