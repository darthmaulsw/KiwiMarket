import { useKiwiWallet } from '../context/WalletContext'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

const MOCK_BETS = [
  { id: 1, title: '"Fresh kiwi delivery in 2h"', side: 'YES', amount: '0.10 SOL', status: 'In Progress' },
  { id: 2, title: '"Unicycle across Brooklyn Bridge"', side: 'NO', amount: '0.20 SOL', status: 'In Progress' },
  { id: 3, title: '"Rubik\'s cube under 30 seconds"', side: 'YES', amount: '0.10 SOL', status: 'Won' },
]

export default function Profile() {
  const { connected, publicKey } = useKiwiWallet()

  if (!connected) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: '40px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 40 }}>👤</div>
        <h2 style={{ color: '#f3f4f6', fontSize: 18, fontWeight: 600 }}>My Profile</h2>
        <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center' }}>
          Connect your wallet to view your profile.
        </p>
        <WalletMultiButton />
      </div>
    )
  }

  const shortKey = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
    : ''

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
      {/* Avatar + handle */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#14532d',
            color: '#4ade80',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 10,
            border: '2px solid #166534',
          }}
        >
          🥝
        </div>
        <div style={{ color: '#f3f4f6', fontSize: 16, fontWeight: 600 }}>@{shortKey}.sol</div>
        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4, fontFamily: 'monospace' }}>
          {publicKey?.toBase58().slice(0, 12)}…
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Bounties Posted', value: '4' },
          { label: 'Bets Placed', value: '12' },
          { label: 'Win Rate', value: '67%' },
        ].map(s => (
          <div
            key={s.label}
            style={{
              flex: 1,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 12,
              padding: '14px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{ color: '#4ade80', fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{s.value}</div>
            <div style={{ color: '#6b7280', fontSize: 10 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Active / Recent Bets */}
      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 10 }}>My Bets</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MOCK_BETS.map(b => (
          <div
            key={b.id}
            style={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: 1, marginRight: 12 }}>
              <div style={{ color: '#e5e7eb', fontSize: 13 }}>{b.title}</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span
                  style={{
                    background: b.side === 'YES' ? '#14532d' : '#1f2937',
                    color: b.side === 'YES' ? '#4ade80' : '#9ca3af',
                    border: b.side === 'NO' ? '1px solid #374151' : 'none',
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                >
                  {b.side}
                </span>
                <span style={{ color: '#6b7280', fontSize: 11 }}>{b.amount}</span>
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                color: b.status === 'Won' ? '#4ade80' : '#fbbf24',
                background: b.status === 'Won' ? '#14532d' : '#1c1a00',
                border: `1px solid ${b.status === 'Won' ? '#166534' : '#854d0e'}`,
                padding: '3px 8px',
                borderRadius: 8,
                whiteSpace: 'nowrap',
              }}
            >
              {b.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
