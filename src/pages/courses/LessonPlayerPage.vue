<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const videoLoading = ref(false)
const message = ref('')
const playback = ref(null)
const course = ref(null)
const completing = ref(false)
const progress = ref(null)
const courseProgress = ref(null)
const certificate = ref(null)
const playlistQuery = ref('')
const playlistFilter = ref('all')
const theatreMode = ref(false)
const openSectionIds = ref([])
const playlistPanel = ref(null)
const engagement = ref({
  likes: 0,
  dislikes: 0,
  my_reaction: null,
  feedback_count: 0,
})
const feedbackOpen = ref(false)
const feedbackBody = ref('')
const feedbackSaving = ref(false)
const reacting = ref(false)

let heartbeatTimer = null
let pageOpenedAt = 0
let basePosition = 0
let lastSentPosition = -1
let loadSeq = 0
let cachedOutlineSlug = ''
let cachedOutline = null
let outlinePromise = null

const iframeSrc = computed(() => playback.value?.playback?.iframe_url || '')
const isCompleted = computed(() => Boolean(progress.value?.completed_at))

const flatLessons = computed(() => {
  const rows = []
  for (const section of course.value?.sections || []) {
    for (const lesson of section.lessons || []) {
      rows.push({ section, lesson })
    }
  }
  return rows
})

const currentIndex = computed(() => flatLessons.value.findIndex(
  ({ lesson }) => String(lesson.id) === String(route.params.lessonId),
))

const currentLesson = computed(() => flatLessons.value[currentIndex.value]?.lesson || null)
const currentSection = computed(() => flatLessons.value[currentIndex.value]?.section || null)
const prevLesson = computed(() => flatLessons.value[currentIndex.value - 1]?.lesson || null)
const nextLesson = computed(() => flatLessons.value[currentIndex.value + 1]?.lesson || null)

const lessonTitle = computed(() => currentLesson.value?.title || t('watchLesson'))

const playlistTabs = computed(() => [
  { key: 'all', label: t('playlistFilterAll') },
  { key: 'free', label: t('playlistFilterFree') },
  { key: 'other', label: t('playlistFilterOther') },
])

const filteredSections = computed(() => {
  const q = playlistQuery.value.trim().toLowerCase()
  const filter = playlistFilter.value
  const sections = course.value?.sections || []

  return sections
    .map((section) => ({
      ...section,
      lessons: (section.lessons || []).filter((lesson) => {
        if (filter === 'free' && !lesson.is_free_preview) return false
        if (filter === 'other' && lesson.is_free_preview) return false
        if (!q) return true
        return String(lesson.title || '').toLowerCase().includes(q)
          || String(section.title || '').toLowerCase().includes(q)
      }),
    }))
    .filter((section) => (section.lessons || []).length > 0)
})

const progressPercent = computed(() => Number(
  courseProgress.value?.percent
  ?? course.value?.course_progress?.percent
  ?? 0,
))

function lessonTime(seconds) {
  const total = Number(seconds) || 0
  if (total <= 0) return ''
  if (total >= 3600) {
    const hours = Math.floor(total / 3600)
    const mins = Math.round((total % 3600) / 60)
    return `${hours}:${String(mins).padStart(2, '0')} ${t('hoursShort')}`
  }
  if (total >= 60) {
    return t('minutesCount', { count: Math.round(total / 60) })
  }
  return t('secondsCount', { count: total })
}

function lessonTone(lesson) {
  if (String(lesson.id) === String(route.params.lessonId)) return 'current'
  if (lesson.is_completed) return 'done'
  if (Number(lesson.progress?.position_seconds || 0) > 0) return 'active'
  return 'todo'
}

function sectionStats(section) {
  const lessons = section.lessons || []
  const done = lessons.filter((lesson) => lesson.is_completed).length
  return { total: lessons.length, done }
}

function isSectionOpen(sectionId) {
  return openSectionIds.value.includes(sectionId)
}

function toggleSection(sectionId) {
  if (isSectionOpen(sectionId)) {
    openSectionIds.value = openSectionIds.value.filter((id) => id !== sectionId)
    return
  }
  openSectionIds.value = [...openSectionIds.value, sectionId]
}

