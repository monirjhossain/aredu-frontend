<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { bandSelectOptions, suggestedOverallFromCriteria } from '../../utils/ieltsBand'
import { useUiStore } from '../../stores/ui'
import { sanitizeWritingHtml } from '../../utils/htmlText'

const { t } = useI18n()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const submission = ref(null)
const form = ref({
  task_response: 6,
  coherence: 6,
  lexical: 6,
  grammar: 6,
  overall_band: 6,
  feedback: '',
})
const loading = ref(true)
const saving = ref(false)
const message = ref('')
const fieldErrors = ref({})
const overallDirty = ref(false)

const bandOptions = bandSelectOptions()
const alreadyEvaluated = computed(() => Boolean(submission.value?.evaluation))
const safeBody = computed(() => sanitizeWritingHtml(submission.value?.body || ''))

const suggestedOverall = computed(() => suggestedOverallFromCriteria([
  form.value.task_response,
  form.value.coherence,
  form.value.lexical,
  form.value.grammar,
]))

const showSuggestApply = computed(() => Number(form.value.overall_band) !== Number(suggestedOverall.value))

watch(
  () => [form.value.task_response, form.value.coherence, form.value.lexical, form.value.grammar],
  () => {
    if (!overallDirty.value) {
      form.value.overall_band = suggestedOverall.value
    }
  },
)

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get(`/teacher/writing-submissions/${route.params.id}`, { skipErrorToast: true })
    submission.value = data.data
    if (data.data.evaluation) {
      form.value = {
        task_response: data.data.evaluation.task_response,
        coherence: data.data.evaluation.coherence,
        lexical: data.data.evaluation.lexical,
        grammar: data.data.evaluation.grammar,
        overall_band: data.data.evaluation.overall_band,
        feedback: data.data.evaluation.feedback || '',
      }
      overallDirty.value = true
    } else {
      overallDirty.value = false
      form.value.overall_band = suggestedOverallFromCriteria([
        form.value.task_response,
        form.value.coherence,
        form.value.lexical,
        form.value.grammar,
      ])
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function markOverallDirty() {
  overallDirty.value = true
}

function applySuggestedOverall() {
  form.value.overall_band = suggestedOverall.value
  overallDirty.value = false
}

async function save() {
  saving.value = true
  message.value = ''
  fieldErrors.value = {}
  const payload = {
    task_response: Number(form.value.task_response),
    coherence: Number(form.value.coherence),
    lexical: Number(form.value.lexical),
    grammar: Number(form.value.grammar),
    overall_band: Number(form.value.overall_band),
    feedback: form.value.feedback || null,
  }
  try {
    if (alreadyEvaluated.value) {
      const { data } = await http.put(
        `/teacher/writing-evaluations/${submission.value.evaluation.id}`,
        payload,
        { skipErrorToast: true, skipSuccessToast: true },
      )
      submission.value = {
        ...submission.value,
        evaluation: data.data,
        evaluation_status: 'evaluated',
      }
      ui.success(t('evaluationUpdated'))
    } else {
      const { data } = await http.post(
        `/teacher/writing-submissions/${route.params.id}/evaluate`,
        payload,
        { skipErrorToast: true, skipSuccessToast: true },
      )
      submission.value = {
        ...submission.value,
        evaluation: data.data,
        evaluation_status: 'evaluated',
      }
      ui.success(t('evaluationReturnedMsg'))
    }
    overallDirty.value = true
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors || {}
    message.value = parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

function taskTypeLabel(value) {
  if (value === 'academic_task_1') return t('writingTaskAcademic1')
  if (value === 'general_task_1') return t('writingTaskGeneral1')
  if (value === 'task_2') return t('writingTask2')
  return value || '—'
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero
      :title="submission?.task?.title || t('evaluateWriting')"
      :lead="t('teacherEvaluateWritingLead')"
      :eyebrow="t('teacherTools')"
    >
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost admin-ui__btn--block admin-ui__btn--block-sm"
          @click="router.push({ name: 'teacher-writing-queue' })"
        >
          {{ t('backToWritingQueue') }}
        </button>
      </template>
    </AdminPageHero>

    <div v-if="loading" class="admin-ui__panel admin-ui__loading">
      <v-progress-circular indeterminate color="#0f5c66" />
    </div>

    <template v-else-if="submission">
      <section class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <div>
            <h2>{{ t('submissionMeta') }}</h2>
            <p>
              {{ submission.student?.name || '—' }}
              · {{ taskTypeLabel(submission.task?.task_type) }}
              · {{ t('wordCountLabel', { count: submission.word_count }) }}
            </p>
          </div>
          <span
            class="admin-ui__chip"
            :class="submission.context_label === 'full_mock' ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'"
          >
            {{ submission.context_label === 'full_mock' ? t('contextFullMock') : t('contextPractice') }}
          </span>
        </div>
        <p v-if="submission.context_key && submission.context_key !== 'practice'" class="admin-ui__row-meta">
          {{ t('contextKeyLabel') }}: {{ submission.context_key }}
        </p>
      </section>

      <v-alert v-if="message" type="error" variant="tonal" class="mb-3">{{ message }}</v-alert>

      <section class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <div>
            <h2>{{ t('writingPrompt') }}</h2>
          </div>
        </div>
        <p v-if="submission.task?.instructions" class="teacher-eval__pre">{{ submission.task.instructions }}</p>
        <p class="teacher-eval__pre">{{ submission.task?.prompt }}</p>
        <img
          v-if="submission.task?.image_url"
          :src="submission.task.image_url"
          :alt="submission.task?.title || t('writingPrompt')"
          class="teacher-eval__image"
        >
      </section>

      <section class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <div>
            <h2>{{ t('studentAnswer') }}</h2>
          </div>
        </div>
        <div class="student-ui__prose teacher-eval__answer" v-html="safeBody" />
      </section>

      <section class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <div>
            <h2>{{ t('criterionScores') }}</h2>
            <p>{{ t('suggestedOverallHint', { band: suggestedOverall }) }}</p>
          </div>
          <button
            v-if="showSuggestApply"
            type="button"
            class="admin-ui__btn admin-ui__btn--soft"
            @click="applySuggestedOverall"
          >
            {{ t('applySuggestedBand', { band: suggestedOverall }) }}
          </button>
        </div>

        <form class="teacher-eval__form" @submit.prevent="save">
          <div class="admin-ui__form-grid admin-ui__form-grid--2">
            <label class="admin-ui__field">
              <span>{{ t('taskResponse') }}</span>
              <select v-model.number="form.task_response">
                <option v-for="band in bandOptions" :key="`tr-${band}`" :value="band">{{ band }}</option>
              </select>
              <small v-if="fieldErrors.task_response?.length" class="teacher-eval__error">{{ fieldErrors.task_response[0] }}</small>
            </label>
            <label class="admin-ui__field">
              <span>{{ t('coherence') }}</span>
              <select v-model.number="form.coherence">
                <option v-for="band in bandOptions" :key="`co-${band}`" :value="band">{{ band }}</option>
              </select>
              <small v-if="fieldErrors.coherence?.length" class="teacher-eval__error">{{ fieldErrors.coherence[0] }}</small>
            </label>
            <label class="admin-ui__field">
              <span>{{ t('lexical') }}</span>
              <select v-model.number="form.lexical">
                <option v-for="band in bandOptions" :key="`lx-${band}`" :value="band">{{ band }}</option>
              </select>
              <small v-if="fieldErrors.lexical?.length" class="teacher-eval__error">{{ fieldErrors.lexical[0] }}</small>
            </label>
            <label class="admin-ui__field">
              <span>{{ t('grammar') }}</span>
              <select v-model.number="form.grammar">
                <option v-for="band in bandOptions" :key="`gr-${band}`" :value="band">{{ band }}</option>
              </select>
              <small v-if="fieldErrors.grammar?.length" class="teacher-eval__error">{{ fieldErrors.grammar[0] }}</small>
            </label>
            <label class="admin-ui__field">
              <span>{{ t('overallBand') }}</span>
              <select v-model.number="form.overall_band" @change="markOverallDirty">
                <option v-for="band in bandOptions" :key="`ov-${band}`" :value="band">{{ band }}</option>
              </select>
              <small v-if="fieldErrors.overall_band?.length" class="teacher-eval__error">{{ fieldErrors.overall_band[0] }}</small>
            </label>
          </div>

          <label class="admin-ui__field teacher-eval__feedback">
            <span>{{ t('teacherFeedback') }}</span>
            <textarea v-model="form.feedback" rows="5" />
            <small v-if="fieldErrors.feedback?.length" class="teacher-eval__error">{{ fieldErrors.feedback[0] }}</small>
          </label>

          <div class="admin-ui__form-actions">
            <button
              type="submit"
              class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
              :disabled="saving"
            >
              {{ saving ? t('loading') : (alreadyEvaluated ? t('updateEvaluation') : t('returnEvaluation')) }}
            </button>
          </div>
        </form>
      </section>
    </template>

    <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
  </div>
</template>

<style scoped>
.teacher-eval__pre {
  margin: 0 0 0.75rem;
  white-space: pre-wrap;
  color: var(--admin-ink, #102a2e);
  font-size: 0.9rem;
  line-height: 1.55;
}

.teacher-eval__image {
  display: block;
  max-width: 100%;
  max-height: 280px;
  width: auto;
  height: auto;
  margin-top: 0.75rem;
  object-fit: contain;
  border-radius: 0.55rem;
  border: 1px solid var(--admin-line, #d7e2e4);
}

.teacher-eval__answer {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.teacher-eval__form {
  display: grid;
  gap: 0.85rem;
}

.teacher-eval__feedback {
  margin-top: 0.25rem;
}

.teacher-eval__error {
  color: #b42318;
  font-size: 0.75rem;
}
</style>
