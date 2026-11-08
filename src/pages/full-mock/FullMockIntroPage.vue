<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { firstApiMessage } from '../../composables/useFullMockContext'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const exam = ref(null)
const loading = ref(true)
const starting = ref(false)
const message = ref('')

const examLabel = computed(() => (exam.value?.exam_type === 'general' ? t('general') : t('academic')))
const totalMinutes = computed(() => {
  const seconds = (exam.value?.sections || []).reduce((sum, s) => sum + Number(s.duration_seconds || 0), 0)
  return seconds ? Math.round(seconds / 60) : 0
})

onMounted(load)
watch(() => route.params.slug, load)

function skillLabel(skill) {
  return t(`skill${skill.charAt(0).toUpperCase()}${skill.slice(1)}`)
}

function skillIcon(skill) {
  return {
    listening: 'mdi-headphones',
    reading: 'mdi-book-open-variant',
    writing: 'mdi-pencil-outline',
    speaking: 'mdi-microphone-outline',
  }[skill] || 'mdi-clipboard-text-outline'
}

function minutes(seconds) {
  return seconds ? t('minutesCount', { count: Math.round(Number(seconds) / 60) }) : ''
}

async function load() {
  loading.value = true
  message.value = ''
  exam.value = null
  try {
    const { data } = await http.get(`/full-mocks/${route.params.slug}`, { skipErrorToast: true })
    exam.value = data.data
    await nextTick()
    window.scrollTo(0, 0)
  } catch (error) {
    message.value = firstApiMessage(error, t('requestFailed'))
  } finally {
    loading.value = false
  }
}

async function start() {
  starting.value = true
  message.value = ''
  try {
    const { data } = await http.post(`/full-mocks/${route.params.slug}/sessions`, {}, { skipErrorToast: true })
    router.push({ name: 'full-mock-session', params: { uuid: data.data.session.uuid } })
  } catch (error) {
    message.value = firstApiMessage(error, t('requestFailed'))
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <div class="student-ui">
    <router-link
      class="student-ui__unlock-cta"
      style="background: transparent; color: var(--student-teal); padding-left: 0"
      :to="{ name: 'full-mocks' }"
    >
      <span aria-hidden="true">←</span>
      {{ t('backToFullMocks') }}
    </router-link>

    <div v-if="loading" class="student-ui__loader">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <v-alert v-else-if="message && !exam" type="error" variant="tonal">{{ message }}</v-alert>

    <template v-else-if="exam">
      <header class="student-ui__hero">
        <div>
          <p class="student-ui__eyebrow">{{ t('fullMockExams') }}</p>
          <h1>{{ exam.title }}</h1>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.7rem">
            <span class="student-ui__badge" style="background: rgba(255,255,255,0.16); color: #fff">{{ examLabel }}</span>
            <span class="student-ui__badge" style="background: rgba(255,255,255,0.16); color: #fff">
              {{ t('fullMockSectionsCount', { count: exam.sections.length }) }}
            </span>
            <span
              v-if="totalMinutes"
              class="student-ui__badge"
              style="background: rgba(255,255,255,0.16); color: #fff"
            >
              {{ t('minutesCount', { count: totalMinutes }) }}
            </span>
            <span
              class="student-ui__badge"
              :class="exam.is_free ? 'student-ui__badge--free' : 'student-ui__badge--premium'"
            >
              {{ exam.is_free ? t('freeSampleBadge') : t('premiumBadge') }}
            </span>
          </div>
        </div>
      </header>

      <v-alert v-if="message" type="error" variant="tonal">{{ message }}</v-alert>

      <section class="student-ui__pane">
        <h2>{{ t('instructions') }}</h2>
        <p class="student-ui__hint" style="white-space: pre-wrap">{{ exam.instructions || t('noInstructions') }}</p>
        <p class="student-ui__hint">{{ t('fullMockIntroNote') }}</p>
      </section>

      <section class="student-ui__pane">
        <h2>{{ t('fullMockSectionsTitle') }}</h2>
        <ol style="margin: 0; padding: 0; list-style: none; display: grid; gap: 0.6rem">
          <li
            v-for="(section, index) in exam.sections"
            :key="section.id"
            class="student-ui__card"
            style="display: grid; grid-template-columns: auto 1fr; gap: 0.75rem; align-items: center"
          >
            <span class="student-ui__badge" aria-hidden="true">
              <v-icon :icon="skillIcon(section.skill)" size="16" />
            </span>
            <div style="min-width: 0">
              <strong style="word-break: break-word">{{ index + 1 }}. {{ section.title }}</strong>
              <p class="student-ui__card-meta" style="margin: 0.15rem 0 0">
                {{ skillLabel(section.skill) }}
                <template v-if="section.duration_seconds"> · {{ minutes(section.duration_seconds) }}</template>
              </p>
            </div>
          </li>
        </ol>
      </section>

      <div class="student-ui__recorder-actions" style="justify-content: flex-start">
        <button
          type="button"
          class="student-ui__btn student-ui__btn--primary"
          style="min-width: min(100%, 16rem)"
          :disabled="starting"
          @click="start"
        >
          <v-icon icon="mdi-play-circle-outline" size="20" />
          {{ starting ? t('loading') : `${t('startFullMock')} / ${t('resumeFullMock')}` }}
        </button>
      </div>
    </template>
  </div>
</template>
