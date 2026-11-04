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
const minWords = computed(() => Number(task.value?.min_words || 0))
const meetsMinimum = computed(() => wordCount.value >= minWords.value)
const remainingWords = computed(() => Math.max(0, minWords.value - wordCount.value))
const progressPct = computed(() => {
  if (!minWords.value) return 100
  return Math.min(100, Math.round((wordCount.value / minWords.value) * 100))
})

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
  <div class="wedit">
    <div v-if="loading" class="wedit__loader">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>

    <template v-else-if="task">
      <header class="wedit__hero">
        <div>
          <router-link class="wedit__back" :to="{ name: 'writing-tasks' }">
            <span aria-hidden="true">←</span> {{ t('backToWritingTasksPublic') }}
          </router-link>
          <h1>{{ task.title }}</h1>
          <p>
            {{ task.exam_type === 'general' ? t('general') : t('academic') }}
            · {{ taskTypeLabel(task.task_type) }}
            · {{ t('minutesCount', { count: task.recommended_minutes }) }}
            · {{ t('minWordsCount', { count: task.min_words }) }}
          </p>
        </div>
        <router-link class="wedit__hero-link" :to="{ name: 'writing-submissions' }">
          {{ t('myWritingSubmissions') }}
          <span aria-hidden="true">→</span>
        </router-link>
      </header>

      <v-alert v-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <v-alert v-if="locked" type="info" variant="tonal">{{ t('writingLocked') }}</v-alert>

      <section class="wedit__panel">
        <h2 class="wedit__title">{{ t('writingPrompt') }}</h2>
        <p v-if="task.instructions" class="wedit__instructions">{{ task.instructions }}</p>
        <p class="wedit__prompt">{{ task.prompt }}</p>
        <img v-if="task.image_url" :src="task.image_url" :alt="task.title" class="wedit__image">
        <ul class="wedit__tips">
          <li>{{ t('writingTipMinWords', { count: task.min_words }) }}</li>
          <li>{{ t('writingTipAutosave') }}</li>
          <li>{{ t('writingTipSubmit') }}</li>
        </ul>
      </section>

      <div class="wedit__bar" role="region" :aria-label="t('wordCount')">
        <div class="wedit__stats">
          <strong class="wedit__words">{{ t('wordCountLabel', { count: wordCount }) }}</strong>
          <span class="wedit__hint" :class="{ 'is-ok': meetsMinimum }">
            {{ meetsMinimum ? t('writingMinReached') : t('writingWordsRemaining', { count: remainingWords }) }}
          </span>
          <span class="wedit__chip" :class="locked ? 'is-ok' : 'is-draft'">
            {{ locked ? t('statusSubmitted') : t('statusDraft') }}
          </span>
          <span v-if="saving" class="wedit__hint">{{ t('writingSavingDraft') }}</span>
        </div>
        <div class="wedit__actions">
          <button type="button" class="wedit__btn wedit__btn--soft" :disabled="locked || saving" @click="saveDraft(false)">
            {{ t('saveDraft') }}
          </button>
          <button
            type="button"
            class="wedit__btn wedit__btn--primary"
            :disabled="locked || !meetsMinimum || submitting"
            @click="submit"
          >
            {{ t('submitWriting') }}
          </button>
        </div>
        <div class="wedit__progress" aria-hidden="true">
          <span :class="{ 'is-ok': meetsMinimum }" :style="{ width: `${progressPct}%` }" />
        </div>
      </div>

      <section class="wedit__panel">
        <label class="wedit__label" for="writing-body">{{ t('yourAnswer') }}</label>
        <textarea
          id="writing-body"
          v-model="body"
          class="wedit__textarea"
          :readonly="locked"
          rows="16"
        />
      </section>

      <section v-if="evaluation" class="wedit__panel">
        <h2 class="wedit__title">{{ t('yourEvaluation') }}</h2>
        <p class="wedit__sub">
          {{ t('evaluationReturned') }}
          <span v-if="evaluation.overall_band != null"> · {{ t('overallBand') }}: <strong>{{ evaluation.overall_band }}</strong></span>
        </p>
        <div class="wedit__scores">
          <div><span>{{ t('taskResponse') }}</span><strong>{{ evaluation.task_response }}</strong></div>
          <div><span>{{ t('coherence') }}</span><strong>{{ evaluation.coherence }}</strong></div>
          <div><span>{{ t('lexical') }}</span><strong>{{ evaluation.lexical }}</strong></div>
          <div><span>{{ t('grammar') }}</span><strong>{{ evaluation.grammar }}</strong></div>
        </div>
        <p v-if="evaluation.feedback" class="wedit__feedback">{{ evaluation.feedback }}</p>
        <p v-else class="wedit__sub">{{ t('noTeacherFeedback') }}</p>
      </section>
      <v-alert v-else-if="locked" type="info" variant="tonal">{{ t('waitingForEvaluation') }}</v-alert>
    </template>

    <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
  </div>
