import { useRefHistory } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import {
  TabUpdate,
  tickResetRef,
  useGroupConfigurations,
  ignoreChromeRuntimeEvents,
  useChromeState,
  useRuntimeReadMode
} from '@/composables'
import * as conflictManager from '@/util/conflict-manager'
import {
  saveGroupConfigurations,
  createGroupConfigurationMatcher
} from '@/util/group-configurations'
import { GroupCreationTracker } from '@/util/group-creation-tracker'
import { generateMatcherRegex } from '@/util/matcher-regex'
import {
  findMatchingTabGroup,
  getFreshTab,
  runWithGroupMutationLock,
  verifyAssignment
} from '@/util/runtime-consistency'
import { createManualGroupToggleTracker } from '@/util/manual-group-toggle-tracker'
import { GroupConfiguration } from '@/util/types'
import { when } from '@/util/when'
import { colors } from '@/util/resources'

// CHANGES START HERE
const startupGracePeriod = 500 // Milliseconds to allow manual expansion after wake
const lastWakeTimestamp = ref(Date.now()) // Using ref for reactivity

import { useCollapseStrategy } from '@/composables/use-collapse-strategy'
import { useExpandOnUpdate } from '@/composables/use-expand-on-update'

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

const expansionUpdateSequenceByWindowId = new Map<number, number>()
const expansionDebounceTimersByWindowId = new Map<number, number>()
const expansionConvergenceDelaysMs = [300, 900, 1800, 3000]
const manualGroupToggleTracker = createManualGroupToggleTracker()

async function getWindowTabGroups(windowId: number) {
  if (runtimeReadMode.data.value === 'cache_only') {
    return chromeState.tabGroupsByWindowId.value[windowId] || []
  }

  try {
    return await chrome.tabGroups.query({ windowId })
  } catch {
    return chromeState.tabGroupsByWindowId.value[windowId] || []
  }
}

async function resolveActiveGroupedTab(tabId: number, windowId: number) {
  const runtimeMode = runtimeReadMode.data.value
  const noneGroupId = chrome.tabGroups.TAB_GROUP_ID_NONE

  const resolvedTab = await getFreshTab(tabId, runtimeMode, {
    cacheTabsById: chromeState.tabsById.value
  })

  if (
    resolvedTab &&
    resolvedTab.windowId === windowId &&
    resolvedTab.active &&
    resolvedTab.groupId !== noneGroupId
  ) {
    return resolvedTab
  }

  const activeTab = (
    await chrome.tabs.query({
      active: true,
      windowId
    })
  )?.[0]

  if (activeTab && activeTab.groupId !== noneGroupId) {
    return activeTab
  }

  // Edge can reflect activation/group linkage slightly late.
  await sleep(35)

  const retriedActiveTab = (
    await chrome.tabs.query({
      active: true,
      windowId
    })
  )?.[0]

  if (retriedActiveTab && retriedActiveTab.groupId !== noneGroupId) {
    return retriedActiveTab
  }

  return
}

async function updateCollapsedStateWithRetry(
  groupId: number,
  collapsed: boolean,
  windowId: number,
  isStaleCall: () => boolean,
  retries: number = 3
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (isStaleCall()) return false

    manualGroupToggleTracker.recordProgrammaticToggle(groupId, collapsed)
    await chrome.tabGroups.update(groupId, { collapsed })

    const refreshedGroup = (await getWindowTabGroups(windowId)).find(
      group => group.id === groupId
    )
    if (refreshedGroup?.collapsed === collapsed) {
      return true
    }

    if (attempt < retries) {
      await sleep(35)
    }
  }

  return false
}

