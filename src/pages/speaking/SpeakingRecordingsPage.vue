<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const items = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const page = ref(1)
const loading = ref(true)
const message = ref('')

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/student/speaking-recordings', {
      params: { page: page.value },
      skipErrorToast: true,
    })
    items.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function partLabel(value) {
  if (Number(value) === 1) return t('speakingPart1')
  if (Number(value) === 2) return t('speakingPart2')
  if (Number(value) === 3) return t('speakingPart3')
  return value || '—'
}

function evaluationLabel(item) {
  if (item.status !== 'submitted') return '—'
  if (item.evaluation_status === 'evaluated') return t('evaluationReturned')
  return t('evaluationPending')
}
</script>

<template>
<div>
      <div class="d-flex align-center mb-4 flex-wrap ga-2">
        <h1 class="text-h5 mb-0">{{ t('mySpeakingRecordings') }}</h1>
        <v-spacer />
        <v-btn variant="tonal" :to="{ name: 'speaking-tasks' }">{{ t('speakingTasks') }}</v-btn>
      </div>

      <v-progress-circular v-if="loading" indeterminate color="primary" />
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <v-alert v-else-if="items.length === 0" type="info" variant="tonal">{{ t('noSpeakingRecordings') }}</v-alert>
      <v-table v-else>
        <thead>
          <tr>
            <th>{{ t('title') }}</th>
            <th>{{ t('speakingPart') }}</th>
            <th>{{ t('status') }}</th>
            <th>{{ t('evaluationStatus') }}</th>
            <th>{{ t('overallBand') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>{{ item.task?.title || '—' }}</td>
            <td>{{ partLabel(item.task?.part) }}</td>
            <td>{{ item.status === 'submitted' ? t('statusSubmitted') : t('statusUploaded') }}</td>
            <td>{{ evaluationLabel(item) }}</td>
            <td>{{ item.evaluation?.overall_band ?? '—' }}</td>
            <td class="text-right">
              <v-btn
                v-if="item.speaking_task_id"
                size="small"
                variant="text"
                :to="{ name: 'speaking-task-detail', params: { id: item.speaking_task_id } }"
              >
                {{ t('openSpeakingTask') }}
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>

      <div v-if="meta.last_page > 1" class="d-flex justify-center mt-4">
        <v-pagination v-model="page" :length="meta.last_page" @update:model-value="load" />
      </div>
  </div>
</template>
