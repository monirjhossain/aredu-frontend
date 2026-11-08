<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
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

const tips = computed(() => [
  { icon: 'mdi-timer-outline', title: t('listeningIntroTipTimerTitle'), body: t('listeningIntroTipTimer') },
  { icon: 'mdi-headphones', title: t('listeningIntroTipAudioTitle'), body: t('listeningIntroTipAudio') },
  { icon: 'mdi-flag-checkered', title: t('listeningIntroTipSubmitTitle'), body: t('listeningIntroTipSubmit') },
])

onMounted(load)
watch(() => route.params.slug, load)

async function load() {
  loading.value = true
  message.value = ''
  test.value = null
  try {
    const { data } = await http.get(`/listening-tests/${route.params.slug}`, { skipErrorToast: true })
    test.value = data.data
    await nextTick()
    window.scrollTo(0, 0)
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
    <div v-if="loading" class="rmock-intro__loader">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <v-alert v-else-if="message && !test" type="error" variant="tonal">{{ message }}</v-alert>

    <template v-else-if="test">
      <div class="rmock-intro__nav">
        <button type="button" class="rmock-intro__back" @click="router.push({ name: 'listening-tests' })">
          <v-icon icon="mdi-arrow-left" size="18" />
          {{ t('backToListeningTestsPublic') }}
        </button>
        <router-link
          v-if="test.is_free_sample"
          class="rmock-intro__nav-link"
          :to="{ name: 'free-practice', query: { module: 'listening' } }"
        >
          {{ t('backToFreePractice') }}
        </router-link>
      </div>

      <header class="rmock-intro__hero">
        <div class="rmock-intro__hero-copy">
          <div class="rmock-intro__badges">
            <span
              class="rmock-intro__badge"
              :class="test.is_free_sample ? 'rmock-intro__badge--free' : 'rmock-intro__badge--premium'"
            >
              {{ test.is_free_sample ? t('freeSampleBadge') : t('premiumBadge') }}
            </span>
            <span class="rmock-intro__badge">{{ examLabel }}</span>
            <span class="rmock-intro__badge">{{ minutes }}</span>
            <span class="rmock-intro__badge">{{ t('listeningFourSectionsStudent') }}</span>
          </div>
          <p class="rmock-intro__eyebrow">{{ t('listeningTests') }}</p>
          <h1>{{ test.title }}</h1>
          <p class="rmock-intro__lead">{{ t('listeningIntroReadyLead') }}</p>
        </div>
        <div class="rmock-intro__hero-cta">
          <button
            type="button"
            class="rmock-intro__start rmock-intro__start--hero"
            :disabled="starting"
            @click="start"
          >
            <v-icon icon="mdi-play-circle-outline" size="22" />
            {{ starting ? t('loading') : t('startOrResumeListening') }}
          </button>
          <p class="rmock-intro__hero-note">{{ t('listeningIntroStartNote') }}</p>
        </div>
      </header>

      <div class="rmock-intro__grid">
        <section class="rmock-intro__panel">
          <h2>{{ t('instructions') }}</h2>
          <p class="rmock-intro__copy">{{ test.instructions || t('noInstructions') }}</p>

          <div v-if="test.is_free_sample" class="rmock-intro__sample">
            <v-icon icon="mdi-gift-outline" size="20" />
            <div>
              <p>{{ t('freeSampleIntroNote') }}</p>
              <router-link class="rmock-intro__enroll rmock-intro__enroll--inline" :to="{ name: 'courses' }">
                {{ t('freeMockEnrollCta') }}
                <span aria-hidden="true">→</span>
              </router-link>
            </div>
          </div>
        </section>

        <section class="rmock-intro__panel rmock-intro__panel--tips">
          <h2>{{ t('listeningIntroReadyTitle') }}</h2>
          <ul class="rmock-intro__tips">
            <li v-for="tip in tips" :key="tip.title">
              <span class="rmock-intro__tip-icon" aria-hidden="true">
                <v-icon :icon="tip.icon" size="20" />
              </span>
              <div>
                <strong>{{ tip.title }}</strong>
                <p>{{ tip.body }}</p>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <v-alert v-if="message" type="error" variant="tonal">{{ message }}</v-alert>

      <footer class="rmock-intro__foot">
        <router-link
          v-if="test.is_free_sample"
          class="rmock-intro__enroll"
          :to="{ name: 'courses' }"
        >
          {{ t('freeMockEnrollCta') }}
          <span aria-hidden="true">→</span>
        </router-link>
        <button
          type="button"
          class="rmock-intro__start"
          :disabled="starting"
          @click="start"
        >
          {{ starting ? t('loading') : t('startOrResumeListening') }}
        </button>
      </footer>

      <div class="rmock-intro__dock">
        <button
          type="button"
          class="rmock-intro__start"
          :disabled="starting"
          @click="start"
        >
          {{ starting ? t('loading') : t('startOrResumeListening') }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rmock-intro {
  --ink: #102a2e;
  --muted: #5b7378;
  --line: #d9e6e8;
  --teal: #0f5c66;
  --yellow: #e54c10;
  display: grid;
  gap: 0.9rem;
  padding-bottom: 5.5rem;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: var(--ink);
  scroll-margin-top: 5rem;
}

.rmock-intro__loader {
  display: grid;
  place-items: center;
  min-height: 220px;
}

.rmock-intro__nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.rmock-intro__back,
.rmock-intro__nav-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--teal);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 750;
  text-decoration: none;
  cursor: pointer;
}

.rmock-intro__hero {
  display: grid;
  gap: 1.1rem;
  padding: 1.25rem 1.2rem 1.3rem;
  border-radius: 1.15rem;
  background:
    radial-gradient(circle at 100% 0%, rgba(229, 76, 16, 0.28), transparent 42%),
    linear-gradient(135deg, #0b3d36 0%, #0f5c66 52%, #0a2a3a 100%);
  color: #fff;
  overflow: hidden;
}

.rmock-intro__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.65rem;
}

.rmock-intro__badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.7rem;
  padding: 0.15rem 0.65rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 0.75rem;
  font-weight: 750;
}

