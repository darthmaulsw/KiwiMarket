import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import {
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js'
import { useBounty } from '../hooks/useBounty'
import { useNetworkGuard } from '../hooks/useNetworkGuard'
import { ESCROW_WALLET } from '../constants/config'
import type { Bounty } from '../hooks/useBounties'

// ─── Types ─────────────────────────────────────────────────────────────────

interface BetFeedItem {
  id: number
  bettor_wallet: string
  side: string
  amount_sol: number
  tx_signature: string | null
  created_at: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function useCountdown(expiryIso: string): string {
  const calc = () => {
    const diff = new Date(expiryIso).getTime() - Date.now()
    if (diff <= 0) return 'Expired'
    const s = Math.floor(diff / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}h ${m}m ${sec}s`
    if (m > 0) return `${m}m ${sec}s`
    return `${sec}s`
  }
  const [val, setVal] = useState(calc)
  useEffect(() => {
    const id = setInterval(() => setVal(calc()), 1000)
    return () => clearInterval(id)
  }, [expiryIso])
  return val
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function abbrev(wallet: string): string {
  if (wallet.length < 8) return wallet
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`
}

// ─── Status badge ──────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  open:      { background: '#14532d', color: '#4ade80', border: '1px solid #166534' },
  fulfilled: { background: '#1c1a00', color: '#fbbf24', border: '1px solid #854d0e' },
  expired:   { background: '#1f2937', color: '#6b7280', border: '1px solid #374151' },
  resolved:  { background: '#1e3a5f', color: '#60a5fa', border: '1px solid #1d4ed8' },
}

// ─── Bet feed hook ─────────────────────────────────────────────────────────

function useBetFeed(bountyId: string | undefined) {
  const [bets, setBets] = useState<BetFeedItem[]>([])

  const fetch_ = useCallback(async () => {
    if (!bountyId) return
    try {
      const res = await fetch(`/bounties/${bountyId}/bets`)
      if (!res.ok) return
      setBets(await res.json())
    } catch {
      // silent — feed is non-critical
    }
  }, [bountyId])

  useEffect(() => { fetch_() }, [fetch_])
  useEffect(() => {
    const id = setInterval(fetch_, 5000)
    return () => clearInterval(id)
  }, [fetch_])

  return { bets, refetchBets: fetch_ }
}

// ─── Toast ─────────────────────────────────────────────────────────────────

interface ToastState { msg: string; type: 'success' | 'error' }

// ─── Main component ────────────────────────────────────────────────────────

export default function BountyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { bounty, loading, error, refetch } = useBounty(id)
  const { bets, refetchBets } = useBetFeed(id)
  const { publicKey, sendTransaction, connected } = useWallet()
  const { connection } = useConnection()
  const { assertDevnet } = useNetworkGuard()

  const countdown = useCountdown(bounty?.expiry_at ?? new Date().toISOString())

  // Bet panel state
  const [betSide, setBetSide] = useState<'YES' | 'NO'>('YES')
  const [betAmount, setBetAmount] = useState('0.05')
  const [placing, setPlacing] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function placeBet() {
    if (!publicKey || !bounty || placing) return
    const amt = parseFloat(betAmount)
    if (!amt || amt <= 0) return

    setPlacing(true)
    try {
      // 0. Ensure wallet is on devnet
      await assertDevnet()

      // 1. Build transaction
      const lamports = Math.round(amt * LAMPORTS_PER_SOL)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: publicKey,
      })
      tx.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(ESCROW_WALLET),
          lamports,
        })
      )

      // 2. Sign + send via Phantom
      const signature = await sendTransaction(tx, connection)

      // 3. Wait for on-chain confirmation
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed'
      )

      // 4. Record in backend (best-effort — SOL is already on chain)
      try {
        const res = await fetch('/bets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bounty_id: bounty.id,
            bettor_wallet: publicKey.toBase58(),
            side: betSide,
            amount_sol: amt,
            tx_signature: signature,
          }),
        })
        if (!res.ok) console.error('Backend bet record failed:', await res.text())
      } catch (e) {
        console.error('Backend bet record error:', e)
      }

      // 5. Success
      showToast(`Bet placed! 🥝 Tx: ${signature.slice(0, 8)}…`, 'success')
      refetch()
      refetchBets()
      setBetAmount('0.05')
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase()
        if (msg.includes('rejected') || msg.includes('user rejected') || msg.includes('cancelled')) {
          showToast('Transaction cancelled', 'error')
        } else if (msg.includes('insufficient') || msg.includes('0x1')) {
          showToast('Insufficient SOL balance', 'error')
        } else {
          showToast('Transaction failed — please try again', 'error')
        }
      } else {
        showToast('Transaction failed — please try again', 'error')
      }
    } finally {
      setPlacing(false)
    }
  }

  // ─── Render: loading / error ─────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px' }}>
        <button onClick={() => navigate(-1)} style={backBtnStyle}>← Back</button>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ ...shimmerBlock, height: i === 1 ? 28 : 14, marginBottom: 12, width: i === 2 ? '70%' : '100%' }} />
        ))}
      </div>
    )
  }

  if (error || !bounty) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px' }}>
        <button onClick={() => navigate(-1)} style={backBtnStyle}>← Back</button>
        <div style={{ color: '#fca5a5', fontSize: 14 }}>⚠️ {error ?? 'Bounty not found'}</div>
      </div>
    )
  }

  const yesPercent = Math.round(bounty.yes_price * 100)
  const noPercent = Math.round(bounty.no_price * 100)
  const totalPool = (bounty.yes_pool + bounty.no_pool).toFixed(4)
  const activeOdds = betSide === 'YES' ? (100 / (bounty.yes_price * 100)).toFixed(2) : (100 / (bounty.no_price * 100)).toFixed(2)
  const statusStyle = STATUS_STYLE[bounty.status] ?? STATUS_STYLE.open

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#14532d' : '#1c0505',
          color: toast.type === 'success' ? '#4ade80' : '#fca5a5',
          border: `1px solid ${toast.type === 'success' ? '#166534' : '#7f1d1d'}`,
          borderRadius: 10, padding: '9px 18px', fontSize: 13,
          zIndex: 300, whiteSpace: 'nowrap', fontWeight: 500,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px 0' }}>
        {/* Back button */}
        <button onClick={() => navigate(-1)} style={backBtnStyle}>← Back</button>

        {/* ── Bounty header card ── */}
        <div style={card}>
          {/* Status badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ ...badgeBase, ...statusStyle, textTransform: 'uppercase', fontSize: 11 }}>
              {bounty.status}
            </span>
            <span style={{ color: countdown === 'Expired' ? '#6b7280' : '#fbbf24', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              ⏱ {countdown}
            </span>
          </div>

          {/* Title */}
          <h1 style={{ color: '#f3f4f6', fontSize: 20, fontWeight: 700, lineHeight: 1.4, marginBottom: 10 }}>
            {bounty.title}
          </h1>

          {/* Description */}
          {bounty.description && (
            <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
              {bounty.description}
            </p>
          )}

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <span style={{ ...badgeBase, background: '#14532d', color: '#4ade80', border: '1px solid #166534', fontSize: 13 }}>
              🥝 {bounty.reward_sol.toFixed(4)} SOL
            </span>
            <span style={{ ...badgeBase, background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', fontSize: 12 }}>
              Posted by {abbrev(bounty.poster_wallet)}
            </span>
          </div>

          {/* Odds bar */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              <span style={{ color: '#4ade80' }}>{yesPercent}% YES</span>
              <span style={{ color: '#f87171' }}>{noPercent}% NO</span>
            </div>
            <div style={{ height: 10, borderRadius: 8, background: '#374151', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${yesPercent}%`,
                background: 'linear-gradient(90deg, #16a34a, #4ade80)',
                borderRadius: 8,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4b5563', marginTop: 5 }}>
              <span>{bounty.yes_pool.toFixed(4)} SOL YES pool</span>
              <span>Total: {totalPool} SOL</span>
              <span>{bounty.no_pool.toFixed(4)} SOL NO pool</span>
            </div>
          </div>

          {/* Fulfill button */}
          <button disabled style={{
            width: '100%', marginTop: 14, padding: '10px 0',
            background: '#1f2937', border: '1px solid #374151',
            borderRadius: 10, color: '#4b5563', fontSize: 13, cursor: 'not-allowed',
          }}>
            Fulfill this bounty (coming soon)
          </button>
        </div>

        {/* ── Bet placement panel ── */}
        <div style={card}>
          <h2 style={{ color: '#f3f4f6', fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Place a Bet</h2>

          {!connected ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#9ca3af', fontSize: 14 }}>
              Connect your wallet to bet
            </div>
          ) : bounty.status !== 'open' ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#6b7280', fontSize: 14 }}>
              This bounty is no longer accepting bets
            </div>
          ) : (
            <>
              {/* YES / NO toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  onClick={() => setBetSide('YES')}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: betSide === 'YES' ? '#22c55e' : 'transparent',
                    border: betSide === 'YES' ? 'none' : '1px solid #374151',
                    color: betSide === 'YES' ? '#000' : '#6b7280',
                  }}
                >
                  Bet YES 🟢
                </button>
                <button
                  onClick={() => setBetSide('NO')}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: betSide === 'NO' ? '#ef4444' : 'transparent',
                    border: betSide === 'NO' ? 'none' : '1px solid #374151',
                    color: betSide === 'NO' ? '#fff' : '#6b7280',
                  }}
                >
                  Bet NO 🔴
                </button>
              </div>

              {/* Amount input */}
              <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 6 }}>Amount (SOL)</div>
              <div style={{
                display: 'flex', alignItems: 'center',
                background: '#1f2937', border: '1px solid #374151',
                borderRadius: 10, padding: '10px 14px', marginBottom: 12,
              }}>
                <input
                  type="number"
                  value={betAmount}
                  min="0.01"
                  max="1.0"
                  step="0.01"
                  onChange={e => setBetAmount(e.target.value)}
                  style={{
                    background: 'transparent', border: 'none',
                    color: '#f3f4f6', fontSize: 16, fontWeight: 600,
                    flex: 1, outline: 'none', width: 80,
                  }}
                />
                <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>SOL</span>
              </div>

              {/* Live preview */}
              <div style={{
                background: '#0f172a', border: '1px solid #1f2937',
                borderRadius: 8, padding: '10px 12px', marginBottom: 14,
                color: '#9ca3af', fontSize: 13,
              }}>
                You are betting{' '}
                <span style={{ color: '#f3f4f6', fontWeight: 600 }}>{betAmount || '0'} SOL</span>
                {' '}on{' '}
                <span style={{ color: betSide === 'YES' ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                  {betSide}
                </span>
                {' '}at{' '}
                <span style={{ color: '#f3f4f6', fontWeight: 600 }}>
                  {betSide === 'YES' ? yesPercent : noPercent}% odds
                </span>
                {' '}→ win{' '}
                <span style={{ color: '#4ade80', fontWeight: 600 }}>
                  {((parseFloat(betAmount) || 0) * parseFloat(activeOdds)).toFixed(4)} SOL
                </span>
              </div>

              {/* Place Bet button */}
              <button
                onClick={placeBet}
                disabled={placing || !betAmount || parseFloat(betAmount) <= 0}
                style={{
                  width: '100%', padding: '12px 0',
                  background: placing ? '#374151' : betSide === 'YES' ? '#22c55e' : '#ef4444',
                  border: 'none', borderRadius: 10,
                  color: placing ? '#6b7280' : betSide === 'YES' ? '#000' : '#fff',
                  fontSize: 15, fontWeight: 700,
                  cursor: placing ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {placing ? 'Confirming on Solana…' : `Place Bet — ${betSide}`}
              </button>

              <p style={{ color: '#4b5563', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                Devnet only · SOL sent to escrow on confirmation
              </p>
            </>
          )}
        </div>

        {/* ── Live bet feed ── */}
        <div style={{ ...card, marginBottom: 24 }}>
          <h2 style={{ color: '#f3f4f6', fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
            Live Bets{bets.length > 0 && <span style={{ color: '#4b5563', fontWeight: 400 }}> · {bets.length}</span>}
          </h2>

          {bets.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: '10px 0' }}>
              No bets yet — be the first! 🥝
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bets.map(bet => (
                <div key={bet.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  background: '#0f172a', border: '1px solid #1f2937', borderRadius: 8,
                }}>
                  {/* Side badge */}
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 700,
                    background: bet.side === 'YES' ? '#14532d' : '#1c0a0a',
                    color: bet.side === 'YES' ? '#4ade80' : '#f87171',
                    border: `1px solid ${bet.side === 'YES' ? '#166534' : '#7f1d1d'}`,
                    flexShrink: 0,
                  }}>
                    {bet.side}
                  </span>

                  {/* Wallet */}
                  <span style={{ color: '#9ca3af', fontSize: 12, fontFamily: 'monospace', flex: 1 }}>
                    {abbrev(bet.bettor_wallet)}
                  </span>

                  {/* Amount */}
                  <span style={{ color: '#f3f4f6', fontSize: 13, fontWeight: 600 }}>
                    {bet.amount_sol.toFixed(4)} SOL
                  </span>

                  {/* Time */}
                  <span style={{ color: '#4b5563', fontSize: 11, flexShrink: 0 }}>
                    {timeAgo(bet.created_at)}
                  </span>

                  {/* Tx link */}
                  {bet.tx_signature && (
                    <a
                      href={`https://explorer.solana.com/tx/${bet.tx_signature}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#4ade80', fontSize: 11, flexShrink: 0 }}
                      title={bet.tx_signature}
                    >
                      ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 14,
  padding: '18px 16px',
  marginBottom: 12,
}

const backBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#9ca3af',
  fontSize: 14,
  cursor: 'pointer',
  padding: '0 0 14px',
  display: 'block',
}

const badgeBase: React.CSSProperties = {
  padding: '3px 10px',
  borderRadius: 8,
  fontWeight: 500,
  display: 'inline-block',
}

const shimmerBlock: React.CSSProperties = {
  background: 'linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s infinite',
  borderRadius: 6,
  width: '100%',
}
