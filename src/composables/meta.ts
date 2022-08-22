import { JsonValue } from 'type-fest'
import { computed, nextTick, ref, toRaw, UnwrapRef } from 'vue'

/**
 * A ref that automatically resets to its initial value after one tick
 */
export function tickResetRef<T>(initialValue: T) {
  const value = ref(initialValue)

  return computed({
    get: () => value.value,
    set: newValue => {
      value.value = newValue

      nextTick(() => {
        value.value = initialValue as UnwrapRef<T>
      })
    }
  })
}

/**
 * Like toRaw, but recursive
 */
export function toRawDeep<T extends JsonValue>(value: T): T {
  const rawValue = toRaw(value)
  if (typeof rawValue !== 'object' || rawValue === null) return rawValue

  if (Array.isArray(rawValue)) {
    return rawValue.map(toRawDeep) as T
  } else {
    return Object.fromEntries(
      Object.entries(rawValue).map(([key, value]) => [
        key,
        toRawDeep(value as JsonValue)
      ])
    ) as T
  }
}
