<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const tasks = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const page = ref(1)
const examType = ref(null)
const taskType = ref(null)
const loading = ref(true)
const message = ref('')

const examTypes = computed(() => [
  { title: t('academic'), value: 'academic' },
  { title: t('general'), value: 'general' },
])
const taskTypes = computed(() => [
  { title: t('writingTaskAcademic1'), value: 'academic_task_1' },
  { title: t('writingTaskGeneral1'), value: 'general_task_1' },
  { title: t('writingTask2'), value: 'task_2' },
])

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/writing-tasks', {
      params: {
        page: page.value,
        exam_type: examType.value || undefined,
        task_type: taskType.value || undefined,
      },
      skipErrorToast: true,
    })
    tasks.value = data.data || []
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

function applyFilters() {
  page.value = 1
  load()
}
</script>

<template>
<div>
      <div class="d-flex align-center mb-4 flex-wrap ga-2">
        <h1 class="text-h5 mb-0">{{ t('writingTasks') }}</h1>
        <v-spacer />
        <v-btn variant="tonal" :to="{ name: 'writing-submissions' }">{{ t('myWritingSubmissions') }}</v-btn>
      </div>

      <v-row class="mb-4" dense>
        <v-col cols="12" md="4">
          <v-select
            v-model="examType"
            :items="examTypes"
            :label="t('examType')"
            clearable
            density="comfortable"
            hide-details
            @update:model-value="applyFilters"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="taskType"
            :items="taskTypes"
            :label="t('writingTaskType')"
            clearable
            density="comfortable"
            hide-details
            @update:model-value="applyFilters"
          />
        </v-col>
      </v-row>

      <v-progress-circular v-if="loading" indeterminate color="primary" />
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <v-alert v-else-if="tasks.length === 0" type="info" variant="tonal">{{ t('noWritingTasksPublic') }}</v-alert>
      <v-row v-else>
        <v-col v-for="item in tasks" :key="item.id" cols="12" md="6">
          <v-card>
            <v-card-title>{{ item.title }}</v-card-title>
            <v-card-subtitle>
              {{ item.exam_type === 'general' ? t('general') : t('academic') }}
              · {{ taskTypeLabel(item.task_type) }}
              · {{ t('minutesCount', { count: item.recommended_minutes }) }}
              · {{ t('minWordsCount', { count: item.min_words }) }}
            </v-card-subtitle>
            <v-card-actions>
              <v-btn color="primary" :to="{ name: 'writing-editor', params: { id: item.id } }">
                {{ t('openWritingTask') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
      <div v-if="meta.last_page > 1" class="d-flex justify-center mt-4">
        <v-pagination v-model="page" :length="meta.last_page" @update:model-value="load" />
      </div>
  </div>
</template>
