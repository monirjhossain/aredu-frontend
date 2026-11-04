<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const tests = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const examType = ref('')
const loading = ref(true)
const message = ref('')

const filters = computed(() => [
  { key: '', label: t('allTypes') },
  { key: 'academic', label: t('academic') },
  { key: 'general', label: t('general') },
])

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/listening-tests', {
      params: {
        page: page.value,
        exam_type: examType.value || undefined,
      },
      skipErrorToast: true,
    })
    tests.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function setFilter(key) {
  examType.value = key
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

function minutes(seconds) {
  return t('minutesCount', { count: Math.round(Number(seconds || 0) / 60) })
}

function examLabel(type) {
  return type === 'general' ? t('general') : t('academic')
}
</script>

<template>
  <div class="rmock">
    <header class="rmock__hero">
      <div>
        <p class="rmock__eyebrow">{{ t('practice') }}</p>
        <h1>{{ t('listeningTests') }}</h1>
        <p>{{ t('listeningMocksLead') }}</p>
      </div>
      <router-link class="rmock__hero-link" :to="{ name: 'listening-results' }">
        {{ t('listeningResults') }}
        <span aria-hidden="true">→</span>
      </router-link>
    </header>

    <section class="rmock__panel">
      <div class="rmock__toolbar">
        <div class="rmock__chips" role="tablist">
          <button
            v-for="chip in filters"
            :key="chip.key || 'all'"
            type="button"
            class="rmock__chip"
            :class="{ 'is-active': examType === chip.key }"
            role="tab"
            :aria-selected="examType === chip.key"
            @click="setFilter(chip.key)"
          >
            {{ chip.label }}
          </button>
        </div>
        <p class="rmock__count">{{ meta.total || tests.length }} {{ t('listeningTests') }}</p>
      </div>

      <div v-if="loading" class="rmock__loader">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="tests.length === 0" class="rmock__empty">
        <strong>{{ t('noListeningTestsPublic') }}</strong>
        <p>{{ t('listeningMocksEmptyLead') }}</p>
      </div>

      <div v-else class="rmock__grid">
        <article v-for="item in tests" :key="item.id" class="rmock-card">
          <div class="rmock-card__top">
            <span class="rmock-card__badge">{{ examLabel(item.exam_type) }}</span>
            <span class="rmock-card__time">{{ minutes(item.duration_seconds) }}</span>
          </div>
          <h2>{{ item.title }}</h2>
          <p>{{ t('listeningMockCardLead') }}</p>
          <router-link
            class="rmock-card__cta"
            :to="{ name: 'listening-test-intro', params: { slug: item.slug } }"
          >
            {{ t('openListeningTest') }}
            <span aria-hidden="true">→</span>
          </router-link>
        </article>
      </div>

      <div v-if="meta.last_page > 1" class="rmock__pager">
        <button type="button" class="rmock__pager-btn" :disabled="page <= 1 || loading" @click="goPage(page - 1)">
          {{ t('previous') }}
        </button>
        <span>{{ page }} / {{ meta.last_page }}</span>
        <button
          type="button"
          class="rmock__pager-btn"
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
.rmock {
  display: grid;
  gap: 1rem;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: #102a2e;
}

.rmock__hero {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.2rem 1.25rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at top right, rgba(245, 197, 24, 0.22), transparent 42%),
    linear-gradient(135deg, #0b3d36 0%, #0f5c66 55%, #0a2a3a 100%);
  color: #fff;
}

@media (min-width: 720px) {
  .rmock__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.rmock__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.rmock__hero h1 {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 1.85rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.rmock__hero p {
  margin: 0.4rem 0 0;
  max-width: 46ch;
  opacity: 0.9;
  font-size: 0.92rem;
  line-height: 1.45;
}

.rmock__hero-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 1rem;
  border-radius: 0.65rem;
  background: #f5c518;
  color: #1a1400;
  text-decoration: none;
  font-size: 0.86rem;
  font-weight: 800;
  width: fit-content;
}

.rmock__panel {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid #d9e6e8;
  background: #fff;
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.rmock__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.rmock__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.rmock__chip {
  min-height: 40px;
  padding: 0 0.9rem;
  border: 1px solid #d9e6e8;
  border-radius: 999px;
  background: #f4f8f9;
  color: #5b7378;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 750;
  cursor: pointer;
}

.rmock__chip.is-active {
  background: #0f5c66;
  border-color: #0f5c66;
  color: #fff;
}

.rmock__count {
  margin: 0;
  color: #5b7378;
  font-size: 0.84rem;
}

.rmock__loader {
  display: grid;
  place-items: center;
  min-height: 160px;
}

.rmock__empty {
  display: grid;
  gap: 0.35rem;
  padding: 1rem 0.25rem;
}

.rmock__empty p {
  margin: 0;
  color: #5b7378;
  line-height: 1.45;
}

.rmock__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.9rem;
}

@media (min-width: 720px) {
  .rmock__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .rmock__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.rmock-card {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.9rem;
  background: #fbfcfd;
}

.rmock-card__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.rmock-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.6rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: rgba(15, 92, 102, 0.12);
  color: #0f5c66;
  font-size: 0.72rem;
  font-weight: 800;
}

.rmock-card__time {
  color: #5b7378;
  font-size: 0.78rem;
  font-weight: 700;
}

.rmock-card h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.3;
  word-break: break-word;
}

.rmock-card p {
  margin: 0;
  color: #5b7378;
  font-size: 0.86rem;
  line-height: 1.4;
}

.rmock-card__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 44px;
  margin-top: auto;
  padding: 0 1rem;
  border-radius: 0.65rem;
  background: #0b1b34;
  color: #fff;
  text-decoration: none;
  font-size: 0.86rem;
  font-weight: 800;
}

.rmock__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.1rem;
}

.rmock__pager-btn {
  min-height: 40px;
  padding: 0 0.9rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.55rem;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.rmock__pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
