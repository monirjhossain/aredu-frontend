<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { useUiStore } from '../../stores/ui'
import { firstApiMessage } from '../../composables/useFullMockContext'

const HEARTBEAT_MS = 20000

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const ui = useUiStore()

const payload = ref(null)
const loading = ref(true)
const message = ref('')
const busyId = ref(null)
const abandoning = ref(false)
const confirmAbandon = ref(false)

// Local countdown: deadlines (ms epoch) per in-progress section, derived from server seconds_remaining.
const deadlines = ref({})
const now = ref(Date.now())
let heartbeatTimer = null
let tickTimer = null
let expiryReloaded = false

const session = computed(() => payload.value?.session || null)
const exam = computed(() => payload.value?.exam || null)
const sections = computed(() => payload.value?.sections || [])
const scorecard = computed(() => payload.value?.scorecard || null)
const isActive = computed(() => session.value?.status === 'in_progress')
const isCompleted = computed(() => session.value?.status === 'completed')
const isAbandoned = computed(() => session.value?.status === 'abandoned')
const showScorecard = computed(() => Boolean(scorecard.value) && (isCompleted.value || isAbandoned.value))

onMounted(() => {
  load()
  tickTimer = setInterval(tick, 1000)
  heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS)
})
onBeforeUnmount(() => {
  clearInterval(tickTimer)
  clearInterval(heartbeatTimer)
})
watch(() => route.params.uuid, () => load())

function applyPayload(data) {
  payload.value = {
    session: data.session,
    exam: data.exam,
    sections: data.sections,
    scorecard: data.scorecard || null,
  }
  const next = {}
  for (const section of data.sections || []) {
    if (section.status === 'in_progress' && section.seconds_remaining != null) {
      next[section.id] = Date.now() + Number(section.seconds_remaining) * 1000
    }
  }
  deadlines.value = next
  expiryReloaded = false
}

async function load(silent = false) {
  if (!silent) loading.value = true
  message.value = ''
  try {
    const { data } = await http.get(`/full-mock-sessions/${route.params.uuid}`, { skipErrorToast: true })
    applyPayload(data.data)
  } catch (error) {
    message.value = firstApiMessage(error, t('requestFailed'))
  } finally {
    loading.value = false
  }
}

function tick() {
  now.value = Date.now()
  if (!isActive.value || expiryReloaded) return
  const expired = Object.values(deadlines.value).some((deadline) => deadline <= now.value)
  if (expired) {
    expiryReloaded = true
    load(true)
  }
}

