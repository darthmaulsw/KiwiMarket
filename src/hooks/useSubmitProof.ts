import { useState, useCallback } from 'react'

export type ProofStatus = 'idle' | 'uploading' | 'pending' | 'verified' | 'rejected' | 'error'

export interface ProofResult {
  proof_id: number
  status: string
  verdict?: string | null
  reasoning?: string | null
}

async function compressImage(file: File, maxDimension = 1024, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height / width) * maxDimension)
          width = maxDimension
        } else {
          width = Math.round((width / height) * maxDimension)
          height = maxDimension
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
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
      // Compress image before upload (phone photos can be 10+ MB as base64)
      const base64 = await compressImage(imageFile)

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
