type ToggleState = {
  collapsed: boolean
  expiresAt: number
}

type TrackerOptions = {
  manualOverrideTtlMs?: number
  programmaticToggleTtlMs?: number
  now?: () => number
}

export function createManualGroupToggleTracker({
  manualOverrideTtlMs = 4000,
  programmaticToggleTtlMs = 4000,
  now = () => Date.now()
}: TrackerOptions = {}) {
  const manualOverridesByGroupId = new Map<number, ToggleState>()
  const pendingProgrammaticTogglesByGroupId = new Map<number, ToggleState>()

  function pruneExpiredEntries(map: Map<number, ToggleState>, currentTime: number) {
    for (const [groupId, state] of map.entries()) {
      if (state.expiresAt <= currentTime) {
        map.delete(groupId)
      }
    }
  }

  function recordProgrammaticToggle(groupId: number, collapsed: boolean) {
    const currentTime = now()
    pruneExpiredEntries(pendingProgrammaticTogglesByGroupId, currentTime)

    pendingProgrammaticTogglesByGroupId.set(groupId, {
      collapsed,
      expiresAt: currentTime + programmaticToggleTtlMs
    })
  }

  function recordObservedToggle(groupId: number, collapsed: boolean) {
    const currentTime = now()

    pruneExpiredEntries(pendingProgrammaticTogglesByGroupId, currentTime)
    const pendingProgrammaticToggle =
      pendingProgrammaticTogglesByGroupId.get(groupId)

    if (pendingProgrammaticToggle?.collapsed === collapsed) {
      pendingProgrammaticTogglesByGroupId.delete(groupId)
      return 'programmatic' as const
    }

    pruneExpiredEntries(manualOverridesByGroupId, currentTime)
    manualOverridesByGroupId.set(groupId, {
      collapsed,
      expiresAt: currentTime + manualOverrideTtlMs
    })

    return 'manual' as const
  }

  function shouldSkipAutomaticToggle(groupId: number, collapsed: boolean) {
    const currentTime = now()
    pruneExpiredEntries(manualOverridesByGroupId, currentTime)

    const manualOverride = manualOverridesByGroupId.get(groupId)
    return manualOverride?.collapsed !== undefined
      ? manualOverride.collapsed !== collapsed
      : false
  }

  return {
    recordObservedToggle,
    recordProgrammaticToggle,
    shouldSkipAutomaticToggle
  }
}
