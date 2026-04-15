import { GroupConfiguration } from './types'

export type RuntimeReadMode =
  | 'cache_only'
  | 'hybrid_read_through'
  | 'live_only_experimental'

type GroupConfigurationKey = Pick<GroupConfiguration, 'title' | 'color'>
type TabGroupPredicate = (
  tabGroup: Partial<Pick<GroupConfiguration, 'title' | 'color'>>
) => boolean

type FindMatchingTabGroupOptions = Partial<{
  includeAllWindows: boolean
  cacheTabGroupsByWindowId: {
    [windowId: string]: readonly chrome.tabGroups.TabGroup[]
  }
  cacheTabGroups: readonly chrome.tabGroups.TabGroup[]
}>

type GetFreshTabOptions = Partial<{
  cacheTabsById: {
    [tabId: string]: chrome.tabs.Tab
  }
}>

type VerifyAssignmentOptions = Partial<{
  retries: number
  delayMs: number
  cacheTabsById: {
    [tabId: string]: chrome.tabs.Tab
  }
  cacheTabGroupsByWindowId: {
    [windowId: string]: readonly chrome.tabGroups.TabGroup[]
  }
  cacheTabGroups: readonly chrome.tabGroups.TabGroup[]
}>

type VerifyAssignmentResult = {
  ok: boolean
  groupId: number | undefined
}

const groupMutationLocks = new Map<string, Promise<unknown>>()

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function getCacheTabGroups(
  windowId: number,
  {
    includeAllWindows = false,
    cacheTabGroupsByWindowId,
    cacheTabGroups
  }: FindMatchingTabGroupOptions = {}
) {
  if (includeAllWindows) {
    return cacheTabGroups ?? []
  }

  return cacheTabGroupsByWindowId?.[windowId] ?? []
}

async function queryTabGroups(
  windowId: number,
  includeAllWindows: boolean
): Promise<chrome.tabGroups.TabGroup[]> {
  if (typeof chrome.tabGroups === 'undefined') return []

  if (includeAllWindows) {
    return await chrome.tabGroups.query({})
  }

  return await chrome.tabGroups.query({ windowId })
}

function findMatchingGroupInCache(
  windowId: number,
  predicate: TabGroupPredicate,
  options: FindMatchingTabGroupOptions = {}
) {
  return getCacheTabGroups(windowId, options).find(predicate)
}

export async function findMatchingTabGroup(
  windowId: number,
  predicate: TabGroupPredicate,
  mode: RuntimeReadMode,
  options: FindMatchingTabGroupOptions = {}
) {
  const includeAllWindows = options.includeAllWindows ?? false

  if (mode === 'cache_only') {
    return findMatchingGroupInCache(windowId, predicate, options)
  }

  try {
    const liveMatch = (await queryTabGroups(windowId, includeAllWindows)).find(
      predicate
    )

    if (liveMatch) {
      return liveMatch
    }
  } catch {
    // Fall back to cache if querying the browser state fails.
  }

  return findMatchingGroupInCache(windowId, predicate, options)
}

async function getFreshTabGroupById(
  groupId: number,
  mode: RuntimeReadMode,
  {
    cacheTabGroupsByWindowId,
    cacheTabGroups
  }: Omit<VerifyAssignmentOptions, 'retries' | 'delayMs' | 'cacheTabsById'>
) {
  if (mode !== 'cache_only' && typeof chrome.tabGroups !== 'undefined') {
    try {
      return await chrome.tabGroups.get(groupId)
    } catch {
      // Fall back to cache if querying the browser state fails.
    }
  }

  if (cacheTabGroups) {
    return cacheTabGroups.find(tabGroup => tabGroup.id === groupId)
  }

  for (const tabGroups of Object.values(cacheTabGroupsByWindowId ?? {})) {
    const tabGroup = tabGroups.find(group => group.id === groupId)
    if (tabGroup) return tabGroup
  }

  return undefined
}

export async function getFreshTab(
  tabId: number,
  mode: RuntimeReadMode,
  { cacheTabsById }: GetFreshTabOptions = {}
) {
  if (mode === 'cache_only') {
    return cacheTabsById?.[tabId]
  }

  if (typeof chrome.tabs !== 'undefined') {
    try {
      return await chrome.tabs.get(tabId)
    } catch {
      // Fall back to cache if querying the browser state fails.
    }
  }

  return cacheTabsById?.[tabId]
}

export async function verifyAssignment(
  tabIds: number[],
  expectedGroup: GroupConfigurationKey,
  mode: RuntimeReadMode,
  {
    retries = 4,
    delayMs = 30,
    cacheTabsById,
    cacheTabGroupsByWindowId,
    cacheTabGroups
  }: VerifyAssignmentOptions = {}
): Promise<VerifyAssignmentResult> {
  const noneGroupId =
    typeof chrome.tabGroups !== 'undefined'
      ? chrome.tabGroups.TAB_GROUP_ID_NONE
      : -1

  for (let attempt = 0; attempt <= retries; attempt++) {
    const tabs = await Promise.all(
      tabIds.map(tabId => getFreshTab(tabId, mode, { cacheTabsById }))
    )
    const resolvedTabs = tabs.filter((tab): tab is chrome.tabs.Tab => Boolean(tab))

    if (resolvedTabs.length === tabIds.length) {
      const groupIds = Array.from(
        new Set(
          resolvedTabs
            .map(tab => tab.groupId)
            .filter(
              (groupId): groupId is number =>
                typeof groupId === 'number' && groupId !== noneGroupId
            )
        )
      )

      if (groupIds.length === 1) {
        const groupId = groupIds[0]
        const tabGroup = await getFreshTabGroupById(groupId, mode, {
          cacheTabGroupsByWindowId,
          cacheTabGroups
        })

        if (
          tabGroup &&
          tabGroup.title === expectedGroup.title &&
          tabGroup.color === expectedGroup.color
        ) {
          return { ok: true, groupId }
        }
      }
    }

    if (attempt < retries) {
      await sleep(delayMs)
    }
  }

  return { ok: false, groupId: undefined }
}

function getGroupMutationKey(windowId: number, groupKey: GroupConfigurationKey) {
  return `${windowId}|${groupKey.title}|${groupKey.color}`
}

export async function runWithGroupMutationLock<T>(
  windowId: number,
  groupKey: GroupConfigurationKey,
  fn: () => Promise<T>
) {
  const key = getGroupMutationKey(windowId, groupKey)
  const previous = groupMutationLocks.get(key) ?? Promise.resolve()
  const queued = previous.catch(() => undefined).then(fn)

  groupMutationLocks.set(key, queued)

  try {
    return await queued
  } finally {
    if (groupMutationLocks.get(key) === queued) {
      groupMutationLocks.delete(key)
    }
  }
}

export function clearGroupMutationLocksForTesting() {
  groupMutationLocks.clear()
}
