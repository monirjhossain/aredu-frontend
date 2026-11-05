<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import WritingRichEditor from '../../components/examination/WritingRichEditor.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'
import { countWordsHtml, sanitizeWritingHtml } from '../../utils/htmlText'
import { useFullMockContext } from '../../composables/useFullMockContext'

const { t } = useI18n()
const ui = useUiStore()
const route = useRoute()
const { contextKey, contextParams, inSession, hubRoute, completeAndReturn } = useFullMockContext()

const task = ref(null)
const body = ref('')
const status = ref('draft')
const evaluation = ref(null)
const loading = ref(true)
const saving = ref(false)
const submitting = ref(false)
const message = ref('')
let saveTimer = null

const locked = computed(() => status.value === 'submitted')
const wordCount = computed(() => countWordsHtml(body.value))
const minWords = computed(() => Number(task.value?.min_words || 0))
const meetsMinimum = computed(() => wordCount.value >= minWords.value)
const remainingWords = computed(() => Math.max(0, minWords.value - wordCount.value))
const progressPct = computed(() => {
  if (!minWords.value) return 100
  return Math.min(100, Math.round((wordCount.value / minWords.value) * 100))
})
const safeEvaluationFeedback = computed(() => evaluation.value?.feedback || '')

onMounted(load)
onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
watch(() => route.params.id, () => {
  if (saveTimer) clearTimeout(saveTimer)
  load()
})

watch(body, () => {
  if (locked.value || loading.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveDraft(true), 1200)
})

function taskTypeLabel(value) {
  if (value === 'academic_task_1') return t('writingTaskAcademic1')
  if (value === 'general_task_1') return t('writingTaskGeneral1')
  if (value === 'task_2') return t('writingTask2')
  return value
}

function payloadBody() {
  return sanitizeWritingHtml(body.value)
}

