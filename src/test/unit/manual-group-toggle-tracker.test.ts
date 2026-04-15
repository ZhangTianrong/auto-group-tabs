import { expect, it } from 'vitest'
import { createManualGroupToggleTracker } from '@/util/manual-group-toggle-tracker'

it('suppresses automatic toggles that would undo a recent manual toggle', () => {
  let currentTime = 1_000
  const tracker = createManualGroupToggleTracker({
    now: () => currentTime
  })

  expect(tracker.recordObservedToggle(42, false)).toBe('manual')
  expect(tracker.shouldSkipAutomaticToggle(42, true)).toBe(true)
  expect(tracker.shouldSkipAutomaticToggle(42, false)).toBe(false)
})

it('does not treat extension-initiated toggles as manual overrides', () => {
  let currentTime = 1_000
  const tracker = createManualGroupToggleTracker({
    now: () => currentTime
  })

  tracker.recordProgrammaticToggle(42, true)

  expect(tracker.recordObservedToggle(42, true)).toBe('programmatic')
  expect(tracker.shouldSkipAutomaticToggle(42, false)).toBe(false)
})

it('expires manual overrides after the grace window', () => {
  let currentTime = 1_000
  const tracker = createManualGroupToggleTracker({
    manualOverrideTtlMs: 500,
    now: () => currentTime
  })

  tracker.recordObservedToggle(42, true)
  expect(tracker.shouldSkipAutomaticToggle(42, false)).toBe(true)

  currentTime = 1_600

  expect(tracker.shouldSkipAutomaticToggle(42, false)).toBe(false)
})
