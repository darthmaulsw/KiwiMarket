import { useBounties } from '../hooks/useBounties'
import BountyCard from '../components/BountyCard'

// ─── Skeleton card shown while loading ────────────────────────────────────
function SkeletonCard() {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    borderRadius: 6,
  }

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
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ ...shimmer, width: 80, height: 12 }} />
        <div style={{ ...shimmer, width: 44, height: 18 }} />
      </div>
      <div style={{ ...shimmer, width: '90%', height: 16 }} />
      <div style={{ ...shimmer, width: '70%', height: 14 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ ...shimmer, width: 100, height: 24 }} />
        <div style={{ ...shimmer, width: 80, height: 24 }} />
      </div>
      <div style={{ ...shimmer, width: '100%', height: 6 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ ...shimmer, flex: 1, height: 36 }} />
        <div style={{ ...shimmer, flex: 1, height: 36 }} />
      </div>
    </div>
  )
}

export default function Feed() {
  const { bounties, loading, error } = useBounties()

  return (
    <>
      {/* Shimmer keyframe injected once */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 14px 0' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <span style={{ color: '#f3f4f6', fontSize: 17, fontWeight: 700 }}>
            Live Bounties
          </span>
          <span
            style={{
              background: '#14532d',
              color: '#4ade80',
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 10,
              border: '1px solid #166534',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            LIVE
          </span>
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              background: '#1c0505',
              border: '1px solid #7f1d1d',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#fca5a5',
              fontSize: 13,
              marginBottom: 14,
            }}
          >
            ⚠️ {error} — retrying every 5s
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && bounties.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              paddingTop: 60,
              color: '#6b7280',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 40 }}>🥝</span>
            <p style={{ fontSize: 15, fontWeight: 500, color: '#9ca3af' }}>
              No open bounties yet — be the first to post one! 🥝
            </p>
          </div>
        )}

        {/* Bounty cards grid */}
        {!loading && bounties.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
            {bounties.map(b => (
              <BountyCard key={b.id} bounty={b} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
