<!-- CHANGES START HERE -->
<template>
  <CardSection class="select-card-section">
    <ToggleLabel class="toggle-label" :for="id">
      <slot />
    </ToggleLabel>

    <Select
      class="card-select"
      :id="id"
      :modelValue="modelValue"
      :options="options"
      @update:modelValue="$emit('update:modelValue', $event)"
    />
  </CardSection>
</template>

<script setup lang="ts">
import ToggleLabel from '@/components/Form/ToggleLabel.vue'
import Select from '@/components/Form/Select.vue'
import CardSection from './CardSection.vue'

import { computed, useAttrs } from 'vue'

defineProps<{
  modelValue: string
  options: Array<{ value: string; label: string }>
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const attrs = useAttrs()
const id = computed(() => `select-${attrs.id ?? crypto.randomUUID()}`)
</script>

<style lang="scss" scoped>
.select-card-section {
  cursor: pointer;
}

.toggle-label {
  cursor: inherit;
}

.card-select {
  width: auto;
  min-width: 200px;
}
</style>
<!-- CHANGES END HERE -->