</template>

<style scoped>
.wedit {
  display: grid;
  gap: 1rem;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: #102a2e;
}

.wedit__loader {
  display: grid;
  place-items: center;
  min-height: 200px;
}

.wedit__hero {
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
  .wedit__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.wedit__back {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 44px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: none;
}

.wedit__hero h1 {
  margin: 0;
  font-size: clamp(1.35rem, 3vw, 1.8rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  word-break: break-word;
}

.wedit__hero p {
  margin: 0.4rem 0 0;
  opacity: 0.9;
  font-size: 0.9rem;
  line-height: 1.45;
}

.wedit__hero-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 1rem;
  border-radius: 0.65rem;
  background: #f5c518;
  color: #1a1400;
  text-decoration: none;
  font-size: 0.86rem;
  font-weight: 800;
  width: fit-content;
}

.wedit__panel {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid #d9e6e8;
  background: #fff;
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.wedit__title {
  margin: 0 0 0.6rem;
  font-size: 1.05rem;
  font-weight: 800;
}

.wedit__sub {
  margin: 0 0 0.75rem;
  color: #5b7378;
  font-size: 0.88rem;
}

.wedit__instructions {
  margin: 0 0 0.75rem;
  color: #5b7378;
  white-space: pre-wrap;
  line-height: 1.5;
}

.wedit__prompt {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.6;
}

.wedit__image {
  display: block;
  max-width: 100%;
  max-height: 420px;
  margin: 1rem auto 0;
  border-radius: 0.65rem;
  object-fit: contain;
}

.wedit__tips {
  margin: 1rem 0 0;
  padding: 0.75rem 1rem 0.75rem 1.5rem;
  border-radius: 0.65rem;
  background: #f4f8f9;
  color: #5b7378;
  font-size: 0.84rem;
  line-height: 1.5;
}

.wedit__bar {
  position: sticky;
  top: 0.5rem;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.75rem 1rem 1rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(6px);
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.08);
  overflow: hidden;
}

.wedit__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
}

.wedit__words {
  font-size: 1rem;
  font-weight: 800;
}

.wedit__hint {
  color: #b45309;
  font-size: 0.8rem;
  font-weight: 700;
}

.wedit__hint.is-ok {
  color: #166534;
}

.wedit__chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.6rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
}

.wedit__chip.is-ok {
  background: rgba(22, 128, 80, 0.12);
  color: #166534;
}

.wedit__chip.is-draft {
  background: rgba(245, 197, 24, 0.2);
  color: #7a5b00;
}

.wedit__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 100%;
}

@media (min-width: 640px) {
  .wedit__actions {
    width: auto;
  }
}

.wedit__btn {
  flex: 1 1 8rem;
  min-height: 44px;
  padding: 0 1.1rem;
  border: 0;
  border-radius: 0.65rem;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 800;
  cursor: pointer;
}

.wedit__btn--soft {
  background: #e8f1f2;
  color: #0f5c66;
}

.wedit__btn--primary {
  background: #0f5c66;
  color: #fff;
}

.wedit__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wedit__progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  background: #e7eef0;
}

.wedit__progress span {
  display: block;
  height: 100%;
  background: #f5c518;
  transition: width 0.2s ease;
}

.wedit__progress span.is-ok {
  background: #16a34a;
}

.wedit__label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.84rem;
  font-weight: 800;
  color: #5b7378;
}

.wedit__textarea {
  display: block;
  width: 100%;
  min-height: 320px;
  padding: 0.85rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.75rem;
  background: #fbfcfd;
  font: inherit;
  font-size: 1rem;
  line-height: 1.65;
  resize: vertical;
}

.wedit__textarea:focus {
  outline: 2px solid rgba(15, 92, 102, 0.35);
  border-color: #0f5c66;
}

.wedit__textarea[readonly] {
  background: #f1f5f6;
}

.wedit__scores {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  margin-bottom: 0.9rem;
}

@media (min-width: 720px) {
  .wedit__scores {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.wedit__scores div {
  display: grid;
  gap: 0.2rem;
  padding: 0.75rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.75rem;
  background: #fbfcfd;
}

.wedit__scores span {
  color: #5b7378;
  font-size: 0.76rem;
  font-weight: 700;
}

.wedit__scores strong {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f5c66;
}

.wedit__feedback {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.55;
}
</style>
