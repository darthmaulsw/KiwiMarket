import { useRef, useState, useCallback } from 'react'
import { useSubmitProof, ProofStatus } from '../hooks/useSubmitProof'

interface Props {
  bountyId: number
  bountyTitle: string
  fulfillerWallet: string
  onClose: () => void
  onResolved: () => void
}

export default function FulfillModal({
  bountyId,
  bountyTitle,
  fulfillerWallet,
  onClose,
  onResolved,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const { status, result, error, submit, reset } = useSubmitProof()

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreview(url)
    reset()
  }, [reset])

  const handleSubmit = useCallback(async () => {
    if (!selectedFile) return
    await submit(bountyId, fulfillerWallet, selectedFile)
  }, [selectedFile, bountyId, fulfillerWallet, submit])

  function handleClose() {
    if (status === 'uploading' || status === 'pending') return
    if (status === 'verified') onResolved()
    onClose()
  }

  const isDone = status === 'verified' || status === 'rejected' || status === 'error'
  const canSubmit = !!selectedFile && status === 'idle'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          zIndex: 400,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(92vw, 420px)',
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: 16,
        padding: '22px 20px',
        zIndex: 401,
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>Fulfill bounty</div>
            <div style={{ color: '#f3f4f6', fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>
              {bountyTitle}
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={status === 'uploading' || status === 'pending'}
            style={{
              background: 'transparent', border: 'none',
              color: '#6b7280', fontSize: 20, cursor: 'pointer',
              padding: '0 0 0 12px', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Upload area */}
        {status !== 'verified' && (
          <>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${preview ? '#374151' : '#1f2937'}`,
                borderRadius: 12,
                padding: preview ? 0 : '32px 16px',
                textAlign: 'center',
                cursor: status === 'uploading' || status === 'pending' ? 'not-allowed' : 'pointer',
                marginBottom: 14,
                overflow: 'hidden',
                background: '#0f172a',
                transition: 'border-color 0.2s',
              }}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Proof preview"
                  style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                  <div style={{ color: '#9ca3af', fontSize: 14, marginBottom: 4 }}>
                    Tap to take a photo or choose a file
                  </div>
                  <div style={{ color: '#4b5563', fontSize: 12 }}>
                    JPG, PNG, WebP — max 10 MB
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {preview && status === 'idle' && (
              <button
                onClick={() => { setPreview(null); setSelectedFile(null) }}
                style={{
                  background: 'transparent', border: 'none',
                  color: '#6b7280', fontSize: 12, cursor: 'pointer',
                  display: 'block', margin: '-8px auto 10px', padding: '2px 0',
                }}
              >
                Remove photo
              </button>
            )}
          </>
        )}

        {/* Status display */}
        {(status === 'pending' || status === 'uploading') && (
          <div style={{
            background: '#0f172a', border: '1px solid #1f2937',
            borderRadius: 10, padding: '14px 16px', marginBottom: 14,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>
              {status === 'uploading' ? '⬆️' : '🤖'}
            </div>
            <div style={{ color: '#f3f4f6', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              {status === 'uploading' ? 'Uploading photo…' : 'Claude is verifying your proof…'}
            </div>
            <div style={{ color: '#9ca3af', fontSize: 12 }}>
              {status === 'uploading' ? 'Please wait' : 'This usually takes 5–15 seconds'}
            </div>
          </div>
        )}

        {status === 'verified' && result && (
          <div style={{
            background: '#052e16', border: '1px solid #166534',
            borderRadius: 10, padding: '16px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>✅</div>
            <div style={{ color: '#4ade80', fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>
              Bounty Fulfilled!
            </div>
            <div style={{ color: '#86efac', fontSize: 13, lineHeight: 1.5, textAlign: 'center' }}>
              {result.reasoning}
            </div>
            <div style={{ color: '#4ade80', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
              SOL payout is on its way to your wallet 🎉
            </div>
          </div>
        )}

        {status === 'rejected' && result && (
          <div style={{
            background: '#1c0a0a', border: '1px solid #7f1d1d',
            borderRadius: 10, padding: '16px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>❌</div>
            <div style={{ color: '#f87171', fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>
              Proof Rejected
            </div>
            <div style={{ color: '#fca5a5', fontSize: 13, lineHeight: 1.5, textAlign: 'center' }}>
              {result.reasoning}
            </div>
            <button
              onClick={() => { reset(); setPreview(null); setSelectedFile(null) }}
              style={{
                display: 'block', margin: '12px auto 0',
                background: 'transparent', border: '1px solid #7f1d1d',
                color: '#f87171', fontSize: 13, borderRadius: 8,
                padding: '6px 16px', cursor: 'pointer',
              }}
            >
              Try again with a different photo
            </button>
          </div>
        )}

        {status === 'error' && (
          <div style={{
            background: '#1c1400', border: '1px solid #854d0e',
            borderRadius: 10, padding: '14px', marginBottom: 14, textAlign: 'center',
          }}>
            <div style={{ color: '#fbbf24', fontSize: 13 }}>{error}</div>
            <button
              onClick={() => { reset(); setPreview(null); setSelectedFile(null) }}
              style={{
                display: 'block', margin: '10px auto 0',
                background: 'transparent', border: '1px solid #854d0e',
                color: '#fbbf24', fontSize: 12, borderRadius: 8,
                padding: '5px 14px', cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Action buttons */}
        {status === 'verified' ? (
          <button
            onClick={handleClose}
            style={{
              width: '100%', padding: '12px 0',
              background: '#22c55e', border: 'none',
              borderRadius: 10, color: '#000',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Done 🥝
          </button>
        ) : canSubmit ? (
          <button
            onClick={handleSubmit}
            style={{
              width: '100%', padding: '12px 0',
              background: '#22c55e', border: 'none',
              borderRadius: 10, color: '#000',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Submit Proof for AI Verification
          </button>
        ) : !isDone ? (
          <button
            disabled
            style={{
              width: '100%', padding: '12px 0',
              background: '#1f2937', border: '1px solid #374151',
              borderRadius: 10, color: '#4b5563',
              fontSize: 14, cursor: 'not-allowed',
            }}
          >
            {status === 'uploading' || status === 'pending'
              ? 'Verifying…'
              : 'Select a photo first'}
          </button>
        ) : null}
      </div>
    </>
  )
}
