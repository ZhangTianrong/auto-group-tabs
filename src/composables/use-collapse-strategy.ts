// CHANGES START HERE
import { useStorage } from './chrome/storage'

export type CollapseStrategy = 'disabled' | 'collapse_inactive'

export function useCollapseStrategy() {
  const { loaded, data } = useStorage<CollapseStrategy>('collapseStrategy', 'disabled', {
    storage: 'sync'
  })

  return {
    loaded,
    data
  }
}
// CHANGES END HERE