// Update tab group expansion/collapse states based on active tab
async function updateGroupExpansionStatus(
  tabId: number,
  windowId: number,
  sequence: number
) {
  const isStaleCall = () =>
    expansionUpdateSequenceByWindowId.get(windowId) !== sequence

  try {
    if (isStaleCall()) return
    if (ignoreChromeRuntimeEvents.value) return
    if (collapseStrategy.data.value === 'disabled') return

    const tab = await resolveActiveGroupedTab(tabId, windowId)
    if (!tab) return
    if (isStaleCall()) return

    if (collapseStrategy.data.value === 'collapse_inactive') {
      const tabGroups = await getWindowTabGroups(windowId)
      const activeGroup = tabGroups.find(group => group.id === tab.groupId)
      if (!activeGroup) return
      if (isStaleCall()) return

      // Enforce desired state directly; Edge can report stale collapsed flags.
      if (
        !manualGroupToggleTracker.shouldSkipAutomaticToggle(tab.groupId, false)
      ) {
        await updateCollapsedStateWithRetry(
          tab.groupId,
          false,
          windowId,
          isStaleCall
        )
      }

      // Collapse all non-active groups (except wake-up grace period).
      for (const group of tabGroups) {
        if (isStaleCall()) return

        if (group.id !== tab.groupId) {
          if (
            manualGroupToggleTracker.shouldSkipAutomaticToggle(group.id, true)
          ) {
            continue
          }

          // Skip collapsing during wake-up grace period
          if (Date.now() - lastWakeTimestamp.value < startupGracePeriod) {
            console.debug('Skipping collapse during wake-up grace period')
            continue
          }
          await updateCollapsedStateWithRetry(
            group.id,
            true,
            windowId,
            isStaleCall
          )
        }
      }
    }
  } catch (error) {
    if (
      error ==
      'Error: Tabs cannot be edited right now (user may be dragging a tab).'
    ) {
      setTimeout(() => updateGroupExpansionStatus(tabId, windowId, sequence), 50)
    } else {
      console.warn('Error updating tab group expansion states:', error)
    }
  }
}

function queueGroupExpansionStatusUpdate(tabId: number, windowId: number) {
  const sequence = (expansionUpdateSequenceByWindowId.get(windowId) ?? 0) + 1
  expansionUpdateSequenceByWindowId.set(windowId, sequence)

  const existingTimer = expansionDebounceTimersByWindowId.get(windowId)
  if (typeof existingTimer === 'number') {
    clearTimeout(existingTimer)
  }

  const timerId = setTimeout(() => {
    void updateGroupExpansionStatus(tabId, windowId, sequence)
  }, 100) as unknown as number
  expansionDebounceTimersByWindowId.set(windowId, timerId)

  // Run delayed convergence passes because Edge can defer/ignore initial updates.
  for (const delayMs of expansionConvergenceDelaysMs) {
    setTimeout(() => {
      if (expansionUpdateSequenceByWindowId.get(windowId) !== sequence) return
      void updateGroupExpansionStatus(tabId, windowId, sequence)
    }, delayMs)
  }
}
// CHANGES END HERE

ignoreChromeRuntimeEvents.value = true

const groupConfigurations = useGroupConfigurations()

// CHANGES START HERE
const transientGroupConfigurations = ref<GroupConfiguration[]>([]) // Domain groups generated on the fly
// CHANGES END HERE

const chromeState = useChromeState()

// CHANGES START HERE
const collapseStrategy = useCollapseStrategy()
const expandOnUpdate = useExpandOnUpdate()
const runtimeReadMode = useRuntimeReadMode()
// CHANGES END HERE

// Augmented group configurations are group configurations with
// enhanced functionality, e.g. matchers converted to regular expressions
const augmentedGroupConfigurations = computed(() =>
  groupConfigurations.data.value.map(group => ({
    ...group,
    matchers: group.matchers.flatMap(matcher => {
      try {
        return generateMatcherRegex(matcher)
      } catch {
        return []
      }
    })
  }))
)

const getColorFromKey = (key: string) => {
  const hash = Array.from(key).reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)

  return colors[Math.abs(hash) % colors.length]
}

function isSplitViewTab(tab: chrome.tabs.Tab) {
  return (
    typeof tab.splitViewId === 'number' &&
    tab.splitViewId !== chrome.tabs.SPLIT_VIEW_ID_NONE
  )
}

function resolveEffectiveGroupConfiguration(tab: chrome.tabs.Tab) {
  const group = getGroupConfigurationForTab(tab)

  if (!group) return

  if (group.title === '%%ignore%%') {
    console.debug(
      'Ignored tab %o (%o) due to explicit %%ignore%% configuration',
      tab.title,
      tab.id
    )
    return
  }

  if (group.title !== '%%domain%%') {
    return group
  }

  const domain = tab.url ? new URL(tab.url).hostname : ''
  if (!domain) return

  const existingDomainGroup = transientGroupConfigurations.value.find(
    group => group.title === domain
  )
  if (existingDomainGroup) {
    return existingDomainGroup
  }

  const domainGroup = {
    id: domain,
    title: domain,
    color: getColorFromKey(domain),
    matchers: [],
    options: { strict: true, merge: true }
  }
  transientGroupConfigurations.value.push(domainGroup)
  console.debug('Added transient configuration:', domainGroup.title)

  return domainGroup
}

