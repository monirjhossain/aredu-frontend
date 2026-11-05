<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const course = ref(null)
const loading = ref(true)
const message = ref('')
const openSectionIds = ref([])

const examLabel = computed(() => {
  if (!course.value) return ''
  return course.value.exam_type === 'general' ? t('general') : t('academic')
})

const progress = computed(() => course.value?.course_progress || {
  percent: 0,
  completed_lessons: 0,
  published_lessons: 0,
})

const allLessons = computed(() => {
  const rows = []
  for (const section of course.value?.sections || []) {
    for (const lesson of section.lessons || []) {
      rows.push({ section, lesson })
    }
  }
  return rows
})

const continueTarget = computed(() => {
  const inProgress = allLessons.value.find(({ lesson }) => !lesson.is_completed && Number(lesson.progress?.position_seconds || 0) > 0)
  if (inProgress) return inProgress.lesson
  const next = allLessons.value.find(({ lesson }) => !lesson.is_completed)
  return next?.lesson || allLessons.value[0]?.lesson || null
})

const continueLabel = computed(() => {
  const lesson = continueTarget.value
  if (!lesson) return t('watchLesson')
  if (lesson.is_completed) return t('rewatchLesson')
  if (Number(lesson.progress?.position_seconds || 0) > 0) return t('resumeLesson')
  if (Number(progress.value.percent || 0) > 0) return t('continueCourse')
  return t('startLearning')
})

function lessonTime(seconds) {
  const total = Number(seconds) || 0
  if (total >= 60 && total % 60 === 0) {
    return t('minutesCount', { count: total / 60 })
  }
  if (total >= 60) {
    return t('minutesCount', { count: Math.round(total / 60) })
  }
  return t('secondsCount', { count: total })
}

function lessonActionLabel(lesson) {
  if (lesson.is_completed) return t('rewatchLesson')
  if (Number(lesson.progress?.position_seconds || 0) > 0) return t('resumeLesson')
  return t('watchLesson')
}

function lessonTone(lesson) {
  if (lesson.is_completed) return 'done'
  if (Number(lesson.progress?.position_seconds || 0) > 0) return 'active'
  return 'todo'
}

function lessonStatus(lesson) {
  if (lesson.is_completed) return t('completed')
  if (Number(lesson.progress?.position_seconds || 0) > 0) return t('inProgress')
  return t('pendingLesson')
}

function sectionStats(section) {
  const lessons = section.lessons || []
  const done = lessons.filter((lesson) => lesson.is_completed).length
  return { total: lessons.length, done }
}

function toggleSection(sectionId) {
  if (openSectionIds.value.includes(sectionId)) {
    openSectionIds.value = openSectionIds.value.filter((id) => id !== sectionId)
    return
  }
  openSectionIds.value = [...openSectionIds.value, sectionId]
}

function isOpen(sectionId) {
  return openSectionIds.value.includes(sectionId)
}

