<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const test = ref(null)
const loading = ref(true)
const starting = ref(false)
const message = ref('')

onMounted(load)
watch(() => route.params.slug, load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get(`/listening-tests/${route.params.slug}`, { skipErrorToast: true })
    test.value = data.data
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

async function start() {
  starting.value = true
  message.value = ''
  try {
    const { data } = await http.post(`/listening-tests/${route.params.slug}/attempts`, {}, { skipErrorToast: true })
    router.push({ name: 'listening-attempt', params: { attemptId: data.data.attempt.id } })
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    starting.value = false
  }
}
</script>

<template>
<div>
    <v-btn class="mb-4" variant="text" :to="{ name: 'listening-tests' }">{{ t('backToListeningTestsPublic') }}</v-btn>
          <v-progress-circular v-if="loading" indeterminate color="primary" />
          <v-alert v-else-if="message && !test" type="error" variant="tonal">{{ message }}</v-alert>
          <template v-else-if="test">
            <h1 class="text-h5 mb-2">{{ test.title }}</h1>
            <div class="text-body-2 text-medium-emphasis mb-4">
              {{ test.exam_type === 'general' ? t('general') : t('academic') }}
              · {{ t('minutesCount', { count: Math.round(test.duration_seconds / 60) }) }}
    <v-alert type="info" variant="tonal" class="mb-4">
              <div class="text-subtitle-2 mb-2">{{ t('instructions') }}</div>
              <div style="white-space: pre-wrap">{{ test.instructions || t('noInstructions') }}</div>
            </v-alert>
            <v-alert type="warning" variant="tonal" class="mb-4">{{ t('listeningAudioHint') }}</v-alert>
            <v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
            <v-btn color="primary" :loading="starting" @click="start">{{ t('startOrResumeListening') }}</v-btn>

      </div>
  </template></div>
</template>