const chromeTabsByGroupConfiguration = computed(() => {
  const tabsByGroups = new Map<GroupConfiguration, chrome.tabs.Tab[]>()
  const tabs = chromeState.tabs.items.value

  for (const tab of tabs) {
    const group = resolveEffectiveGroupConfiguration(tab)
    if (!group) continue

    if (tabsByGroups.has(group)) {
      tabsByGroups.get(group)!.push(tab)
    } else {
      const groupTabs = [tab]
      tabsByGroups.set(group, groupTabs)
    }
  }

  return tabsByGroups
})

/**
 * { [string: windowId]: Map<GroupConfiguration, chrome.tabs.Tab[]> }
 */
const chromeTabsByWindowIdAndGroupConfiguration = computed(() =>
  Object.entries(chromeState.tabsByWindowId.value).map(
    ([windowId, tabs]: [string, chrome.tabs.Tab[]]) => {
      const tabsByGroups = new Map<GroupConfiguration, chrome.tabs.Tab[]>()

      for (const tab of tabs) {
        const group = resolveEffectiveGroupConfiguration(tab)
        if (!group) continue

        if (tabsByGroups.has(group)) {
          tabsByGroups.get(group)!.push(tab)
        } else {
          const groupTabs = [tab]
          tabsByGroups.set(group, groupTabs)
        }
      }

      return { windowId: Number(windowId), tabsByGroups }
    }
  )
)

Object.assign(self, { chromeState })

/**
 * Get a matching configuration group for a tab
 */
function getGroupConfigurationForTab(tab: chrome.tabs.Tab) {
  // Ignore pinned tabs
  if (tab.pinned) {
    console.debug('Tab %o (%o) pinned, ignore.', tab.title, tab.id)
    return
  }

  // Ignore tabs with no URL
  if (!tab.url) {
    console.debug('Tab %o (%o) has no URL, ignore.', tab.title, tab.id)
    return
  }

  // Iterate tab group configurations
  let groupIndex = 0
  for (const group of augmentedGroupConfigurations.value) {
    for (const matcher of group.matchers) {
      if (matcher.test(tab.url))
        return groupConfigurations.data.value[groupIndex]
    }
    groupIndex++
  }

  // No matching group found
  return
}

const groupCreationTracker = new GroupCreationTracker()

