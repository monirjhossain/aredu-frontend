<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocaleStore } from '../../stores/locale'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const localeStore = useLocaleStore()
const rows = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const page = ref(1)
const loading = ref(true)
const message = ref('')

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/student/listening-attempts', {
      params: { page: page.value },
      skipErrorToast: true,
    })
    rows.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function when(value) {
  if (!value) return ''
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleString(locale)
}
</script>

<template>
<div>
      <div class="d-flex align-center mb-4">
        <h1 class="text-h5 mb-0">{{ t('listeningResults') }}</h1>
        <v-spacer />
        <v-btn color="primary" variant="tonal" :to="{ name: 'listening-tests' }">{{ t('listeningTests') }}</v-btn>
      </div>
      <v-progress-circular v-if="loading" indeterminate color="primary" />
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <v-alert v-else-if="rows.length === 0" type="info" variant="tonal">{{ t('noListeningResults') }}</v-alert>
      <v-table v-else>
        <thead>
          <tr>
            <th>{{ t('title') }}</th>
            <th>{{ t('submittedAt') }}</th>
            <th>{{ t('yourScore') }}</th>
            <th>{{ t('bandScore') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.test?.title }}</td>
            <td>{{ when(row.submitted_at) }}</td>
            <td>{{ row.result ? `${row.result.raw_score}/${row.result.max_score}` : '—' }}</td>
            <td>{{ row.result?.band_score ?? t('bandPending') }}</td>
            <td class="text-right">
              <v-btn size="small" variant="text" :to="{ name: 'listening-attempt', params: { attemptId: row.id } }">
                {{ t('viewAttempt') }}
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
