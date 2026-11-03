<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../services/http'
import { useLocaleStore } from '../stores/locale'
import { apiError } from '../utils/apiError'

const { t } = useI18n()
const router = useRouter()
const localeStore = useLocaleStore()

const items = ref([])
const meta = ref({ current_page: 1, last_page: 1, unread_count: 0 })
const page = ref(1)
const loading = ref(true)
const message = ref('')

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/notifications', {
      params: { page: page.value },
      skipErrorToast: true,
    })
    items.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

async function markOne(item) {
  if (!item.read_at) {
    try {
      await http.post(`/notifications/${item.id}/read`, {}, { skipErrorToast: true })
      item.read_at = new Date().toISOString()
      meta.value.unread_count = Math.max(0, (meta.value.unread_count || 0) - 1)
    } catch {
      // ignore
    }
  }
  if (item.url) router.push(item.url)
}

async function markAll() {
  try {
    await http.post('/notifications/read-all', {}, { skipErrorToast: true })
    items.value = items.value.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() }))
    meta.value.unread_count = 0
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  }
}

function when(value) {
  if (!value) return ''
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleString(locale)
}
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4 flex-wrap ga-2">
      <h1 class="text-h5 mb-0">{{ t('notifications') }}</h1>
      <v-spacer />
      <v-btn variant="tonal" :disabled="!(meta.unread_count > 0)" @click="markAll">{{ t('markAllRead') }}</v-btn>
    </div>
    <v-progress-circular v-if="loading" indeterminate color="primary" />
    <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
    <v-alert v-else-if="items.length === 0" type="info" variant="tonal">{{ t('noNotifications') }}</v-alert>
    <v-list v-else lines="three">
      <v-list-item v-for="item in items" :key="item.id" :title="item.title" :subtitle="`${item.message} · ${when(item.created_at)}`" :class="{ 'bg-grey-lighten-4': !item.read_at }" @click="markOne(item)">
        <template #append>
          <v-chip size="small" variant="tonal" :color="item.read_at ? 'default' : 'primary'">
            {{ item.read_at ? t('read') : t('unread') }}
          </v-chip>
        </template>
      </v-list-item>
    </v-list>

    <div v-if="meta.last_page > 1" class="d-flex justify-center mt-4">
      <v-pagination v-model="page" :length="meta.last_page" @update:model-value="load" />
    </div>
  </div>
</template>
