<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  empty: {
    type: Boolean,
    default: false,
  },
  emptyTitle: {
    type: String,
    default: '',
  },
  emptyLead: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div v-if="loading" class="student-ui__loader">
    <v-progress-circular indeterminate color="#0f5c66" size="36" />
  </div>
  <v-alert v-else-if="error" type="error" variant="tonal">{{ error }}</v-alert>
  <div v-else-if="empty" class="student-ui__state">
    <strong>{{ emptyTitle }}</strong>
    <p v-if="emptyLead">{{ emptyLead }}</p>
    <slot name="empty-action" />
  </div>
  <slot v-else />
</template>
