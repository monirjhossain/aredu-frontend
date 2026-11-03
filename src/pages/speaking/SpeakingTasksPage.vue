<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const tasks = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const page = ref(1)
const part = ref(null)
const loading = ref(true)
const message = ref('')

const parts = computed(() => [
  { title: t('speakingPart1'), value: 1 },
  { title: t('speakingPart2'), value: 2 },
  { title: t('speakingPart3'), value: 3 },
])

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/speaking-tasks', {
      params: {
        page: page.value,
        part: part.value || undefined,
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

function partLabel(value) {
  if (Number(value) === 1) return t('speakingPart1')
  if (Number(value) === 2) return t('speakingPart2')
  if (Number(value) === 3) return t('speakingPart3')
  return value
}
</script>

<template>
  <div>
      <h1 class="text-h5 mb-4">{{ t('speakingTasks') }}</h1>
      <v-select
        v-model="part"
        class="mb-4"
        style="max-width: 280px"
        :items="parts"
        :label="t('speakingPart')"
        clearable
        density="comfortable"
        @update:model-value="() => { page = 1; load() }"
      />
      <v-progress-circular v-if="loading" indeterminate color="primary" />
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <v-alert v-else-if="tasks.length === 0" type="info" variant="tonal">{{ t('noSpeakingTasksPublic') }}</v-alert>
      <v-row v-else>
        <v-col v-for="item in tasks" :key="item.id" cols="12" md="6">
          <v-card>
            <v-card-title>{{ item.title }}</v-card-title>
            <v-card-subtitle>
              {{ partLabel(item.part) }}
              · {{ t('prepSecondsShort', { count: item.preparation_seconds }) }}
              · {{ t('responseSecondsShort', { count: item.response_seconds }) }}
              · {{ t('questionsCount', { count: item.questions_count ?? 0 }) }}
            </v-card-subtitle>
            <v-card-actions>
              <v-btn color="primary" :to="{ name: 'speaking-task-detail', params: { id: item.id } }">
                {{ t('openSpeakingTask') }}
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