async function assignTabsToGroup(
  tabs: chrome.tabs.Tab[],
  group: GroupConfiguration,
  noRedundantGrouping: boolean = false
) {
  tabs = tabs.filter(tab => !isSplitViewTab(tab))
  if (tabs.length === 0) return

  const windowId = tabs[0].windowId
  const runtimeMode = runtimeReadMode.data.value

  const tabGroupPredicate = createGroupConfigurationMatcher(group)
  const preflightTargetTabGroup = await findMatchingTabGroup(
    windowId,
    tabGroupPredicate,
    runtimeMode,
    {
      cacheTabGroupsByWindowId: chromeState.tabGroupsByWindowId.value,
      cacheTabGroups: chromeState.tabGroups.items.value
    }
  )
  const preflightTabGroupId = preflightTargetTabGroup?.id

  if (noRedundantGrouping && preflightTabGroupId) {
    const allTabsAlreadyInGroup = tabs.every(
      tab => tab.groupId === preflightTabGroupId
    )
    if (allTabsAlreadyInGroup) {
      console.debug(
        'All tabs already in correct group %o (%o / %o), skipping to preserve expansion state',
        preflightTabGroupId,
        group.title,
        group.color
      )
      return
    }
  }

  console.debug(
    'Assigning %o tabs to group %o (%o / %o)...',
    tabs.length,
    preflightTabGroupId,
    group.title,
    group.color
  )

  // Assign the tabs to the proper tab group
  // If the group does not exist, it is created in the process
  const attemptGroupAssignment = async ({ waitable = true } = {}) => {
    const tabIds = tabs.flatMap(tab => tab.id ?? [])
    if (tabIds.length === 0) return

    // We need to query the current tab state because they
    // may have been dragged to a different window
    const freshestTab = await getFreshTab(tabs[0].id!, runtimeMode, {
      cacheTabsById: chromeState.tabsById.value
    })
    if (!freshestTab) return

    const updatedWindowId = freshestTab.windowId

    return await runWithGroupMutationLock(updatedWindowId, group, async () => {
      let tabGroupId: number | undefined

      try {
        if (waitable && groupCreationTracker.isCreating(updatedWindowId, group)) {
          tabGroupId = await groupCreationTracker.getCreationPromise(
            updatedWindowId,
            group
          )
        }

        const targetTabGroupInSameWindow = await findMatchingTabGroup(
          updatedWindowId,
          tabGroupPredicate,
          runtimeMode,
          {
            cacheTabGroupsByWindowId: chromeState.tabGroupsByWindowId.value,
            cacheTabGroups: chromeState.tabGroups.items.value
          }
        )

        let targetTabGroupAcrossWindows: chrome.tabGroups.TabGroup | undefined
        if (group.options.merge) {
          targetTabGroupAcrossWindows = await findMatchingTabGroup(
            updatedWindowId,
            tabGroupPredicate,
            runtimeMode,
            {
              includeAllWindows: true,
              cacheTabGroupsByWindowId: chromeState.tabGroupsByWindowId.value,
              cacheTabGroups: chromeState.tabGroups.items.value
            }
          )
        }

        const sourceWindow =
          runtimeMode === 'cache_only'
            ? chromeState.windows.items.value.find(
                window => window.id === updatedWindowId
              )
            : await chrome.windows.get(updatedWindowId)

        const targetWindow =
          runtimeMode === 'cache_only'
            ? chromeState.windows.items.value.find(
                window => window.id === targetTabGroupAcrossWindows?.windowId
              )
            : targetTabGroupAcrossWindows
              ? await chrome.windows.get(targetTabGroupAcrossWindows.windowId)
              : undefined

        const canMergeAcrossWindows =
          group.options.merge &&
          Boolean(targetWindow) &&
          sourceWindow?.incognito === targetWindow?.incognito

        const sameWindowTarget =
          targetTabGroupInSameWindow ||
          (targetTabGroupAcrossWindows?.windowId === updatedWindowId
            ? targetTabGroupAcrossWindows
            : undefined)

        if (!tabGroupId) {
          tabGroupId = canMergeAcrossWindows
            ? targetTabGroupAcrossWindows?.id
            : sameWindowTarget?.id
        }

        if (!tabGroupId) {
          console.debug(
            'Attempt assignment to new group in window %o',
            updatedWindowId
          )
          const tabCreationPromise = chrome.tabs.group({
            tabIds,
            createProperties: { windowId: updatedWindowId }
          })

          groupCreationTracker.queueGroupCreation(
            updatedWindowId,
            group,
            tabCreationPromise
          )

          tabGroupId = await tabCreationPromise

          manualGroupToggleTracker.recordProgrammaticToggle(
            tabGroupId,
            expandOnUpdate.data.value !== 'enabled'
          )
          await chrome.tabGroups.update(tabGroupId, {
            title: group.title,
            color: group.color,
            collapsed: expandOnUpdate.data.value !== 'enabled'
          })
        } else {
          const currentWindow = await chrome.windows.getCurrent()
          const currentWindowId = currentWindow?.id
          const currentTab = (
            await chrome.tabs.query({ active: true, windowId: currentWindowId })
          )?.[0]
          const currentTabId = currentTab?.id

          const latestTabs = await Promise.all(
            tabIds.map(tabId =>
              getFreshTab(tabId, runtimeMode, {
                cacheTabsById: chromeState.tabsById.value
              })
            )
          )
          const tabsNotInGroup = latestTabs.filter(
            (tab): tab is chrome.tabs.Tab =>
              tab !== undefined && tab.groupId !== tabGroupId
          )

          if (tabsNotInGroup.length > 0) {
            console.debug('Attempt assignment to existing group %o', tabGroupId)
            await chrome.tabs.group({
              tabIds,
              groupId: tabGroupId
            })
          } else {
            console.debug(
              'All tabs already in group %o, skipping assignment',
              tabGroupId
            )
          }

          if (currentTabId && tabIds.includes(currentTabId)) {
            const targetWindowId = chromeState.tabGroups.items.value.find(
              tabGroup => tabGroup.id === tabGroupId
            )?.windowId

            if (targetWindowId && currentWindowId !== targetWindowId) {
              chrome.windows.update(targetWindowId, {
                focused: true
              })
              chrome.tabs.update(currentTabId, {
                active: true
              })
            }
          }
        }

        const verificationResult = await verifyAssignment(
          tabIds,
          {
            title: group.title,
            color: group.color
          },
          runtimeMode,
          {
            cacheTabsById: chromeState.tabsById.value,
            cacheTabGroupsByWindowId: chromeState.tabGroupsByWindowId.value,
            cacheTabGroups: chromeState.tabGroups.items.value,
            retries: runtimeMode === 'cache_only' ? 0 : 4,
            delayMs: 30
          }
        )

        if (verificationResult.groupId) {
          tabGroupId = verificationResult.groupId
        } else if (!verificationResult.ok) {
          console.debug(
            'Assignment verification did not converge for group %o / %o',
            group.title,
            group.color
          )
        }

        tabIds.forEach(tabId => draggingTabs.delete(tabId))
        console.debug('Assignment successful')

        const groupedTabs = await Promise.all(
          tabIds.map(tabId =>
            getFreshTab(tabId, runtimeMode, {
              cacheTabsById: chromeState.tabsById.value
            })
          )
        )
        const activeTab = groupedTabs.find(
          (tab): tab is chrome.tabs.Tab => Boolean(tab && tab.active)
        )

        if (activeTab) {
          queueGroupExpansionStatusUpdate(activeTab.id!, activeTab.windowId)
        }

        return tabGroupId
      } catch (error) {
        if (
          error ==
          'Error: Tabs cannot be edited right now (user may be dragging a tab).'
        ) {
          tabIds.forEach(tabId => draggingTabs.add(tabId))

          console.debug(
            'Tab is being dragged, cannot assign it to a group, poll for dragging to be done...'
          )
          setTimeout(() => {
            const result = attemptGroupAssignment({ waitable: false })

            groupCreationTracker.queueGroupCreation(
              updatedWindowId,
              group,
              result.then(id => {
                if (typeof id === 'number') return id

                throw new Error('Tab group assignment failed')
              })
            )
          }, 50)
        } else {
          console.warn('Could not group tabs:', error)
        }
      }
    })
  }

  await attemptGroupAssignment()
}

