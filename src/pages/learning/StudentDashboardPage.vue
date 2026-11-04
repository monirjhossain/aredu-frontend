<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { useLocaleStore } from '../../stores/locale'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const auth = useAuthStore()
const localeStore = useLocaleStore()

const dashboard = ref(null)
const message = ref('')
const loading = ref(true)
const courseTab = ref('all')

const firstName = computed(() => {
  const name = auth.user?.name || ''
  return name.split(' ')[0] || name || t('student')
})

const enrolledCourses = computed(() => dashboard.value?.enrolled_courses || [])

const activeCount = computed(() => enrolledCourses.value.length)
const inProgressCount = computed(() => enrolledCourses.value.filter((item) => {
  const percent = Number(item.progress?.percent || 0)
  return percent > 0 && percent < 100
}).length)
const completedCount = computed(() => enrolledCourses.value.filter((item) => Number(item.progress?.percent || 0) >= 100).length)

const filteredCourses = computed(() => {
  if (courseTab.value === 'ongoing') {
    return enrolledCourses.value.filter((item) => {
      const percent = Number(item.progress?.percent || 0)
      return percent < 100
    })
  }
  if (courseTab.value === 'completed') {
    return enrolledCourses.value.filter((item) => Number(item.progress?.percent || 0) >= 100)
  }
  return enrolledCourses.value
})

const courseTabs = computed(() => [
  { key: 'all', label: t('allCoursesTab') },
  { key: 'ongoing', label: t('ongoingCoursesTab') },
  { key: 'completed', label: t('completedCoursesTab') },
])

const summaryCards = computed(() => [
  {
    key: 'active',
    label: t('activeCourses'),
    value: activeCount.value,
    icon: 'mdi-book-open-page-variant',
    tone: 'blue',
  },
  {
    key: 'progress',
    label: t('coursesInProgress'),
    value: inProgressCount.value,
    icon: 'mdi-fast-forward',
    tone: 'orange',
  },
  {
    key: 'completed',
    label: t('completedCourses'),
    value: completedCount.value,
    icon: 'mdi-flag-checkered',
    tone: 'violet',
  },
])

const quickLinks = computed(() => [
  { to: { name: 'my-courses' }, label: t('myCourses'), icon: 'mdi-bookshelf' },
  { to: { name: 'orders' }, label: t('myOrders'), icon: 'mdi-receipt-text' },
  { to: { name: 'reading-tests' }, label: t('readingTests'), icon: 'mdi-book-open-blank-variant' },
  { to: { name: 'listening-tests' }, label: t('listeningTests'), icon: 'mdi-headphones' },
  { to: { name: 'writing-tasks' }, label: t('writingTasks'), icon: 'mdi-pencil-outline' },
  { to: { name: 'speaking-tasks' }, label: t('speakingTasks'), icon: 'mdi-microphone-outline' },
  { to: { name: 'notifications' }, label: t('notifications'), icon: 'mdi-bell-outline' },
  { to: { name: 'account' }, label: t('account'), icon: 'mdi-account' },
])

