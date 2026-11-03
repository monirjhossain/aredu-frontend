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
    const { data } = await http.get('/student/writing-submissions', {
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

function taskTypeLabel(value) {
  if (value === 'academic_task_1') return t('writingTaskAcademic1')
  if (value === 'general_task_1') return t('writingTaskGeneral1')
  if (value === 'task_2') return t('writingTask2')
  return value
}
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4 flex-wrap ga-2">
      <h1 class="text-h5 mb-0">{{ t('myWritingSubmissions') }}</h1>
      <v-spacer />
      <v-btn variant="tonal" :to="{ name: 'writing-tasks' }">{{ t('writingTasks') }}</v-btn>
    </div>
    <v-progress-circular v-if="loading" indeterminate color="primary" />
    <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
    <v-alert v-else-if="items.length === 0" type="info" variant="tonal">{{ t('noWritingSubmissions') }}</v-alert>
    <v-table v-else>
      <thead>
        <tr>
          <th>{{ t('title') }}</th>
          <th>{{ t('writingTaskType') }}</th>
          <th>{{ t('status') }}</th>
          <th>{{ t('evaluationStatus') }}</th>
          <th>{{ t('overallBand') }}</th>
          <th>{{ t('wordCount') }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td>{{ item.task?.title || '—' }}</td>
          <td>{{ taskTypeLabel(item.task?.task_type) }}</td>
          <td>{{ item.status === 'submitted' ? t('statusSubmitted') : t('statusDraft') }}</td>
          <td>
            <template v-if="item.status !== 'submitted'">—</template>
            <template v-else-if="item.evaluation_status === 'evaluated'">{{ t('evaluationReturned') }}</template>
            <template v-else>{{ t('evaluationPending') }}</template>
          </td>
          <td>{{ item.evaluation?.overall_band ?? '—' }}</td>
          <td>{{ item.word_count }}</td>
          <td class="text-right">
            <v-btn v-if="item.writing_task_id" size="small" variant="text" :to="{ name: 'writing-editor', params: { id: item.writing_task_id } }">
              {{ t('openWritingTask') }}
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
