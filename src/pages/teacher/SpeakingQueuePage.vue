<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const items = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const page = ref(1)
const search = ref('')
const evaluationStatus = ref('pending')
const loading = ref(true)
const message = ref('')

const statuses = computed(() => [
  { title: t('evaluationPending'), value: 'pending' },
  { title: t('evaluationReturned'), value: 'evaluated' },
])

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/teacher/speaking-recordings', {
      params: {
        page: page.value,
        search: search.value || undefined,
        evaluation_status: evaluationStatus.value || undefined,
      },
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

function applyFilters() {
  page.value = 1
  load()
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
      <h1 class="text-h5 mb-4">{{ t('teacherSpeakingQueue') }}</h1>

      <v-row class="mb-2" dense>
        <v-col cols="12" md="5">
          <v-text-field v-model="search" :label="t('search')" hide-details density="comfortable" clearable @keyup.enter="applyFilters" />
        </v-col>
        <v-col cols="12" md="4">
          <v-select v-model="evaluationStatus" :items="statuses" :label="t('evaluationStatus')" clearable hide-details density="comfortable" />
        </v-col>
        <v-col cols="12" md="3">
          <v-btn block color="primary" variant="tonal" @click="applyFilters">{{ t('filter') }}</v-btn>
        </v-col>
      </v-row>

      <v-progress-circular v-if="loading" indeterminate color="primary" />
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <v-alert v-else-if="items.length === 0" type="info" variant="tonal">{{ t('noTeacherSpeakingQueue') }}</v-alert>
      <v-table v-else>
        <thead>
          <tr>
            <th>{{ t('title') }}</th>
            <th>{{ t('student') }}</th>
            <th>{{ t('speakingPart') }}</th>
            <th>{{ t('evaluationStatus') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>{{ item.task?.title || '—' }}</td>
            <td>{{ item.student?.name || '—' }}</td>
            <td>{{ partLabel(item.task?.part) }}</td>
            <td>{{ item.evaluation_status === 'evaluated' ? t('evaluationReturned') : t('evaluationPending') }}</td>
            <td class="text-right">
              <v-btn size="small" variant="text" :to="{ name: 'teacher-speaking-evaluate', params: { id: item.id } }">
                {{ item.evaluation_status === 'evaluated' ? t('viewEvaluation') : t('evaluateSpeaking') }}
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
