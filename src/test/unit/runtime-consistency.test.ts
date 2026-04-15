import { createGroupConfigurationMatcher } from '@/util/group-configurations'
import {
  clearGroupMutationLocksForTesting,
  findMatchingTabGroup,
  runWithGroupMutationLock,
  verifyAssignment
} from '@/util/runtime-consistency'
import { afterEach, expect, it, vi } from 'vitest'

const originalChrome = globalThis.chrome

function wait(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  clearGroupMutationLocksForTesting()
  ;(globalThis as any).chrome = originalChrome
})

it('prefers live tab group lookup over stale cache in hybrid mode', async () => {
  const groupMatcher = createGroupConfigurationMatcher({
    title: 'www.cashbackmonitor.com',
    color: 'purple'
  })
  const liveGroup = {
    id: 42,
    windowId: 7,
    title: 'www.cashbackmonitor.com',
    color: 'purple',
    collapsed: false
  } as chrome.tabGroups.TabGroup

  ;(globalThis as any).chrome = {
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      query: vi.fn(async () => [liveGroup])
    },
    tabs: {}
  }

  const result = await findMatchingTabGroup(7, groupMatcher, 'hybrid_read_through', {
    cacheTabGroupsByWindowId: { 7: [] },
    cacheTabGroups: []
  })

  expect(result?.id).toBe(liveGroup.id)
})

it('serializes concurrent mutations for the same window/group key', async () => {
  const order: string[] = []
  const groupKey = {
    title: 'www.cashbackmonitor.com',
    color: 'purple'
  } as const

  const first = runWithGroupMutationLock(7, groupKey, async () => {
    order.push('first-start')
    await wait(20)
    order.push('first-end')
    return 'first'
  })

  const second = runWithGroupMutationLock(7, groupKey, async () => {
    order.push('second-start')
    order.push('second-end')
    return 'second'
  })

  const result = await Promise.all([first, second])

  expect(result).toEqual(['first', 'second'])
  expect(order).toEqual([
    'first-start',
    'first-end',
    'second-start',
    'second-end'
  ])
})

it('finds matching groups across windows for merge-aware cleanup checks', async () => {
  const groupMatcher = createGroupConfigurationMatcher({
    title: 'www.cashbackmonitor.com',
    color: 'purple'
  })
  const crossWindowGroup = {
    id: 101,
    windowId: 99,
    title: 'www.cashbackmonitor.com',
    color: 'purple',
    collapsed: false
  } as chrome.tabGroups.TabGroup

  ;(globalThis as any).chrome = {
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      query: vi.fn(async () => [crossWindowGroup])
    },
    tabs: {}
  }

  const result = await findMatchingTabGroup(7, groupMatcher, 'hybrid_read_through', {
    includeAllWindows: true,
    cacheTabGroupsByWindowId: { 7: [] },
    cacheTabGroups: []
  })

  expect(result?.id).toBe(crossWindowGroup.id)
  expect(result?.windowId).toBe(99)
})

it('verifies assignment with short retries until tab/group state converges', async () => {
  let tabReadCount = 0

  ;(globalThis as any).chrome = {
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      get: vi.fn(async () => ({
        id: 500,
        windowId: 3,
        title: 'www.cashbackmonitor.com',
        color: 'purple',
        collapsed: false
      }))
    },
    tabs: {
      get: vi.fn(async (tabId: number) => {
        tabReadCount += 1

        return {
          id: tabId,
          windowId: 3,
          groupId: tabReadCount < 2 ? -1 : 500
        } as chrome.tabs.Tab
      })
    }
  }

  const result = await verifyAssignment(
    [123],
    { title: 'www.cashbackmonitor.com', color: 'purple' },
    'hybrid_read_through',
    {
      retries: 3,
      delayMs: 0,
      cacheTabsById: {},
      cacheTabGroups: []
    }
  )

  expect(result.ok).toBe(true)
  expect(result.groupId).toBe(500)
})
