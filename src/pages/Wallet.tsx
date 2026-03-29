import { useKiwiWallet } from '../context/WalletContext'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

const MOCK_ACTIVITY = [
  { id: 1, type: 'Bet YES', market: 'Fresh kiwi delivery in 2h', amount: '-0.10 SOL', status: 'pending', time: '5 min ago' },
  { id: 2, type: 'Won', market: 'Rubik\'s cube under 30s', amount: '+0.34 SOL', status: 'won', time: '2 hrs ago' },
  { id: 3, type: 'Bet NO', market: 'Unicycle across Brooklyn Bridge', amount: '-0.20 SOL', status: 'pending', time: '1 day ago' },
  { id: 4, type: 'Posted Bounty', market: '"I bet no one can..."', amount: '-0.50 SOL', status: 'open', time: '3 days ago' },
]

export default function Wallet() {
  const { connected, publicKey, disconnect } = useKiwiWallet()

  const statusColor = (status: string) => {
    if (status === 'won') return '#4ade80'
    if (status === 'pending') return '#fbbf24'
    return '#9ca3af'
  }

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
        <div style={{ fontSize: 40 }}>👛</div>
        <h2 style={{ color: '#f3f4f6', fontSize: 18, fontWeight: 600 }}>My Wallet</h2>
        <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center' }}>
          Connect your wallet to see your balance and activity.
        </p>
        <WalletMultiButton />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
      <h2 style={{ color: '#f3f4f6', fontSize: 18, fontWeight: 600, marginBottom: 20 }}>My Wallet</h2>

      {/* Balance card */}
      <div
        style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 16,
          padding: '20px 18px',
          marginBottom: 16,
        }}
      >
        <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 6 }}>Total Balance</div>
        <div style={{ color: '#4ade80', fontSize: 32, fontWeight: 700, marginBottom: 4 }}>4.82 SOL</div>
        <div style={{ color: '#9ca3af', fontSize: 12 }}>≈ $482.00 USD</div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Active Bets', value: '2', color: '#fbbf24' },
          { label: 'Total Won', value: '1.24 SOL', color: '#4ade80' },
          { label: 'Win Rate', value: '67%', color: '#60a5fa' },
        ].map(s => (
          <div
            key={s.label}
            style={{
              flex: 1,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 12,
              padding: '12px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{ color: s.color, fontSize: 16, fontWeight: 600, marginBottom: 2 }}>{s.value}</div>
            <div style={{ color: '#6b7280', fontSize: 10 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Wallet address */}
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #1f2937',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <span style={{ color: '#6b7280', fontSize: 12 }}>Address</span>
        <span style={{ color: '#4ade80', fontSize: 12, fontFamily: 'monospace' }}>
          {publicKey?.toBase58().slice(0, 8)}…{publicKey?.toBase58().slice(-6)}
        </span>
      </div>

      {/* Activity */}
      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 10 }}>Recent Activity</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {MOCK_ACTIVITY.map(a => (
          <div
            key={a.id}
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
            <div>
              <div style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 500 }}>{a.type}</div>
              <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>{a.market}</div>
              <div style={{ color: '#4b5563', fontSize: 10, marginTop: 1 }}>{a.time}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  color: a.amount.startsWith('+') ? '#4ade80' : '#f3f4f6',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {a.amount}
              </div>
              <div
                style={{
                  color: statusColor(a.status),
                  fontSize: 10,
                  marginTop: 3,
                  textTransform: 'capitalize',
                }}
              >
                {a.status}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Disconnect */}
      <button
        onClick={disconnect}
        style={{
          width: '100%',
          padding: '10px 0',
          background: 'transparent',
          border: '1px solid #374151',
          borderRadius: 10,
          color: '#9ca3af',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Disconnect Wallet
      </button>
    </div>
  )
}
