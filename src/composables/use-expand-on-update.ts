import { useStorage } from './chrome/storage'

export type ExpandOnUpdate = 'disabled' | 'enabled'

export function useExpandOnUpdate() {
  const { loaded, data } = useStorage<ExpandOnUpdate>('expandOnUpdate', 'disabled', {
    storage: 'sync'
  })

  return {
    loaded,
    data
  }
}
