<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { useAuthStore } from '../../stores/auth'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const ui = useUiStore()
const route = useRoute()
const auth = useAuthStore()

const payload = ref(null)
const loading = ref(true)
const message = ref('')
const audioError = ref('')
const saving = ref(false)
const submitting = ref(false)
const currentSectionId = ref(null)
const currentQuestionId = ref(null)
const answers = ref({})
const secondsRemaining = ref(0)
const audioObjectUrl = ref('')

let timer = null
let autosaveTimer = null
let dirty = false

const sections = computed(() => payload.value?.test?.sections || [])
const currentSection = computed(() =>
  sections.value.find((section) => section.id === currentSectionId.value) || sections.value[0] || null,
)
const flatQuestions = computed(() => {
  const rows = []
  for (const group of currentSection.value?.groups || []) {
    for (const question of group.questions || []) {
      rows.push({ group, question })
    }
  }
  return rows
})
const current = computed(() =>
  flatQuestions.value.find((row) => row.question.id === currentQuestionId.value) || flatQuestions.value[0] || null,
)
const isSubmitted = computed(() => payload.value?.attempt?.status === 'submitted')
const timerLabel = computed(() => {
  const total = Math.max(0, secondsRemaining.value)
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
})

const allQuestions = computed(() => {
  const rows = []
  for (const section of sections.value) {
    for (const group of section.groups || []) {
      for (const question of group.questions || []) rows.push({ group, question })
    }
  }
  return rows
})
const totalQuestions = computed(() => allQuestions.value.length)
const answeredCount = computed(() =>
  allQuestions.value.filter((row) => isAnswered(row.question.id, row.group.type)).length,
)
const timerUrgent = computed(() => !isSubmitted.value && secondsRemaining.value > 0 && secondsRemaining.value <= 300)

onMounted(load)
onBeforeUnmount(() => {
  stopTimers()
  revokeAudio()
  if (dirty && !isSubmitted.value) saveAnswers(true)
})
watch(() => route.params.attemptId, load)
watch(currentSectionId, async () => {
  currentQuestionId.value = null
  await loadSectionAudio()
  if (flatQuestions.value[0]) currentQuestionId.value = flatQuestions.value[0].question.id
})

