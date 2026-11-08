<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { useLocaleStore } from '../../stores/locale'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const localeStore = useLocaleStore()

const analytics = ref(null)
const loading = ref(true)
const message = ref('')

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/student/skill-analytics', { skipErrorToast: true })
    analytics.value = data.data
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

const latestCards = computed(() => {
  const bands = analytics.value?.latest_bands || {}
  return [
    { key: 'reading', label: t('reading'), band: bands.reading },
    { key: 'listening', label: t('listening'), band: bands.listening },
    { key: 'writing', label: t('writing'), band: bands.writing },
    { key: 'speaking', label: t('speaking'), band: bands.speaking },
  ]
})

function bandText(value) {
  if (value === null || value === undefined || value === '') return '—'
  return Number(value).toFixed(1)
}

function when(value) {
  if (!value) return '—'
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function criterionLabel(key) {
  const map = {
    task_response: t('taskResponse'),
    coherence: t('coherence'),
    lexical: t('lexical'),
    grammar: t('grammar'),
    fluency: t('fluency'),
    pronunciation: t('pronunciation'),
  }
  return map[key] || key
}

function contextLabel(value) {
  return value === 'full_mock' ? t('contextFullMock') : t('contextPractice')
}

const writingWeak = computed(() => analytics.value?.weak_areas?.writing || null)
const speakingWeak = computed(() => analytics.value?.weak_areas?.speaking || null)
const readingWeak = computed(() => analytics.value?.weak_areas?.reading || null)
const listeningWeak = computed(() => analytics.value?.weak_areas?.listening || null)

const pendingWriting = computed(() => analytics.value?.pending_teacher_evaluations?.writing || { total: 0, items: [] })
const pendingSpeaking = computed(() => analytics.value?.pending_teacher_evaluations?.speaking || { total: 0, items: [] })

const readingHistory = computed(() => [...(analytics.value?.bands_over_time?.reading || [])].reverse())
const listeningHistory = computed(() => [...(analytics.value?.bands_over_time?.listening || [])].reverse())
const writingHistory = computed(() => [...(analytics.value?.bands_over_time?.writing || [])].reverse())
const speakingHistory = computed(() => [...(analytics.value?.bands_over_time?.speaking || [])].reverse())
const fullMocks = computed(() => analytics.value?.full_mock_sessions || [])
</script>

<template>
  <div class="skill-analytics">
    <header class="skill-analytics__hero">
      <p class="skill-analytics__eyebrow">{{ t('studentDashboard') }}</p>
      <h1>{{ t('skillAnalytics') }}</h1>
      <p>{{ t('skillAnalyticsLead') }}</p>
    </header>

    <div v-if="loading" class="skill-analytics__loading">
      <v-progress-circular indeterminate color="#0f5c66" />
    </div>
    <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>

    <template v-else-if="analytics">
      <section class="skill-analytics__bands">
        <article v-for="card in latestCards" :key="card.key" class="skill-analytics__band-card">
          <p>{{ card.label }}</p>
          <strong>{{ bandText(card.band) }}</strong>
          <span>{{ t('latestBand') }}</span>
        </article>
      </section>

      <section class="skill-analytics__grid">
        <article class="skill-analytics__panel">
          <div class="skill-analytics__panel-head">
            <h2>{{ t('weakAreas') }}</h2>
            <p>{{ t('weakAreasLead') }}</p>
          </div>
          <ul class="skill-analytics__weak-list">
            <li>
              <strong>{{ t('reading') }}</strong>
              <p v-if="readingWeak?.average_band != null">
                {{ t('averageBand') }}: {{ bandText(readingWeak.average_band) }}
                <template v-if="readingWeak.average_accuracy_percent != null">
                  · {{ t('averageAccuracy') }}: {{ readingWeak.average_accuracy_percent }}%
                </template>
              </p>
              <p v-else class="is-muted">{{ t('noSkillDataYet') }}</p>
              <p v-if="readingWeak?.lowest" class="is-soft">
                {{ t('lowestAttempt') }}: {{ readingWeak.lowest.title }} ({{ bandText(readingWeak.lowest.band_score) }})
              </p>
            </li>
            <li>
              <strong>{{ t('listening') }}</strong>
              <p v-if="listeningWeak?.average_band != null">
                {{ t('averageBand') }}: {{ bandText(listeningWeak.average_band) }}
                <template v-if="listeningWeak.average_accuracy_percent != null">
                  · {{ t('averageAccuracy') }}: {{ listeningWeak.average_accuracy_percent }}%
                </template>
              </p>
              <p v-else class="is-muted">{{ t('noSkillDataYet') }}</p>
              <p v-if="listeningWeak?.lowest" class="is-soft">
                {{ t('lowestAttempt') }}: {{ listeningWeak.lowest.title }} ({{ bandText(listeningWeak.lowest.band_score) }})
              </p>
            </li>
            <li>
              <strong>{{ t('writing') }}</strong>
              <p v-if="writingWeak?.weakest_criterion">
                {{ t('weakestCriterion') }}:
                {{ criterionLabel(writingWeak.weakest_criterion) }}
                ({{ bandText(writingWeak.weakest_average) }})
              </p>
              <p v-else class="is-muted">{{ t('noSkillDataYet') }}</p>
            </li>
            <li>
              <strong>{{ t('speaking') }}</strong>
              <p v-if="speakingWeak?.weakest_criterion">
                {{ t('weakestCriterion') }}:
                {{ criterionLabel(speakingWeak.weakest_criterion) }}
                ({{ bandText(speakingWeak.weakest_average) }})
              </p>
              <p v-else class="is-muted">{{ t('noSkillDataYet') }}</p>
            </li>
          </ul>
        </article>

        <article class="skill-analytics__panel">
          <div class="skill-analytics__panel-head">
            <h2>{{ t('pendingTeacherEvaluations') }}</h2>
            <p>{{ t('pendingTeacherEvaluationsLead') }}</p>
          </div>
          <div class="skill-analytics__pending">
            <div>
              <h3>{{ t('writing') }} · {{ pendingWriting.total }}</h3>
              <ul v-if="pendingWriting.items?.length">
                <li v-for="item in pendingWriting.items" :key="`w-${item.id}`">
                  <router-link :to="{ name: 'writing-editor', params: { id: item.task_id } }">
                    {{ item.title || t('writing') }}
                  </router-link>
                  <span>{{ when(item.submitted_at) }}</span>
                </li>
              </ul>
              <p v-else class="is-muted">{{ t('noPendingWriting') }}</p>
            </div>
            <div>
              <h3>{{ t('speaking') }} · {{ pendingSpeaking.total }}</h3>
              <ul v-if="pendingSpeaking.items?.length">
                <li v-for="item in pendingSpeaking.items" :key="`s-${item.id}`">
                  <router-link :to="{ name: 'speaking-task-detail', params: { id: item.task_id } }">
                    {{ item.title || t('speaking') }}
                  </router-link>
                  <span>{{ when(item.submitted_at) }}</span>
                </li>
              </ul>
              <p v-else class="is-muted">{{ t('noPendingSpeaking') }}</p>
            </div>
          </div>
        </article>
      </section>

      <section class="skill-analytics__panel">
        <div class="skill-analytics__panel-head">
          <h2>{{ t('scoreHistory') }}</h2>
          <p>{{ t('scoreHistoryLead') }}</p>
        </div>

        <div class="skill-analytics__history-grid">
          <div>
            <h3>{{ t('reading') }}</h3>
            <ul v-if="readingHistory.length" class="skill-analytics__history">
              <li v-for="row in readingHistory" :key="`r-${row.attempt_id}`">
                <div>
                  <strong>{{ row.title || '—' }}</strong>
                  <span>{{ contextLabel(row.context_label) }} · {{ when(row.submitted_at) }}</span>
                </div>
                <em>{{ bandText(row.band_score) }}</em>
              </li>
            </ul>
            <p v-else class="is-muted">{{ t('noSkillDataYet') }}</p>
          </div>
          <div>
            <h3>{{ t('listening') }}</h3>
            <ul v-if="listeningHistory.length" class="skill-analytics__history">
              <li v-for="row in listeningHistory" :key="`l-${row.attempt_id}`">
                <div>
                  <strong>{{ row.title || '—' }}</strong>
                  <span>{{ contextLabel(row.context_label) }} · {{ when(row.submitted_at) }}</span>
                </div>
                <em>{{ bandText(row.band_score) }}</em>
              </li>
            </ul>
            <p v-else class="is-muted">{{ t('noSkillDataYet') }}</p>
          </div>
          <div>
            <h3>{{ t('writing') }}</h3>
            <ul v-if="writingHistory.length" class="skill-analytics__history">
              <li v-for="row in writingHistory" :key="`w-${row.evaluation_id}`">
                <div>
                  <strong>{{ row.title || '—' }}</strong>
                  <span>{{ contextLabel(row.context_label) }} · {{ when(row.evaluated_at) }}</span>
                </div>
                <em>{{ bandText(row.overall_band) }}</em>
              </li>
            </ul>
            <p v-else class="is-muted">{{ t('noSkillDataYet') }}</p>
          </div>
          <div>
            <h3>{{ t('speaking') }}</h3>
            <ul v-if="speakingHistory.length" class="skill-analytics__history">
              <li v-for="row in speakingHistory" :key="`s-${row.evaluation_id}`">
                <div>
                  <strong>{{ row.title || '—' }}</strong>
                  <span>{{ contextLabel(row.context_label) }} · {{ when(row.evaluated_at) }}</span>
                </div>
                <em>{{ bandText(row.overall_band) }}</em>
              </li>
            </ul>
            <p v-else class="is-muted">{{ t('noSkillDataYet') }}</p>
          </div>
        </div>
      </section>

      <section class="skill-analytics__panel">
        <div class="skill-analytics__panel-head">
          <h2>{{ t('fullMockHistory') }}</h2>
          <p>{{ t('fullMockHistoryLead') }}</p>
        </div>
        <ul v-if="fullMocks.length" class="skill-analytics__history">
          <li v-for="session in fullMocks" :key="session.uuid">
            <div>
              <strong>
                <router-link :to="{ name: 'full-mock-session', params: { uuid: session.uuid } }">
                  {{ session.exam_title || t('fullMockExams') }}
                </router-link>
              </strong>
              <span>
                {{ when(session.completed_at) }}
                ·
                {{ session.overall_pending ? t('overallPending') : `${t('overallBand')}: ${bandText(session.overall_band)}` }}
              </span>
            </div>
            <em>{{ bandText(session.overall_band) }}</em>
          </li>
        </ul>
        <p v-else class="is-muted">{{ t('noFullMockHistory') }}</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.skill-analytics {
  width: min(1100px, 100%);
  margin: 0 auto;
  padding: 1rem 1rem 2.5rem;
  display: grid;
  gap: 0.85rem;
}

.skill-analytics__hero {
  padding: 1.1rem 1.15rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at top right, rgba(229, 76, 16, 0.22), transparent 45%),
    linear-gradient(135deg, #0f5c66, #147a86 55%, #0c4a52);
  color: #fff;
}

.skill-analytics__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.85;
}

