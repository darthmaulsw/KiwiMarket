import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import {
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js'
import BountyCard from '../components/BountyCard'
import { useNetworkGuard } from '../hooks/useNetworkGuard'
import { ESCROW_WALLET } from '../constants/config'
import type { Bounty } from '../hooks/useBounties'

// ─── Expiry options ─────────────────────────────────────────────────────────

const EXPIRY_OPTIONS = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour',     value: 60 },
  { label: '2 hours',    value: 120 },
  { label: '4 hours',    value: 240 },
]

// ─── Validation ─────────────────────────────────────────────────────────────

interface FormErrors {
  title?: string
  description?: string
  reward?: string
}

function validate(title: string, description: string, reward: string): FormErrors {
  const errors: FormErrors = {}
  if (!title.trim()) {
    errors.title = 'Title is required'
  } else if (title.trim().length < 10) {
    errors.title = `At least 10 characters (${title.trim().length}/10)`
  }
  if (!description.trim()) {
    errors.description = 'Description is required'
  } else if (description.trim().length < 20) {
    errors.description = `At least 20 characters (${description.trim().length}/20)`
  }
  const r = parseFloat(reward)
  if (!reward || isNaN(r)) {
    errors.reward = 'Reward amount is required'
  } else if (r < 0.05) {
    errors.reward = 'Minimum reward is 0.05 SOL'
  } else if (r > 2.0) {
    errors.reward = 'Maximum reward is 2.0 SOL'
  }
  return errors
}

// ─── Shared input styles ────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: '100%',
  background: '#1f2937',
  border: '1px solid #374151',
  borderRadius: 10,
  padding: '10px 14px',
  color: '#f3f4f6',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
}

const inputError: React.CSSProperties = {
  ...inputBase,
  border: '1px solid #f87171',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#9ca3af',
  fontSize: 12,
  marginBottom: 6,
}

const errorStyle: React.CSSProperties = {
  color: '#f87171',
  fontSize: 11,
  marginTop: 4,
}

const counterStyle = (cur: number, max: number): React.CSSProperties => ({
  fontSize: 11,
  color: cur > max * 0.9 ? '#fbbf24' : '#4b5563',
  textAlign: 'right',
  marginTop: 3,
})

// ─── Component ──────────────────────────────────────────────────────────────

