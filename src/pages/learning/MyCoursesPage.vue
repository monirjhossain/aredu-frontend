<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { useLocaleStore } from '../../stores/locale'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const localeStore = useLocaleStore()

const items = ref([])
const loading = ref(true)
const message = ref('')
const courseTab = ref('all')

const courseTabs = computed(() => [
  { key: 'all', label: t('allCoursesTab') },
  { key: 'ongoing', label: t('ongoingCoursesTab') },
  { key: 'completed', label: t('completedCoursesTab') },
])

const filteredItems = computed(() => {
  if (courseTab.value === 'ongoing') {
    return items.value.filter((item) => Number(item.progress?.percent || 0) < 100)
  }
  if (courseTab.value === 'completed') {
    return items.value.filter((item) => Number(item.progress?.percent || 0) >= 100)
  }
  return items.value
})

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/student/enrollments', { skipErrorToast: true })
    items.value = data.data || []
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function examLabel(course) {
  return course?.exam_type === 'general' ? t('general') : t('academic')
}

function batchLabel(course) {
  if (course?.batch_number == null) return ''
  return t('batchNumber', { number: course.batch_number })
}

function enrolledLabel(value) {
  if (!value) return ''
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

onMounted(load)
</script>

<template>
  <div class="my-courses">
    <header class="my-courses__hero">
      <div>
        <p class="my-courses__eyebrow">{{ t('learning') }}</p>
        <h1>{{ t('myCourses') }}</h1>
        <p>{{ t('myCoursesLead') }}</p>
      </div>
      <router-link class="my-courses__browse" :to="{ name: 'courses' }">
        {{ t('browseCourses') }}
        <span aria-hidden="true">→</span>
      </router-link>
    </header>

    <v-progress-circular v-if="loading" class="my-courses__loader" indeterminate color="#0f5c66" />
    <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>

    <section v-else class="my-courses__panel">
      <div class="my-courses__head">
        <div>
          <h2>{{ t('enrolledCourses') }}</h2>
          <p>{{ items.length }} {{ t('courses') }}</p>
        </div>
        <div v-if="items.length" class="my-courses__tabs" role="tablist">
          <button
            v-for="tab in courseTabs"
            :key="tab.key"
            type="button"
            class="my-courses__tab"
            :class="{ 'is-active': courseTab === tab.key }"
            role="tab"
            :aria-selected="courseTab === tab.key"
            @click="courseTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <div v-if="items.length === 0" class="my-courses__empty">
        <strong>{{ t('noPurchasedCourses') }}</strong>
        <p>{{ t('myCoursesEmptyLead') }}</p>
        <router-link class="my-courses__cta my-courses__cta--inline" :to="{ name: 'courses' }">
          {{ t('browseCourses') }}
          <span aria-hidden="true">→</span>
        </router-link>
      </div>

      <div v-else-if="filteredItems.length === 0" class="my-courses__empty">
        <p>{{ t('noCoursesInTab') }}</p>
      </div>

      <div v-else class="my-courses__grid">
        <article v-for="item in filteredItems" :key="item.id" class="my-course">
          <div
            class="my-course__media"
            :style="item.course?.thumbnail_url
              ? { backgroundImage: `url(${item.course.thumbnail_url})` }
              : undefined"
          >
            <span v-if="!item.course?.thumbnail_url">{{ item.course?.title }}</span>
          </div>
          <div class="my-course__body">
            <h3>{{ item.course?.title }}</h3>
            <div class="my-course__meta">
              <span v-if="item.course?.category?.name">{{ item.course.category.name }}</span>
              <span>{{ examLabel(item.course) }}</span>
              <span v-if="batchLabel(item.course)">{{ batchLabel(item.course) }}</span>
            </div>
            <p v-if="item.enrolled_at" class="my-course__enrolled">
              {{ t('enrolledOn') }} · {{ enrolledLabel(item.enrolled_at) }}
            </p>
            <div class="my-course__progress">
              <div class="my-course__progress-top">
                <span>{{ Number(item.progress?.percent || 0) }}% {{ t('complete') }}</span>
                <span>
                  {{ Number(item.progress?.completed_lessons || 0) }}/{{ Number(item.progress?.published_lessons || 0) }}
                </span>
              </div>
              <div class="my-course__bar" aria-hidden="true">
                <span :style="{ width: `${Math.min(100, Number(item.progress?.percent || 0))}%` }" />
              </div>
            </div>
            <router-link
              v-if="item.course?.slug"
              class="my-course__cta"
              :to="{ name: 'learning-course', params: { slug: item.course.slug } }"
            >
              {{ Number(item.progress?.percent || 0) >= 100 ? t('reviewCourse') : t('continueCourse') }}
              <span aria-hidden="true">→</span>
            </router-link>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.my-courses {
  --ink: #0b1b34;
  --muted: #667085;
  --line: #e8edf3;
  --paper: #f5f7fa;
  --teal: #0f5c66;
  display: grid;
  gap: 1.1rem;
  color: var(--ink);
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.my-courses__hero {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.15rem 1.1rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at 100% 0%, rgba(20, 145, 155, 0.22), transparent 42%),
    linear-gradient(135deg, #0a3d44 0%, #0f5c66 48%, #145c4f 100%);
  color: #f7fbfb;
  box-shadow: 0 12px 28px rgba(15, 92, 102, 0.18);
}

@media (min-width: 760px) {
  .my-courses__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.my-courses__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.my-courses__hero h1 {
  margin: 0;
  font-size: clamp(1.4rem, 2.8vw, 1.85rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.my-courses__hero p {
  margin: 0.35rem 0 0;
  max-width: 42ch;
  opacity: 0.9;
  font-size: 0.92rem;
  line-height: 1.45;
}

.my-courses__browse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 1rem;
  border-radius: 0.65rem;
  background: #e54c10;
  color: #fff;
  text-decoration: none;
  font-size: 0.86rem;
  font-weight: 800;
  width: fit-content;
}

.my-courses__loader {
  margin: 1rem auto;
  display: block;
}

.my-courses__panel {
  padding: 1rem;
  border-radius: 1rem;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.my-courses__head {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-bottom: 1rem;
}

@media (min-width: 760px) {
  .my-courses__head {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.my-courses__head h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.my-courses__head p {
  margin: 0.2rem 0 0;
  color: var(--muted);
  font-size: 0.84rem;
}

.my-courses__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.my-courses__tab {
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

.my-courses__tab.is-active {
  background: var(--ink);
  color: #fff;
}

.my-courses__empty {
  display: grid;
  gap: 0.45rem;
  justify-items: start;
  padding: 1.25rem 0.25rem 0.5rem;
}

.my-courses__empty strong {
  font-size: 1rem;
}

.my-courses__empty p {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.45;
}

.my-courses__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.9rem;
}

@media (min-width: 720px) {
  .my-courses__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .my-courses__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.my-course {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border-radius: 0.85rem;
  border: 1px solid var(--line);
  background: #fff;
}

.my-course__media {
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

.my-course__body {
  display: grid;
  gap: 0.55rem;
  padding: 0.85rem;
  flex: 1;
}

.my-course__body h3 {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.3;
  font-weight: 800;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.my-course__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.my-course__meta span {
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

.my-course__enrolled {
  margin: 0;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.my-course__progress {
  display: grid;
  gap: 0.35rem;
}

.my-course__progress-top {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 700;
}

.my-course__bar {
  height: 0.4rem;
  border-radius: 999px;
  background: #eef1f5;
  overflow: hidden;
}

.my-course__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0f5c66, #14919b);
}

.my-course__cta,
.my-courses__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.55rem;
  margin-top: auto;
  border-radius: 0.5rem;
  background: var(--ink);
  color: #fff;
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 800;
}

.my-courses__cta--inline {
  width: fit-content;
  padding: 0 1rem;
  margin-top: 0.35rem;
}
</style>
