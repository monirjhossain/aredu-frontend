<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const ui = useUiStore()
const route = useRoute()

const task = ref(null)
const body = ref('')
const status = ref('draft')
const submittedAt = ref(null)
const serverWordCount = ref(0)
const evaluation = ref(null)
const loading = ref(true)
const saving = ref(false)
const submitting = ref(false)
const message = ref('')
let saveTimer = null

const locked = computed(() => status.value === 'submitted')
const wordCount = computed(() => countWords(body.value))
const meetsMinimum = computed(() => wordCount.value >= Number(task.value?.min_words || 0))

onMounted(load)
onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})

watch(body, () => {
  if (locked.value || loading.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveDraft(true), 1200)
})

function countWords(text) {
  const trimmed = String(text || '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}

function taskTypeLabel(value) {
  if (value === 'academic_task_1') return t('writingTaskAcademic1')
  if (value === 'general_task_1') return t('writingTaskGeneral1')
  if (value === 'task_2') return t('writingTask2')
  return value
}

async function load() {
  loading.value = true
  message.value = ''
  try {
    const [taskRes, submissionRes] = await Promise.all([
      http.get(`/writing-tasks/${route.params.id}`, { skipErrorToast: true }),
      http.get(`/writing-tasks/${route.params.id}/submission`, { skipErrorToast: true }),
    ])
    task.value = taskRes.data.data
    const submission = submissionRes.data.data
    body.value = submission.body || ''
    status.value = submission.status
    submittedAt.value = submission.submitted_at
    serverWordCount.value = submission.word_count || 0
    evaluation.value = submission.evaluation || null
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

async function saveDraft(silent = false) {
  if (locked.value || !task.value) return
  saving.value = true
  if (!silent) {
    message.value = ''
  }
  try {
    const { data } = await http.put(
      `/writing-tasks/${route.params.id}/submission`,
      { body: body.value },
      { skipErrorToast: true, skipSuccessToast: true },
    )
    status.value = data.data.status
    serverWordCount.value = data.data.word_count
    if (!silent) ui.success(t('draftSaved'))
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

async function submit() {
  if (locked.value || !task.value) return
  submitting.value = true
  message.value = ''
  try {
    const { data } = await http.post(
      `/writing-tasks/${route.params.id}/submission/submit`,
      { body: body.value },
      { skipErrorToast: true, skipSuccessToast: true },
    )
    status.value = data.data.status
    submittedAt.value = data.data.submitted_at
    serverWordCount.value = data.data.word_count
    body.value = data.data.body || body.value
    ui.success(t('writingSubmitted'))
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
<div>
    <v-btn class="mb-4" variant="text" :to="{ name: 'writing-tasks' }">{{ t('backToWritingTasksPublic') }}</v-btn>
          <v-progress-circular v-if="loading" indeterminate color="primary" />
          <template v-else-if="task">
            <h1 class="text-h5 mb-2">{{ task.title }}</h1>
            <p class="text-medium-emphasis mb-4">
              {{ task.exam_type === 'general' ? t('general') : t('academic') }}
              · {{ taskTypeLabel(task.task_type) }}
              · {{ t('minutesCount', { count: task.recommended_minutes }) }}
              · {{ t('minWordsCount', { count: task.min_words }) }}
            </p>

            <v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
            <v-alert v-if="locked" type="info" variant="tonal" class="mb-4">{{ t('writingLocked') }}</v-alert>

            <v-card variant="outlined" class="mb-4">
              <v-card-title>{{ t('writingPrompt') }}</v-card-title>
              <v-card-text>
                <p v-if="task.instructions" class="mb-3 text-medium-emphasis" style="white-space: pre-wrap">{{ task.instructions }}</p>
                <p style="white-space: pre-wrap">{{ task.prompt }}</p>
                <v-img v-if="task.image_url" :src="task.image_url" max-height="360" class="mt-4" contain />
              </v-card-text>
            </v-card>

            <div class="d-flex align-center flex-wrap ga-3 mb-2">
              <span class="text-body-2">
                {{ t('wordCountLabel', { count: wordCount }) }}
                <span v-if="!meetsMinimum" class="text-error"> · {{ t('belowMinWords') }}</span>
              </span>
              <v-chip size="small" :color="locked ? 'success' : 'default'" variant="tonal">
                {{ locked ? t('statusSubmitted') : t('statusDraft') }}
              </v-chip>
              <v-spacer />
              <v-btn variant="tonal" :loading="saving" :disabled="locked" @click="saveDraft(false)">{{ t('saveDraft') }}</v-btn>
              <v-btn color="primary" :loading="submitting" :disabled="locked || !meetsMinimum" @click="submit">
                {{ t('submitWriting') }}
              </v-btn>
            </div>
            <v-textarea
              v-model="body"
              :readonly="locked"
              :label="t('yourAnswer')"
              rows="16"
              auto-grow
              variant="outlined"
              class="mb-4"
            />

            <v-card v-if="evaluation" variant="outlined">
              <v-card-title>{{ t('yourEvaluation') }}</v-card-title>
              <v-card-subtitle>
                {{ t('evaluationReturned') }}
                <span v-if="evaluation.overall_band != null"> · {{ t('overallBand') }}: {{ evaluation.overall_band }}</span>
              </v-card-subtitle>
              <v-card-text>
                <v-row dense class="mb-2">
                  <v-col cols="6" md="3">{{ t('taskResponse') }}: {{ evaluation.task_response }}</v-col>
                  <v-col cols="6" md="3">{{ t('coherence') }}: {{ evaluation.coherence }}</v-col>
                  <v-col cols="6" md="3">{{ t('lexical') }}: {{ evaluation.lexical }}</v-col>
                  <v-col cols="6" md="3">{{ t('grammar') }}: {{ evaluation.grammar }}</v-col>
                </v-row>
                <p v-if="evaluation.feedback" style="white-space: pre-wrap">{{ evaluation.feedback }}</p>
                <p v-else class="text-medium-emphasis">{{ t('noTeacherFeedback') }}</p>
              </v-card-text>
            </v-card>
            <v-alert v-else-if="locked" type="info" variant="tonal" class="mt-2">
              {{ t('waitingForEvaluation') }}
            </v-alert>
          </template>
          <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
  </div>
</template>
