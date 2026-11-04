<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocaleStore } from '../../stores/locale'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const localeStore = useLocaleStore()
const rows = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const loading = ref(true)
const message = ref('')

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/student/reading-attempts', {
      params: { page: page.value },
      skipErrorToast: true,
    })
    rows.value = data.data || []
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
  <div class="rmock-results">
    <header class="rmock-results__hero">
      <div>
        <p class="rmock-results__eyebrow">{{ t('readingTests') }}</p>
        <h1>{{ t('readingResults') }}</h1>
        <p>{{ t('readingResultsLead') }}</p>
      </div>
      <router-link class="rmock-results__hero-link" :to="{ name: 'reading-tests' }">
        {{ t('readingTests') }}
        <span aria-hidden="true">→</span>
      </router-link>
    </header>

    <section class="rmock-results__panel">
      <div v-if="loading" class="rmock-results__loader">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="rows.length === 0" class="rmock-results__empty">
        <strong>{{ t('noReadingResults') }}</strong>
        <p>{{ t('readingResultsEmptyLead') }}</p>
        <router-link class="rmock-results__cta" :to="{ name: 'reading-tests' }">
          {{ t('openReadingTest') }}
        </router-link>
      </div>

      <template v-else>
        <div class="rmock-results__table-wrap">
          <table class="rmock-results__table">
            <thead>
              <tr>
                <th>{{ t('title') }}</th>
                <th>{{ t('submittedAt') }}</th>
                <th>{{ t('yourScore') }}</th>
                <th>{{ t('bandScore') }}</th>
                <th>{{ t('actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td>
                  <strong>{{ row.test?.title || '—' }}</strong>
                </td>
                <td>{{ when(row.submitted_at) }}</td>
                <td>
                  {{ row.result ? `${row.result.raw_score}/${row.result.max_score}` : '—' }}
                </td>
                <td>{{ row.result?.band_score ?? t('bandPending') }}</td>
                <td>
                  <router-link
                    class="rmock-results__link"
                    :to="{ name: 'reading-attempt', params: { attemptId: row.id } }"
                  >
                    {{ t('viewAttempt') }}
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rmock-results__cards">
          <article v-for="row in rows" :key="`m-${row.id}`" class="rmock-results__card">
            <h2>{{ row.test?.title || '—' }}</h2>
            <p>{{ when(row.submitted_at) }}</p>
            <div class="rmock-results__stats">
              <span>
                {{ t('yourScore') }}:
                <strong>{{ row.result ? `${row.result.raw_score}/${row.result.max_score}` : '—' }}</strong>
              </span>
              <span>
                {{ t('bandScore') }}:
                <strong>{{ row.result?.band_score ?? t('bandPending') }}</strong>
              </span>
            </div>
            <router-link
              class="rmock-results__cta"
              :to="{ name: 'reading-attempt', params: { attemptId: row.id } }"
            >
              {{ t('viewAttempt') }}
            </router-link>
          </article>
        </div>
      </template>

      <div v-if="meta.last_page > 1" class="rmock-results__pager">
        <button type="button" class="rmock-results__pager-btn" :disabled="page <= 1 || loading" @click="goPage(page - 1)">
          {{ t('previous') }}
        </button>
        <span>{{ page }} / {{ meta.last_page }}</span>
        <button
          type="button"
          class="rmock-results__pager-btn"
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
.rmock-results {
  display: grid;
  gap: 1rem;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: #102a2e;
}

.rmock-results__hero {
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
  .rmock-results__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.rmock-results__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.rmock-results__hero h1 {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 1.85rem);
  font-weight: 800;
}

.rmock-results__hero p {
  margin: 0.4rem 0 0;
  max-width: 42ch;
  opacity: 0.9;
  font-size: 0.92rem;
  line-height: 1.45;
}

.rmock-results__hero-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 1rem;
  border-radius: 0.65rem;
  background: #f5c518;
  color: #1a1400;
  text-decoration: none;
  font-weight: 800;
  width: fit-content;
}

.rmock-results__panel {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid #d9e6e8;
  background: #fff;
}

.rmock-results__loader {
  display: grid;
  place-items: center;
  min-height: 140px;
}

.rmock-results__empty {
  display: grid;
  gap: 0.45rem;
  justify-items: start;
}

.rmock-results__empty p {
  margin: 0;
  color: #5b7378;
}

.rmock-results__table-wrap {
  display: none;
  overflow-x: auto;
}

.rmock-results__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 640px;
}

.rmock-results__table th,
.rmock-results__table td {
  padding: 0.75rem 0.65rem;
  border-bottom: 1px solid #e7eef0;
  text-align: left;
  vertical-align: top;
  font-size: 0.9rem;
}

.rmock-results__table th {
  color: #5b7378;
  font-size: 0.78rem;
  font-weight: 750;
}

.rmock-results__cards {
  display: grid;
  gap: 0.75rem;
}

.rmock-results__card {
  display: grid;
  gap: 0.4rem;
  padding: 0.95rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.85rem;
  background: #fbfcfd;
}

.rmock-results__card h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  word-break: break-word;
}

.rmock-results__card > p {
  margin: 0;
  color: #5b7378;
  font-size: 0.82rem;
}

.rmock-results__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 1rem;
  font-size: 0.86rem;
  color: #5b7378;
}

.rmock-results__cta,
.rmock-results__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 0.9rem;
  border-radius: 0.55rem;
  background: #0f5c66;
  color: #fff;
  text-decoration: none;
  font-size: 0.84rem;
  font-weight: 800;
  width: fit-content;
}

.rmock-results__link {
  background: transparent;
  color: #0f5c66;
  padding: 0;
  min-height: auto;
}

.rmock-results__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.rmock-results__pager-btn {
  min-height: 40px;
  padding: 0 0.9rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.55rem;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

@media (min-width: 900px) {
  .rmock-results__table-wrap {
    display: block;
  }

  .rmock-results__cards {
    display: none;
  }
}
</style>
