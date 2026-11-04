<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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

const minutes = computed(() =>
  t('minutesCount', { count: Math.round(Number(test.value?.duration_seconds || 0) / 60) }),
)

const examLabel = computed(() =>
  test.value?.exam_type === 'general' ? t('general') : t('academic'),
)

onMounted(load)
watch(() => route.params.slug, load)

async function load() {
  loading.value = true
  message.value = ''
  test.value = null
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
  <div class="rmock-intro">
    <button type="button" class="rmock-intro__back" @click="router.push({ name: 'listening-tests' })">
      <span aria-hidden="true">←</span>
      {{ t('backToListeningTestsPublic') }}
    </button>

    <div v-if="loading" class="rmock-intro__loader">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <v-alert v-else-if="message && !test" type="error" variant="tonal">{{ message }}</v-alert>

    <template v-else-if="test">
      <header class="rmock-intro__hero">
        <p class="rmock-intro__eyebrow">{{ t('listeningTests') }}</p>
        <h1>{{ test.title }}</h1>
        <div class="rmock-intro__meta">
          <span>{{ examLabel }}</span>
          <span>{{ minutes }}</span>
          <span>{{ t('listeningFourSectionsStudent') }}</span>
        </div>
      </header>

      <section class="rmock-intro__panel">
        <h2>{{ t('instructions') }}</h2>
        <p class="rmock-intro__copy">{{ test.instructions || t('noInstructions') }}</p>

        <ul class="rmock-intro__tips">
          <li>{{ t('listeningIntroTipTimer') }}</li>
          <li>{{ t('listeningIntroTipAudio') }}</li>
          <li>{{ t('listeningIntroTipSubmit') }}</li>
        </ul>

        <v-alert v-if="message" type="error" variant="tonal" class="mb-3">{{ message }}</v-alert>

        <button
          type="button"
          class="rmock-intro__start"
          :disabled="starting"
          @click="start"
        >
          {{ starting ? t('loading') : t('startOrResumeListening') }}
        </button>
      </section>
    </template>
  </div>
</template>

<style scoped>
.rmock-intro {
  display: grid;
  gap: 1rem;
  max-width: 720px;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: #102a2e;
}

.rmock-intro__back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 40px;
  width: fit-content;
  padding: 0;
  border: 0;
  background: transparent;
  color: #0f5c66;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 750;
  cursor: pointer;
}

.rmock-intro__loader {
  display: grid;
  place-items: center;
  min-height: 160px;
}

.rmock-intro__hero {
  padding: 1.2rem 1.25rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at top right, rgba(245, 197, 24, 0.2), transparent 42%),
    linear-gradient(135deg, #0b3d36 0%, #0f5c66 55%, #0a2a3a 100%);
  color: #fff;
}

.rmock-intro__eyebrow {
  margin: 0 0 0.3rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.rmock-intro__hero h1 {
  margin: 0;
  font-size: clamp(1.35rem, 3vw, 1.8rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  word-break: break-word;
}

.rmock-intro__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.85rem;
}

.rmock-intro__meta span {
  display: inline-flex;
  align-items: center;
  min-height: 1.7rem;
  padding: 0.15rem 0.65rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 0.78rem;
  font-weight: 750;
}

.rmock-intro__panel {
  padding: 1.1rem;
  border-radius: 1rem;
  border: 1px solid #d9e6e8;
  background: #fff;
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.rmock-intro__panel h2 {
  margin: 0 0 0.55rem;
  font-size: 1.05rem;
  font-weight: 800;
}

.rmock-intro__copy {
  margin: 0;
  color: #5b7378;
  white-space: pre-wrap;
  line-height: 1.55;
  font-size: 0.95rem;
}

.rmock-intro__tips {
  margin: 1rem 0 0;
  padding-left: 1.15rem;
  display: grid;
  gap: 0.4rem;
  color: #35555a;
  font-size: 0.88rem;
  line-height: 1.4;
}

.rmock-intro__start {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  margin-top: 1.15rem;
  padding: 0 1.2rem;
  border: 0;
  border-radius: 0.7rem;
  background: #0f5c66;
  color: #fff;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
  width: 100%;
}

@media (min-width: 560px) {
  .rmock-intro__start {
    width: auto;
  }
}

.rmock-intro__start:disabled {
  opacity: 0.7;
  cursor: wait;
}
</style>
