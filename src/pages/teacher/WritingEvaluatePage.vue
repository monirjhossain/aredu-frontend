<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const route = useRoute()

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
const success = ref('')
const fieldErrors = ref({})

const bandOptions = computed(() => {
  const options = []
  for (let value = 0; value <= 9; value += 0.5) {
    options.push({ title: String(value), value })
  }
  return options
})

const alreadyEvaluated = computed(() => Boolean(submission.value?.evaluation))

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  success.value = ''
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
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  message.value = ''
  success.value = ''
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
        { skipErrorToast: true },
      )
      submission.value = {
        ...submission.value,
        evaluation: data.data,
        evaluation_status: 'evaluated',
      }
      success.value = t('evaluationUpdated')
    } else {
      const { data } = await http.post(
        `/teacher/writing-submissions/${route.params.id}/evaluate`,
        payload,
        { skipErrorToast: true },
      )
      submission.value = {
        ...submission.value,
        evaluation: data.data,
        evaluation_status: 'evaluated',
      }
      success.value = t('evaluationReturnedMsg')
    }
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
<div>
    <v-btn class="mb-4" variant="text" :to="{ name: 'teacher-writing-queue' }">{{ t('backToWritingQueue') }}</v-btn>
          <v-progress-circular v-if="loading" indeterminate color="primary" />
          <template v-else-if="submission">
            <h1 class="text-h5 mb-2">{{ submission.task?.title || t('evaluateWriting') }}</h1>
            <p class="text-medium-emphasis mb-4">
              {{ submission.student?.name }} · {{ taskTypeLabel(submission.task?.task_type) }}
              · {{ t('wordCountLabel', { count: submission.word_count }) }}
            </p>

            <v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
            <v-alert v-if="success" type="success" variant="tonal" class="mb-4">{{ success }}</v-alert>

            <v-card variant="outlined" class="mb-4">
              <v-card-title>{{ t('writingPrompt') }}</v-card-title>
              <v-card-text>
                <p v-if="submission.task?.instructions" class="mb-3 text-medium-emphasis" style="white-space: pre-wrap">
                  {{ submission.task.instructions }}
                </p>
                <p style="white-space: pre-wrap">{{ submission.task?.prompt }}</p>
                <v-img v-if="submission.task?.image_url" :src="submission.task.image_url" max-height="280" class="mt-4" contain />
              </v-card-text>
            </v-card>

            <v-card variant="outlined" class="mb-4">
              <v-card-title>{{ t('studentAnswer') }}</v-card-title>
              <v-card-text>
                <p style="white-space: pre-wrap">{{ submission.body }}</p>
              </v-card-text>
            </v-card>

            <v-form @submit.prevent="save">
              <h2 class="text-h6 mb-3">{{ t('criterionScores') }}</h2>
              <v-row dense>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.task_response"
                    :items="bandOptions"
                    :label="t('taskResponse')"
                    class="mb-2"
                    :error-messages="fieldErrors.task_response || []"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.coherence"
                    :items="bandOptions"
                    :label="t('coherence')"
                    class="mb-2"
                    :error-messages="fieldErrors.coherence || []"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.lexical"
                    :items="bandOptions"
                    :label="t('lexical')"
                    class="mb-2"
                    :error-messages="fieldErrors.lexical || []"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.grammar"
                    :items="bandOptions"
                    :label="t('grammar')"
                    class="mb-2"
                    :error-messages="fieldErrors.grammar || []"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.overall_band"
                    :items="bandOptions"
                    :label="t('overallBand')"
                    class="mb-2"
                    :error-messages="fieldErrors.overall_band || []"
                  />
                </v-col>
              </v-row>
              <v-textarea
                v-model="form.feedback"
                :label="t('teacherFeedback')"
                rows="5"
                class="mb-4"
                :error-messages="fieldErrors.feedback || []"
              />
              <v-btn color="primary" type="submit" :loading="saving">
                {{ alreadyEvaluated ? t('updateEvaluation') : t('returnEvaluation') }}
              </v-btn>
            </v-form>
          </template>
          <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
  </div>
</template>
