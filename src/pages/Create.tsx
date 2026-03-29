import { useState } from 'react'
import { useKiwiWallet } from '../context/WalletContext'

export default function Create() {
  const { connected, publicKey } = useKiwiWallet()
  const [statement, setStatement] = useState('')
  const [bounty, setBounty] = useState('0.10')
  const [deadline, setDeadline] = useState('24')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!statement.trim()) return
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
    setStatement('')
    setBounty('0.10')
    setDeadline('24')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#f3f4f6',
    fontSize: 14,
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 6,
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
      <h2 style={{ color: '#f3f4f6', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Post a Bounty</h2>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
        Challenge the community. Someone will prove you wrong — or you keep the pot.
      </p>

      {!connected && (
        <div
          style={{
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 20,
            color: '#9ca3af',
            fontSize: 13,
          }}
        >
          Connect your wallet to post a bounty.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Statement */}
        <div>
          <label style={labelStyle}>Your challenge statement</label>
          <textarea
            value={statement}
            onChange={e => setStatement(e.target.value)}
            placeholder='"I bet no one will..."'
            rows={3}
            disabled={!connected}
            style={{
              ...inputStyle,
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
          />
        </div>

        {/* Bounty amount */}
        <div>
          <label style={labelStyle}>Bounty amount (SOL)</label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: 10,
              padding: '10px 14px',
            }}
          >
            <input
              type="number"
              value={bounty}
              min="0.01"
              step="0.01"
              onChange={e => setBounty(e.target.value)}
              disabled={!connected}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f3f4f6',
                fontSize: 14,
                flex: 1,
                outline: 'none',
              }}
            />
            <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 500 }}>SOL</span>
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label style={labelStyle}>Time limit (hours)</label>
          <select
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            disabled={!connected}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="1">1 hour</option>
            <option value="2">2 hours</option>
            <option value="6">6 hours</option>
            <option value="12">12 hours</option>
            <option value="24">24 hours</option>
            <option value="48">48 hours</option>
          </select>
        </div>

        {/* Wallet info */}
        {connected && publicKey && (
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #1f2937',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#6b7280', fontSize: 12 }}>Posting from</span>
            <span style={{ color: '#4ade80', fontSize: 12, fontFamily: 'monospace' }}>
              {publicKey.toBase58().slice(0, 6)}…{publicKey.toBase58().slice(-4)}
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={!connected || !statement.trim()}
          style={{
            padding: '12px 0',
            background: connected && statement.trim() ? '#22c55e' : '#1f2937',
            border: 'none',
            borderRadius: 10,
            color: connected && statement.trim() ? '#000' : '#4b5563',
            fontSize: 14,
            fontWeight: 600,
            cursor: connected && statement.trim() ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
        >
          {submitted ? '✓ Bounty posted!' : 'Post Bounty'}
        </button>
      </form>
    </div>
  )
}
