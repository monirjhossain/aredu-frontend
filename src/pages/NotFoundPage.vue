<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div>
    <v-empty-state
      :title="t('notFoundTitle')"
      :text="t('notFoundBody')"
      icon="mdi-map-marker-question"
    >
      <template #actions>
        <v-btn color="primary" @click="$router.push({ name: 'home' })">{{ t('backHome') }}</v-btn>
      </template>
    </v-empty-state>
  </div>
</template>