async function load() {
  loading.value = true
  message.value = ''
  task.value = null
  body.value = ''
  status.value = 'draft'
  evaluation.value = null
  try {
    const [taskRes, submissionRes] = await Promise.all([
      http.get(`/writing-tasks/${route.params.id}`, { skipErrorToast: true }),
      http.get(`/writing-tasks/${route.params.id}/submission`, {
        params: contextParams.value,
        skipErrorToast: true,
      }),
    ])
    task.value = taskRes.data.data
    const submission = submissionRes.data.data
    body.value = submission.body || ''
    status.value = submission.status
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
      { body: payloadBody(), ...contextParams.value },
      { params: contextParams.value, skipErrorToast: true, skipSuccessToast: true },
    )
    status.value = data.data.status
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
      { body: payloadBody(), ...contextParams.value },
      { params: contextParams.value, skipErrorToast: true, skipSuccessToast: true },
    )
    status.value = data.data.status
    body.value = data.data.body || body.value
    ui.success(t('writingSubmitted'))
    if (inSession.value) {
      if (saveTimer) clearTimeout(saveTimer)
      await completeAndReturn((section) => section.skill === 'writing'
        && (!contextKey.value || section.context_key === contextKey.value))
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="student-ui">
    <div v-if="loading" class="student-ui__loader">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>

    <template v-else-if="task">
      <header class="student-ui__hero">
        <div>
          <router-link
            v-if="hubRoute"
            class="student-ui__hero-link"
            style="background: rgba(255,255,255,0.16); color: #fff; margin-bottom: 0.65rem"
            :to="hubRoute"
          >
            <span aria-hidden="true">←</span> {{ t('backToExamHub') }}
          </router-link>
          <router-link v-else class="student-ui__hero-link" style="background: rgba(255,255,255,0.16); color: #fff; margin-bottom: 0.65rem" :to="{ name: 'writing-tasks' }">
            <span aria-hidden="true">←</span> {{ t('backToWritingTasksPublic') }}
          </router-link>
          <h1>{{ task.title }}</h1>
          <p class="student-ui__hero-lead">
            {{ task.exam_type === 'general' ? t('general') : t('academic') }}
            · {{ taskTypeLabel(task.task_type) }}
            · {{ t('minutesCount', { count: task.recommended_minutes }) }}
            · {{ t('minWordsCount', { count: task.min_words }) }}
          </p>
        </div>
        <router-link class="student-ui__hero-link" :to="{ name: 'writing-submissions' }">
          {{ t('myWritingSubmissions') }}
          <span aria-hidden="true">→</span>
        </router-link>
      </header>

      <v-alert v-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <v-alert v-if="locked" type="info" variant="tonal">{{ t('writingLocked') }}</v-alert>
      <v-alert v-if="locked && hubRoute" type="success" variant="tonal">
        <router-link :to="hubRoute">{{ t('returnToExamHub') }} →</router-link>
      </v-alert>

      <section class="student-ui__pane">
        <h2>{{ t('writingPrompt') }}</h2>
        <p v-if="task.instructions" class="student-ui__hint" style="white-space: pre-wrap">{{ task.instructions }}</p>
        <p style="margin: 0; white-space: pre-wrap; line-height: 1.6">{{ task.prompt }}</p>
        <img
          v-if="task.image_url"
          :src="task.image_url"
          :alt="task.title"
          style="display: block; max-width: 100%; max-height: 420px; margin: 1rem auto 0; border-radius: 0.65rem; object-fit: contain"
        >
        <ul class="student-ui__tips">
          <li>{{ t('writingTipMinWords', { count: task.min_words }) }}</li>
          <li>{{ t('writingTipAutosave') }}</li>
          <li>{{ t('writingTipSubmit') }}</li>
        </ul>
      </section>

      <div class="student-ui__pane" style="position: sticky; top: 4.5rem; z-index: 4; padding-bottom: 1.15rem; overflow: hidden">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.65rem">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem">
            <strong>{{ t('wordCountLabel', { count: wordCount }) }}</strong>
            <span class="student-ui__hint" :style="{ color: meetsMinimum ? '#166534' : '#b45309', margin: 0 }">
              {{ meetsMinimum ? t('writingMinReached') : t('writingWordsRemaining', { count: remainingWords }) }}
            </span>
            <span class="student-ui__badge" :class="locked ? '' : 'student-ui__badge--free'">
              {{ locked ? t('statusSubmitted') : t('statusDraft') }}
            </span>
            <span v-if="saving" class="student-ui__hint" style="margin: 0">{{ t('writingSavingDraft') }}</span>
          </div>
          <div class="student-ui__recorder-actions" style="width: auto">
            <button type="button" class="student-ui__btn student-ui__btn--soft" :disabled="locked || saving" @click="saveDraft(false)">
              {{ t('saveDraft') }}
            </button>
            <button
              type="button"
              class="student-ui__btn student-ui__btn--primary"
              :disabled="locked || !meetsMinimum || submitting"
              @click="submit"
            >
              {{ t('submitWriting') }}
            </button>
          </div>
        </div>
        <div aria-hidden="true" style="position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: #e7eef0">
          <span :style="{ display: 'block', height: '100%', width: `${progressPct}%`, background: meetsMinimum ? '#16a34a' : '#f5c518' }" />
        </div>
      </div>

      <section class="student-ui__pane">
        <label class="student-ui__type" for="writing-body">{{ t('yourAnswer') }}</label>
        <WritingRichEditor
          v-model="body"
          :readonly="locked"
          :placeholder="t('writingEditorPlaceholder')"
        />
      </section>

      <section v-if="evaluation" class="student-ui__pane">
        <h2>{{ t('yourEvaluation') }}</h2>
        <p class="student-ui__hint">
          {{ t('evaluationReturned') }}
          <span v-if="evaluation.overall_band != null"> · {{ t('overallBand') }}: <strong>{{ evaluation.overall_band }}</strong></span>
        </p>
        <div class="student-ui__grid" style="grid-template-columns: repeat(2, minmax(0, 1fr))">
          <div class="student-ui__card"><span class="student-ui__card-meta">{{ t('taskResponse') }}</span><strong>{{ evaluation.task_response }}</strong></div>
          <div class="student-ui__card"><span class="student-ui__card-meta">{{ t('coherence') }}</span><strong>{{ evaluation.coherence }}</strong></div>
          <div class="student-ui__card"><span class="student-ui__card-meta">{{ t('lexical') }}</span><strong>{{ evaluation.lexical }}</strong></div>
          <div class="student-ui__card"><span class="student-ui__card-meta">{{ t('grammar') }}</span><strong>{{ evaluation.grammar }}</strong></div>
        </div>
        <p v-if="safeEvaluationFeedback" class="student-ui__hint" style="white-space: pre-wrap; margin-top: 0.75rem">{{ safeEvaluationFeedback }}</p>
        <p v-else class="student-ui__hint">{{ t('noTeacherFeedback') }}</p>
      </section>
      <v-alert v-else-if="locked" type="info" variant="tonal">{{ t('waitingForEvaluation') }}</v-alert>
    </template>

    <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
  </div>
</template>
