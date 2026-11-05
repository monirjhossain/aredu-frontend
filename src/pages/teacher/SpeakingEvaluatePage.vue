<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { apiError } from '../../utils/apiError'
import { bandSelectOptions, suggestedOverallFromCriteria } from '../../utils/ieltsBand'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const recording = ref(null)
const form = ref({
  fluency: 6,
  lexical: 6,
  grammar: 6,
  pronunciation: 6,
  overall_band: 6,
  feedback: '',
})
const loading = ref(true)
const saving = ref(false)
const message = ref('')
const fieldErrors = ref({})
const audioObjectUrl = ref('')
const audioError = ref('')
const overallDirty = ref(false)

const bandOptions = bandSelectOptions()
const alreadyEvaluated = computed(() => Boolean(recording.value?.evaluation))

const suggestedOverall = computed(() => suggestedOverallFromCriteria([
  form.value.fluency,
  form.value.lexical,
  form.value.grammar,
  form.value.pronunciation,
]))

const showSuggestApply = computed(() => Number(form.value.overall_band) !== Number(suggestedOverall.value))

watch(
  () => [form.value.fluency, form.value.lexical, form.value.grammar, form.value.pronunciation],
  () => {
    if (!overallDirty.value) {
      form.value.overall_band = suggestedOverall.value
    }
  },
)

onMounted(load)
onBeforeUnmount(() => {
  if (audioObjectUrl.value) URL.revokeObjectURL(audioObjectUrl.value)
})

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get(`/teacher/speaking-recordings/${route.params.id}`, { skipErrorToast: true })
    recording.value = data.data
    if (data.data.evaluation) {
      form.value = {
        fluency: data.data.evaluation.fluency,
        lexical: data.data.evaluation.lexical,
        grammar: data.data.evaluation.grammar,
        pronunciation: data.data.evaluation.pronunciation,
        overall_band: data.data.evaluation.overall_band,
        feedback: data.data.evaluation.feedback || '',
      }
      overallDirty.value = true
    } else {
      overallDirty.value = false
      form.value.overall_band = suggestedOverallFromCriteria([
        form.value.fluency,
        form.value.lexical,
        form.value.grammar,
        form.value.pronunciation,
      ])
    }
    if (data.data.audio_url) await loadAudio(data.data.audio_url)
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

async function loadAudio(url) {
  audioError.value = ''
  if (audioObjectUrl.value) {
    URL.revokeObjectURL(audioObjectUrl.value)
    audioObjectUrl.value = ''
  }
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${auth.token}` } })
    if (!response.ok) {
      audioError.value = t('audioLoadFailed')
      return
    }
    audioObjectUrl.value = URL.createObjectURL(await response.blob())
  } catch {
    audioError.value = t('audioLoadFailed')
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
    fluency: Number(form.value.fluency),
    lexical: Number(form.value.lexical),
    grammar: Number(form.value.grammar),
    pronunciation: Number(form.value.pronunciation),
    overall_band: Number(form.value.overall_band),
    feedback: form.value.feedback || null,
  }
  try {
    if (alreadyEvaluated.value) {
      const { data } = await http.put(
        `/teacher/speaking-evaluations/${recording.value.evaluation.id}`,
        payload,
        { skipErrorToast: true, skipSuccessToast: true },
      )
      recording.value = { ...recording.value, evaluation: data.data, evaluation_status: 'evaluated' }
      ui.success(t('evaluationUpdated'))
    } else {
      const { data } = await http.post(
        `/teacher/speaking-recordings/${route.params.id}/evaluate`,
        payload,
        { skipErrorToast: true, skipSuccessToast: true },
      )
      recording.value = { ...recording.value, evaluation: data.data, evaluation_status: 'evaluated' }
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

function partLabel(value) {
  if (Number(value) === 1) return t('speakingPart1')
  if (Number(value) === 2) return t('speakingPart2')
  if (Number(value) === 3) return t('speakingPart3')
  return value || '—'
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero
      :title="recording?.task?.title || t('evaluateSpeaking')"
      :lead="t('teacherEvaluateSpeakingLead')"
      :eyebrow="t('teacherTools')"
    >
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost admin-ui__btn--block admin-ui__btn--block-sm"
          @click="router.push({ name: 'teacher-speaking-queue' })"
        >
          {{ t('backToSpeakingQueue') }}
        </button>
      </template>
    </AdminPageHero>

    <div v-if="loading" class="admin-ui__panel admin-ui__loading">
      <v-progress-circular indeterminate color="#0f5c66" />
    </div>

    <template v-else-if="recording">
      <section class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <div>
            <h2>{{ t('submissionMeta') }}</h2>
            <p>{{ recording.student?.name || '—' }} · {{ partLabel(recording.task?.part) }}</p>
          </div>
          <span
            class="admin-ui__chip"
            :class="recording.context_label === 'full_mock' ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'"
          >
            {{ recording.context_label === 'full_mock' ? t('contextFullMock') : t('contextPractice') }}
          </span>
        </div>
        <p v-if="recording.context_key && recording.context_key !== 'practice'" class="admin-ui__row-meta">
          {{ t('contextKeyLabel') }}: {{ recording.context_key }}
        </p>
      </section>

      <v-alert v-if="message" type="error" variant="tonal" class="mb-3">{{ message }}</v-alert>

      <section class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <div>
            <h2>{{ t('studentRecording') }}</h2>
          </div>
        </div>
        <v-alert v-if="audioError" type="warning" variant="tonal">{{ audioError }}</v-alert>
        <audio v-else-if="audioObjectUrl" :src="audioObjectUrl" controls class="teacher-eval__audio" />
      </section>

      <section v-if="recording.task?.questions?.length" class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <div>
            <h2>{{ t('speakingQuestions') }}</h2>
          </div>
        </div>
        <ol class="teacher-eval__questions">
          <li v-for="item in recording.task.questions" :key="item.id">
            <strong>{{ item.position }}.</strong> {{ item.prompt }}
            <p v-if="item.cue_card" class="admin-ui__row-meta">{{ item.cue_card }}</p>
          </li>
        </ol>
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
              <span>{{ t('fluency') }}</span>
              <select v-model.number="form.fluency">
                <option v-for="band in bandOptions" :key="`fl-${band}`" :value="band">{{ band }}</option>
              </select>
              <small v-if="fieldErrors.fluency?.length" class="teacher-eval__error">{{ fieldErrors.fluency[0] }}</small>
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
              <span>{{ t('pronunciation') }}</span>
              <select v-model.number="form.pronunciation">
                <option v-for="band in bandOptions" :key="`pr-${band}`" :value="band">{{ band }}</option>
              </select>
              <small v-if="fieldErrors.pronunciation?.length" class="teacher-eval__error">{{ fieldErrors.pronunciation[0] }}</small>
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
.teacher-eval__audio {
  display: block;
  width: 100%;
  max-width: 100%;
}

.teacher-eval__questions {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.65rem;
  color: var(--admin-ink, #102a2e);
  font-size: 0.9rem;
  line-height: 1.5;
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
