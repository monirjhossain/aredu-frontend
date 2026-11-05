<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AttemptChrome from '../../components/examination/AttemptChrome.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'
import { useFullMockContext } from '../../composables/useFullMockContext'

const { t } = useI18n()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const { inSession, hubRoute, completeAndReturn } = useFullMockContext()

const payload = ref(null)
const loading = ref(true)
const message = ref('')
const saving = ref(false)
const submitting = ref(false)
const currentQuestionId = ref(null)
const answers = ref({})
const secondsRemaining = ref(0)
const passageEl = ref(null)

let timer = null
let autosaveTimer = null
let dirty = false

const flatQuestions = computed(() => {
  const rows = []
  for (const section of payload.value?.test?.sections || []) {
    for (const group of section.groups || []) {
      for (const question of group.questions || []) {
        rows.push({ section, group, question })
      }
    }
  }
  return rows
})

const current = computed(() =>
  flatQuestions.value.find((row) => row.question.id === currentQuestionId.value) || flatQuestions.value[0] || null,
)

const currentIndex = computed(() =>
  flatQuestions.value.findIndex((row) => row.question.id === current.value?.question.id),
)

const isFirstQuestion = computed(() => currentIndex.value <= 0)
const isLastQuestion = computed(() =>
  currentIndex.value >= 0 && currentIndex.value === flatQuestions.value.length - 1,
)

function questionNumber(row) {
  const index = flatQuestions.value.findIndex((item) => item.question.id === row.question.id)
  return index >= 0 ? index + 1 : row.question.position
}

const currentPassage = computed(() => {
  if (!current.value) return null
  const passageId = current.value.group.question_passage_id
  if (!passageId) return current.value.section.passages?.[0] || null
  return current.value.section.passages?.find((p) => p.id === passageId) || null
})

const isSubmitted = computed(() => payload.value?.attempt?.status === 'submitted')

const answeredCount = computed(() =>
  flatQuestions.value.filter((row) => {
    const answer = answers.value[row.question.id]
    if (!answer) return false
    if (usesOptions(row.group.type)) return Boolean(answer.question_option_id)
    return Boolean(String(answer.answer_text || '').trim())
  }).length,
)