onMounted(async () => {
  try {
    const { data } = await http.get('/student/dashboard', { skipErrorToast: true })
    dashboard.value = data.data
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
})

function when(value) {
  if (!value) return ''
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function examLabel(course) {
  return course?.exam_type === 'general' ? t('general') : t('academic')
}

function batchLabel(course) {
  if (course?.batch_number == null) return ''
  return t('batchNumber', { number: course.batch_number })
}

function notificationText(item) {
  if (item?.data?.message) return item.data.message
  if (item?.data?.title) return item.data.title
  return item?.type || t('notification')
}
</script>

<template>
  <div class="student-dash">
    <header class="student-dash__hero">
      <div>
        <p class="student-dash__eyebrow">{{ t('studentDashboard') }}</p>
        <h1>{{ t('helloName', { name: firstName }) }}</h1>
        <p>{{ t('studentWelcomeBack') }}</p>
      </div>
      <router-link class="student-dash__hero-link" :to="{ name: 'my-courses' }">
        {{ t('myCourses') }}
        <span aria-hidden="true">→</span>
      </router-link>
    </header>

    <v-progress-circular v-if="loading" class="student-dash__loader" indeterminate color="#0f5c66" />
    <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>

    <template v-else-if="dashboard">
      <section class="student-dash__shortcuts" aria-label="Quick links">
        <router-link
          v-for="link in quickLinks"
          :key="link.label"
          class="student-dash__shortcut"
          :to="link.to"
        >
          <v-icon size="18">{{ link.icon }}</v-icon>
          <span>{{ link.label }}</span>
        </router-link>
      </section>

      <section class="student-dash__top">
        <div class="student-dash__stats">
          <article
            v-for="card in summaryCards"
            :key="card.key"
            class="student-stat"
            :class="`student-stat--${card.tone}`"
          >
            <div>
              <p>{{ card.label }}</p>
              <strong>{{ card.value }}</strong>
            </div>
            <span class="student-stat__icon" aria-hidden="true">
              <v-icon size="22">{{ card.icon }}</v-icon>
            </span>
          </article>
        </div>

        <aside class="student-dash__note">
          <v-icon size="18" color="#e8a317">mdi-information</v-icon>
          <div>
            <strong>{{ t('noLiveClassToday') }}</strong>
            <p>{{ t('noLiveClassTodayLead') }}</p>
          </div>
        </aside>
      </section>

      <section class="student-dash__courses">
        <div class="student-dash__courses-head">
          <h2>{{ t('myCourses') }}</h2>
          <div class="student-dash__tabs" role="tablist">
            <button
              v-for="tab in courseTabs"
              :key="tab.key"
              type="button"
              class="student-dash__tab"
              :class="{ 'is-active': courseTab === tab.key }"
              role="tab"
              :aria-selected="courseTab === tab.key"
              @click="courseTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>

        <div v-if="enrolledCourses.length === 0" class="student-dash__empty">
          <strong>{{ t('noPurchasedCourses') }}</strong>
          <p>{{ t('myCoursesEmptyLead') }}</p>
          <router-link class="student-dash__empty-link" :to="{ name: 'courses' }">
            {{ t('browseCourses') }}
            <span aria-hidden="true">→</span>
          </router-link>
        </div>
        <div v-else-if="filteredCourses.length === 0" class="student-dash__empty">
          <p>{{ t('noCoursesInTab') }}</p>
        </div>
        <div v-else class="student-dash__course-grid">
          <article
            v-for="item in filteredCourses"
            :key="item.enrollment_id"
            class="student-course"
          >
            <div
              class="student-course__media"
              :style="item.course?.thumbnail_url
                ? { backgroundImage: `url(${item.course.thumbnail_url})` }
                : undefined"
            >
              <span v-if="!item.course?.thumbnail_url">{{ item.course?.title }}</span>
            </div>
            <div class="student-course__body">
              <h3>{{ item.course?.title }}</h3>
              <div class="student-course__meta">
                <span>{{ examLabel(item.course) }}</span>
                <span v-if="batchLabel(item.course)">{{ batchLabel(item.course) }}</span>
              </div>
              <div class="student-course__progress">
                <div class="student-course__progress-top">
                  <span>{{ item.progress.percent }}% {{ t('complete') }}</span>
                  <span>{{ item.progress.completed_lessons }}/{{ item.progress.published_lessons }}</span>
                </div>
                <div class="student-course__bar" aria-hidden="true">
                  <span :style="{ width: `${Math.min(100, Number(item.progress.percent || 0))}%` }" />
                </div>
              </div>
              <router-link
                class="student-course__cta"
                :to="{ name: 'learning-course', params: { slug: item.course.slug } }"
              >
                {{ Number(item.progress.percent || 0) >= 100 ? t('reviewCourse') : t('continueCourse') }}
                <span aria-hidden="true">→</span>
              </router-link>
            </div>
          </article>
        </div>
      </section>

      <section class="student-dash__panels">
        <article class="student-panel">
          <h2>{{ t('recentLessons') }}</h2>
          <p v-if="dashboard.recent_lessons.length === 0" class="student-panel__empty">{{ t('noRecentLessons') }}</p>
          <ul v-else class="student-panel__list">
            <li v-for="lesson in dashboard.recent_lessons" :key="lesson.lesson_id">
              <router-link
                v-if="lesson.course?.slug"
                :to="{ name: 'lesson-player', params: { slug: lesson.course.slug, lessonId: lesson.lesson_id } }"
              >
                <strong>{{ lesson.title }}</strong>
                <span>{{ lesson.course?.title }} · {{ when(lesson.updated_at) }}</span>
              </router-link>
              <div v-else>
                <strong>{{ lesson.title }}</strong>
                <span>{{ when(lesson.updated_at) }}</span>
              </div>
              <span v-if="lesson.completed_at" class="student-panel__tag">{{ t('completed') }}</span>
            </li>
          </ul>
        </article>

        <article class="student-panel">
          <div class="student-panel__head">
            <h2>{{ t('recentMockResults') }}</h2>
            <router-link class="student-panel__all" :to="{ name: 'reading-results' }">
              {{ t('viewAll') }}
            </router-link>
          </div>
          <p v-if="dashboard.recent_mock_results.length === 0" class="student-panel__empty">{{ t('noMockResults') }}</p>
          <ul v-else class="student-panel__list">
            <li v-for="row in dashboard.recent_mock_results" :key="row.attempt_id">
              <div>
                <strong>{{ row.mock_test?.title }}</strong>
                <span>
                  {{ row.result?.raw_score }}/{{ row.result?.max_score }}
                  · {{ t('bandScore') }}: {{ row.result?.band_score ?? '—' }}
                  · {{ when(row.submitted_at) }}
                </span>
              </div>
            </li>
          </ul>
        </article>

        <article class="student-panel">
          <div class="student-panel__head">
            <h2>{{ t('pendingWriting') }} ({{ dashboard.pending_writing.total }})</h2>
            <router-link class="student-panel__all" :to="{ name: 'writing-tasks' }">
              {{ t('viewAll') }}
            </router-link>
          </div>
          <p v-if="dashboard.pending_writing.items.length === 0" class="student-panel__empty">{{ t('noPendingWriting') }}</p>
          <ul v-else class="student-panel__list">
            <li v-for="item in dashboard.pending_writing.items" :key="item.id">
              <div>
                <strong>{{ item.title }}</strong>
                <span>{{ when(item.submitted_at) }}</span>
              </div>
            </li>
          </ul>
        </article>

        <article class="student-panel">
          <div class="student-panel__head">
            <h2>{{ t('pendingSpeaking') }} ({{ dashboard.pending_speaking.total }})</h2>
            <router-link class="student-panel__all" :to="{ name: 'speaking-tasks' }">
              {{ t('viewAll') }}
            </router-link>
          </div>
          <p v-if="dashboard.pending_speaking.items.length === 0" class="student-panel__empty">{{ t('noPendingSpeaking') }}</p>
          <ul v-else class="student-panel__list">
            <li v-for="item in dashboard.pending_speaking.items" :key="item.id">
              <div>
                <strong>{{ item.title }}</strong>
                <span>{{ when(item.submitted_at) }}</span>
              </div>
            </li>
          </ul>
        </article>

        <article class="student-panel student-panel--wide">
          <div class="student-panel__head">
            <h2>{{ t('notifications') }}</h2>
            <router-link class="student-panel__all" :to="{ name: 'notifications' }">
              {{ t('viewAll') }}
            </router-link>
          </div>
          <p v-if="dashboard.notifications.length === 0" class="student-panel__empty">{{ t('noNotifications') }}</p>
          <ul v-else class="student-panel__list">
            <li v-for="item in dashboard.notifications" :key="item.id">
              <div>
                <strong>{{ notificationText(item) }}</strong>
                <span>{{ when(item.created_at) }}</span>
              </div>
              <span v-if="!item.read_at" class="student-panel__tag student-panel__tag--new">{{ t('unread') }}</span>
            </li>
          </ul>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped>
.student-dash {
  --ink: #0b1b34;
  --muted: #667085;
  --line: #e8edf3;
  --paper: #f5f7fa;
  display: grid;
  gap: 1.1rem;
  color: var(--ink);
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.student-dash__hero {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.2rem 1.25rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at top right, rgba(245, 197, 24, 0.22), transparent 42%),
    linear-gradient(135deg, #0b3d36 0%, #0f5c66 55%, #0a2a3a 100%);
  color: #fff;
}

@media (min-width: 720px) {
  .student-dash__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.student-dash__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.student-dash__hero h1 {
  margin: 0;
  font-size: clamp(1.35rem, 2.6vw, 1.8rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.student-dash__hero p {
  margin: 0.35rem 0 0;
  max-width: 42ch;
  opacity: 0.9;
  font-size: 0.92rem;
  line-height: 1.45;
}

.student-dash__hero-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 1rem;
  border-radius: 0.65rem;
  background: #f5c518;
  color: #1a1400;
  text-decoration: none;
  font-size: 0.86rem;
  font-weight: 800;
  width: fit-content;
}

.student-dash__shortcuts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

@media (min-width: 640px) {
  .student-dash__shortcuts {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.student-dash__shortcut {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 44px;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: 0.7rem;
  background: #fff;
  color: var(--ink);
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 750;
}

.student-dash__shortcut :deep(.v-icon) {
  color: #0f5c66;
}

.student-dash__loader {
  margin: 1rem auto;
}

.student-dash__top {
  display: grid;
  gap: 0.85rem;
}

@media (min-width: 980px) {
  .student-dash__top {
    grid-template-columns: minmax(0, 1.7fr) minmax(240px, 0.7fr);
    align-items: stretch;
  }
}

.student-dash__stats {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .student-dash__stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.student-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 5.2rem;
  padding: 0.95rem 1rem;
  border-radius: 0.9rem;
  border: 1px solid transparent;
}

.student-stat p {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--muted);
}

.student-stat strong {
  display: block;
  margin-top: 0.2rem;
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.student-stat__icon {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.7rem;
  background: rgba(255, 255, 255, 0.7);
}

.student-stat--blue {
  background: #e8f3ff;
  color: #1d4f91;
}

.student-stat--orange {
  background: #fff1e6;
  color: #b45a12;
}

.student-stat--violet {
  background: #f1eaff;
  color: #5b39a8;
}

.student-dash__note {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  padding: 1rem;
  border-radius: 0.9rem;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.student-dash__note strong,
.student-dash__note p {
  display: block;
}

.student-dash__note strong {
  font-size: 0.95rem;
}

.student-dash__note p {
  margin: 0.2rem 0 0;
  color: var(--muted);
  font-size: 0.84rem;
  line-height: 1.4;
}

.student-dash__courses,
.student-panel {
  padding: 1rem;
  border-radius: 1rem;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.student-dash__courses-head {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-bottom: 1rem;
}

@media (min-width: 760px) {
  .student-dash__courses-head {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.student-dash__courses-head h2,
.student-panel h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.student-panel__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 0.85rem;
}

.student-panel__all {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 0.35rem;
  color: #0f5c66;
  text-decoration: none;
  font-size: 0.84rem;
  font-weight: 750;
}

.student-dash__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.student-dash__tab {
  min-height: 44px;
  padding: 0 0.85rem;
  border: 0;
  border-radius: 999px;
  background: var(--paper);
  color: var(--muted);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.student-dash__tab.is-active {
  background: #0b1b34;
  color: #fff;
}

.student-dash__empty {
  display: grid;
  gap: 0.45rem;
  justify-items: start;
  padding: 0.35rem 0 0.15rem;
}

.student-dash__empty strong {
  font-size: 1rem;
  color: var(--ink);
}

.student-dash__empty p,
.student-panel__empty {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.45;
}

.student-dash__empty-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 1rem;
  margin-top: 0.15rem;
  border-radius: 0.55rem;
  background: #0b1b34;
  color: #fff;
  text-decoration: none;
  font-size: 0.84rem;
  font-weight: 800;
}

.student-dash__course-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.9rem;
}

@media (min-width: 720px) {
  .student-dash__course-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .student-dash__course-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.student-course {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border-radius: 0.85rem;
  border: 1px solid var(--line);
  background: #fff;
}

.student-course__media {
  aspect-ratio: 16 / 10;
  display: grid;
  place-items: center;
  background:
    linear-gradient(145deg, #0b3d36 0%, #145c4f 45%, #0a2a3a 100%) center / cover no-repeat;
  background-size: cover;
  background-position: center;
  color: #fff;
  font-weight: 800;
  text-align: center;
  padding: 0.75rem;
}

.student-course__body {
  display: grid;
  gap: 0.55rem;
  padding: 0.85rem;
  flex: 1;
}

.student-course__body h3 {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.3;
  font-weight: 800;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.student-course__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.student-course__meta span {
  display: inline-flex;
  min-height: 1.55rem;
  align-items: center;
  padding: 0.1rem 0.45rem;
  border-radius: 0.4rem;
  background: var(--paper);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
}

.student-course__progress {
  display: grid;
  gap: 0.35rem;
}

.student-course__progress-top {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 700;
}

.student-course__bar {
  height: 0.4rem;
  border-radius: 999px;
  background: #eef1f5;
  overflow: hidden;
}

.student-course__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0f5c66, #14919b);
}

.student-course__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.55rem;
  margin-top: auto;
  border-radius: 0.5rem;
  background: #0b1b34;
  color: #fff;
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 800;
}

.student-dash__panels {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem;
}

@media (min-width: 860px) {
  .student-dash__panels {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .student-panel--wide {
    grid-column: 1 / -1;
  }
}

.student-panel__list {
  list-style: none;
  margin: 0.85rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}

.student-panel__list li,
.student-panel__list a {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
  text-decoration: none;
  color: inherit;
}

.student-panel__list li {
  padding: 0.7rem 0.75rem;
  border-radius: 0.7rem;
  background: var(--paper);
}

.student-panel__list strong,
.student-panel__list span {
  display: block;
}

.student-panel__list strong {
  font-size: 0.9rem;
}

.student-panel__list span {
  margin-top: 0.15rem;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.35;
}

.student-panel__tag {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  min-height: 1.55rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  background: #e7f4f5;
  color: #0f5c66;
  font-size: 0.7rem;
  font-weight: 750;
}

.student-panel__tag--new {
  background: #fff1e6;
  color: #b45a12;
}
</style>