async function load() {
  stopTimers()
  loading.value = true
  message.value = ''
  audioError.value = ''
  try {
    const { data } = await http.get(`/listening-attempts/${route.params.attemptId}`, { skipErrorToast: true })
    applyPayload(data.data)
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function applyPayload(data) {
  payload.value = data
  const map = {}
  for (const section of data.test?.sections || []) {
    for (const group of section.groups || []) {
      for (const question of group.questions || []) {
        map[question.id] = {
          question_option_id: question.answer?.question_option_id ?? null,
          answer_text: question.answer?.answer_text ?? '',
        }
      }
    }
  }
  answers.value = map
  if (!currentSectionId.value && data.test?.sections?.[0]) {
    currentSectionId.value = data.test.sections[0].id
  }
  secondsRemaining.value = Number(data.attempt.seconds_remaining || 0)
  dirty = false
  if (data.attempt.status === 'in_progress') startTimers()
  else stopTimers()
  loadSectionAudio()
}

function revokeAudio() {
  if (audioObjectUrl.value) {
    URL.revokeObjectURL(audioObjectUrl.value)
    audioObjectUrl.value = ''
  }
}

async function loadSectionAudio() {
  revokeAudio()
  audioError.value = ''
  const url = currentSection.value?.audio?.url
  if (!url) {
    audioError.value = t('audioUnavailable')
    return
  }
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${auth.token}` } })
    if (!response.ok) {
      audioError.value = t('audioLoadFailed')
      return
    }
    const blob = await response.blob()
    audioObjectUrl.value = URL.createObjectURL(blob)
  } catch {
    audioError.value = t('audioLoadFailed')
  }
}

function startTimers() {
  stopTimers()
  timer = window.setInterval(() => {
    if (secondsRemaining.value <= 0) {
      submit(true)
      return
    }
    secondsRemaining.value -= 1
  }, 1000)
  autosaveTimer = window.setInterval(() => {
    if (dirty) saveAnswers()
  }, 15000)
}

function stopTimers() {
  if (timer) window.clearInterval(timer)
  if (autosaveTimer) window.clearInterval(autosaveTimer)
  timer = null
  autosaveTimer = null
}

function usesOptions(type) {
  return ['multiple_choice', 'true_false_not_given', 'yes_no_not_given', 'matching_headings', 'matching_information'].includes(type)
}

function isAnswered(questionId, type) {
  const answer = answers.value[questionId]
  if (!answer) return false
  if (usesOptions(type)) return Boolean(answer.question_option_id)
  return Boolean(String(answer.answer_text || '').trim())
}

function setOption(questionId, optionId) {
  answers.value[questionId] = { ...(answers.value[questionId] || {}), question_option_id: optionId, answer_text: '' }
  dirty = true
}

function setText(questionId, text) {
  answers.value[questionId] = { ...(answers.value[questionId] || {}), question_option_id: null, answer_text: text }
  dirty = true
}

async function saveAnswers(keepalive = false) {
  if (isSubmitted.value || !payload.value) return
  const body = {
    answers: Object.entries(answers.value).map(([questionId, value]) => ({
      question_id: Number(questionId),
      question_option_id: value.question_option_id,
      answer_text: value.answer_text || null,
    })),
  }
  if (!body.answers.length) return
  saving.value = true
  try {
    const { data } = await http.put(
      `/listening-attempts/${route.params.attemptId}/answers`,
      body,
      { skipErrorToast: true, skipSuccessToast: true },
    )
    dirty = false
    if (data.data.attempt.status === 'submitted') {
      applyPayload(data.data)
      stopTimers()
    } else {
      secondsRemaining.value = Number(data.data.attempt.seconds_remaining || secondsRemaining.value)
    }
  } catch (error) {
    if (!keepalive) {
      message.value = apiError(error).message || t('requestFailed')
      if (String(message.value).toLowerCase().includes('expired')) await load()
    }
  } finally {
    saving.value = false
  }
}

async function submit(auto = false) {
  if (submitting.value || isSubmitted.value) return
  submitting.value = true
  message.value = ''
  try {
    await saveAnswers()
    const { data } = await http.post(
      `/listening-attempts/${route.params.attemptId}/submit`,
      {},
      { skipErrorToast: true, skipSuccessToast: auto },
    )
    applyPayload(data.data)
    stopTimers()
    if (auto) ui.success(t('timeExpiredSubmitted'))
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
    await load()
  } finally {
    submitting.value = false
  }
}

function goRelative(delta) {
  const list = flatQuestions.value
  const index = list.findIndex((row) => row.question.id === current.value?.question.id)
  const next = list[index + delta]
  if (next) currentQuestionId.value = next.question.id
}
</script>

<template>
  <div class="rmock-attempt">
    <div v-if="loading" class="rmock-attempt__loader">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <v-alert v-else-if="message && !payload" type="error" variant="tonal">{{ message }}</v-alert>

    <template v-else-if="payload">
      <header class="rmock-attempt__bar">
        <div class="rmock-attempt__bar-main">
          <router-link class="rmock-attempt__back" :to="{ name: 'listening-tests' }" :aria-label="t('backToListeningTestsPublic')">
            ←
          </router-link>
          <div class="rmock-attempt__titles">
            <h1>{{ payload.test.title }}</h1>
            <p>
              {{ answeredCount }}/{{ totalQuestions }} {{ t('answered') }}
              <span v-if="saving"> · {{ t('savingAnswers') }}</span>
            </p>
          </div>
        </div>
        <div class="rmock-attempt__bar-actions">
          <span
            v-if="!isSubmitted"
            class="rmock-attempt__timer"
            :class="{ 'is-urgent': timerUrgent }"
          >
            {{ t('timeLeft') }} {{ timerLabel }}
          </span>
          <button
            v-if="!isSubmitted"
            type="button"
            class="rmock-attempt__submit"
            :disabled="submitting"
            @click="submit(false)"
          >
            {{ t('submitTest') }}
          </button>
          <router-link
            v-else
            class="rmock-attempt__results"
            :to="{ name: 'listening-results' }"
          >
            {{ t('listeningResults') }}
          </router-link>
        </div>
      </header>

      <v-alert v-if="message" type="error" variant="tonal">{{ message }}</v-alert>

      <div v-if="isSubmitted && payload.result" class="rmock-attempt__score">
        <strong>{{ t('yourScore') }}: {{ payload.result.raw_score }}/{{ payload.result.max_score }}</strong>
        <span v-if="payload.result.band_score != null"> · {{ t('bandScore') }}: {{ payload.result.band_score }}</span>
        <span v-else> · {{ t('bandPending') }}</span>
      </div>

      <div class="rmock-attempt__tabs" role="tablist" :aria-label="t('listeningFourSectionsStudent')">
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          role="tab"
          class="rmock-attempt__tab"
          :class="{ 'is-active': section.id === currentSection?.id }"
          :aria-selected="section.id === currentSection?.id"
          @click="currentSectionId = section.id"
        >
          {{ section.title }}
        </button>
      </div>

      <section v-if="currentSection" class="rmock-attempt__audio">
        <h2>{{ t('sectionAudio') }}</h2>
        <v-alert v-if="audioError" type="warning" variant="tonal">{{ audioError }}</v-alert>
        <audio v-else-if="audioObjectUrl" :src="audioObjectUrl" controls class="rmock-attempt__audio-el" />
        <div v-else class="rmock-attempt__hint">{{ t('loadingAudio') }}</div>
      </section>

      <div class="rmock-attempt__nav" role="navigation" :aria-label="t('questionNav')">
        <button
          v-for="row in flatQuestions"
          :key="row.question.id"
          type="button"
          class="rmock-attempt__qbtn"
          :class="{
            'is-active': row.question.id === current?.question.id,
            'is-done': isAnswered(row.question.id, row.group.type),
          }"
          @click="currentQuestionId = row.question.id"
        >
          {{ row.question.position }}
        </button>
      </div>

      <div v-if="current" class="rmock-attempt__layout">
        <section class="rmock-attempt__question">
          <p class="rmock-attempt__type">{{ t(`questionTypes.${current.group.type}`) }}</p>
          <h2>{{ current.question.position }}. {{ current.question.prompt }}</h2>
          <p v-if="current.group.instructions" class="rmock-attempt__hint">
            {{ current.group.instructions }}
          </p>

          <div v-if="usesOptions(current.group.type)" class="rmock-attempt__options">
            <label
              v-for="option in current.group.options"
              :key="option.id"
              class="rmock-attempt__option"
              :class="{ 'is-selected': answers[current.question.id]?.question_option_id === option.id }"
            >
              <input
                type="radio"
                :name="`q-${current.question.id}`"
                :value="option.id"
                :checked="answers[current.question.id]?.question_option_id === option.id"
                :disabled="isSubmitted"
                @change="setOption(current.question.id, option.id)"
              >
              <span class="rmock-attempt__option-label">{{ option.label || '•' }}</span>
              <span>{{ option.content }}</span>
            </label>
          </div>

          <label v-else class="rmock-attempt__text">
            <span>{{ t('yourAnswer') }}</span>
            <input
              type="text"
              :value="answers[current.question.id]?.answer_text || ''"
              :disabled="isSubmitted"
              @input="setText(current.question.id, $event.target.value)"
            >
          </label>

          <div v-if="isSubmitted && current.question.correct_option_id" class="rmock-attempt__review">
            {{ t('correctOption') }}: #{{ current.question.correct_option_id }}
          </div>
          <div v-if="isSubmitted && current.question.accepted_answers?.length" class="rmock-attempt__review">
            {{ t('acceptedAnswers') }}: {{ current.question.accepted_answers.join(' / ') }}
          </div>

          <div class="rmock-attempt__stepper">
            <button
              type="button"
              class="rmock-attempt__step"
              :disabled="!flatQuestions[0] || current.question.id === flatQuestions[0].id"
              @click="goRelative(-1)"
            >
              {{ t('previous') }}
            </button>
            <button
              type="button"
              class="rmock-attempt__step rmock-attempt__step--next"
              :disabled="current.question.id === flatQuestions.at(-1)?.question.id"
              @click="goRelative(1)"
            >
              {{ t('next') }}
            </button>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rmock-attempt {
  display: grid;
  gap: 0.85rem;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: #102a2e;
}

.rmock-attempt__loader {
  display: grid;
  place-items: center;
  min-height: 220px;
}

.rmock-attempt__bar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: 0.9rem;
  background: #0f5c66;
  color: #fff;
  box-shadow: 0 10px 24px rgba(15, 92, 102, 0.25);
}

.rmock-attempt__bar-main {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.rmock-attempt__back {
  display: inline-grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border: 0;
  border-radius: 0.55rem;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  font-size: 1.1rem;
  text-decoration: none;
  cursor: pointer;
  flex: 0 0 auto;
}

.rmock-attempt__titles {
  min-width: 0;
}

.rmock-attempt__titles h1 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rmock-attempt__titles p {
  margin: 0.15rem 0 0;
  opacity: 0.82;
  font-size: 0.78rem;
}

.rmock-attempt__bar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.rmock-attempt__timer {
  display: inline-flex;
  align-items: center;
  min-height: 2.2rem;
  padding: 0 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 0.84rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.rmock-attempt__timer.is-urgent {
  background: #f5c518;
  color: #1a1400;
}

.rmock-attempt__submit,
.rmock-attempt__results {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.4rem;
  padding: 0 0.95rem;
  border: 0;
  border-radius: 0.55rem;
  background: #f5c518;
  color: #1a1400;
  text-decoration: none;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
}

.rmock-attempt__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.rmock-attempt__score {
  padding: 0.85rem 1rem;
  border-radius: 0.85rem;
  background: #eef8f6;
  border: 1px solid rgba(15, 92, 102, 0.18);
  font-size: 0.92rem;
}

.rmock-attempt__tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 0.2rem;
  -webkit-overflow-scrolling: touch;
}

.rmock-attempt__tab {
  flex: 1 0 auto;
  min-height: 44px;
  padding: 0 1rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.65rem;
  background: #fff;
  color: #5b7378;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
}

.rmock-attempt__tab.is-active {
  background: #0f5c66;
  border-color: #0f5c66;
  color: #fff;
}

.rmock-attempt__audio {
  min-width: 0;
  padding: 1rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.95rem;
  background: #fff;
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.rmock-attempt__audio h2 {
  margin: 0 0 0.65rem;
  font-size: 1.02rem;
  font-weight: 800;
}

.rmock-attempt__audio-el {
  display: block;
  width: 100%;
  max-width: 100%;
}

.rmock-attempt__nav {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 0.2rem;
  -webkit-overflow-scrolling: touch;
}

.rmock-attempt__qbtn {
  flex: 0 0 auto;
  width: 2.35rem;
  height: 2.35rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.55rem;
  background: #fff;
  color: #5b7378;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
}

.rmock-attempt__qbtn.is-done {
  background: #e7f4f5;
  border-color: #9ed0d4;
  color: #0f5c66;
}

.rmock-attempt__qbtn.is-active {
  background: #0f5c66;
  border-color: #0f5c66;
  color: #fff;
}

.rmock-attempt__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.85rem;
}

@media (min-width: 960px) {
  .rmock-attempt__layout {
    grid-template-columns: minmax(0, 1fr);
    max-width: 52rem;
  }

  .rmock-attempt__tab {
    flex: 0 0 auto;
  }
}

.rmock-attempt__question {
  min-width: 0;
  padding: 1rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.95rem;
  background: #fff;
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.rmock-attempt__question h2 {
  margin: 0 0 0.65rem;
  font-size: 1.02rem;
  font-weight: 800;
  line-height: 1.35;
  word-break: break-word;
}

.rmock-attempt__type {
  margin: 0 0 0.35rem;
  color: #0f5c66;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.rmock-attempt__hint {
  margin: 0 0 0.85rem;
  color: #5b7378;
  font-size: 0.88rem;
  line-height: 1.4;
}

.rmock-attempt__options {
  display: grid;
  gap: 0.55rem;
}

.rmock-attempt__option {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 0.55rem;
  align-items: start;
  min-height: 44px;
  padding: 0.75rem 0.8rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.7rem;
  background: #fbfcfd;
  cursor: pointer;
}

.rmock-attempt__option.is-selected {
  border-color: #0f5c66;
  background: #eef8f6;
}

.rmock-attempt__option input {
  margin-top: 0.2rem;
}

.rmock-attempt__option-label {
  display: inline-grid;
  place-items: center;
  min-width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  background: #e7eef0;
  font-size: 0.75rem;
  font-weight: 800;
}

.rmock-attempt__text {
  display: grid;
  gap: 0.4rem;
  font-weight: 700;
  font-size: 0.86rem;
}

.rmock-attempt__text input {
  min-height: 46px;
  padding: 0.55rem 0.75rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.65rem;
  font: inherit;
  font-weight: 500;
}

.rmock-attempt__review {
  margin-top: 0.75rem;
  color: #0f5c66;
  font-size: 0.82rem;
  font-weight: 700;
}

.rmock-attempt__stepper {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 1rem;
}

.rmock-attempt__step {
  min-height: 44px;
  padding: 0 1rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.6rem;
  background: #fff;
  font: inherit;
  font-weight: 750;
  cursor: pointer;
}

.rmock-attempt__step--next {
  margin-left: auto;
  background: #0f5c66;
  border-color: #0f5c66;
  color: #fff;
}

.rmock-attempt__step:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