const timerLabel = computed(() => {
  const total = Math.max(0, secondsRemaining.value)
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${t('timeLeft')} ${m}:${s}`
})

const timerUrgent = computed(() => !isSubmitted.value && secondsRemaining.value > 0 && secondsRemaining.value <= 300)

const progressSubtitle = computed(() => {
  const base = `${answeredCount.value}/${flatQuestions.value.length} ${t('answered')}`
  return saving.value ? `${base} · ${t('savingAnswers')}` : base
})

onMounted(load)
onBeforeUnmount(() => {
  stopTimers()
  if (dirty && !isSubmitted.value) {
    saveAnswers(true)
  }
})
watch(() => route.params.attemptId, load)
watch(isSubmitted, (done) => {
  if (!done || !inSession.value) return
  completeAndReturn((section) => section.skill === 'reading'
    && Number(section.test_attempt_id) === Number(route.params.attemptId))
})
watch(currentPassage, async () => {
  await nextTick()
  renderPassage()
})

async function load() {
  stopTimers()
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get(`/reading-attempts/${route.params.attemptId}`, { skipErrorToast: true })
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
  for (const row of flatQuestionsFrom(data)) {
    map[row.question.id] = {
      question_option_id: row.question.answer?.question_option_id ?? null,
      answer_text: row.question.answer?.answer_text ?? '',
    }
  }
  answers.value = map
  if (!currentQuestionId.value && flatQuestionsFrom(data)[0]) {
    currentQuestionId.value = flatQuestionsFrom(data)[0].question.id
  }
  secondsRemaining.value = Number(data.attempt.seconds_remaining || 0)
  dirty = false
  if (data.attempt.status === 'in_progress') {
    startTimers()
  } else {
    stopTimers()
  }
  nextTick(renderPassage)
}

function flatQuestionsFrom(data) {
  const rows = []
  for (const section of data?.test?.sections || []) {
    for (const group of section.groups || []) {
      for (const question of group.questions || []) {
        rows.push({ section, group, question })
      }
    }
  }
  return rows
}

function renderPassage() {
  if (!passageEl.value) return
  const text = currentPassage.value?.body || t('noPassageForQuestion')
  passageEl.value.textContent = text
}

function highlightSelection() {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
  const range = selection.getRangeAt(0)
  if (!passageEl.value?.contains(range.commonAncestorContainer)) return
  try {
    const mark = document.createElement('mark')
    mark.className = 'student-ui__mark'
    range.surroundContents(mark)
    selection.removeAllRanges()
  } catch {
    // Ignore complex multi-node selections
  }
}

function clearHighlights() {
  if (!passageEl.value) return
  passageEl.value.querySelectorAll('mark.student-ui__mark').forEach((mark) => {
    const parent = mark.parentNode
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  })
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

function setOption(questionId, optionId) {
  answers.value[questionId] = {
    ...(answers.value[questionId] || {}),
    question_option_id: optionId,
    answer_text: '',
  }
  dirty = true
}

function setText(questionId, text) {
  answers.value[questionId] = {
    ...(answers.value[questionId] || {}),
    question_option_id: null,
    answer_text: text,
  }
  dirty = true
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

async function saveAnswers(keepalive = false) {
  if (isSubmitted.value || !payload.value) return
  const body = {
    answers: Object.entries(answers.value).map(([questionId, value]) => ({
      question_id: Number(questionId),
      question_option_id: value.question_option_id,
      answer_text: value.answer_text || null,
    })),
  }
  if (body.answers.length === 0) return
  saving.value = true
  try {
    const { data } = await http.put(
      `/reading-attempts/${route.params.attemptId}/answers`,
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
      if (String(message.value).toLowerCase().includes('expired')) {
        await load()
      }
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
      `/reading-attempts/${route.params.attemptId}/submit`,
      {},
      { skipErrorToast: true, skipSuccessToast: auto },
    )
    applyPayload(data.data)
    stopTimers()
    if (auto) {
      ui.success(t('timeExpiredSubmitted'))
    }
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
  <div class="student-ui">
    <div v-if="loading" class="student-ui__loader">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <v-alert v-else-if="message && !payload" type="error" variant="tonal">{{ message }}</v-alert>

    <AttemptChrome
      v-else-if="payload"
      :title="payload.test.title"
      :subtitle="progressSubtitle"
      :show-timer="!isSubmitted"
      :timer-label="timerLabel"
      :timer-urgent="timerUrgent"
      :is-submitted="isSubmitted"
      :submitting="submitting"
      :submit-label="t('submitTest')"
      :results-to="{ name: 'reading-results' }"
      :results-label="t('readingResults')"
      :back-label="hubRoute ? t('backToExamHub') : t('backToReadingTestsPublic')"
      @back="router.push(hubRoute || { name: 'reading-tests' })"
      @submit="submit(false)"
    >
      <template #alerts>
        <v-alert v-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      </template>

      <template #score>
        <div v-if="isSubmitted && payload.result" class="student-ui__score">
          <strong>{{ t('yourScore') }}: {{ payload.result.raw_score }}/{{ payload.result.max_score }}</strong>
          <span v-if="payload.result.band_score != null"> · {{ t('bandScore') }}: {{ payload.result.band_score }}</span>
          <span v-else> · {{ t('bandPending') }}</span>
        </div>
      </template>

      <template #nav>
        <div class="student-ui__qnav" role="navigation" :aria-label="t('questionNav')">
          <button
            v-for="row in flatQuestions"
            :key="row.question.id"
            type="button"
            class="student-ui__qbtn"
            :class="{
              'is-active': row.question.id === current?.question.id,
              'is-done': isAnswered(row.question.id, row.group.type),
            }"
            @click="currentQuestionId = row.question.id"
          >
            {{ questionNumber(row) }}
          </button>
        </div>
      </template>

      <div v-if="current" class="student-ui__split">
        <section class="student-ui__pane">
          <h2>{{ currentPassage?.title || t('passage') }}</h2>
          <div class="student-ui__passage-tools">
            <button type="button" class="student-ui__tool-btn" @click="highlightSelection">
              {{ t('highlightSelection') }}
            </button>
            <button type="button" class="student-ui__tool-btn" @click="clearHighlights">
              {{ t('clearHighlights') }}
            </button>
          </div>
          <p class="student-ui__hint">{{ t('highlightTip') }}</p>
          <div ref="passageEl" class="student-ui__passage-body" />
        </section>

        <section class="student-ui__pane">
          <p class="student-ui__type">{{ t(`questionTypes.${current.group.type}`) }}</p>
          <h2>{{ questionNumber(current) }}. {{ current.question.prompt }}</h2>
          <p v-if="current.group.instructions" class="student-ui__hint">
            {{ current.group.instructions }}
          </p>

          <div v-if="usesOptions(current.group.type)" class="student-ui__options">
            <label
              v-for="option in current.group.options"
              :key="option.id"
              class="student-ui__option"
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
              <span class="student-ui__option-label">{{ option.label || '•' }}</span>
              <span>{{ option.content }}</span>
            </label>
          </div>

          <label v-else class="student-ui__field">
            <span>{{ t('yourAnswer') }}</span>
            <input
              type="text"
              :value="answers[current.question.id]?.answer_text || ''"
              :disabled="isSubmitted"
              @input="setText(current.question.id, $event.target.value)"
            >
          </label>

          <div v-if="isSubmitted && current.question.correct_option_id" class="student-ui__hint">
            {{ t('correctOption') }}: #{{ current.question.correct_option_id }}
          </div>
          <div v-if="isSubmitted && current.question.accepted_answers?.length" class="student-ui__hint">
            {{ t('acceptedAnswers') }}: {{ current.question.accepted_answers.join(' / ') }}
          </div>

          <div class="student-ui__stepper">
            <button
              type="button"
              class="student-ui__step"
              :disabled="isFirstQuestion"
              @click="goRelative(-1)"
            >
              {{ t('previous') }}
            </button>
            <button
              v-if="!isLastQuestion"
              type="button"
              class="student-ui__step student-ui__step--next"
              @click="goRelative(1)"
            >
              {{ t('next') }}
            </button>
            <button
              v-else-if="!isSubmitted"
              type="button"
              class="student-ui__step student-ui__step--next"
              :disabled="submitting"
              @click="submit(false)"
            >
              {{ t('submitTest') }}
            </button>
          </div>
        </section>
      </div>
    </AttemptChrome>
  </div>
</template>