async function ungroupAppropriateTabs(tabs: chrome.tabs.Tab[]) {
  const runtimeMode = runtimeReadMode.data.value

  for (const tab of tabs) {
    if (isSplitViewTab(tab)) continue

    const freshTab = await getFreshTab(tab.id!, runtimeMode, {
      cacheTabsById: chromeState.tabsById.value
    })
    const currentGroupId = freshTab?.groupId ?? tab.groupId

    if (currentGroupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      let assignedGroup = chromeState.tabGroups.items.value.find(
        tabGroup => tabGroup.id === currentGroupId
      )

      if (!assignedGroup && runtimeMode !== 'cache_only') {
        try {
          assignedGroup = await chrome.tabGroups.get(currentGroupId)
        } catch {
          assignedGroup = undefined
        }
      }

      if (!assignedGroup) continue

      for (const groupConfiguration of augmentedGroupConfigurations.value) {
        const matchesGroupConfiguration =
          createGroupConfigurationMatcher(groupConfiguration)
        if (matchesGroupConfiguration(assignedGroup!)) {
          if (groupConfiguration.options.strict) {
            console.debug(
              'Unassigning tab %o (%o) from group %o (%o / %o)...',
              tab.title,
              tab.id,
              currentGroupId,
              groupConfiguration.title,
              groupConfiguration.color
            )

            await chrome.tabs.ungroup(tab.id!)
          }
        }
      }
    }
  }
}

async function groupAllAppropriateTabs() {
  const assignedTabIds = new Set<number>()

  for (const {
    tabsByGroups
  } of chromeTabsByWindowIdAndGroupConfiguration.value) {
    for (const [group, tabs] of tabsByGroups) {
      for (const tab of tabs) {
        assignedTabIds.add(tab.id!)
      }

      await assignTabsToGroup(
        tabs,
        group,
        true // Pass noRedundantGrouping=true to preserve expansion state
      )
    }
  }

  const tabsToUnassign: chrome.tabs.Tab[] = []
  for (const tab of chromeState.tabs.items.value) {
    if (assignedTabIds.has(tab.id!)) continue
    tabsToUnassign.push(tab)
  }
  if (tabsToUnassign.length > 0) {
    await ungroupAppropriateTabs(tabsToUnassign)
  }
}

const justLoadedGroupConfigurations = tickResetRef(false)
const stopWatchingGroupConfigurationsLoaded = watch(
  groupConfigurations.loaded,
  isLoaded => {
    if (isLoaded) {
      stopWatchingGroupConfigurationsLoaded()
      justLoadedGroupConfigurations.value = true
    }
  }
)

const programmaticallyUpdatingTabGroups = ref(false)

const draggingTabs = new Set<number>()

