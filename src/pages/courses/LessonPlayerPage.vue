<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const message = ref('')
const actionMessage = ref('')
const playback = ref(null)
const lessonTitle = ref('')
const completing = ref(false)
const progress = ref(null)
const courseProgress = ref(null)
const certificate = ref(null)

let heartbeatTimer = null
let pageOpenedAt = 0
let basePosition = 0
let lastSentPosition = -1

const iframeSrc = computed(() => playback.value?.playback?.iframe_url || '')
const isCompleted = computed(() => Boolean(progress.value?.completed_at))

async function load() {
  stopHeartbeat()
  loading.value = true
  message.value = ''
  actionMessage.value = ''
  playback.value = null
  progress.value = null
  courseProgress.value = null
  certificate.value = null
  try {
    const course = await http.get(`/courses/${route.params.slug}`, { skipErrorToast: true })
    const sections = course.data.data.sections || []
    let found = null
    for (const section of sections) {
      found = (section.lessons || []).find((lesson) => String(lesson.id) === String(route.params.lessonId))
      if (found) break
    }
    lessonTitle.value = found?.title || ''

    const { data } = await http.get(`/lessons/${route.params.lessonId}/playback`, { skipErrorToast: true })
    playback.value = data.data
    progress.value = data.data.progress
    basePosition = Number(data.data.progress?.position_seconds || 0)
    lastSentPosition = basePosition
    pageOpenedAt = Date.now()
    if (!data.data.progress?.completed_at) {
      startHeartbeat()
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function estimatedPosition() {
  const elapsed = Math.floor((Date.now() - pageOpenedAt) / 1000)
  const duration = playback.value?.duration_seconds
  const next = basePosition + Math.max(0, elapsed)
  if (duration != null) {
    return Math.min(Number(duration), next)
  }
  return next
}

async function savePosition(force = false) {
  if (isCompleted.value || !playback.value) return
  const position = estimatedPosition()
  if (!force && position <= lastSentPosition) return
  if (!force && position - lastSentPosition < 10) return

  try {
    const { data } = await http.put(
      `/lessons/${route.params.lessonId}/progress`,
      { position_seconds: position },
      { skipErrorToast: true },
    )
    progress.value = data.data.progress
    courseProgress.value = data.data.course_progress
    certificate.value = data.data.certificate
    if (data.data.saved) {
      lastSentPosition = data.data.progress.position_seconds
    }
  } catch {
    // Keep watching; next heartbeat can retry.
  }
}

async function markComplete() {
  completing.value = true
  actionMessage.value = ''
  try {
    await savePosition(true)
    const { data } = await http.post(
      `/lessons/${route.params.lessonId}/progress/complete`,
      {},
      { skipErrorToast: true },
    )
    progress.value = data.data.progress
    courseProgress.value = data.data.course_progress
    certificate.value = data.data.certificate
    stopHeartbeat()
    actionMessage.value = data.data.certificate
      ? t('lessonCompletedWithCertificate')
      : t('lessonCompleted')
  } catch (error) {
    actionMessage.value = apiError(error).message || t('requestFailed')
  } finally {
    completing.value = false
  }
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = window.setInterval(() => {
    savePosition()
  }, 20000)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function onPlayerMessage(event) {
  if (!event?.data) return
  const name = typeof event.data === 'string' ? event.data : event.data.event || event.data.name
  if (name === 'ended' || name === 'streamEnded') {
    markComplete()
  }
}

onMounted(() => {
  window.addEventListener('message', onPlayerMessage)
  load()
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onPlayerMessage)
  savePosition(true)
  stopHeartbeat()
})
watch(() => [route.params.slug, route.params.lessonId], load)
</script>

<template>
<div>
    <v-btn
            class="mb-4"
            variant="text"
            @click="router.push({ name: 'learning-course', params: { slug: route.params.slug } })"
          >
            {{ t('backToCourse') }}
          </v-btn>

          <h1 class="text-h5 mb-4">{{ lessonTitle || t('watchLesson') }}</h1>

          <v-progress-circular v-if="loading" indeterminate color="primary" />
          <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
          <template v-else-if="playback">
            <div class="video-frame mb-3">
              <iframe
                v-if="iframeSrc"
                :src="iframeSrc"
                title="lesson video"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowfullscreen
              />
    <div class="d-flex flex-wrap align-center ga-3 mb-3">
              <div class="text-body-2 text-medium-emphasis">
                <span v-if="playback.duration_seconds != null">{{ t('secondsCount', { count: playback.duration_seconds }) }}</span>
                <span v-if="playback.expires_in"> · {{ t('playbackExpiresIn', { count: playback.expires_in }) }}</span>
                <span v-if="progress?.position_seconds"> · {{ t('resumeAt', { count: progress.position_seconds }) }}</span>
              </div>
              <v-spacer />
              <v-chip v-if="isCompleted" color="success" variant="tonal" size="small">{{ t('completed') }}</v-chip>
              <v-btn
                v-else
                color="primary"
                :loading="completing"
                @click="markComplete"
              >
                {{ t('markLessonComplete') }}
              </v-btn>
            </div>
            <v-alert v-if="actionMessage" :type="isCompleted ? 'success' : 'error'" variant="tonal" class="mb-2">
              {{ actionMessage }}
            </v-alert>
            <div v-if="courseProgress" class="text-body-2 text-medium-emphasis">
              {{ t('courseProgress') }}:
              {{ courseProgress.completed_lessons }}/{{ courseProgress.published_lessons }}
              ({{ courseProgress.percent }}%)
              <span v-if="certificate"> · {{ t('certificateIssued') }}: {{ certificate.certificate_number }}</span>
            </div>

      </div>
  </template></div>
</template>

<style scoped>
.video-frame {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  background: #111;
  overflow: hidden;
}
.video-frame iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
