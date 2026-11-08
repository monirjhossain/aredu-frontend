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
  if (!item.url) return
  // Support absolute app paths with query (e.g. full-mock context_key + session).
  router.push(item.url)
}

async function markAll() {
  try {
    await http.post('/notifications/read-all', {}, { skipErrorToast: true })
    items.value = items.value.map((item) => ({
      ...item,
      read_at: item.read_at || new Date().toISOString(),
    }))
    meta.value.unread_count = 0
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  }
}

function goPage(next) {
  page.value = next
  load()
}

function when(value) {
  if (!value) return '—'
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="notify-page">
    <header class="notify-page__hero">
      <div>
        <p class="notify-page__eyebrow">{{ t('account') }}</p>
        <h1>{{ t('notifications') }}</h1>
        <p>{{ t('notificationsLead') }}</p>
      </div>
      <button
        type="button"
        class="notify-page__hero-btn"
        :disabled="!(meta.unread_count > 0) || loading"
        @click="markAll"
      >
        {{ t('markAllRead') }}
      </button>
    </header>

    <section class="notify-page__panel">
      <div class="notify-page__head">
        <div>
          <h2>{{ t('notifications') }}</h2>
          <p>
            {{ t('unreadCount', { count: meta.unread_count || 0 }) }}
          </p>
        </div>
      </div>

      <div v-if="loading" class="notify-page__loader">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="items.length === 0" class="notify-page__empty">
        <strong>{{ t('noNotifications') }}</strong>
        <p>{{ t('notificationsEmptyLead') }}</p>
        <router-link class="notify-page__cta" :to="{ name: 'student-dashboard' }">
          {{ t('studentDashboard') }}
        </router-link>
      </div>

      <div v-else class="notify-page__list">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="notify-card"
          :class="{ 'is-unread': !item.read_at }"
          @click="markOne(item)"
        >
          <div class="notify-card__main">
            <h3>{{ item.title }}</h3>
            <p>{{ item.message }}</p>
            <span>{{ when(item.created_at) }}</span>
          </div>
          <span class="notify-card__chip" :class="{ 'is-unread': !item.read_at }">
            {{ item.read_at ? t('read') : t('unread') }}
          </span>
        </button>
      </div>

      <div v-if="meta.last_page > 1" class="notify-page__pager">
        <button
          type="button"
          class="notify-page__pager-btn"
          :disabled="page <= 1 || loading"
          @click="goPage(page - 1)"
        >
          {{ t('previous') }}
        </button>
        <span>{{ page }} / {{ meta.last_page }}</span>
        <button
          type="button"
          class="notify-page__pager-btn"
          :disabled="page >= meta.last_page || loading"
          @click="goPage(page + 1)"
        >
          {{ t('next') }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.notify-page {
  display: grid;
  gap: 1rem;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: #102a2e;
}

.notify-page__hero {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.2rem 1.25rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at top right, rgba(229, 76, 16, 0.22), transparent 42%),
    linear-gradient(135deg, #0b3d36 0%, #0f5c66 55%, #0a2a3a 100%);
  color: #fff;
}

@media (min-width: 720px) {
  .notify-page__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.notify-page__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.notify-page__hero h1 {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 1.85rem);
  font-weight: 800;
}

.notify-page__hero p {
  margin: 0.4rem 0 0;
  max-width: 42ch;
  opacity: 0.9;
  font-size: 0.92rem;
  line-height: 1.45;
}

.notify-page__hero-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 1rem;
  border: 0;
  border-radius: 0.65rem;
  background: #e54c10;
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  width: fit-content;
}

.notify-page__hero-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.notify-page__panel {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid #d9e6e8;
  background: #fff;
}

.notify-page__head h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.notify-page__head p {
  margin: 0.3rem 0 0;
  color: #5b7378;
  font-size: 0.86rem;
}

.notify-page__loader {
  display: grid;
  place-items: center;
  min-height: 140px;
}

.notify-page__empty {
  display: grid;
  gap: 0.4rem;
  justify-items: start;
  padding: 0.5rem 0;
}

.notify-page__empty p {
  margin: 0;
  color: #5b7378;
}

.notify-page__cta {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 0.9rem;
  border-radius: 0.55rem;
  background: #0f5c66;
  color: #fff;
  text-decoration: none;
  font-size: 0.84rem;
  font-weight: 800;
}

.notify-page__list {
  display: grid;
  gap: 0.7rem;
  margin-top: 0.85rem;
}

.notify-card {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  padding: 0.95rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.85rem;
  background: #fbfcfd;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.notify-card.is-unread {
  border-color: rgba(15, 92, 102, 0.35);
  background: #f2fafb;
}

.notify-card__main {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
  flex: 1 1 14rem;
}

.notify-card__main h3 {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 800;
  word-break: break-word;
}

.notify-card__main p {
  margin: 0;
  color: #5b7378;
  font-size: 0.88rem;
  line-height: 1.45;
}

.notify-card__main span {
  color: #7a9094;
  font-size: 0.78rem;
  font-weight: 650;
}

.notify-card__chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.7rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: #eef3f4;
  color: #5b7378;
  font-size: 0.72rem;
  font-weight: 800;
}

.notify-card__chip.is-unread {
  background: rgba(15, 92, 102, 0.12);
  color: #0f5c66;
}

.notify-page__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.notify-page__pager-btn {
  min-height: 40px;
  padding: 0 0.9rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.55rem;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.notify-page__pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