// React to changed group configurations
watch(
  augmentedGroupConfigurations,
  async (newGroups, oldGroups) => {
    // Bail out if group configurations haven't loaded yet
    if (
      !groupConfigurations.loaded.value ||
      justLoadedGroupConfigurations.value
    )
      return

    const addedGroupConfigurations = newGroups.filter(
      ({ id }) => !oldGroups!.some(oldGroup => oldGroup.id === id)
    )

    const deletedGroupConfigurations = oldGroups!.filter(
      ({ id }) => !newGroups.some(newGroup => newGroup.id === id)
    )

    // Superficially changed = just title and/or color changed
    const superficiallyChangedGroupConfigurations = newGroups.filter(
      newGroup => {
        const oldGroup = oldGroups!.find(
          oldGroup => oldGroup.id === newGroup.id
        )
        if (!oldGroup) return false

        return (
          oldGroup.title !== newGroup.title || oldGroup.color !== newGroup.color
        )
      }
    )

    const deeplyChangedGroupConfigurations = newGroups.filter(newGroup => {
      const oldGroup = oldGroups!.find(oldGroup => oldGroup.id === newGroup.id)

      // Group is new -> it's not counting as changed
      if (!oldGroup) return false

      // Group is at a different position than before
      if (oldGroups!.indexOf(oldGroup) !== newGroups.indexOf(newGroup))
        return true

      // Group's 'strict' option changed
      if (oldGroup.options.strict !== newGroup.options.strict) return true

      // Group's 'merge' option changed
      if (oldGroup.options.merge !== newGroup.options.merge) return true

      // Group has different matchers than before
      if (oldGroup.matchers.length !== newGroup.matchers.length) return true
      const sortedOldMatchers = [...oldGroup.matchers].sort()
      const sortedNewMatchers = [...newGroup.matchers].sort()

      for (let i = 0; i < oldGroup.matchers.length; i++) {
        if (sortedOldMatchers[i].source !== sortedNewMatchers[i].source)
          return true
      }

      return false
    })

    if (addedGroupConfigurations.length > 0) {
      console.debug('Added tab group configurations:', addedGroupConfigurations)
    }

    if (superficiallyChangedGroupConfigurations.length > 0) {
      console.debug(
        'Superficially changed tab group configurations:',
        superficiallyChangedGroupConfigurations
      )

      // Update superficially changed groups
      for (const newGroup of newGroups) {
        if (!superficiallyChangedGroupConfigurations.includes(newGroup))
          continue

        const oldGroup = oldGroups!.find(
          oldGroup => oldGroup.id === newGroup.id
        )!

        programmaticallyUpdatingTabGroups.value = true
        for (const tabGroup of chromeState.tabGroups.items.value) {
          if (
            tabGroup.title === oldGroup.title &&
            tabGroup.color === oldGroup.color
          ) {
            // Wait until updated
            await chrome.tabGroups.update(tabGroup.id, {
              title: newGroup.title,
              color: newGroup.color
            })

            // Wait until reflected in state
            await when(chromeState.tabGroups.items, tabGroups =>
              tabGroups.some(
                stateTabGroup =>
                  stateTabGroup.id === tabGroup.id &&
                  stateTabGroup.title === newGroup.title &&
                  stateTabGroup.color === newGroup.color
              )
            )
          }
        }
        programmaticallyUpdatingTabGroups.value = false
      }
    }

    if (deeplyChangedGroupConfigurations.length > 0) {
      console.debug(
        'Deeply changed tab group configurations:',
        deeplyChangedGroupConfigurations
      )
    }

    if (deletedGroupConfigurations.length > 0) {
      console.debug(
        'Deleted tab group configurations:',
        deletedGroupConfigurations
      )
      const groupsToDelete = chromeState.tabGroups.items.value.filter(
        tabGroup =>
          deletedGroupConfigurations.some(
            groupConfiguration =>
              groupConfiguration.title === tabGroup.title &&
              groupConfiguration.color === tabGroup.color
          )
      )

      console.debug('Tab groups to delete: %o', groupsToDelete)

      for (const groupToDelete of groupsToDelete) {
        const tabsToUngroup = chromeState.tabs.items.value.filter(
          tab => tab.groupId === groupToDelete.id
        )

        chrome.tabs.ungroup(tabsToUngroup.flatMap(tab => tab.id ?? []))
      }
    }

    if (
      addedGroupConfigurations.length > 0 ||
      deeplyChangedGroupConfigurations.length > 0
    ) {
      console.debug('❇️ Added groups or changed matchers, reassign tabs.')
      await groupAllAppropriateTabs()
    }
  },
  { immediate: true }
)

const tabGroupsHistory = useRefHistory(chromeState.tabGroups.items, {
  capacity: 2
})
const removedTabGroups = useRefHistory(chromeState.tabGroups.lastRemoved, {
  capacity: 10
})