function goLesson(lesson) {
  if (!lesson?.id) return
  router.push({
    name: 'lesson-player',
    params: { slug: route.params.slug, lessonId: lesson.id },
  })
}

function scrollToPlaylist() {
  playlistPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function fetchCourseOutline(slug) {
  try {
    const { data } = await http.get(`/student/courses/${slug}`, {
      skipErrorToast: true,
      skipLoading: true,
    })
    return data.data
  } catch {
    const { data } = await http.get(`/courses/${slug}`, {
      skipErrorToast: true,
      skipLoading: true,
    })
    return data.data
  }
}

function loadCourseOutline(slug) {
  if (cachedOutlineSlug === slug && cachedOutline) {
    return Promise.resolve(cachedOutline)
  }
  if (cachedOutlineSlug === slug && outlinePromise) {
    return outlinePromise
  }

  cachedOutlineSlug = slug
  outlinePromise = fetchCourseOutline(slug)
    .then((outline) => {
      cachedOutline = outline
      return outline
    })
    .finally(() => {
      outlinePromise = null
    })

  return outlinePromise
}

function syncOpenSection(outline, lessonId) {
  const activeSection = (outline.sections || []).find((section) => (
    (section.lessons || []).some((lesson) => String(lesson.id) === String(lessonId))
  ))
  const nextId = activeSection?.id || outline.sections?.[0]?.id
  if (nextId && !openSectionIds.value.includes(nextId)) {
    openSectionIds.value = [...openSectionIds.value, nextId]
  } else if (nextId && openSectionIds.value.length === 0) {
    openSectionIds.value = [nextId]
  }
}

async function load() {
  const seq = ++loadSeq
  const slug = String(route.params.slug || '')
  const lessonId = String(route.params.lessonId || '')
  const hasCachedCourse = cachedOutlineSlug === slug && (cachedOutline || course.value)

  stopHeartbeat()
  message.value = ''
  certificate.value = null
  feedbackOpen.value = false
  feedbackBody.value = ''

  if (hasCachedCourse) {
    videoLoading.value = true
    playback.value = null
    progress.value = null
  } else {
    loading.value = true
    playback.value = null
    progress.value = null
    courseProgress.value = null
  }

  try {
    const quiet = { skipErrorToast: true, skipLoading: true }
    const outlineTask = loadCourseOutline(slug)
    const playbackTask = http.get(`/lessons/${lessonId}/playback`, quiet)

    const [outline, playbackRes] = await Promise.all([outlineTask, playbackTask])
    if (seq !== loadSeq) return

    course.value = outline
    courseProgress.value = outline.course_progress || courseProgress.value
    syncOpenSection(outline, lessonId)

    playback.value = playbackRes.data.data
    progress.value = playbackRes.data.data.progress
    engagement.value = playbackRes.data.data.engagement || {
      likes: 0,
      dislikes: 0,
      my_reaction: null,
      feedback_count: 0,
    }
    basePosition = Number(playbackRes.data.data.progress?.position_seconds || 0)
    lastSentPosition = basePosition
    pageOpenedAt = Date.now()
    if (!playbackRes.data.data.progress?.completed_at) {
      startHeartbeat()
    }
  } catch (error) {
    if (seq !== loadSeq) return
    if (error?.code === 'ERR_CANCELED') return
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    if (seq === loadSeq) {
      loading.value = false
      videoLoading.value = false
    }
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
      { skipErrorToast: true, skipSuccessToast: true, skipLoading: true },
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
  try {
    await savePosition(true)
    const { data } = await http.post(
      `/lessons/${route.params.lessonId}/progress/complete`,
      {},
      { skipErrorToast: true, skipSuccessToast: true, skipLoading: true },
    )
    progress.value = data.data.progress
    courseProgress.value = data.data.course_progress
    certificate.value = data.data.certificate

    if (currentLesson.value) {
      currentLesson.value.is_completed = true
      currentLesson.value.progress = data.data.progress
    }
    if (course.value?.course_progress && data.data.course_progress) {
      course.value.course_progress = data.data.course_progress
    }

    stopHeartbeat()
    ui.success(data.data.certificate
      ? t('lessonCompletedWithCertificate')
      : t('lessonCompleted'))
  } catch (error) {
    ui.toastError(apiError(error).message || t('requestFailed'))
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

async function setReaction(type) {
  if (reacting.value || !route.params.lessonId) return
  reacting.value = true
  try {
    const { data } = await http.post(
      `/lessons/${route.params.lessonId}/reaction`,
      { type },
      { skipErrorToast: true, skipSuccessToast: true, skipLoading: true },
    )
    engagement.value = data.data
  } catch (error) {
    ui.toastError(apiError(error).message || t('requestFailed'))
  } finally {
    reacting.value = false
  }
}

async function submitFeedback() {
  if (feedbackSaving.value) return
  feedbackSaving.value = true
  try {
    const { data } = await http.post(
      `/lessons/${route.params.lessonId}/feedback`,
      { body: feedbackBody.value },
      { skipErrorToast: true, skipSuccessToast: true, skipLoading: true },
    )
    engagement.value = data.data.engagement || engagement.value
    feedbackBody.value = ''
    feedbackOpen.value = false
    ui.success(t('lessonFeedbackSent'))
  } catch (error) {
    ui.toastError(apiError(error).message || t('requestFailed'))
  } finally {
    feedbackSaving.value = false
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
  <div class="lesson-player" :class="{ 'is-theatre': theatreMode }">
    <div class="lesson-player__top">
      <router-link
        class="lesson-player__back"
        :to="{ name: 'learning-course', params: { slug: route.params.slug } }"
      >
        ← {{ t('backToCourse') }}
      </router-link>
      <button
        v-if="theatreMode"
        type="button"
        class="lesson-player__theatre-exit"
        @click="theatreMode = false"
      >
        <v-icon size="18">mdi-arrow-collapse</v-icon>
        {{ t('exitTheatreMode') }}
      </button>
    </div>

    <v-progress-circular v-if="loading && !course" class="lesson-player__loader" indeterminate color="#0f5c66" />
    <v-alert v-else-if="message && !course && !playback" type="error" variant="tonal">{{ message }}</v-alert>

    <div v-else-if="course || playback" class="lesson-player__layout">
      <section class="lesson-player__main">
        <v-alert v-if="message" type="error" variant="tonal" class="mb-2">{{ message }}</v-alert>
        <div class="lesson-player__frame">
          <iframe
            v-if="iframeSrc && !videoLoading"
            :src="iframeSrc"
            title="lesson video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin"
          />
          <div v-else-if="videoLoading || loading" class="lesson-player__empty-video">
            <v-progress-circular indeterminate color="white" size="36" />
          </div>
          <div v-else class="lesson-player__empty-video">{{ t('videoNotReady') }}</div>
        </div>

        <div class="lesson-player__meta">
          <div class="lesson-player__title-row">
            <div class="lesson-player__title">
              <p v-if="currentSection" class="lesson-player__section">{{ currentSection.title }}</p>
              <h1>{{ lessonTitle }}</h1>
              <div class="lesson-player__facts">
                <span v-if="playback?.duration_seconds != null">{{ lessonTime(playback.duration_seconds) }}</span>
                <span v-if="progress?.position_seconds && !isCompleted">
                  {{ t('resumeAt', { count: progress.position_seconds }) }}
                </span>
                <span v-if="isCompleted" class="is-done">{{ t('completed') }}</span>
              </div>
            </div>

            <div class="lesson-player__engage">
              <button
                type="button"
                class="lesson-player__feedback-btn"
                @click="feedbackOpen = !feedbackOpen"
              >
                <v-icon size="16">mdi-message-text-outline</v-icon>
                {{ t('lessonFeedback') }}
              </button>

              <button
                type="button"
                class="lesson-player__vote"
                :class="{ 'is-active': engagement.my_reaction === 'like' }"
                :disabled="reacting"
                :aria-label="t('likeLesson')"
                @click="setReaction('like')"
              >
                <v-icon size="18">mdi-thumb-up-outline</v-icon>
                <span>{{ engagement.likes }}</span>
              </button>
              <button
                type="button"
                class="lesson-player__vote"
                :class="{ 'is-active is-dislike': engagement.my_reaction === 'dislike' }"
                :disabled="reacting"
                :aria-label="t('dislikeLesson')"
                @click="setReaction('dislike')"
              >
                <v-icon size="18">mdi-thumb-down-outline</v-icon>
                <span>{{ engagement.dislikes }}</span>
              </button>

              <button
                type="button"
                class="lesson-player__step"
                :disabled="!prevLesson"
                :title="t('previousLesson')"
                :aria-label="t('previousLesson')"
                @click="goLesson(prevLesson)"
              >
                <v-icon size="20">mdi-chevron-left</v-icon>
              </button>
              <button
                type="button"
                class="lesson-player__step"
                :disabled="!nextLesson"
                :title="t('nextLesson')"
                :aria-label="t('nextLesson')"
                @click="goLesson(nextLesson)"
              >
                <v-icon size="20">mdi-chevron-right</v-icon>
              </button>
            </div>
          </div>

          <div class="lesson-player__secondary">
            <button
              v-if="!isCompleted"
              type="button"
              class="lesson-player__complete"
              :disabled="completing"
              @click="markComplete"
            >
              {{ t('markLessonComplete') }}
            </button>
            <p v-if="prevLesson || nextLesson" class="lesson-player__step-hint">
              <template v-if="prevLesson">← {{ prevLesson.title }}</template>
              <template v-if="prevLesson && nextLesson"> · </template>
              <template v-if="nextLesson">{{ nextLesson.title }} →</template>
            </p>
          </div>

          <div v-if="feedbackOpen" class="lesson-player__feedback">
            <label>
              <span>{{ t('lessonFeedbackLead') }}</span>
              <textarea
                v-model="feedbackBody"
                rows="3"
                maxlength="2000"
                :placeholder="t('lessonFeedbackPlaceholder')"
              />
            </label>
            <div class="lesson-player__feedback-actions">
              <button type="button" class="lesson-player__nav" @click="feedbackOpen = false">
                {{ t('close') }}
              </button>
              <button
                type="button"
                class="lesson-player__complete"
                :disabled="feedbackSaving || feedbackBody.trim().length < 3"
                @click="submitFeedback"
              >
                {{ t('sendFeedback') }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="courseProgress || course?.course_progress" class="lesson-player__course-progress">
          <div class="lesson-player__course-progress-top">
            <strong>{{ t('courseProgress') }}</strong>
            <span>
              {{ courseProgress?.completed_lessons ?? course?.course_progress?.completed_lessons ?? 0 }}
              /
              {{ courseProgress?.published_lessons ?? course?.course_progress?.published_lessons ?? 0 }}
              ({{ progressPercent }}%)
            </span>
          </div>
          <div class="lesson-player__bar" aria-hidden="true">
            <span :style="{ width: `${Math.min(100, progressPercent)}%` }" />
          </div>
          <p v-if="certificate" class="lesson-player__cert">
            {{ t('certificateIssued') }} · {{ certificate.certificate_number }}
          </p>
        </div>
      </section>

      <aside ref="playlistPanel" class="lesson-player__playlist" id="lesson-playlist">
        <div class="lesson-player__playlist-head">
          <div>
            <h2>{{ t('playlist') }}</h2>
            <p>{{ course?.title }}</p>
          </div>
          <button
            type="button"
            class="lesson-player__theatre-mini"
            @click="theatreMode = true"
          >
            <v-icon size="16">mdi-arrow-expand</v-icon>
            <span class="lesson-player__theatre-label">{{ t('theatreMode') }}</span>
          </button>
        </div>

        <label class="lesson-player__search">
          <input
            v-model="playlistQuery"
            type="search"
            :placeholder="t('search')"
            :aria-label="t('searchLessons')"
          >
          <button
            v-if="playlistQuery"
            type="button"
            class="lesson-player__search-clear"
            :aria-label="t('close')"
            @click="playlistQuery = ''"
          >
            <v-icon size="16">mdi-close</v-icon>
          </button>
          <span class="lesson-player__search-icon" aria-hidden="true">
            <v-icon size="18">mdi-magnify</v-icon>
          </span>
        </label>

        <div class="lesson-player__filters" role="tablist" :aria-label="t('playlist')">
          <button
            v-for="tab in playlistTabs"
            :key="tab.key"
            type="button"
            class="lesson-player__filter"
            :class="{ 'is-active': playlistFilter === tab.key }"
            role="tab"
            :aria-selected="playlistFilter === tab.key"
            @click="playlistFilter = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="lesson-player__sections">
          <article
            v-for="section in filteredSections"
            :key="section.id"
            class="playlist-section"
            :class="{ 'is-open': isSectionOpen(section.id) }"
          >
            <button
              type="button"
              class="playlist-section__toggle"
              :aria-expanded="isSectionOpen(section.id)"
              @click="toggleSection(section.id)"
            >
              <div class="playlist-section__copy">
                <strong>{{ section.position }}. {{ section.title }}</strong>
                <span>
                  {{ sectionStats(section).done }}/{{ sectionStats(section).total }}
                  {{ t('lessonsCompletedShort') }}
                </span>
              </div>
              <span class="playlist-section__chevron" aria-hidden="true">
                <v-icon size="18">
                  {{ isSectionOpen(section.id) ? 'mdi-minus' : 'mdi-plus' }}
                </v-icon>
              </span>
            </button>

            <ul v-show="isSectionOpen(section.id)" class="playlist-section__list">
              <li v-for="lesson in section.lessons" :key="lesson.id">
                <button
                  type="button"
                  class="playlist-lesson"
                  :class="`playlist-lesson--${lessonTone(lesson)}`"
                  @click="goLesson(lesson)"
                >
                  <span class="playlist-lesson__icon" aria-hidden="true">
                    <v-icon v-if="lesson.is_completed" size="18">mdi-check-circle</v-icon>
                    <v-icon v-else-if="String(lesson.id) === String(route.params.lessonId)" size="18">mdi-play-circle</v-icon>
                    <v-icon v-else size="18">mdi-circle-outline</v-icon>
                  </span>
                  <span class="playlist-lesson__copy">
                    <strong>{{ lesson.position }}) {{ lesson.title }}</strong>
                    <small v-if="lesson.duration_seconds">{{ lessonTime(lesson.duration_seconds) }}</small>
                  </span>
                </button>
              </li>
            </ul>
          </article>

          <p v-if="filteredSections.length === 0" class="lesson-player__playlist-empty">
            {{ t('noLessonsFound') }}
          </p>
        </div>
      </aside>
    </div>

    <nav
      v-if="(course || playback) && !theatreMode"
      class="lesson-player__dock"
      aria-label="Lesson navigation"
    >
      <button
        type="button"
        class="lesson-player__dock-btn"
        :disabled="!prevLesson"
        @click="goLesson(prevLesson)"
      >
        <v-icon size="20">mdi-chevron-left</v-icon>
        <span>{{ t('previousLesson') }}</span>
      </button>
      <button
        type="button"
        class="lesson-player__dock-btn lesson-player__dock-btn--primary"
        @click="scrollToPlaylist"
      >
        <v-icon size="18">mdi-playlist-play</v-icon>
        <span>{{ t('playlist') }}</span>
      </button>
      <button
        type="button"
        class="lesson-player__dock-btn"
        :disabled="!nextLesson"
        @click="goLesson(nextLesson)"
      >
        <span>{{ t('nextLesson') }}</span>
        <v-icon size="20">mdi-chevron-right</v-icon>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.lesson-player {
  --ink: #0b1b34;
  --muted: #667085;
  --line: #e8edf3;
  --paper: #f5f7fa;
  --teal: #0f5c66;
  display: grid;
  gap: 0.75rem;
  color: var(--ink);
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding-bottom: 4.75rem;
}

@media (min-width: 980px) {
  .lesson-player {
    gap: 0.85rem;
    padding-bottom: 0;
  }
}

.lesson-player__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
}

.lesson-player__back,
.lesson-player__theatre-exit {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  color: var(--teal);
  text-decoration: none;
  font-size: 0.86rem;
  font-weight: 700;
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.lesson-player__theatre-exit {
  padding: 0 0.75rem;
  border-radius: 0.55rem;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
}

.lesson-player__loader {
  display: block;
  margin: 1.5rem auto;
}

.lesson-player__layout {
  display: grid;
  gap: 0.9rem;
  align-items: start;
}

@media (min-width: 980px) {
  .lesson-player__layout {
    grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.9fr);
    gap: 1rem;
  }

  .lesson-player.is-theatre .lesson-player__layout {
    grid-template-columns: 1fr;
  }

  .lesson-player.is-theatre .lesson-player__playlist {
    display: none;
  }
}

.lesson-player__main,
.lesson-player__playlist {
  min-width: 0;
  border-radius: 1rem;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.lesson-player__main {
  padding: 0.55rem;
  display: grid;
  gap: 0.75rem;
}

@media (min-width: 720px) {
  .lesson-player__main {
    padding: 0.75rem;
    gap: 0.85rem;
  }
}

.lesson-player__frame {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  background: #111;
  overflow: hidden;
  border-radius: 0.55rem;
}

@media (min-width: 720px) {
  .lesson-player__frame {
    border-radius: 0.75rem;
  }
}

.lesson-player__frame iframe,
.lesson-player__empty-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.lesson-player__empty-video {
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  padding: 1rem;
  text-align: center;
}

.lesson-player__meta {
  display: grid;
  gap: 0.75rem;
}

.lesson-player__title-row {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

@media (min-width: 860px) {
  .lesson-player__title-row {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
}

.lesson-player__title {
  min-width: 0;
  flex: 1;
}

.lesson-player__engage {
  display: grid;
  grid-template-columns: 1fr auto auto auto auto;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
}

@media (max-width: 559px) {
  .lesson-player__engage {
    grid-template-columns: 1fr 1fr;
  }

  .lesson-player__feedback-btn {
    grid-column: 1 / -1;
    width: 100%;
    justify-content: center;
  }

  .lesson-player__vote {
    width: 100%;
  }

  .lesson-player__step {
    width: 100%;
  }
}

@media (min-width: 860px) {
  .lesson-player__engage {
    display: flex;
    flex-wrap: wrap;
    width: auto;
  }
}

.lesson-player__secondary {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.55rem;
}

@media (min-width: 560px) {
  .lesson-player__secondary {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }
}

.lesson-player__step-hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.lesson-player__section {
  margin: 0 0 0.2rem;
  color: var(--teal);
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.lesson-player__meta h1 {
  margin: 0;
  font-size: clamp(1.1rem, 2.2vw, 1.4rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.lesson-player__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.45rem;
}

.lesson-player__facts span {
  display: inline-flex;
  min-height: 1.55rem;
  align-items: center;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: var(--paper);
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 700;
}

.lesson-player__facts .is-done {
  background: rgba(20, 145, 155, 0.12);
  color: #0f5c66;
}

.lesson-player__feedback-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 0.9rem;
  border: 0;
  border-radius: 0.55rem;
  background: #e85d4c;
  color: #fff;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  cursor: pointer;
}

.lesson-player__votes {
  display: inline-flex;
  gap: 0.35rem;
}

.lesson-player__vote,
.lesson-player__step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  min-height: 44px;
  min-width: 44px;
  padding: 0 0.7rem;
  border: 1px solid var(--line);
  border-radius: 0.55rem;
  background: #f3f4f6;
  color: var(--muted);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.lesson-player__step {
  padding: 0;
  background: #eceff3;
}

.lesson-player__step:hover:not(:disabled),
.lesson-player__vote:hover:not(:disabled) {
  background: #e5e7eb;
  color: var(--ink);
}

.lesson-player__step:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.lesson-player__vote.is-active {
  background: rgba(15, 92, 102, 0.1);
  border-color: transparent;
  color: var(--teal);
}

.lesson-player__vote.is-dislike {
  background: rgba(232, 93, 76, 0.1);
  color: #c2410c;
}

.lesson-player__feedback {
  display: grid;
  gap: 0.65rem;
  padding: 0.85rem;
  border-radius: 0.75rem;
  background: var(--paper);
  border: 1px solid var(--line);
}

.lesson-player__feedback label {
  display: grid;
  gap: 0.35rem;
}

.lesson-player__feedback span {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--muted);
}

.lesson-player__feedback textarea {
  width: 100%;
  min-height: 88px;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--line);
  border-radius: 0.6rem;
  background: #fff;
  font: inherit;
  resize: vertical;
}

.lesson-player__feedback-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: flex-end;
}

.lesson-player__nav,
.lesson-player__complete {
  min-height: 44px;
  border: 0;
  border-radius: 0.55rem;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.lesson-player__complete {
  width: 100%;
}

@media (min-width: 560px) {
  .lesson-player__complete {
    width: auto;
  }
}

.lesson-player__nav {
  padding: 0 0.85rem;
  background: #fff;
  border: 1px solid var(--line);
  color: var(--ink);
}

.lesson-player__complete {
  padding: 0 0.95rem;
  background: var(--ink);
  color: #fff;
  font-size: 0.8rem;
}

.lesson-player__course-progress {
  display: grid;
  gap: 0.35rem;
  padding: 0.75rem 0.85rem;
  border-radius: 0.7rem;
  background: var(--paper);
}

.lesson-player__course-progress-top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.35rem;
  font-size: 0.8rem;
}

.lesson-player__course-progress-top span {
  color: var(--muted);
  font-weight: 700;
}

.lesson-player__bar {
  height: 0.4rem;
  border-radius: 999px;
  background: #e4ebf0;
  overflow: hidden;
}

.lesson-player__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0f5c66, #14919b);
}

.lesson-player__cert {
  margin: 0;
  color: #0f5c66;
  font-size: 0.76rem;
  font-weight: 700;
}

.lesson-player__playlist {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  max-height: none;
  overflow: hidden;
  background: #fff;
}

@media (min-width: 980px) {
  .lesson-player__playlist {
    position: sticky;
    top: 0.75rem;
    max-height: calc(100vh - 5.5rem);
  }
}

.lesson-player__playlist-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 1rem 1rem 0.45rem;
}

.lesson-player__playlist-head h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #111827;
}

.lesson-player__playlist-head p {
  margin: 0.25rem 0 0;
  color: #6b7280;
  font-size: 0.82rem;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.lesson-player__theatre-mini {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 34px;
  padding: 0 0.45rem;
  border: 0;
  border-radius: 0.45rem;
  background: transparent;
  color: #6b7280;
  font: inherit;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
}

.lesson-player__theatre-mini:hover {
  color: #111827;
  background: #f3f4f6;
}

.lesson-player__search {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.35rem 1rem 0.7rem;
  padding: 0 0.9rem 0 1rem;
  min-height: 44px;
  border-radius: 0.8rem;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #9ca3af;
}

.lesson-player__search:focus-within {
  border-color: #cbd5e1;
  box-shadow: 0 0 0 3px rgba(15, 92, 102, 0.08);
  color: var(--teal);
}

.lesson-player__search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-size: 0.9rem;
  color: #111827;
}

.lesson-player__search input::placeholder {
  color: #9ca3af;
  opacity: 1;
}

.lesson-player__search-icon,
.lesson-player__search-clear {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  color: inherit;
}

.lesson-player__search-clear {
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.lesson-player__search-clear:hover {
  background: rgba(15, 92, 102, 0.08);
  color: var(--teal);
}

.lesson-player__filters {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.45rem;
  margin: 0 1rem 0.85rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 0.15rem;
}

.lesson-player__filters::-webkit-scrollbar {
  display: none;
}

@media (min-width: 560px) {
  .lesson-player__filters {
    flex-wrap: wrap;
    overflow: visible;
  }
}

.lesson-player__filter {
  flex: 0 0 auto;
  min-height: 40px;
  padding: 0 0.95rem;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #374151;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.lesson-player__filter.is-active {
  background: #0b1b34;
  border-color: #0b1b34;
  color: #fff;
  box-shadow: 0 6px 14px rgba(11, 27, 52, 0.16);
}

.lesson-player__filter:hover:not(.is-active) {
  background: #f9fafb;
}

.lesson-player__sections {
  overflow: auto;
  padding: 0 0.85rem 0.9rem;
  display: grid;
  gap: 0.55rem;
}

.playlist-section {
  border: 1px solid #e8edf3;
  border-radius: 0.9rem;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}

.playlist-section__toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 0.9rem;
  border: 0;
  background: #fff;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
  min-height: 58px;
}

.playlist-section.is-open .playlist-section__toggle {
  background: #fff;
  border-bottom: 1px solid #f1f5f9;
}

.playlist-section__copy {
  min-width: 0;
}

.playlist-section__copy strong {
  display: block;
  font-size: 0.92rem;
  line-height: 1.3;
  font-weight: 800;
  color: #111827;
}

.playlist-section__copy span {
  display: block;
  margin-top: 0.2rem;
  color: #6b7280;
  font-size: 0.76rem;
  font-weight: 600;
}

.playlist-section__chevron {
  flex-shrink: 0;
  width: 1.85rem;
  height: 1.85rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #f3f4f6;
  color: #4b5563;
}

.playlist-section.is-open .playlist-section__chevron {
  background: #eef7f7;
  color: var(--teal);
}

.playlist-section__list {
  list-style: none;
  margin: 0;
  padding: 0.45rem 0.55rem 0.6rem;
  display: grid;
  gap: 0.3rem;
}

.playlist-lesson {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.7rem 0.65rem;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 0.65rem;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
  min-height: 48px;
}

.playlist-lesson:hover {
  background: #f8fafc;
}

.playlist-lesson--current {
  background: rgba(15, 92, 102, 0.08);
  border-left-color: #0f5c66;
}

.playlist-lesson--done {
  background: transparent;
}

.playlist-lesson__icon {
  color: #9ca3af;
  margin-top: 0.05rem;
}

.playlist-lesson--current .playlist-lesson__icon,
.playlist-lesson--done .playlist-lesson__icon {
  color: #0f5c66;
}

.playlist-lesson__copy {
  display: grid;
  gap: 0.18rem;
  min-width: 0;
}

.playlist-lesson__copy strong {
  font-size: 0.86rem;
  line-height: 1.35;
  font-weight: 700;
  color: #111827;
}

.playlist-lesson__copy small {
  color: #6b7280;
  font-size: 0.74rem;
  font-weight: 600;
}

.lesson-player__playlist-empty {
  margin: 0.5rem 0.25rem;
  color: var(--muted);
  font-size: 0.86rem;
}

.lesson-player__dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.35rem;
  padding: 0.55rem 0.65rem calc(0.55rem + env(safe-area-inset-bottom, 0px));
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid var(--line);
  backdrop-filter: blur(10px);
  box-shadow: 0 -8px 24px rgba(11, 27, 52, 0.08);
}

@media (min-width: 980px) {
  .lesson-player__dock {
    display: none;
  }
}

.lesson-player__dock-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  min-height: 44px;
  padding: 0 0.55rem;
  border: 1px solid var(--line);
  border-radius: 0.65rem;
  background: #fff;
  color: var(--ink);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
}

.lesson-player__dock-btn span {
  max-width: 7.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lesson-player__dock-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.lesson-player__dock-btn--primary {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
  min-width: 6.5rem;
}

.lesson-player__theatre-label {
  display: none;
}

@media (min-width: 420px) {
  .lesson-player__theatre-label {
    display: inline;
  }
}

@media (max-width: 979px) {
  .lesson-player__main,
  .lesson-player__playlist {
    border-radius: 0.85rem;
  }

  .lesson-player__playlist {
    max-height: min(70vh, 34rem);
  }

  .lesson-player__sections {
    max-height: none;
  }

  .lesson-player__meta h1 {
    font-size: 1.05rem;
  }

  .lesson-player__step-hint {
    display: none;
  }
}

@media (max-width: 419px) {
  .lesson-player__dock-btn span {
    max-width: 4.5rem;
    font-size: 0.68rem;
  }

  .lesson-player__playlist-head {
    padding: 0.85rem 0.75rem 0.4rem;
  }

  .lesson-player__search,
  .lesson-player__filters {
    margin-left: 0.75rem;
    margin-right: 0.75rem;
  }

  .lesson-player__sections {
    padding-left: 0.65rem;
    padding-right: 0.65rem;
  }
}
</style>
