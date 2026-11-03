<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const tests = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const page = ref(1)
const examType = ref(null)
const loading = ref(true)
const message = ref('')

const examTypes = computed(() => [
  { title: t('academic'), value: 'academic' },
  { title: t('general'), value: 'general' },
])

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/reading-tests', {
      params: {
        page: page.value,
        exam_type: examType.value || undefined,
      },
      skipErrorToast: true,
    })
    tests.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function minutes(seconds) {
  return t('minutesCount', { count: Math.round(Number(seconds || 0) / 60) })
}
</script>

<template>
  <div>
      <h1 class="text-h5 mb-4">{{ t('readingTests') }}</h1>
      <v-select
        v-model="examType"
        class="mb-4"
        style="max-width: 280px"
        :items="examTypes"
        :label="t('examType')"
        clearable
        density="comfortable"
        @update:model-value="() => { page = 1; load() }"
      />
      <v-progress-circular v-if="loading" indeterminate color="primary" />
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <v-alert v-else-if="tests.length === 0" type="info" variant="tonal">{{ t('noReadingTestsPublic') }}</v-alert>
      <v-row v-else>
        <v-col v-for="item in tests" :key="item.id" cols="12" md="6">
          <v-card>
            <v-card-title>{{ item.title }}</v-card-title>
            <v-card-subtitle>
              {{ item.exam_type === 'general' ? t('general') : t('academic') }} · {{ minutes(item.duration_seconds) }}
            </v-card-subtitle>
            <v-card-actions>
              <v-btn color="primary" :to="{ name: 'reading-test-intro', params: { slug: item.slug } }">
                {{ t('openReadingTest') }}
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