watch(chromeState.tabGroups.lastUpdated, tabGroup => {
  if (!tabGroup) return

  const oldTabGroup = tabGroupsHistory.history.value[0].snapshot.find(
    stateTabGroup => stateTabGroup.id === tabGroup.id
  )
  if (!oldTabGroup || oldTabGroup.collapsed === tabGroup.collapsed) return

  manualGroupToggleTracker.recordObservedToggle(tabGroup.id, tabGroup.collapsed)
})

// When manually updating a group name/color, sync that back to the configuration
watch(chromeState.tabGroups.lastUpdated, async tabGroup => {
  if (!tabGroup) return
  if (programmaticallyUpdatingTabGroups.value) return

  const oldTabGroup = tabGroupsHistory.history.value[0].snapshot.find(
    stateTabGroup => stateTabGroup.id === tabGroup!.id
  )
  if (!oldTabGroup) return
  if (
    oldTabGroup.title === tabGroup.title &&
    oldTabGroup.color === tabGroup.color
  )
    return

  const matchesOldGroup = createGroupConfigurationMatcher(oldTabGroup)
  const matchesNewGroup = createGroupConfigurationMatcher(tabGroup)

  if (groupConfigurations.data.value.some(matchesOldGroup)) {
    const groupsCopy: GroupConfiguration[] = JSON.parse(
      JSON.stringify(groupConfigurations.data.value)
    )

    const conflictingItem = groupsCopy.find(matchesNewGroup)
    let unconflictingTitle: string

    // Check for and resolve conflicts
    if (conflictingItem) {
      // We cannot prevent the user from changing the group name/color manually,
      // therefore, in case of a conflict, we need to resolve it by renaming the
      // existing group it conflicts with.
      unconflictingTitle = conflictManager.withMarker(tabGroup.title!)
      conflictingItem.title = unconflictingTitle
    }

    const updatedGroupItem = groupsCopy.find(matchesOldGroup)!
    updatedGroupItem.title = tabGroup.title ?? ''
    updatedGroupItem.color = tabGroup.color

    saveGroupConfigurations(groupsCopy)

    if (conflictingItem) {
      // When there was a conflict, and the conflicting group has been renamed,
      // our manually edited tab will now belong to that conflicting group as it was
      // briefly shifted there when its group names matched and then renamed to the
      // unconflicting group name in the background.
      // However, since the actual tab name now no longer matches the name in Chrome's
      // tab group editor input field, we need to revert the tab group's name to match
      // that input field again.

      programmaticallyUpdatingTabGroups.value = true

      // Wait for the manually edited tab group to have its
      // title aligned with the unconflicting title
      await when(
        chromeState.tabGroups.lastUpdated,
        updatedTabGroup =>
          updatedTabGroup!.id === tabGroup.id &&
          updatedTabGroup!.title === unconflictingTitle
      )

      // Revert the edited tab group's title
      await chrome.tabGroups.update(tabGroup.id, {
        title: tabGroup.title
      })

      // Wait for the reverted title to be reflected in the extension state
      await when(
        chromeState.tabGroups.lastUpdated,
        updatedTabGroup =>
          updatedTabGroup!.id === tabGroup.id &&
          updatedTabGroup!.title === tabGroup.title
      )
      programmaticallyUpdatingTabGroups.value = false
    }
  }
})

// Reload the runtime on update to avoid sticking to outdated behavior in existing tabs
chrome.runtime.onUpdateAvailable.addListener(() => {
  chrome.runtime.reload()
})

// Reload the runtime when manually requested
chrome.runtime.onMessage.addListener(message => {
  if (message === 'reload') {
    chrome.runtime.reload()
  }
})