export default function Create() {
  const navigate = useNavigate()
  const { publicKey, sendTransaction, connected } = useWallet()
  const { connection } = useConnection()
  const { assertDevnet } = useNetworkGuard()

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reward, setReward] = useState('0.10')
  const [expiry, setExpiry] = useState(30)
  const [touched, setTouched] = useState({ title: false, description: false, reward: false })

  // Submission state
  const [posting, setPosting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const errors = validate(title, description, reward)
  const isValid = Object.keys(errors).length === 0

  function touch(field: keyof typeof touched) {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  function resetForm() {
    setTitle('')
    setDescription('')
    setReward('0.10')
    setExpiry(30)
    setTouched({ title: false, description: false, reward: false })
  }

  // ── Live preview bounty object ────────────────────────────────────────────
  const previewBounty: Bounty = useMemo(() => ({
    id: 0,
    title: title || 'Your bounty title will appear here…',
    description,
    reward_sol: parseFloat(reward) || 0,
    yes_pool: 1.0,
    no_pool: 1.0,
    yes_price: 0.5,
    no_price: 0.5,
    poster_wallet: publicKey?.toBase58() ?? '11111111111111111111111111111111',
    status: 'open',
    expiry_at: new Date(Date.now() + expiry * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  }), [title, description, reward, expiry, publicKey])

  // ── Submit handler ────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || !publicKey || posting) return

    // Touch all fields to reveal any remaining errors
    setTouched({ title: true, description: true, reward: true })
    if (!isValid) return

    setPosting(true)
    try {
      // 0. Ensure wallet is on devnet
      await assertDevnet()

      const rewardSol = parseFloat(reward)
      const lamports = Math.round(rewardSol * LAMPORTS_PER_SOL)

      // 1. Build transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey })
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

      // 4. Record in backend
      const res = await fetch('/bounties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          reward_sol: rewardSol,
          expiry_minutes: expiry,
          poster_wallet: publicKey.toBase58(),
          tx_signature: signature,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? 'Backend error')
      }

      const created = await res.json()

      // 5. Success
      showToast("Bounty posted! 🥝 Let's see if anyone can do it...", 'success')
      resetForm()
      setTimeout(() => navigate(`/bounty/${created.id}`), 1500)
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase()
        if (msg.includes('rejected') || msg.includes('user rejected') || msg.includes('cancelled')) {
          showToast('Transaction cancelled — bounty not posted', 'error')
        } else if (msg.includes('insufficient') || msg.includes('0x1')) {
          showToast(`You need at least ${reward} SOL to post this bounty`, 'error')
        } else {
          showToast('Failed to post bounty — please try again', 'error')
          console.error(err)
        }
      }
    } finally {
      setPosting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#14532d' : '#1c0505',
          color: toast.type === 'success' ? '#4ade80' : '#fca5a5',
          border: `1px solid ${toast.type === 'success' ? '#166534' : '#7f1d1d'}`,
          borderRadius: 10, padding: '10px 20px', fontSize: 14,
          zIndex: 300, whiteSpace: 'nowrap', fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px 32px' }}>
        <h2 style={{ color: '#f3f4f6', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          Post a Bounty 🥝
        </h2>
        <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 22 }}>
          Stake SOL. Challenge the world. If nobody fulfills it — you keep the pot.
        </p>

        {/* Connect wallet notice */}
        {!connected && (
          <div style={{
            background: '#0f172a', border: '1px solid #1d4ed8',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
            color: '#93c5fd', fontSize: 13, textAlign: 'center',
          }}>
            Connect your wallet to post a bounty 🥝
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── Title ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <label style={labelStyle}>Challenge title</label>
              <span style={counterStyle(title.length, 100)}>{title.length}/100</span>
            </div>
            <input
              type="text"
              value={title}
              maxLength={100}
              placeholder='I bet nobody brings me a kiwi in 30 minutes...'
              disabled={!connected || posting}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => touch('title')}
              style={touched.title && errors.title ? inputError : inputBase}
            />
            {touched.title && errors.title && (
              <div style={errorStyle}>⚠ {errors.title}</div>
            )}
          </div>

          {/* ── Description ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <label style={labelStyle}>Fulfillment conditions</label>
              <span style={counterStyle(description.length, 300)}>{description.length}/300</span>
            </div>
            <textarea
              value={description}
              maxLength={300}
              rows={3}
              placeholder='Describe exactly what counts as fulfilling this bounty...'
              disabled={!connected || posting}
              onChange={e => setDescription(e.target.value)}
              onBlur={() => touch('description')}
              style={{
                ...(touched.description && errors.description ? inputError : inputBase),
                resize: 'vertical',
                lineHeight: 1.55,
              }}
            />
            {touched.description && errors.description && (
              <div style={errorStyle}>⚠ {errors.description}</div>
            )}
          </div>

          {/* ── Reward ── */}
          <div>
            <label style={labelStyle}>Reward (SOL) — you stake this upfront</label>
            <div style={{
              display: 'flex', alignItems: 'center',
              background: '#1f2937',
              border: `1px solid ${touched.reward && errors.reward ? '#f87171' : '#374151'}`,
              borderRadius: 10, padding: '10px 14px',
            }}>
              <input
                type="number"
                value={reward}
                min="0.05"
                max="2.0"
                step="0.05"
                disabled={!connected || posting}
                onChange={e => setReward(e.target.value)}
                onBlur={() => touch('reward')}
                style={{
                  background: 'transparent', border: 'none',
                  color: '#f3f4f6', fontSize: 16, fontWeight: 600,
                  flex: 1, outline: 'none',
                }}
              />
              <span style={{ color: '#4ade80', fontSize: 14, fontWeight: 600 }}>SOL</span>
            </div>
            {touched.reward && errors.reward && (
              <div style={errorStyle}>⚠ {errors.reward}</div>
            )}
            <div style={{ color: '#4b5563', fontSize: 11, marginTop: 4 }}>
              Min 0.05 · Max 2.0 · Sent to escrow on confirmation
            </div>
          </div>

          {/* ── Expiry ── */}
          <div>
            <label style={labelStyle}>Time limit</label>
            <select
              value={expiry}
              disabled={!connected || posting}
              onChange={e => setExpiry(parseInt(e.target.value))}
              style={{ ...inputBase, cursor: 'pointer' }}
            >
              {EXPIRY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* ── Wallet info ── */}
          {connected && publicKey && (
            <div style={{
              background: '#0f172a', border: '1px solid #1f2937',
              borderRadius: 10, padding: '10px 14px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ color: '#6b7280', fontSize: 12 }}>Posting from</span>
              <span style={{ color: '#4ade80', fontSize: 12, fontFamily: 'monospace' }}>
                {publicKey.toBase58().slice(0, 6)}…{publicKey.toBase58().slice(-4)}
              </span>
            </div>
          )}

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={!connected || !isValid || posting}
            style={{
              padding: '13px 0',
              background: connected && isValid && !posting ? '#22c55e' : '#1f2937',
              border: 'none', borderRadius: 10,
              color: connected && isValid && !posting ? '#000' : '#4b5563',
              fontSize: 15, fontWeight: 700,
              cursor: connected && isValid && !posting ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s',
            }}
          >
            {posting ? 'Confirming on Solana…' : 'Post Bounty 🥝'}
          </button>
        </form>

        {/* ── Live preview ── */}
        <div style={{ marginTop: 28 }}>
          <div style={{ color: '#4b5563', fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: '#1f2937' }} />
            <span>Live preview</span>
            <div style={{ flex: 1, height: 1, background: '#1f2937' }} />
          </div>
          <BountyCard bounty={previewBounty} preview />
        </div>
      </div>
    </>
  )
}
