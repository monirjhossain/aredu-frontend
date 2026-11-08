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
    const { data } = await http.get('/student/writing-submissions', {
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

function taskTypeLabel(value) {
  if (value === 'academic_task_1') return t('writingTaskAcademic1')
  if (value === 'general_task_1') return t('writingTaskGeneral1')
  if (value === 'task_2') return t('writingTask2')
  return value || '—'
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

function statusLabel(item) {
  return item.status === 'submitted' ? t('statusSubmitted') : t('statusDraft')
}

function evalLabel(item) {
  if (item.status !== 'submitted') return '—'
  return item.evaluation_status === 'evaluated' ? t('evaluationReturned') : t('evaluationPending')
}
</script>

<template>
  <div class="wmock-results">
    <header class="wmock-results__hero">
      <div>
        <p class="wmock-results__eyebrow">{{ t('writingTasks') }}</p>
        <h1>{{ t('myWritingSubmissions') }}</h1>
        <p>{{ t('writingSubmissionsLead') }}</p>
      </div>
      <router-link class="wmock-results__hero-link" :to="{ name: 'writing-tasks' }">
        {{ t('writingTasks') }}
        <span aria-hidden="true">→</span>
      </router-link>
    </header>

    <section class="wmock-results__panel">
      <div v-if="loading" class="wmock-results__loader">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="items.length === 0" class="wmock-results__empty">
        <strong>{{ t('noWritingSubmissions') }}</strong>
        <p>{{ t('writingSubmissionsEmptyLead') }}</p>
        <router-link class="wmock-results__cta" :to="{ name: 'writing-tasks' }">
          {{ t('openWritingTask') }}
        </router-link>
      </div>

      <template v-else>
        <div class="wmock-results__table-wrap">
          <table class="wmock-results__table">
            <thead>
              <tr>
                <th>{{ t('title') }}</th>
                <th>{{ t('writingTaskType') }}</th>
                <th>{{ t('status') }}</th>
                <th>{{ t('evaluationStatus') }}</th>
                <th>{{ t('overallBand') }}</th>
                <th>{{ t('wordCount') }}</th>
                <th>{{ t('actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.id">
                <td>
                  <strong>{{ item.task?.title || '—' }}</strong>
                  <div class="wmock-results__sub">{{ when(item.submitted_at || item.updated_at) }}</div>
                </td>
                <td>{{ taskTypeLabel(item.task?.task_type) }}</td>
                <td>
                  <span class="wmock-results__chip" :class="item.status === 'submitted' ? 'is-ok' : 'is-draft'">
                    {{ statusLabel(item) }}
                  </span>
                </td>
                <td>{{ evalLabel(item) }}</td>
                <td>{{ item.evaluation?.overall_band ?? '—' }}</td>
                <td>{{ item.word_count }}</td>
                <td>
                  <router-link
                    v-if="item.writing_task_id"
                    class="wmock-results__link"
                    :to="{ name: 'writing-editor', params: { id: item.writing_task_id } }"
                  >
                    {{ t('openWritingTask') }}
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="wmock-results__cards">
          <article v-for="item in items" :key="`m-${item.id}`" class="wmock-results__card">
            <div class="wmock-results__card-top">
              <span class="wmock-results__chip" :class="item.status === 'submitted' ? 'is-ok' : 'is-draft'">
                {{ statusLabel(item) }}
              </span>
              <span class="wmock-results__sub">{{ taskTypeLabel(item.task?.task_type) }}</span>
            </div>
            <h2>{{ item.task?.title || '—' }}</h2>
            <p>{{ when(item.submitted_at || item.updated_at) }}</p>
            <div class="wmock-results__stats">
              <span>{{ t('wordCount') }}: <strong>{{ item.word_count }}</strong></span>
              <span>{{ t('evaluationStatus') }}: <strong>{{ evalLabel(item) }}</strong></span>
              <span>{{ t('overallBand') }}: <strong>{{ item.evaluation?.overall_band ?? '—' }}</strong></span>
            </div>
            <router-link
              v-if="item.writing_task_id"
              class="wmock-results__cta"
              :to="{ name: 'writing-editor', params: { id: item.writing_task_id } }"
            >
              {{ t('openWritingTask') }}
            </router-link>
          </article>
        </div>
      </template>

      <div v-if="meta.last_page > 1" class="wmock-results__pager">
        <button type="button" class="wmock-results__pager-btn" :disabled="page <= 1 || loading" @click="goPage(page - 1)">
          {{ t('previous') }}
        </button>
        <span>{{ page }} / {{ meta.last_page }}</span>
        <button
          type="button"
          class="wmock-results__pager-btn"
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
.wmock-results {
  display: grid;
  gap: 1rem;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: #102a2e;
}

.wmock-results__hero {
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
  .wmock-results__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.wmock-results__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.wmock-results__hero h1 {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 1.85rem);
  font-weight: 800;
}

.wmock-results__hero p {
  margin: 0.4rem 0 0;
  max-width: 42ch;
  opacity: 0.9;
  font-size: 0.92rem;
  line-height: 1.45;
}

.wmock-results__hero-link {
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

.wmock-results__panel {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid #d9e6e8;
  background: #fff;
}

.wmock-results__loader {
  display: grid;
  place-items: center;
  min-height: 140px;
}

.wmock-results__empty {
  display: grid;
  gap: 0.45rem;
  justify-items: start;
}

.wmock-results__empty p {
  margin: 0;
  color: #5b7378;
}

.wmock-results__table-wrap {
  display: none;
  overflow-x: auto;
}

.wmock-results__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
}

.wmock-results__table th,
.wmock-results__table td {
  padding: 0.75rem 0.65rem;
  border-bottom: 1px solid #e7eef0;
  text-align: left;
  vertical-align: top;
  font-size: 0.9rem;
}

.wmock-results__table th {
  color: #5b7378;
  font-size: 0.78rem;
  font-weight: 750;
}

.wmock-results__sub {
  color: #5b7378;
  font-size: 0.78rem;
  font-weight: 600;
}

.wmock-results__chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.6rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
}

.wmock-results__chip.is-ok {
  background: rgba(22, 128, 80, 0.12);
  color: #166534;
}

.wmock-results__chip.is-draft {
  background: rgba(229, 76, 16, 0.2);
  color: #7a5b00;
}

.wmock-results__cards {
  display: grid;
  gap: 0.75rem;
}

.wmock-results__card {
  display: grid;
  gap: 0.4rem;
  padding: 0.95rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.85rem;
  background: #fbfcfd;
}

.wmock-results__card-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.wmock-results__card h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  word-break: break-word;
}

.wmock-results__card > p {
  margin: 0;
  color: #5b7378;
  font-size: 0.82rem;
}

.wmock-results__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 1rem;
  font-size: 0.86rem;
  color: #5b7378;
}

.wmock-results__cta,
.wmock-results__link {
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

.wmock-results__link {
  background: transparent;
  color: #0f5c66;
  padding: 0;
  min-height: 44px;
}

.wmock-results__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.wmock-results__pager-btn {
  min-height: 44px;
  padding: 0 0.9rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.55rem;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.wmock-results__pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (min-width: 900px) {
  .wmock-results__table-wrap {
    display: block;
  }

  .wmock-results__cards {
    display: none;
  }
}
</style>
