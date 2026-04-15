import { RuntimeReadMode } from '@/util/runtime-consistency'
import { useStorage } from './chrome/storage'

export function useRuntimeReadMode() {
  const { loaded, data } = useStorage<RuntimeReadMode>(
    'runtimeReadMode',
    'hybrid_read_through',
    {
      storage: 'local'
    }
  )

  return {
    loaded,
    data
  }
}
