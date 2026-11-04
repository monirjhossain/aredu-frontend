<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const tasks = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const part = ref(null)
const loading = ref(true)
const message = ref('')

const filters = computed(() => [
  { key: null, label: t('allTypes') },
  { key: 1, label: t('speakingPart1') },
  { key: 2, label: t('speakingPart2') },
  { key: 3, label: t('speakingPart3') },
])

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/speaking-tasks', {
      params: {
        page: page.value,
        part: part.value || undefined,
      },
      skipErrorToast: true,
    })
    tasks.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function setFilter(key) {
  part.value = key
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

function partLabel(value) {
  if (Number(value) === 1) return t('speakingPart1')
  if (Number(value) === 2) return t('speakingPart2')
  if (Number(value) === 3) return t('speakingPart3')
  return value
}
</script>

<template>
  <div class="smock">
    <header class="smock__hero">
      <div>
        <p class="smock__eyebrow">{{ t('practice') }}</p>
        <h1>{{ t('speakingTasks') }}</h1>
        <p>{{ t('speakingMocksLead') }}</p>
      </div>
      <router-link class="smock__hero-link" :to="{ name: 'speaking-recordings' }">
        {{ t('mySpeakingRecordings') }}
        <span aria-hidden="true">→</span>
      </router-link>
    </header>

    <section class="smock__panel">
      <div class="smock__toolbar">
        <div class="smock__chips" role="tablist">
          <button
            v-for="chip in filters"
            :key="chip.key ?? 'all'"
            type="button"
            class="smock__chip"
            :class="{ 'is-active': part === chip.key }"
            role="tab"
            :aria-selected="part === chip.key"
            @click="setFilter(chip.key)"
          >
            {{ chip.label }}
          </button>
        </div>
        <p class="smock__count">{{ t('speakingTasksListCount', { count: meta.total || tasks.length }) }}</p>
      </div>

      <ul class="smock__tips">
        <li>{{ t('speakingTipRecord') }}</li>
        <li>{{ t('speakingTipPrep') }}</li>
        <li>{{ t('speakingTipSubmit') }}</li>
      </ul>

      <div v-if="loading" class="smock__loader">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="tasks.length === 0" class="smock__empty">
        <strong>{{ t('noSpeakingTasksPublic') }}</strong>
        <p>{{ t('speakingMocksEmptyLead') }}</p>
      </div>

      <div v-else class="smock__grid">
        <article v-for="item in tasks" :key="item.id" class="smock-card">
          <div class="smock-card__top">
            <span class="smock-card__badge">{{ partLabel(item.part) }}</span>
            <span class="smock-card__time">{{ t('questionsCount', { count: item.questions_count ?? 0 }) }}</span>
          </div>
          <h2>{{ item.title }}</h2>
          <p>{{ t('speakingMockCardLead') }}</p>
          <div class="smock-card__meta">
            <span>{{ t('prepSecondsShort', { count: item.preparation_seconds }) }}</span>
            <span>{{ t('responseSecondsShort', { count: item.response_seconds }) }}</span>
          </div>
          <router-link
            class="smock-card__cta"
            :to="{ name: 'speaking-task-detail', params: { id: item.id } }"
          >
            {{ t('openSpeakingTask') }}
            <span aria-hidden="true">→</span>
          </router-link>
        </article>
      </div>

      <div v-if="meta.last_page > 1" class="smock__pager">
        <button type="button" class="smock__pager-btn" :disabled="page <= 1 || loading" @click="goPage(page - 1)">
          {{ t('previous') }}
        </button>
        <span>{{ page }} / {{ meta.last_page }}</span>
        <button
          type="button"
          class="smock__pager-btn"
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
.smock {
  display: grid;
  gap: 1rem;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: #102a2e;
}

.smock__hero {
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
  .smock__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.smock__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.smock__hero h1 {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 1.85rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.smock__hero p {
  margin: 0.4rem 0 0;
  max-width: 46ch;
  opacity: 0.9;
  font-size: 0.92rem;
  line-height: 1.45;
}

.smock__hero-link {
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

.smock__panel {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid #d9e6e8;
  background: #fff;
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.smock__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

.smock__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.smock__chip {
  min-height: 44px;
  padding: 0 0.95rem;
  border: 1px solid #d9e6e8;
  border-radius: 999px;
  background: #f4f8f9;
  color: #5b7378;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 750;
  cursor: pointer;
}

.smock__chip.is-active {
  background: #0f5c66;
  border-color: #0f5c66;
  color: #fff;
}

.smock__count {
  margin: 0;
  color: #5b7378;
  font-size: 0.84rem;
}

.smock__tips {
  display: grid;
  gap: 0.3rem;
  margin: 0 0 1rem;
  padding: 0.75rem 0.9rem 0.75rem 1.8rem;
  border-radius: 0.75rem;
  background: rgba(15, 92, 102, 0.06);
  color: #3c5a60;
  font-size: 0.84rem;
  line-height: 1.4;
}

.smock__loader {
  display: grid;
  place-items: center;
  min-height: 160px;
}

.smock__empty {
  display: grid;
  gap: 0.35rem;
  padding: 1rem 0.25rem;
}

.smock__empty p {
  margin: 0;
  color: #5b7378;
  line-height: 1.45;
}

.smock__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.9rem;
}

@media (min-width: 720px) {
  .smock__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .smock__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.smock-card {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.9rem;
  background: #fbfcfd;
}

.smock-card__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.smock-card__badge {
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

.smock-card__time {
  color: #5b7378;
  font-size: 0.78rem;
  font-weight: 700;
}

.smock-card h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.3;
  word-break: break-word;
}

.smock-card p {
  margin: 0;
  color: #5b7378;
  font-size: 0.86rem;
  line-height: 1.4;
}

.smock-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.9rem;
  color: #3c5a60;
  font-size: 0.8rem;
  font-weight: 700;
}

.smock-card__cta {
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

.smock__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.1rem;
}

.smock__pager-btn {
  min-height: 44px;
  padding: 0 0.9rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.55rem;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.smock__pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
