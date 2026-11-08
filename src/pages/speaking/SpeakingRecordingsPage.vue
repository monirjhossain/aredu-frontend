<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocaleStore } from '../../stores/locale'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const localeStore = useLocaleStore()
const items = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const loading = ref(true)
const message = ref('')

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/student/speaking-recordings', {
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

function goPage(next) {
  page.value = next
  load()
}

function partLabel(value) {
  if (Number(value) === 1) return t('speakingPart1')
  if (Number(value) === 2) return t('speakingPart2')
  if (Number(value) === 3) return t('speakingPart3')
  return value || '—'
}

function evaluationLabel(item) {
  if (item.status !== 'submitted') return '—'
  if (item.evaluation_status === 'evaluated') return t('evaluationReturned')
  return t('evaluationPending')
}

function statusLabel(item) {
  return item.status === 'submitted' ? t('statusSubmitted') : t('statusUploaded')
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
  <div class="smock-results">
    <header class="smock-results__hero">
      <div>
        <p class="smock-results__eyebrow">{{ t('speakingTasks') }}</p>
        <h1>{{ t('mySpeakingRecordings') }}</h1>
        <p>{{ t('speakingRecordingsLead') }}</p>
      </div>
      <router-link class="smock-results__hero-link" :to="{ name: 'speaking-tasks' }">
        {{ t('speakingTasks') }}
        <span aria-hidden="true">→</span>
      </router-link>
    </header>

    <section class="smock-results__panel">
      <div v-if="loading" class="smock-results__loader">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="items.length === 0" class="smock-results__empty">
        <strong>{{ t('noSpeakingRecordings') }}</strong>
        <p>{{ t('speakingRecordingsEmptyLead') }}</p>
        <router-link class="smock-results__cta" :to="{ name: 'speaking-tasks' }">
          {{ t('openSpeakingTask') }}
        </router-link>
      </div>

      <template v-else>
        <div class="smock-results__table-wrap">
          <table class="smock-results__table">
            <thead>
              <tr>
                <th>{{ t('title') }}</th>
                <th>{{ t('speakingPart') }}</th>
                <th>{{ t('status') }}</th>
                <th>{{ t('evaluationStatus') }}</th>
                <th>{{ t('overallBand') }}</th>
                <th>{{ t('actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.id">
                <td>
                  <strong>{{ item.task?.title || '—' }}</strong>
                  <div class="smock-results__sub">{{ when(item.submitted_at || item.updated_at) }}</div>
                </td>
                <td>{{ partLabel(item.task?.part) }}</td>
                <td>
                  <span class="smock-results__chip" :class="{ 'is-ok': item.status === 'submitted' }">{{ statusLabel(item) }}</span>
                </td>
                <td>{{ evaluationLabel(item) }}</td>
                <td>{{ item.evaluation?.overall_band ?? '—' }}</td>
                <td>
                  <router-link
                    v-if="item.speaking_task_id"
                    class="smock-results__link"
                    :to="{ name: 'speaking-task-detail', params: { id: item.speaking_task_id } }"
                  >
                    {{ t('openSpeakingTask') }}
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="smock-results__cards">
          <article v-for="item in items" :key="`m-${item.id}`" class="smock-results__card">
            <div class="smock-results__card-top">
              <span class="smock-results__badge">{{ partLabel(item.task?.part) }}</span>
              <span class="smock-results__chip" :class="{ 'is-ok': item.status === 'submitted' }">{{ statusLabel(item) }}</span>
            </div>
            <h2>{{ item.task?.title || '—' }}</h2>
            <p>{{ when(item.submitted_at || item.updated_at) }}</p>
            <div class="smock-results__stats">
              <span>
                {{ t('evaluationStatus') }}:
                <strong>{{ evaluationLabel(item) }}</strong>
              </span>
              <span>
                {{ t('overallBand') }}:
                <strong>{{ item.evaluation?.overall_band ?? '—' }}</strong>
              </span>
            </div>
            <router-link
              v-if="item.speaking_task_id"
              class="smock-results__cta"
              :to="{ name: 'speaking-task-detail', params: { id: item.speaking_task_id } }"
            >
              {{ t('openSpeakingTask') }}
            </router-link>
          </article>
        </div>
      </template>

      <div v-if="meta.last_page > 1" class="smock-results__pager">
        <button type="button" class="smock-results__pager-btn" :disabled="page <= 1 || loading" @click="goPage(page - 1)">
          {{ t('previous') }}
        </button>
        <span>{{ page }} / {{ meta.last_page }}</span>
        <button
          type="button"
          class="smock-results__pager-btn"
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
.smock-results {
  display: grid;
  gap: 1rem;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: #102a2e;
}

.smock-results__hero {
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
  .smock-results__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.smock-results__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.smock-results__hero h1 {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 1.85rem);
  font-weight: 800;
}

.smock-results__hero p {
  margin: 0.4rem 0 0;
  max-width: 46ch;
  opacity: 0.9;
  font-size: 0.92rem;
  line-height: 1.45;
}

.smock-results__hero-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 1rem;
  border-radius: 0.65rem;
  background: #e54c10;
  color: #fff;
  text-decoration: none;
  font-weight: 800;
  width: fit-content;
}

.smock-results__panel {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid #d9e6e8;
  background: #fff;
}

.smock-results__loader {
  display: grid;
  place-items: center;
  min-height: 140px;
}

.smock-results__empty {
  display: grid;
  gap: 0.45rem;
  justify-items: start;
}

.smock-results__empty p {
  margin: 0;
  color: #5b7378;
}

.smock-results__table-wrap {
  display: none;
  overflow-x: auto;
}

.smock-results__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
}

.smock-results__table th,
.smock-results__table td {
  padding: 0.75rem 0.65rem;
  border-bottom: 1px solid #e7eef0;
  text-align: left;
  vertical-align: top;
  font-size: 0.9rem;
}

.smock-results__table th {
  color: #5b7378;
  font-size: 0.78rem;
  font-weight: 750;
}

.smock-results__sub {
  margin-top: 0.15rem;
  color: #5b7378;
  font-size: 0.78rem;
}

.smock-results__cards {
  display: grid;
  gap: 0.75rem;
}

.smock-results__card {
  display: grid;
  gap: 0.4rem;
  padding: 0.95rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.85rem;
  background: #fbfcfd;
}

.smock-results__card-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.smock-results__card h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  word-break: break-word;
}

.smock-results__card > p {
  margin: 0;
  color: #5b7378;
  font-size: 0.82rem;
}

.smock-results__badge,
.smock-results__chip {
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

.smock-results__chip {
  background: rgba(229, 76, 16, 0.22);
  color: #7a5a00;
}

.smock-results__chip.is-ok {
  background: rgba(22, 130, 73, 0.14);
  color: #167a46;
}

.smock-results__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 1rem;
  font-size: 0.86rem;
  color: #5b7378;
}

.smock-results__cta,
.smock-results__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 0.9rem;
  border-radius: 0.55rem;
  background: #0f5c66;
  color: #fff;
  text-decoration: none;
  font-size: 0.84rem;
  font-weight: 800;
  width: fit-content;
}

.smock-results__link {
  background: transparent;
  color: #0f5c66;
  padding: 0;
}

.smock-results__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.smock-results__pager-btn {
  min-height: 44px;
  padding: 0 0.9rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.55rem;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.smock-results__pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (min-width: 900px) {
  .smock-results__table-wrap {
    display: block;
  }

  .smock-results__cards {
    display: none;
  }
}
</style>
