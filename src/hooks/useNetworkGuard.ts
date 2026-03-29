import { useConnection } from '@solana/wallet-adapter-react'
import { useCallback } from 'react'

/**
 * Returns a function that resolves true if we're on devnet,
 * or throws a human-readable error if we're on mainnet/testnet.
 */
export function useNetworkGuard() {
  const { connection } = useConnection()

  const assertDevnet = useCallback(async (): Promise<void> => {
    const genesis = await connection.getGenesisHash()
    // Devnet genesis hash (stable)
    const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
    if (genesis !== DEVNET_GENESIS) {
      throw new Error(
        'Wrong network — please switch Phantom to Devnet (Settings → Developer Settings → Change Network)'
      )
    }
  }, [connection])

  return { assertDevnet }
}