when(groupConfigurations.loaded).then(async () => {
  // Wait for the extension state to initialize
  console.debug('Waiting for extension state to initialize...')
  await when(chromeState.tabs.loaded)

  console.debug(
    'Extension state initialized, grouping all appropriate tabs now...'
  )
  await groupAllAppropriateTabs()

  console.debug(
    'Initial grouping done, begin listening to chrome runtime events...'
  )
  ignoreChromeRuntimeEvents.value = false

  watch(chromeState.tabs.lastUpdated, async (update: TabUpdate | undefined) => {
    if (!update) return
    const runtimeMode = runtimeReadMode.data.value

    if (chromeState.tabs.detachedTabs.value.includes(update.tab.id!)) return
    if (draggingTabs.has(update.tab.id!)) return

    // Check if the tab's group has actually changed
    const groupChanged =
      update.changes.groupId !== undefined &&
      update.changes.groupId !== update.oldTab?.groupId &&
      update.changes.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE

    // If the group has changed and expand on update is enabled, expand the group
    if (
      groupChanged &&
      expandOnUpdate.data.value === 'enabled' &&
      update.changes.groupId
    ) {
      try {
        manualGroupToggleTracker.recordProgrammaticToggle(
          update.changes.groupId,
          false
        )
        await chrome.tabGroups.update(update.changes.groupId, {
          collapsed: false
        })
      } catch (error) {
        console.warn('Error expanding tab group:', error)
      }
    }

    const removedFromTabGroup =
      update.changes.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE
    if (!update.changes.url && !removedFromTabGroup) return

    if (removedFromTabGroup) {
      console.debug(
        'Removed tab %o (%o) from tab group %o. Looking up the group now...',
        update.tab.title,
        update.tab.id,
        update.oldTab?.groupId
      )

      try {
        await chrome.tabGroups.get(update.oldTab!.groupId)
        console.debug('Group found, it still exists.')
      } catch {
        console.debug(
          'Group of removed tab no longer found. Waiting for extension state to reflect the removal...'
        )

        await when(removedTabGroups.history, history =>
          history.some(item => item.snapshot?.id === update.oldTab?.groupId)
        )

        console.debug('Reflected tab group removal in extension state')

        // CHANGES START HERE
        // Check if the removed group was created by a transient configuration
        const removedGroup = removedTabGroups.history.value[0].snapshot
        const transientConfig = transientGroupConfigurations.value.find(
          config =>
            config.title === removedGroup?.title &&
            config.color === removedGroup?.color
        )

        if (transientConfig) {
          const hasRemainingGroups = Boolean(
            await findMatchingTabGroup(
              removedGroup?.windowId ?? update.tab.windowId!,
              createGroupConfigurationMatcher(transientConfig),
              runtimeMode,
              {
                includeAllWindows: transientConfig.options.merge,
                cacheTabGroupsByWindowId: chromeState.tabGroupsByWindowId.value,
                cacheTabGroups: chromeState.tabGroups.items.value
              }
            )
          )

          if (!hasRemainingGroups) {
            transientGroupConfigurations.value =
              transientGroupConfigurations.value.filter(
                config => config !== transientConfig
              )
            console.debug('Removed transient configuration:', transientConfig.title)
          }
        }
        // CHANGES END HERE
      }
    }

    // Check if the tab itself is gone
    if (!chromeState.tabsById.value[update.tab.id!]) return

    console.debug(
      'Reassigning tab %o (%o) due to change %o',
      update.tab.title,
      update.tab.id,
      update.changes
    )

    // Fetch current data for tab instead of reusing update.tab
    // as this leads to problems in cases where the user closed a window
    // by moving a tab.
    const updatedTab = await getFreshTab(update.tab.id!, runtimeMode, {
      cacheTabsById: chromeState.tabsById.value
    })
    if (!updatedTab) return

    let assignedAny = false
    for (const [group, tabs] of chromeTabsByGroupConfiguration.value) {
      if (!tabs.some(tab => tab.id === updatedTab.id)) continue

      assignedAny = true
      await assignTabsToGroup([updatedTab], group)
    }

    // Check if tab has been reassigned,
    // otherwise check if it needs to be removed from its current group
    // because the group is configured as strict.
    if (!assignedAny) {
      await ungroupAppropriateTabs([updatedTab])
    }
  })
})

// CHANGES START HERE
// Handle tab group expansion/collapse based on active tab
chrome.tabs.onActivated.addListener(activeInfo => {
  queueGroupExpansionStatusUpdate(activeInfo.tabId, activeInfo.windowId)
})

// Handle the case when a tab is moved from one window to another
chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
  try {
    // Get the active tab in the original window after the tab was detached
    const tabs = await chrome.tabs.query({
      active: true,
      windowId: detachInfo.oldWindowId
    })

    if (
      tabs.length > 0 &&
      tabs[0].groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE &&
      tabs[0].id !== undefined
    ) {
      // If the active tab belongs to a group, ensure that group is expanded
      console.debug(
        'Tab detached, expanding group of new active tab in original window',
        tabs[0].id,
        tabs[0].groupId,
        detachInfo.oldWindowId
      )
      queueGroupExpansionStatusUpdate(tabs[0].id, detachInfo.oldWindowId)
    }
  } catch (error) {
    console.warn('Error handling tab detach event:', error)
  }
})
// CHANGES END HERE

chrome.action.onClicked.addListener(() => {
  console.debug('Trigger extension action')
  chrome.runtime.openOptionsPage()
})
