<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const ui = useUiStore()
const route = useRoute()
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

const bandOptions = computed(() => {
  const options = []
  for (let value = 0; value <= 9; value += 0.5) {
    options.push({ title: String(value), value })
  }
  return options
})
const alreadyEvaluated = computed(() => Boolean(recording.value?.evaluation))

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
<div>
    <v-btn class="mb-4" variant="text" :to="{ name: 'teacher-speaking-queue' }">{{ t('backToSpeakingQueue') }}</v-btn>
          <v-progress-circular v-if="loading" indeterminate color="primary" />
          <template v-else-if="recording">
            <h1 class="text-h5 mb-2">{{ recording.task?.title || t('evaluateSpeaking') }}</h1>
            <p class="text-medium-emphasis mb-4">
              {{ recording.student?.name }} · {{ partLabel(recording.task?.part) }}
            </p>

            <v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>

            <v-card variant="outlined" class="mb-4">
              <v-card-title>{{ t('studentRecording') }}</v-card-title>
              <v-card-text>
                <v-alert v-if="audioError" type="warning" variant="tonal">{{ audioError }}</v-alert>
                <audio v-else-if="audioObjectUrl" :src="audioObjectUrl" controls class="w-100" />
              </v-card-text>
            </v-card>

            <v-card v-if="recording.task?.questions?.length" variant="outlined" class="mb-4">
              <v-card-title>{{ t('speakingQuestions') }}</v-card-title>
              <v-card-text>
                <p v-for="item in recording.task.questions" :key="item.id" class="mb-2">
                  {{ item.position }}. {{ item.prompt }}
                </p>
              </v-card-text>
            </v-card>

            <v-form @submit.prevent="save">
              <h2 class="text-h6 mb-3">{{ t('criterionScores') }}</h2>
              <v-row dense>
                <v-col cols="12" md="6">
                  <v-select v-model="form.fluency" :items="bandOptions" :label="t('fluency')" class="mb-2" :error-messages="fieldErrors.fluency || []" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select v-model="form.lexical" :items="bandOptions" :label="t('lexical')" class="mb-2" :error-messages="fieldErrors.lexical || []" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select v-model="form.grammar" :items="bandOptions" :label="t('grammar')" class="mb-2" :error-messages="fieldErrors.grammar || []" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select v-model="form.pronunciation" :items="bandOptions" :label="t('pronunciation')" class="mb-2" :error-messages="fieldErrors.pronunciation || []" />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select v-model="form.overall_band" :items="bandOptions" :label="t('overallBand')" class="mb-2" :error-messages="fieldErrors.overall_band || []" />
                </v-col>
              </v-row>
              <v-textarea v-model="form.feedback" :label="t('teacherFeedback')" rows="5" class="mb-4" :error-messages="fieldErrors.feedback || []" />
              <v-btn color="primary" type="submit" :loading="saving">
                {{ alreadyEvaluated ? t('updateEvaluation') : t('returnEvaluation') }}
              </v-btn>
            </v-form>
          </template>
          <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
  </div>
</template>
