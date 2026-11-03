<script setup>
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useLocaleStore } from './stores/locale'

const { locale, t } = useI18n()
const route = useRoute()
const localeStore = useLocaleStore()

watch(
  () => localeStore.locale,
  (value) => {
    locale.value = value
    document.documentElement.lang = value
    if (route.meta.titleKey) {
      document.title = `${t(route.meta.titleKey)} · AR Education`
    }
  },
  { immediate: true },
)
</script>

<template>
<router-view />
</template>
