import { createContext, useContext, ReactNode } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import type { PublicKey } from '@solana/web3.js'

interface KiwiWalletContextValue {
  publicKey: PublicKey | null
  connected: boolean
  disconnect: () => Promise<void>
}

const KiwiWalletContext = createContext<KiwiWalletContextValue | null>(null)

export function KiwiWalletProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected, disconnect } = useWallet()

  return (
    <KiwiWalletContext.Provider value={{ publicKey, connected, disconnect }}>
      {children}
    </KiwiWalletContext.Provider>
  )
}

export function useKiwiWallet(): KiwiWalletContextValue {
  const ctx = useContext(KiwiWalletContext)
  if (!ctx) {
    throw new Error('useKiwiWallet must be used inside KiwiWalletProvider')
  }
  return ctx
}
