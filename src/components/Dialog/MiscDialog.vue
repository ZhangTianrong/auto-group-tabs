<!-- CHANGES START HERE -->
<template>
  <OverlayDialog class="settings-dialog" @keydown.esc="close">
    <AppBar :label="msg.settingsMiscConfigurationTitle" @back="close" />

    <Card>
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
  </OverlayDialog>
</template>

<script setup lang="ts">
import AppBar from '@/components/AppBar.vue'
import Card from '@/components/Card/Card.vue'
import SelectCardSection from '@/components/Card/SelectCardSection.vue'
import Text from '@/components/Text.vue'
import OverlayDialog from './OverlayDialog.vue'
import { useCollapseStrategy } from '@/composables/use-collapse-strategy'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const collapseStrategy = useCollapseStrategy()

function close() {
  emit('close')
}
</script>

<style lang="scss" scoped>
.settings-dialog {
  background-color: var(--dimmed-background);
}
</style>
<!-- CHANGES END HERE -->
