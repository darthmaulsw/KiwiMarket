import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import Feed from './pages/Feed'
import Create from './pages/Create'
import Wallet from './pages/Wallet'
import Profile from './pages/Profile'

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 20px',
  background: '#0f0f0f',
  borderBottom: '1px solid #1f2937',
  position: 'sticky',
  top: 0,
  zIndex: 100,
}

const logoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  textDecoration: 'none',
}

const logoIconStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  background: '#22c55e',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
}

const logoTextStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: 17,
  fontWeight: 600,
  letterSpacing: '-0.3px',
}

const bottomNavStyle: React.CSSProperties = {
  display: 'flex',
  background: '#0f0f0f',
  borderTop: '1px solid #1f2937',
  padding: '6px 0 12px',
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 100,
}

export default function App() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      {/* Top Nav */}
      <nav style={navStyle}>
        <NavLink to="/" style={logoStyle}>
          <div style={logoIconStyle}>🥝</div>
          <span style={logoTextStyle}>KiwiMarket🥝</span>
        </NavLink>
        <WalletMultiButton />
      </nav>

      {/* Page Content */}
      <main style={{ flex: 1, paddingBottom: 80 }}>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/create" element={<Create />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>

      {/* Bottom Nav */}
      <nav style={bottomNavStyle}>
        <TabItem label="Market" icon="🏪" to="/" navigate={navigate} />
        <TabItem label="Wallet" icon="👛" to="/wallet" navigate={navigate} />
        <TabItem label="Post" icon="✏️" to="/create" navigate={navigate} />
        <TabItem label="Profile" icon="👤" to="/profile" navigate={navigate} />
      </nav>
    </div>
  )
}

function TabItem({
  label,
  icon,
  to,
  navigate,
}: {
  label: string
  icon: string
  to: string
  navigate: (path: string) => void
}) {
  const isActive = window.location.pathname === to

  return (
    <button
      onClick={() => navigate(to)}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 0',
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          background: isActive ? '#14532d' : 'transparent',
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: 10,
          color: isActive ? '#22c55e' : '#6b7280',
        }}
      >
        {label}
      </span>
    </button>
  )
}
