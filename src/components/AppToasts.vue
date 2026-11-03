<script setup>
import { computed } from 'vue'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()

const current = computed(() => ui.toasts[ui.toasts.length - 1] || null)

const colorMap = {
  success: '#0f766e',
  error: '#e85d4c',
  info: '#0f5c66',
  warning: '#d97706',
}

const iconMap = {
  success: 'mdi-check-circle',
  error: 'mdi-alert-circle',
  info: 'mdi-information',
  warning: 'mdi-alert',
}

const open = computed({
  get: () => current.value !== null,
  set: (value) => {
    if (!value && current.value) {
      ui.removeToast(current.value.id)
    }
  },
})
</script>

<template>
  <v-snackbar
    v-model="open"
    :timeout="current?.timeout || 4000"
    :color="colorMap[current?.type] || colorMap.info"
    location="top right"
    multi-line
    elevation="8"
  >
    <div class="app-toasts__row">
      <v-icon size="18" class="me-2">{{ iconMap[current?.type] || iconMap.info }}</v-icon>
      <span>{{ current?.message }}</span>
    </div>
    <template #actions>
      <v-btn variant="text" density="compact" @click="open = false">
        <v-icon size="18">mdi-close</v-icon>
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style scoped>
.app-toasts__row {
  display: flex;
  align-items: flex-start;
  gap: 0.15rem;
  font-weight: 650;
  line-height: 1.35;
}
</style>
