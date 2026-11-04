<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { apiError } from '../utils/apiError'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const menu = ref(false)
const items = ref([])
const unread = ref(0)
const loading = ref(false)
const message = ref('')
let pollId = null

watch(() => auth.isAuthenticated, (ok) => {
  if (ok) {
    refresh()
    startPoll()
  } else {
    stopPoll()
    items.value = []
    unread.value = 0
  }
}, { immediate: true })

onMounted(() => {
  if (auth.isAuthenticated) startPoll()
})

onUnmounted(stopPoll)

function startPoll() {
  stopPoll()
  pollId = setInterval(() => {
    if (auth.isAuthenticated) refreshCount()
  }, 60000)
}

function stopPoll() {
  if (pollId) {
    clearInterval(pollId)
    pollId = null
  }
}

async function refreshCount() {
  try {
    const { data } = await http.get('/notifications/unread-count', { skipErrorToast: true, skipLoading: true })
    unread.value = data.data?.unread_count ?? 0
  } catch {
    // keep last count
  }
}

async function refresh() {
  if (!auth.isAuthenticated) return
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/notifications', {
      params: { page: 1 },
      skipErrorToast: true,
      skipLoading: true,
    })
    items.value = (data.data || []).slice(0, 8)
    unread.value = data.meta?.unread_count ?? 0
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

async function openMenu(open) {
  menu.value = open
  if (open) await refresh()
}

async function markOne(item) {
  if (!item.read_at) {
    try {
      await http.post(`/notifications/${item.id}/read`, {}, { skipErrorToast: true })
      item.read_at = new Date().toISOString()
      unread.value = Math.max(0, unread.value - 1)
    } catch {
      // ignore
    }
  }
  if (item.url) {
    menu.value = false
    router.push(item.url)
  }
}

async function markAll() {
  try {
    await http.post('/notifications/read-all', {}, { skipErrorToast: true })
    items.value = items.value.map((item) => ({
      ...item,
      read_at: item.read_at || new Date().toISOString(),
    }))
    unread.value = 0
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  }
}
</script>

<template>
  <div v-if="auth.isAuthenticated" class="notify-bell">
    <v-menu
      :model-value="menu"
      location="bottom end"
      offset="8"
      :close-on-content-click="false"
      @update:model-value="openMenu"
    >
      <template #activator="{ props }">
        <v-btn v-bind="props" icon variant="text" density="comfortable" :aria-label="t('notifications')">
          <v-badge :content="unread" :model-value="unread > 0" color="error" overlap>
            <v-icon>mdi-bell-outline</v-icon>
          </v-badge>
        </v-btn>
      </template>

      <v-card min-width="320" max-width="380">
        <v-card-title class="d-flex align-center text-body-1">
          {{ t('notifications') }}
          <v-spacer />
          <v-btn size="small" variant="text" :disabled="unread === 0" @click="markAll">
            {{ t('markAllRead') }}
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-progress-linear v-if="loading" indeterminate />
        <v-alert v-else-if="message" type="error" variant="tonal" class="ma-2">{{ message }}</v-alert>
        <v-list v-else-if="items.length" density="compact" lines="two">
          <v-list-item
            v-for="item in items"
            :key="item.id"
            :title="item.title"
            :subtitle="item.message"
            :class="{ 'bg-grey-lighten-4': !item.read_at }"
            @click="markOne(item)"
          />
        </v-list>
        <v-card-text v-else class="text-medium-emphasis">{{ t('noNotifications') }}</v-card-text>
        <v-divider />
        <v-card-actions>
          <v-btn variant="text" block :to="{ name: 'notifications' }" @click="menu = false">
            {{ t('viewAllNotifications') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>
  </div>
</template>

<style scoped>
.notify-bell {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
}
</style>