.rmock-intro__badge--free {
  background: var(--yellow);
  color: #fff;
}

.rmock-intro__badge--premium {
  background: rgba(255, 255, 255, 0.92);
  color: #0f5c66;
}

.rmock-intro__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.rmock-intro__hero h1 {
  margin: 0;
  font-size: clamp(1.45rem, 4vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
  word-break: break-word;
}

.rmock-intro__lead {
  margin: 0.65rem 0 0;
  max-width: 42ch;
  color: rgba(255, 255, 255, 0.86);
  font-size: 0.95rem;
  line-height: 1.5;
}

.rmock-intro__hero-cta {
  display: none;
  gap: 0.45rem;
}

.rmock-intro__hero-note {
  margin: 0;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.72);
}

.rmock-intro__grid {
  display: grid;
  gap: 0.85rem;
}

.rmock-intro__panel {
  padding: 1.15rem 1.1rem;
  border-radius: 1rem;
  border: 1px solid var(--line);
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
  color: var(--muted);
  white-space: pre-wrap;
  line-height: 1.55;
  font-size: 0.95rem;
}

.rmock-intro__sample {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  margin-top: 1rem;
  padding: 0.85rem 0.9rem;
  border-radius: 0.8rem;
  background: #fff8db;
  color: #5c4a00;
}

.rmock-intro__sample p {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  font-weight: 600;
}

.rmock-intro__enroll--inline {
  margin-top: 0.35rem;
  color: #5c4a00;
}

@media (min-width: 720px) {
  .rmock-intro__enroll--inline {
    display: none;
  }
}

.rmock-intro__tips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.rmock-intro__tips li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  align-items: start;
}

.rmock-intro__tip-icon {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.7rem;
  background: rgba(15, 92, 102, 0.1);
  color: var(--teal);
}

.rmock-intro__tips strong {
  display: block;
  font-size: 0.92rem;
  font-weight: 800;
}

.rmock-intro__tips p {
  margin: 0.15rem 0 0;
  color: var(--muted);
  font-size: 0.86rem;
  line-height: 1.4;
}

.rmock-intro__foot {
  display: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.15rem 0 0.25rem;
}

.rmock-intro__enroll {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 44px;
  color: var(--teal);
  font-weight: 750;
  text-decoration: none;
}

.rmock-intro__start {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 48px;
  padding: 0 1.2rem;
  border: 0;
  border-radius: 0.75rem;
  background: var(--teal);
  color: #fff;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
  width: 100%;
}

.rmock-intro__start--hero {
  background: var(--yellow);
  color: #fff;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
}

.rmock-intro__start:disabled {
  opacity: 0.7;
  cursor: wait;
}

.rmock-intro__dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  padding: 0.75rem 0.85rem calc(0.75rem + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(243, 245, 248, 0), #f3f5f8 28%);
}

.rmock-intro__dock .rmock-intro__start {
  box-shadow: 0 10px 28px rgba(15, 92, 102, 0.28);
}

@media (min-width: 720px) {
  .rmock-intro {
    padding-bottom: 0.5rem;
  }

  .rmock-intro__hero {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 1.5rem;
    padding: 1.45rem 1.4rem;
  }

  .rmock-intro__hero-cta {
    display: grid;
    min-width: 12.5rem;
  }

  .rmock-intro__start--hero,
  .rmock-intro__foot .rmock-intro__start {
    width: auto;
  }

  .rmock-intro__grid {
    grid-template-columns: minmax(0, 1.15fr) minmax(16rem, 0.85fr);
    align-items: start;
  }

  .rmock-intro__foot {
    display: flex;
  }

  .rmock-intro__dock {
    display: none;
  }
}
</style>
