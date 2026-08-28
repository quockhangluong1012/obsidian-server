import { useEffect, useState } from 'react'
import { useVault, type VaultState } from './useVault'

export function useStoreSelector<T>(selector: (s: VaultState) => T): T {
  const [v, setV] = useState<T>(() => selector(useVault.getState()))
  useEffect(() => {
    return useVault.subscribe((s) => setV(selector(s as VaultState)))
  }, [selector])
  return v
}
