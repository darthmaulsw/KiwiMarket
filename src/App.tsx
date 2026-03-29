import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import Feed from './pages/Feed'
import Create from './pages/Create'
import Wallet from './pages/Wallet'
import Profile from './pages/Profile'
import BountyDetail from './pages/BountyDetail'

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      {/* Top Nav */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: '#0f0f0f',
        borderBottom: '1px solid #1f2937',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{
            width: 28, height: 28, background: '#22c55e',
            borderRadius: 8, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 16,
          }}>
            🥝
          </div>
          <span style={{ color: '#fff', fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px' }}>
            KiwiMarket 🥝
          </span>
        </NavLink>
        <WalletMultiButton />
      </nav>

      {/* Page Content */}
      <main style={{ flex: 1, paddingBottom: 80 }}>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/bounty/:id" element={<BountyDetail />} />
          <Route path="/create" element={<Create />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>

      {/* Bottom Nav */}
      <nav style={{
        display: 'flex',
        background: '#0f0f0f',
        borderTop: '1px solid #1f2937',
        padding: '6px 0 12px',
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 100,
      }}>
        <TabItem label="Market"  icon="🏪" to="/"        active={isActive('/')}        navigate={navigate} />
        <TabItem label="Wallet"  icon="👛" to="/wallet"  active={isActive('/wallet')}  navigate={navigate} />
        <TabItem label="Post"    icon="✏️" to="/create"  active={isActive('/create')}  navigate={navigate} />
        <TabItem label="Profile" icon="👤" to="/profile" active={isActive('/profile')} navigate={navigate} />
      </nav>
    </div>
  )
}

function TabItem({
  label, icon, to, active, navigate,
}: {
  label: string
  icon: string
  to: string
  active: boolean
  navigate: (path: string) => void
}) {
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
      <div style={{
        width: 26, height: 26,
        borderRadius: 7,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        background: active ? '#14532d' : 'transparent',
        transition: 'background 0.15s',
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: 10,
        color: active ? '#22c55e' : '#6b7280',
        transition: 'color 0.15s',
      }}>
        {label}
      </span>
    </button>
  )
}
