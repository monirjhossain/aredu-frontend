<script setup>
import { useI18n } from 'vue-i18n'

defineProps({
  title: { type: String, required: true },
  lead: { type: String, default: '' },
  eyebrow: { type: String, default: '' },
})

const { t } = useI18n()
</script>

<template>
  <header class="admin-ui__hero">
    <div>
      <p class="admin-ui__eyebrow">{{ eyebrow || t('adminDashboard') }}</p>
      <h1>{{ title }}</h1>
      <p v-if="lead" class="admin-ui__lead">{{ lead }}</p>
    </div>
    <div v-if="$slots.actions" class="admin-ui__hero-actions">
      <slot name="actions" />
    </div>
  </header>
</template>