async function heartbeat() {
  if (!payload.value || !isActive.value || document.hidden) return
  try {
    const { data } = await http.post(`/full-mock-sessions/${route.params.uuid}/heartbeat`, {}, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    const hb = data.data
    const changed = hb.session?.status !== session.value?.status
      || (hb.sections || []).some((item) => {
        const local = sections.value.find((s) => s.id === item.id)
        return !local || local.status !== item.status
      })
    if (changed) {
      await load(true)
      return
    }
    for (const item of hb.sections || []) {
      if (item.status === 'in_progress' && item.seconds_remaining != null) {
        deadlines.value = { ...deadlines.value, [item.id]: Date.now() + Number(item.seconds_remaining) * 1000 }
      }
    }
  } catch {
    // Transient errors are ignored; next beat retries.
  }
}

function secondsLeft(section) {
  const deadline = deadlines.value[section.id]
  if (!deadline) return null
  return Math.max(0, Math.round((deadline - now.value) / 1000))
}

function clock(total) {
  const h = Math.floor(total / 3600)
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

function skillLabel(skill) {
  return t(`skill${skill.charAt(0).toUpperCase()}${skill.slice(1)}`)
}

function skillIcon(skill) {
  return {
    listening: 'mdi-headphones',
    reading: 'mdi-book-open-variant',
    writing: 'mdi-pencil-outline',
    speaking: 'mdi-microphone-outline',
  }[skill] || 'mdi-clipboard-text-outline'
}

function statusLabel(status) {
  return {
    locked: t('fullMockSectionLocked'),
    ready: t('fullMockSectionReady'),
    in_progress: t('fullMockSectionInProgress'),
    completed: t('fullMockSectionCompleted'),
    expired: t('fullMockSectionExpired'),
  }[status] || status
}

function skillScoreLabel(skill) {
  const row = scorecard.value?.skills?.[skill]
  if (!row) return t('fullMockSkillNotInExam')
  if (row.status === 'scored' && row.band_score != null) return String(row.band_score)
  if (row.status === 'pending') return t('fullMockBandPending')
  return t('fullMockBandNotStarted')
}

function isCurrent(section) {
  return isActive.value
    && (section.status === 'ready' || section.status === 'in_progress')
    && Number(section.position) === Number(session.value?.current_position)
}

async function enter(section) {
  busyId.value = section.id
  message.value = ''
  try {
    const { data } = await http.post(
      `/full-mock-sessions/${route.params.uuid}/sections/${section.id}/enter`,
      {},
      { skipErrorToast: true, skipSuccessToast: true },
    )
    const target = data.data.navigation?.route
    if (!target?.name) {
      applyPayload(data.data)
      return
    }
    router.push({ name: target.name, params: target.params || {}, query: target.query || {} })
  } catch (error) {
    message.value = firstApiMessage(error, t('requestFailed'))
    await load(true)
  } finally {
    busyId.value = null
  }
}

async function complete(section) {
  busyId.value = section.id
  message.value = ''
  try {
    const { data } = await http.post(
      `/full-mock-sessions/${route.params.uuid}/sections/${section.id}/complete`,
      {},
      { skipErrorToast: true, skipSuccessToast: true },
    )
    applyPayload(data.data)
  } catch (error) {
    message.value = firstApiMessage(error, t('requestFailed'))
    await load(true)
  } finally {
    busyId.value = null
  }
}

async function abandon() {
  abandoning.value = true
  message.value = ''
  try {
    const { data } = await http.post(`/full-mock-sessions/${route.params.uuid}/abandon`, {}, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    applyPayload(data.data)
    confirmAbandon.value = false
    ui.success(t('fullMockAbandoned'))
  } catch (error) {
    message.value = firstApiMessage(error, t('requestFailed'))
  } finally {
    abandoning.value = false
  }
}
</script>

<template>
  <div class="student-ui">
    <router-link
      class="student-ui__unlock-cta"
      style="background: transparent; color: var(--student-teal); padding-left: 0"
      :to="exam ? { name: 'full-mock-intro', params: { slug: exam.slug } } : { name: 'full-mocks' }"
    >
      <span aria-hidden="true">←</span>
      {{ t('backToFullMocks') }}
    </router-link>

    <div v-if="loading" class="student-ui__loader">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <v-alert v-else-if="message && !payload" type="error" variant="tonal">{{ message }}</v-alert>

    <template v-else-if="payload">
      <header class="student-ui__hero">
        <div>
          <p class="student-ui__eyebrow">{{ t('fullMockSession') }}</p>
          <h1>{{ exam?.title }}</h1>
          <p class="student-ui__hero-lead">{{ t('fullMockSessionLead') }}</p>
        </div>
      </header>

      <v-alert v-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <v-alert v-if="isCompleted" type="success" variant="tonal">{{ t('fullMockFinished') }}</v-alert>
      <v-alert v-else-if="isAbandoned" type="warning" variant="tonal">{{ t('fullMockAbandoned') }}</v-alert>

      <section v-if="showScorecard" class="student-ui__pane">
        <h2>{{ t('fullMockScorecard') }}</h2>
        <div class="student-ui__grid" style="grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 0.85rem">
          <div v-for="skill in ['listening', 'reading', 'writing', 'speaking']" :key="skill" class="student-ui__card">
            <span class="student-ui__card-meta">{{ skillLabel(skill) }}</span>
            <strong style="font-size: 1.25rem; color: var(--student-teal)">{{ skillScoreLabel(skill) }}</strong>
          </div>
        </div>
        <div class="student-ui__score">
          <template v-if="scorecard?.overall_pending || scorecard?.overall_band == null">
            <strong>{{ t('fullMockOverallPendingTitle') }}</strong>
            <p class="student-ui__hint" style="margin: 0.35rem 0 0">{{ t('fullMockOverallPendingLead') }}</p>
          </template>
          <template v-else>
            <strong>{{ t('overallBand') }}: {{ scorecard.overall_band }}</strong>
          </template>
        </div>
      </section>

      <section class="student-ui__pane">
        <h2>{{ t('fullMockSectionsTitle') }}</h2>
        <ol style="margin: 0; padding: 0; list-style: none; display: grid; gap: 0.7rem">
          <li
            v-for="(section, index) in sections"
            :key="section.id"
            class="student-ui__card"
            :style="{
              opacity: section.status === 'locked' ? 0.65 : 1,
              borderColor: isCurrent(section) ? 'var(--student-teal)' : undefined,
            }"
          >
            <div class="student-ui__card-top">
              <div class="student-ui__card-badges">
                <span class="student-ui__badge">
                  <v-icon :icon="skillIcon(section.skill)" size="14" />
                  {{ skillLabel(section.skill) }}
                </span>
                <span
                  class="student-ui__badge"
                  :class="{ 'student-ui__badge--free': section.status === 'completed' || section.status === 'in_progress' }"
                >
                  {{ statusLabel(section.status) }}
                </span>
              </div>
              <span
                v-if="secondsLeft(section) != null"
                class="student-ui__timer"
                :class="{ 'is-urgent': secondsLeft(section) <= 300 }"
                :style="secondsLeft(section) > 300 ? { background: 'var(--student-teal-soft)', color: 'var(--student-teal)' } : undefined"
              >
                {{ t('fullMockTimeLeft', { time: clock(secondsLeft(section)) }) }}
              </span>
              <span v-else-if="section.duration_seconds" class="student-ui__card-meta">
                {{ t('minutesCount', { count: Math.round(section.duration_seconds / 60) }) }}
              </span>
            </div>

            <h3 class="student-ui__card-title" style="word-break: break-word">{{ index + 1 }}. {{ section.title }}</h3>
            <p v-if="section.instructions" class="student-ui__card-lead" style="white-space: pre-wrap">{{ section.instructions }}</p>
            <p v-if="section.status === 'in_progress'" class="student-ui__hint" style="margin: 0.4rem 0 0">
              {{ t('fullMockCompleteHint') }}
            </p>

            <div v-if="isCurrent(section)" class="student-ui__recorder-actions" style="justify-content: flex-start; margin-top: 0.75rem">
              <button
                type="button"
                class="student-ui__btn student-ui__btn--primary"
                :disabled="busyId === section.id"
                @click="enter(section)"
              >
                {{ section.status === 'in_progress' ? t('continueSection') : t('enterSection') }}
                <span aria-hidden="true">→</span>
              </button>
              <button
                v-if="section.status === 'in_progress'"
                type="button"
                class="student-ui__btn student-ui__btn--soft"
                :disabled="busyId === section.id"
                @click="complete(section)"
              >
                {{ t('completeSection') }}
              </button>
            </div>
          </li>
        </ol>
      </section>

      <div v-if="isActive" class="student-ui__recorder-actions" style="justify-content: flex-start">
        <button type="button" class="student-ui__btn student-ui__btn--soft" style="color: var(--student-danger)" @click="confirmAbandon = true">
          {{ t('abandonFullMock') }}
        </button>
      </div>
    </template>

    <v-dialog v-model="confirmAbandon" max-width="420">
      <v-card class="pa-4">
        <p style="margin: 0 0 1rem">{{ t('confirmAbandonFullMock') }}</p>
        <div class="student-ui__recorder-actions">
          <button type="button" class="student-ui__btn student-ui__btn--soft" @click="confirmAbandon = false">{{ t('cancel') }}</button>
          <button type="button" class="student-ui__btn student-ui__btn--danger" :disabled="abandoning" @click="abandon">
            {{ t('abandonFullMock') }}
          </button>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>
