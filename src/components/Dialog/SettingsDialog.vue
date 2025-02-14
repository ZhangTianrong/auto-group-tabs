<template>
  <OverlayDialog class="settings-dialog" @keydown.esc="close">
    <AppBar :label="msg.settingsTitle" @back="close" />

    <Card>
      <NavigationCardSection @click="step = 'transfer'">
        <Text>
          {{ msg.settingsTransferConfigurationTitle }}
          <template #secondary>
            {{ msg.settingsTransferConfigurationSubtitle }}
          </template>
        </Text>
      </NavigationCardSection>
      <NavigationCardSection @click="reloadRuntime()">
        <Text>
          {{ msg.settingsForceReloadTitle }}
          <template #secondary>
            {{ msg.settingsForceReloadSubtitle }}
          </template>
        </Text>
      </NavigationCardSection>
    </Card>

    <!-- CHANGES START HERE -->
    <Card>
      <Text class="h6 headline-margin">{{ msg.settingsMiscTitle }}</Text>
      <SelectCardSection
        v-model="collapseStrategy.data.value"
        :options="[
          { value: 'disabled', label: msg.settingsCollapseStrategyDisabled },
          { value: 'collapse_inactive', label: msg.settingsCollapseStrategyInactive }
        ]"
      >
        <Text>
          {{ msg.settingsCollapseStrategyTitle }}
          <template #secondary>
            {{ msg.settingsCollapseStrategySubtitle }}
          </template>
        </Text>
      </SelectCardSection>
    </Card>
    <!-- CHANGES END HERE -->

    <transition name="from-right">
      <TransferDialog v-if="step === 'transfer'" @close="step = 'base'" />
    </transition>
  </OverlayDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import AppBar from '@/components/AppBar.vue'
import Card from '@/components/Card/Card.vue'
import NavigationCardSection from '@/components/Card/NavigationCardSection.vue'
import Text from '@/components/Text.vue'
import OverlayDialog from './OverlayDialog.vue'
import TransferDialog from './TransferDialog.vue'

// CHANGES START HERE
import SelectCardSection from '@/components/Card/SelectCardSection.vue'
import { useCollapseStrategy } from '@/composables/use-collapse-strategy'
// CHANGES END HERE

const emit = defineEmits<{
  (e: 'close'): void
}>()

const step = ref('base')

// CHANGES START HERE
const collapseStrategy = useCollapseStrategy()
// CHANGES END HERE

function reloadRuntime() {
  chrome.runtime.sendMessage('reload')
  window.close()
}

function close() {
  emit('close')
}
</script>

<style lang="scss" scoped>
.settings-dialog {
  background-color: var(--dimmed-background);
}
</style>
