<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const payload = ref(null)
const loading = ref(true)
const message = ref('')
const saving = ref(false)
const submitting = ref(false)
const currentQuestionId = ref(null)
const answers = ref({})
const secondsRemaining = ref(0)

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

const currentPassage = computed(() => {
  if (!current.value) return null
  const passageId = current.value.group.question_passage_id
  if (!passageId) return current.value.section.passages?.[0] || null
  return current.value.section.passages?.find((p) => p.id === passageId) || null
})

const isSubmitted = computed(() => payload.value?.attempt?.status === 'submitted')

const timerLabel = computed(() => {
  const total = Math.max(0, secondsRemaining.value)
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
})

onMounted(load)
onBeforeUnmount(() => {
  stopTimers()
  if (dirty && !isSubmitted.value) {
    saveAnswers(true)
  }
})
watch(() => route.params.attemptId, load)

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
      { skipErrorToast: true },
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
      { skipErrorToast: true },
    )
    applyPayload(data.data)
    stopTimers()
    if (auto) {
      message.value = t('timeExpiredSubmitted')
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
  <div>
    <v-progress-circular v-if="loading" indeterminate color="primary" />
          <v-alert v-else-if="message && !payload" type="error" variant="tonal">{{ message }}</v-alert>
          <template v-else-if="payload">
            <div class="d-flex align-center flex-wrap ga-2 mb-4">
              <div>
                <h1 class="text-h6 mb-0">{{ payload.test.title }}</h1>
                <div class="text-caption text-medium-emphasis">{{ t('questionNav') }}</div>
              </div>
              <v-spacer />
              <v-chip v-if="!isSubmitted" color="primary" variant="tonal">{{ t('timeLeft') }}: {{ timerLabel }}</v-chip>
              <v-chip v-if="saving" size="small" variant="text">{{ t('savingAnswers') }}</v-chip>
              <v-btn v-if="!isSubmitted" color="primary" :loading="submitting" @click="submit(false)">{{ t('submitTest') }}</v-btn>
            </div>

            <v-alert v-if="message" :type="isSubmitted ? 'success' : 'error'" variant="tonal" class="mb-4">{{ message }}</v-alert>

            <v-alert v-if="isSubmitted && payload.result" type="success" variant="tonal" class="mb-4">
              {{ t('yourScore') }}: {{ payload.result.raw_score }}/{{ payload.result.max_score }}
              <span v-if="payload.result.band_score != null"> · {{ t('bandScore') }}: {{ payload.result.band_score }}</span>
              <span v-else> · {{ t('bandPending') }}</span>
            </v-alert>

            <div class="mb-3 d-flex flex-wrap ga-1">
              <v-btn
                v-for="row in flatQuestions"
                :key="row.question.id"
                size="small"
                :variant="row.question.id === current?.question.id ? 'flat' : 'tonal'"
                :color="row.question.id === current?.question.id ? 'primary' : undefined"
                @click="currentQuestionId = row.question.id"
              >
                {{ row.question.position }}
              </v-btn>
            </div>

            <v-row v-if="current">
              <v-col cols="12" md="6">
                <v-card>
                  <v-card-title>{{ currentPassage?.title || t('passage') }}</v-card-title>
                  <v-card-text style="white-space: pre-wrap">{{ currentPassage?.body || t('noPassageForQuestion') }}</v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="6">
                <v-card>
                  <v-card-title>
                    {{ current.question.position }}. {{ current.question.prompt }}
                  </v-card-title>
                  <v-card-subtitle>{{ t(`questionTypes.${current.group.type}`) }}</v-card-subtitle>
                  <v-card-text>
                    <div v-if="current.group.instructions" class="text-body-2 mb-3">{{ current.group.instructions }}</div>
                    <v-radio-group
                      v-if="usesOptions(current.group.type)"
                      :model-value="answers[current.question.id]?.question_option_id"
                      :disabled="isSubmitted"
                      @update:model-value="(value) => setOption(current.question.id, value)"
                    >
                      <v-radio
                        v-for="option in current.group.options"
                        :key="option.id"
                        :label="`${option.label ? `${option.label}. ` : ''}${option.content}`"
                        :value="option.id"
                      />
                    </v-radio-group>
                    <v-text-field
                      v-else
                      :model-value="answers[current.question.id]?.answer_text"
                      :label="t('yourAnswer')"
                      :disabled="isSubmitted"
                      @update:model-value="(value) => setText(current.question.id, value)"
                    />
                    <div v-if="isSubmitted && current.question.correct_option_id" class="text-caption mt-2">
                      {{ t('correctOption') }}: #{{ current.question.correct_option_id }}
                    </div>
                    <div v-if="isSubmitted && current.question.accepted_answers?.length" class="text-caption mt-2">
                      {{ t('acceptedAnswers') }}: {{ current.question.accepted_answers.join(' / ') }}
                    </div>
                  </v-card-text>
                  <v-card-actions>
                    <v-btn variant="text" :disabled="!flatQuestions[0] || current.question.id === flatQuestions[0].id" @click="goRelative(-1)">
                      {{ t('previous') }}
                    </v-btn>
                    <v-spacer />
                    <v-btn variant="text" :disabled="current.question.id === flatQuestions.at(-1)?.question.id" @click="goRelative(1)">
                      {{ t('next') }}
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
            </v-row>

            <div class="mt-4">
              <v-btn variant="text" :to="{ name: 'reading-results' }">{{ t('readingResults') }}</v-btn>
            </div>
          </template>
  </div>
</template>