async function load() {
  loading.value = true
  message.value = ''
  course.value = null
  openSectionIds.value = []
  try {
    const { data } = await http.get(`/student/courses/${route.params.slug}`, { skipErrorToast: true })
    course.value = data.data
    const sections = data.data?.sections || []
    const firstIncomplete = sections.find((section) => (section.lessons || []).some((lesson) => !lesson.is_completed))
    openSectionIds.value = [(firstIncomplete || sections[0])?.id].filter(Boolean)
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function watchLesson(lesson) {
  if (!lesson?.id) return
  router.push({
    name: 'lesson-player',
    params: { slug: route.params.slug, lessonId: lesson.id },
  })
}

onMounted(load)
watch(() => route.params.slug, load)
</script>

<template>
  <div class="learn-course">
    <router-link class="learn-course__back" :to="{ name: 'my-courses' }">
      ← {{ t('backToMyCourses') }}
    </router-link>

    <v-progress-circular v-if="loading" class="learn-course__loader" indeterminate color="#0f5c66" />
    <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>

    <template v-else-if="course">
      <header class="learn-course__hero">
        <div class="learn-course__hero-copy">
          <div class="learn-course__chips">
            <span v-if="course.category?.name">{{ course.category.name }}</span>
            <span>{{ examLabel }}</span>
            <span v-if="course.duration_minutes">{{ t('minutesCount', { count: course.duration_minutes }) }}</span>
            <span v-if="course.batch_number != null">{{ t('batchNumber', { number: course.batch_number }) }}</span>
          </div>
          <h1>{{ course.title }}</h1>
          <p v-if="course.description">{{ course.description }}</p>

          <div class="learn-course__progress">
            <div class="learn-course__progress-top">
              <strong>{{ progress.percent }}% {{ t('complete') }}</strong>
              <span>{{ progress.completed_lessons }}/{{ progress.published_lessons }} {{ t('lessons') }}</span>
            </div>
            <div class="learn-course__bar" aria-hidden="true">
              <span :style="{ width: `${Math.min(100, Number(progress.percent || 0))}%` }" />
            </div>
            <div v-if="course.certificate" class="learn-course__certificate">
              <p>
                {{ t('certificateIssued') }} · {{ course.certificate.certificate_number }}
              </p>
              <router-link
                class="learn-course__cert-link"
                :to="{ name: 'certificate-view', params: { id: course.certificate.id } }"
              >
                {{ t('viewCertificate') }}
              </router-link>
            </div>
          </div>

          <button
            v-if="continueTarget"
            type="button"
            class="learn-course__continue"
            @click="watchLesson(continueTarget)"
          >
            {{ continueLabel }}
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <div
          class="learn-course__cover"
          :style="course.thumbnail_url
            ? { backgroundImage: `url(${course.thumbnail_url})` }
            : undefined"
          aria-hidden="true"
        >
          <span v-if="!course.thumbnail_url">{{ course.title }}</span>
        </div>
      </header>

      <section class="learn-course__panel">
        <div class="learn-course__panel-head">
          <div>
            <h2>{{ t('curriculum') }}</h2>
            <p>{{ t('curriculumLead') }}</p>
          </div>
        </div>

        <div v-if="!course.sections?.length" class="learn-course__empty">
          {{ t('noPublicLessons') }}
        </div>

        <div v-else class="learn-course__sections">
          <article
            v-for="section in course.sections"
            :key="section.id"
            class="learn-section"
            :class="{ 'is-open': isOpen(section.id) }"
          >
            <button
              type="button"
              class="learn-section__toggle"
              :aria-expanded="isOpen(section.id)"
              @click="toggleSection(section.id)"
            >
              <div>
                <span class="learn-section__index">{{ t('sectionNumber', { number: section.position }) }}</span>
                <h3>{{ section.title }}</h3>
                <p>
                  {{ sectionStats(section).done }}/{{ sectionStats(section).total }}
                  {{ t('lessonsCompletedShort') }}
                </p>
              </div>
              <span class="learn-section__chevron" aria-hidden="true">{{ isOpen(section.id) ? '−' : '+' }}</span>
            </button>

            <ul v-show="isOpen(section.id)" class="learn-section__lessons">
              <li
                v-for="lesson in section.lessons"
                :key="lesson.id"
                class="learn-lesson"
                :class="`learn-lesson--${lessonTone(lesson)}`"
              >
                <div class="learn-lesson__main">
                  <span class="learn-lesson__status" aria-hidden="true">
                    <v-icon v-if="lesson.is_completed" size="18">mdi-check-circle</v-icon>
                    <v-icon v-else-if="Number(lesson.progress?.position_seconds || 0) > 0" size="18">mdi-play-circle</v-icon>
                    <v-icon v-else size="18">mdi-circle-outline</v-icon>
                  </span>
                  <div>
                    <strong>{{ lesson.position }}. {{ lesson.title }}</strong>
                    <p>
                      {{ lessonTime(lesson.duration_seconds) }}
                      <template v-if="lesson.is_free_preview"> · {{ t('freePreview') }}</template>
                      · {{ lessonStatus(lesson) }}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="learn-lesson__cta"
                  @click="watchLesson(lesson)"
                >
                  {{ lessonActionLabel(lesson) }}
                </button>
              </li>
            </ul>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.learn-course {
  --ink: #0b1b34;
  --muted: #667085;
  --line: #e8edf3;
  --paper: #f5f7fa;
  --teal: #0f5c66;
  display: grid;
  gap: 1rem;
  color: var(--ink);
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.learn-course__back {
  width: fit-content;
  color: var(--teal);
  text-decoration: none;
  font-size: 0.86rem;
  font-weight: 700;
}

.learn-course__loader {
  display: block;
  margin: 1rem auto;
}

.learn-course__hero {
  display: grid;
  gap: 1rem;
  padding: 1.1rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at 100% 0%, rgba(20, 145, 155, 0.2), transparent 40%),
    linear-gradient(135deg, #0a3d44 0%, #0f5c66 50%, #145c4f 100%);
  color: #f7fbfb;
  box-shadow: 0 12px 28px rgba(15, 92, 102, 0.18);
}

@media (min-width: 900px) {
  .learn-course__hero {
    grid-template-columns: minmax(0, 1.35fr) minmax(220px, 0.85fr);
    align-items: stretch;
  }
}

.learn-course__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.learn-course__chips span {
  display: inline-flex;
  min-height: 1.6rem;
  align-items: center;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 0.72rem;
  font-weight: 700;
}

.learn-course__hero h1 {
  margin: 0;
  font-size: clamp(1.35rem, 2.8vw, 1.9rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.learn-course__hero-copy > p {
  margin: 0.55rem 0 0;
  max-width: 54ch;
  opacity: 0.9;
  font-size: 0.92rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.learn-course__progress {
  margin-top: 1rem;
  display: grid;
  gap: 0.4rem;
}

.learn-course__progress-top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.4rem;
  font-size: 0.82rem;
}

.learn-course__progress-top span {
  opacity: 0.85;
}

.learn-course__bar {
  height: 0.45rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  overflow: hidden;
}

.learn-course__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #f5c518, #ffe08a);
}

.learn-course__certificate {
  display: grid;
  gap: 0.35rem;
  margin: 0.15rem 0 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: #d7f5e8;
}

.learn-course__certificate p {
  margin: 0;
}

.learn-course__cert-link {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  width: fit-content;
  color: #102a2e;
  background: #f5c518;
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  text-decoration: none;
  font-weight: 800;
}

.learn-course__continue {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 44px;
  margin-top: 1rem;
  padding: 0 1.1rem;
  border: 0;
  border-radius: 0.65rem;
  background: #f5c518;
  color: #1a1400;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  width: fit-content;
}

.learn-course__cover {
  min-height: 180px;
  border-radius: 0.85rem;
  display: grid;
  place-items: center;
  padding: 1rem;
  text-align: center;
  font-weight: 800;
  background:
    linear-gradient(145deg, rgba(10, 42, 58, 0.35), rgba(11, 61, 54, 0.45)),
    linear-gradient(145deg, #0b3d36 0%, #145c4f 45%, #0a2a3a 100%) center / cover no-repeat;
  background-size: cover;
  background-position: center;
}

.learn-course__panel {
  padding: 1rem;
  border-radius: 1rem;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.learn-course__panel-head h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.learn-course__panel-head p {
  margin: 0.25rem 0 0;
  color: var(--muted);
  font-size: 0.86rem;
}

.learn-course__empty {
  margin-top: 0.85rem;
  color: var(--muted);
  font-size: 0.92rem;
}

.learn-course__sections {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
}

.learn-section {
  border: 1px solid var(--line);
  border-radius: 0.85rem;
  overflow: hidden;
  background: #fff;
}

.learn-section__toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  padding: 0.9rem 1rem;
  border: 0;
  background: var(--paper);
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
  min-height: 64px;
}

.learn-section.is-open .learn-section__toggle {
  background: #eef7f7;
}

.learn-section__index {
  display: block;
  margin-bottom: 0.2rem;
  color: var(--teal);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.learn-section__toggle h3 {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 800;
  line-height: 1.3;
}

.learn-section__toggle p {
  margin: 0.2rem 0 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.learn-section__chevron {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #fff;
  border: 1px solid var(--line);
  font-weight: 800;
  color: var(--teal);
}

.learn-section__lessons {
  list-style: none;
  margin: 0;
  padding: 0.35rem 0.55rem 0.65rem;
  display: grid;
  gap: 0.35rem;
}

.learn-lesson {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.75rem;
  border-radius: 0.7rem;
  background: #fff;
  border: 1px solid transparent;
}

@media (min-width: 720px) {
  .learn-lesson {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.learn-lesson--done {
  background: #f3fbf7;
}

.learn-lesson--active {
  background: #f3f8ff;
  border-color: #d7e6ff;
}

.learn-lesson__main {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  min-width: 0;
}

.learn-lesson__status {
  color: var(--teal);
  margin-top: 0.1rem;
}

.learn-lesson--done .learn-lesson__status {
  color: #14919b;
}

.learn-lesson--active .learn-lesson__status {
  color: #2563eb;
}

.learn-lesson__main strong {
  display: block;
  font-size: 0.92rem;
  line-height: 1.35;
}

.learn-lesson__main p {
  margin: 0.2rem 0 0;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.learn-lesson__cta {
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 0.9rem;
  border: 0;
  border-radius: 0.5rem;
  background: var(--ink);
  color: #fff;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
  width: 100%;
}

@media (min-width: 720px) {
  .learn-lesson__cta {
    width: auto;
  }
}
</style>