.skill-analytics__hero h1 {
  margin: 0.35rem 0 0.4rem;
  font-size: clamp(1.45rem, 4vw, 2rem);
  letter-spacing: -0.03em;
}

.skill-analytics__hero p {
  margin: 0;
  max-width: 40rem;
  opacity: 0.9;
  line-height: 1.5;
}

.skill-analytics__loading {
  display: grid;
  place-items: center;
  min-height: 10rem;
}

.skill-analytics__bands {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.skill-analytics__band-card {
  padding: 0.9rem 1rem;
  border-radius: 0.85rem;
  background: #fff;
  border: 1px solid rgba(15, 92, 102, 0.14);
}

.skill-analytics__band-card p,
.skill-analytics__band-card span {
  margin: 0;
  color: rgba(16, 42, 46, 0.62);
  font-size: 0.78rem;
  font-weight: 700;
}

.skill-analytics__band-card strong {
  display: block;
  margin: 0.25rem 0;
  color: #0f5c66;
  font-size: 1.55rem;
  letter-spacing: -0.03em;
}

.skill-analytics__grid {
  display: grid;
  gap: 0.85rem;
}

.skill-analytics__panel {
  padding: 0.95rem 1rem;
  border-radius: 0.85rem;
  background: #fff;
  border: 1px solid rgba(15, 92, 102, 0.14);
}

.skill-analytics__panel-head h2,
.skill-analytics__history-grid h3,
.skill-analytics__pending h3 {
  margin: 0;
  font-size: 1rem;
  color: #102a2e;
}

.skill-analytics__panel-head p {
  margin: 0.25rem 0 0;
  color: rgba(16, 42, 46, 0.62);
  font-size: 0.82rem;
}

.skill-analytics__weak-list,
.skill-analytics__history,
.skill-analytics__pending ul {
  list-style: none;
  margin: 0.85rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.65rem;
}

.skill-analytics__weak-list li,
.skill-analytics__history li {
  padding: 0.7rem 0.8rem;
  border-radius: 0.65rem;
  background: rgba(15, 92, 102, 0.045);
  border: 1px solid rgba(15, 92, 102, 0.08);
}

.skill-analytics__weak-list p,
.skill-analytics__history span {
  margin: 0.2rem 0 0;
  color: rgba(16, 42, 46, 0.7);
  font-size: 0.82rem;
}

.skill-analytics__history li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.skill-analytics__history em {
  font-style: normal;
  font-weight: 800;
  color: #0f5c66;
}

.skill-analytics__pending {
  display: grid;
  gap: 1rem;
  margin-top: 0.85rem;
}

.skill-analytics__pending li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.35rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid rgba(15, 92, 102, 0.08);
}

.skill-analytics__pending a {
  color: #0f5c66;
  font-weight: 700;
  text-decoration: none;
}

.skill-analytics__history-grid {
  display: grid;
  gap: 1rem;
  margin-top: 0.85rem;
}

.is-muted {
  color: rgba(16, 42, 46, 0.55) !important;
}

.is-soft {
  color: rgba(16, 42, 46, 0.72) !important;
}

@media (min-width: 720px) {
  .skill-analytics__bands {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .skill-analytics__grid {
    grid-template-columns: 1.2fr 1fr;
  }

  .skill-analytics__history-grid {
    grid-template-columns: 1fr 1fr;
  }

  .skill-analytics__pending {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
