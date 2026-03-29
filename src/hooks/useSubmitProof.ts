import { useState, useCallback } from 'react'

export type ProofStatus = 'idle' | 'uploading' | 'pending' | 'verified' | 'rejected' | 'error'

export interface ProofResult {
  proof_id: number
  status: string
  verdict?: string | null
  reasoning?: string | null
}

export function useSubmitProof() {
  const [status, setStatus] = useState<ProofStatus>('idle')
  const [result, setResult] = useState<ProofResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (
    bountyId: number,
    fulfillerWallet: string,
    imageFile: File,
  ) => {
    setStatus('uploading')
    setError(null)
    setResult(null)

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(imageFile)
      })

      // Upload to backend
      const uploadRes = await fetch('/proof/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounty_id: bountyId,
          fulfiller_wallet: fulfillerWallet,
          image_base64: base64,
        }),
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ detail: uploadRes.statusText }))
        throw new Error(err.detail ?? 'Upload failed')
      }

      const uploaded: ProofResult = await uploadRes.json()
      setStatus('pending')
      setResult(uploaded)

      // Poll for verdict every 2 seconds, up to 60 seconds
      const deadline = Date.now() + 60_000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const pollRes = await fetch(`/proof/status/${bountyId}`)
          if (!pollRes.ok) continue
          const polled: ProofResult = await pollRes.json()
          setResult(polled)
          if (polled.status === 'verified') {
            setStatus('verified')
            return
          }
          if (polled.status === 'rejected') {
            setStatus('rejected')
            return
          }
        } catch {
          // transient poll failure — keep retrying
        }
      }

      // Timed out
      setError('Verification is taking longer than expected. Check back soon.')
      setStatus('error')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }, [])

  function reset() {
    setStatus('idle')
    setResult(null)
    setError(null)
  }

  return { status, result, error, submit, reset }
}
