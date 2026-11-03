<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CourseCard from '../components/marketing/CourseCard.vue'
import { useAuthStore } from '../stores/auth'
import { http } from '../services/http'
import { apiError } from '../utils/apiError'

const { t } = useI18n()
const auth = useAuthStore()

const loading = ref(true)
const message = ref('')
const branding = ref({
  platform_name: 'AR Education',
  logo_url: null,
  contact_information: '',
  support_email: '',
  currency: 'BDT',
})
const about = ref('')
const videos = ref([])
const courses = ref([])
const previewLessons = ref([])
const activeVideo = ref(0)
const courseFilter = ref('all')

const brandName = computed(() => branding.value.platform_name || t('appName'))
const currency = computed(() => branding.value.currency || 'BDT')
const hasVideos = computed(() => videos.value.length > 0)
const hasPreviews = computed(() => previewLessons.value.length > 0)
const hasCourses = computed(() => courses.value.length > 0)

const filteredCourses = computed(() => {
  if (courseFilter.value === 'all') return courses.value
  return courses.value.filter((course) => course.exam_type === courseFilter.value)
})

const courseFilters = computed(() => [
  { key: 'all', label: t('landingFilterAll'), count: courses.value.length },
  {
    key: 'academic',
    label: t('academic'),
    count: courses.value.filter((c) => c.exam_type === 'academic').length,
  },
  {
    key: 'general',
    label: t('general'),
    count: courses.value.filter((c) => c.exam_type === 'general').length,
  },
])

onMounted(loadLanding)

async function loadLanding() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/landing', { skipErrorToast: true })
    const payload = data.data || {}
    branding.value = { ...branding.value, ...(payload.branding || {}) }
    about.value = payload.about || ''
    videos.value = payload.videos || []
    courses.value = payload.courses || []
    previewLessons.value = payload.preview_lessons || []
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function youtubeId(url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '')
    }
    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v')
    }
  } catch {
    return null
  }
  return null
}

function embedUrl(url) {
  const id = youtubeId(url)
  return id ? `https://www.youtube.com/embed/${id}` : null
}

function previewTarget(lesson) {
  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: `/courses/${lesson.course_slug}/lessons/${lesson.id}` } }
  }
  return { name: 'lesson-player', params: { slug: lesson.course_slug, lessonId: lesson.id } }
}

function scrollToCourses() {
  document.getElementById('landing-courses')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="ostad">
    <section class="ostad-hero" aria-label="Hero">
      <div class="ostad-hero__media" aria-hidden="true" />
      <div class="ostad-hero__shade" aria-hidden="true" />
      <div class="ostad-hero__orb ostad-hero__orb--a" aria-hidden="true" />
      <div class="ostad-hero__orb ostad-hero__orb--b" aria-hidden="true" />
      <div class="ostad-hero__sheen" aria-hidden="true" />
      <div class="ostad-hero__inner">
        <p class="ostad-hero__brand ostad-hero__reveal">{{ brandName }}</p>
        <span class="ostad-hero__rule" aria-hidden="true" />
        <h1 class="ostad-hero__title ostad-hero__reveal">
          {{ t('landingHeadlineLead') }}
          <span class="ostad-hero__accent">{{ t('landingHeadlineAccent') }}</span>
        </h1>
        <p class="ostad-hero__sub ostad-hero__reveal">{{ t('landingSupport') }}</p>
        <div class="ostad-hero__actions ostad-hero__reveal">
          <button type="button" class="ostad-cta ostad-cta--pulse" @click="scrollToCourses">
            {{ t('landingStartLearning') }}
            <span class="ostad-cta__arrow" aria-hidden="true">→</span>
          </button>
          <router-link class="ostad-cta ostad-cta--ghost" :to="{ name: 'courses' }">
            {{ t('browseCourses') }}
          </router-link>
        </div>
      </div>
      <div class="ostad-hero__scroll" aria-hidden="true">
        <span class="ostad-hero__scroll-line" />
      </div>
    </section>

    <v-progress-linear v-if="loading" indeterminate color="#f5c518" class="ostad-loader" />
    <v-alert v-else-if="message" type="error" variant="tonal" class="ma-6">{{ message }}</v-alert>

    <template v-else>
      <section id="landing-courses" class="ostad-section ostad-courses">
        <div class="ostad-wrap">
          <div class="ostad-section__head">
            <div>
              <h2>{{ t('landingCourses') }}</h2>
              <p>{{ t('landingCoursesLead') }}</p>
            </div>
          </div>

          <div class="ostad-chips" role="tablist" :aria-label="t('courses')">
            <button
              v-for="chip in courseFilters"
              :key="chip.key"
              type="button"
              class="ostad-chip"
              :class="{ 'is-active': courseFilter === chip.key }"
              role="tab"
              :aria-selected="courseFilter === chip.key"
              @click="courseFilter = chip.key"
            >
              <span>{{ chip.label }}</span>
              <small>{{ chip.count }} {{ t('landingCourseCount') }}</small>
            </button>
          </div>

          <div v-if="filteredCourses.length" class="ostad-course-grid">
            <CourseCard
              v-for="course in filteredCourses"
              :key="course.id"
              :course="course"
              :currency="currency"
            />
          </div>
          <p v-else class="ostad-empty">{{ t('noCourses') }}</p>

          <router-link class="ostad-see-all" :to="{ name: 'courses' }">
            {{ t('viewAllCourses') }}
            <span aria-hidden="true">→</span>
          </router-link>
        </div>
      </section>

      <section class="ostad-section ostad-videos">
        <div class="ostad-wrap">
          <div class="ostad-videos__title">
            <span class="ostad-live">{{ t('landingLiveBadge') }}</span>
            <h2>{{ t('landingVideos') }}</h2>
          </div>
          <p class="ostad-videos__lead">{{ t('landingVideosLead') }}</p>

          <template v-if="hasVideos">
            <div class="ostad-video-stage">
              <iframe
                v-if="embedUrl(videos[activeVideo]?.url)"
                class="ostad-video-frame"
                :src="embedUrl(videos[activeVideo].url)"
                :title="videos[activeVideo].title"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              />
              <video
                v-else
                class="ostad-video-frame"
                :src="videos[activeVideo]?.url"
                controls
                playsinline
              />
            </div>
            <div class="ostad-video-list">
              <button
                v-for="(video, index) in videos"
                :key="`${video.url}-${index}`"
                type="button"
                class="ostad-video-item"
                :class="{ 'is-active': index === activeVideo }"
                @click="activeVideo = index"
              >
                <span class="ostad-video-item__watch">{{ t('watchLesson') }}</span>
                {{ video.title }}
              </button>
            </div>
          </template>

          <div v-else-if="hasPreviews" class="ostad-preview-grid">
            <router-link
              v-for="lesson in previewLessons"
              :key="lesson.id"
              class="ostad-preview"
              :to="previewTarget(lesson)"
            >
              <div
                class="ostad-preview__media"
                :style="lesson.cover_url ? { backgroundImage: `url(${lesson.cover_url})` } : undefined"
              >
                <span class="ostad-preview__live">{{ t('landingLiveBadge') }}</span>
              </div>
              <div class="ostad-preview__body">
                <p>{{ lesson.course_title }}</p>
                <h3>{{ lesson.title }}</h3>
                <span>{{ t('watchFreePreview') }} →</span>
              </div>
            </router-link>
          </div>

          <p v-else class="ostad-empty ostad-empty--on-dark">{{ t('landingVideosEmpty') }}</p>
        </div>
      </section>

      <section class="ostad-section ostad-about">
        <div class="ostad-wrap">
          <h2>{{ t('aboutCompany') }}</h2>
          <p class="ostad-about__text">{{ about || t('landingAboutFallback') }}</p>
          <div class="ostad-facts">
            <article>
              <h3>{{ t('landingFactCourses') }}</h3>
              <p>{{ t('landingFactCoursesBody') }}</p>
            </article>
            <article>
              <h3>{{ t('landingFactPractice') }}</h3>
              <p>{{ t('landingFactPracticeBody') }}</p>
            </article>
            <article>
              <h3>{{ t('landingFactTeachers') }}</h3>
              <p>{{ t('landingFactTeachersBody') }}</p>
            </article>
          </div>
        </div>
      </section>

      <section class="ostad-section ostad-contact">
        <div class="ostad-wrap ostad-contact__inner">
          <div>
            <h2>{{ t('contactUs') }}</h2>
            <p v-if="branding.contact_information">{{ branding.contact_information }}</p>
            <p v-else class="ostad-empty">{{ t('landingContactEmpty') }}</p>
            <a
              v-if="branding.support_email"
              class="ostad-mail"
              :href="`mailto:${branding.support_email}`"
            >
              {{ branding.support_email }}
            </a>
          </div>
          <div class="ostad-contact__actions">
            <router-link class="ostad-cta ostad-cta--dark" :to="{ name: 'courses' }">
              {{ t('browseCourses') }}
            </router-link>
            <router-link
              v-if="!auth.isAuthenticated"
              class="ostad-ghost"
              :to="{ name: 'register' }"
            >
              {{ t('register') }}
            </router-link>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ostad {
  --ink: #0b1b34;
  --muted: #5b6b7c;
  --yellow: #f5c518;
  --yellow-ink: #1a1400;
  --coral: #e85d4c;
  --paper: #f7f9fc;
  --line: #e6ebf2;
  --navy: #101828;
  color: var(--ink);
  background: #fff;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.ostad-hero {
  position: relative;
  min-height: calc(100vh - 64px);
  min-height: calc(100dvh - 64px);
  display: grid;
  align-items: end;
  padding: 2rem 1.25rem 4.5rem;
  overflow: hidden;
  color: #f7f9fc;
}

.ostad-hero__media {
  position: absolute;
  inset: -4%;
  background: url('/images/hero-study.jpg') center / cover no-repeat;
  animation: ostad-hero-in 1.4s cubic-bezier(0.22, 1, 0.36, 1) both, ostad-drift 22s ease-in-out 1.4s infinite alternate;
  will-change: transform;
}

.ostad-hero__shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(110deg, rgba(8, 20, 36, 0.9) 0%, rgba(8, 20, 36, 0.58) 46%, rgba(8, 20, 36, 0.32) 100%),
    linear-gradient(180deg, rgba(8, 20, 36, 0.18) 0%, rgba(8, 20, 36, 0.78) 100%);
  pointer-events: none;
  animation: ostad-fade 1.1s ease both;
}

.ostad-hero__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(48px);
  pointer-events: none;
  opacity: 0.55;
  mix-blend-mode: soft-light;
}

.ostad-hero__orb--a {
  width: min(42vw, 420px);
  height: min(42vw, 420px);
  left: -6%;
  bottom: 8%;
  background: radial-gradient(circle, rgba(245, 197, 24, 0.55), transparent 68%);
  animation: ostad-orb-a 12s ease-in-out infinite alternate;
}

.ostad-hero__orb--b {
  width: min(36vw, 360px);
  height: min(36vw, 360px);
  right: 8%;
  top: 12%;
  background: radial-gradient(circle, rgba(232, 93, 76, 0.35), transparent 70%);
  animation: ostad-orb-b 14s ease-in-out infinite alternate;
}

.ostad-hero__sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(255, 255, 255, 0.08) 48%,
    transparent 62%
  );
  background-size: 220% 100%;
  animation: ostad-sheen 9s ease-in-out 1.2s infinite;
  opacity: 0.7;
}

.ostad-hero__inner {
  position: relative;
  z-index: 1;
  width: min(680px, 100%);
  margin: 0 auto 0 0;
  max-width: min(960px, 100%);
}

@media (min-width: 900px) {
  .ostad-hero__inner {
    margin-left: max(0px, calc((100% - 960px) / 2));
  }
}

.ostad-hero__reveal {
  opacity: 0;
  animation: ostad-rise 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.ostad-hero__brand.ostad-hero__reveal { animation-delay: 180ms; }
.ostad-hero__title.ostad-hero__reveal { animation-delay: 420ms; }
.ostad-hero__sub.ostad-hero__reveal { animation-delay: 560ms; }
.ostad-hero__actions.ostad-hero__reveal { animation-delay: 700ms; }

.ostad-hero__brand {
  margin: 0 0 0.65rem;
  font-size: clamp(2rem, 5.5vw, 3.15rem);
  font-weight: 800;
  letter-spacing: -0.045em;
  line-height: 1.02;
  text-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}

.ostad-hero__rule {
  display: block;
  width: 3.25rem;
  height: 3px;
  margin: 0 0 1rem;
  border-radius: 999px;
  background: linear-gradient(90deg, #f5c518, rgba(245, 197, 24, 0.15));
  transform-origin: left center;
  opacity: 0;
  animation: ostad-rule 1s cubic-bezier(0.22, 1, 0.36, 1) 360ms both;
}

.ostad-hero__title {
  margin: 0 0 0.9rem;
  font-size: clamp(1.15rem, 2.4vw, 1.55rem);
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.3;
  max-width: 18ch;
}

.ostad-hero__accent {
  display: inline-block;
  color: #f5c518;
  background: linear-gradient(90deg, #f5c518 0%, #ffe48a 45%, #f5c518 90%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: ostad-shimmer 4.5s ease-in-out 1.2s infinite;
}

.ostad-hero__sub {
  margin: 0 0 1.6rem;
  max-width: 36ch;
  color: rgba(247, 249, 252, 0.86);
  font-size: 1.08rem;
  line-height: 1.55;
}

.ostad-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.ostad-hero__actions .ostad-cta {
  min-width: 0;
}

.ostad-hero__scroll {
  position: absolute;
  left: 50%;
  bottom: 1.25rem;
  z-index: 1;
  width: 1px;
  height: 2.4rem;
  transform: translateX(-50%);
  opacity: 0;
  animation: ostad-fade 800ms ease 1.3s both;
}

.ostad-hero__scroll-line {
  display: block;
  width: 1px;
  height: 100%;
  background: linear-gradient(180deg, rgba(247, 249, 252, 0.7), transparent);
  transform-origin: top;
  animation: ostad-scroll 1.8s ease-in-out 1.5s infinite;
}

.ostad-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 3rem;
  min-width: min(320px, 100%);
  padding: 0 1.35rem;
  border: 0;
  border-radius: 0.55rem;
  background: var(--yellow);
  color: var(--yellow-ink);
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease;
  box-shadow: 0 10px 24px rgba(245, 197, 24, 0.35);
}

.ostad-cta:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 32px rgba(245, 197, 24, 0.42);
}

.ostad-cta:hover .ostad-cta__arrow {
  transform: translateX(4px);
}

.ostad-cta__arrow {
  display: inline-block;
  transition: transform 180ms ease;
}

.ostad-cta--pulse {
  animation: ostad-cta-glow 2.8s ease-in-out 1.4s infinite;
}

.ostad-cta--ghost {
  min-width: 0;
  background: transparent;
  color: #f7f9fc;
  border: 1px solid rgba(247, 249, 252, 0.45);
  box-shadow: none;
  backdrop-filter: blur(6px);
}

.ostad-cta--ghost:hover {
  background: rgba(247, 249, 252, 0.1);
  border-color: rgba(247, 249, 252, 0.75);
  box-shadow: none;
}

.ostad-cta--dark {
  box-shadow: none;
  animation: none;
}

.ostad-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  padding: 0 1.2rem;
  border-radius: 0.55rem;
  border: 1px solid rgba(11, 27, 52, 0.18);
  color: var(--ink);
  text-decoration: none;
  font-weight: 650;
}

.ostad-loader {
  position: sticky;
  top: 0;
  z-index: 2;
}

.ostad-section {
  padding: clamp(3rem, 7vw, 5rem) 0;
}

.ostad-wrap {
  width: min(960px, calc(100% - 2rem));
  margin: 0 auto;
}

.ostad-section__head h2,
.ostad-about h2,
.ostad-contact h2,
.ostad-videos__title h2 {
  margin: 0 0 0.55rem;
  font-size: clamp(1.35rem, 2.6vw, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.ostad-section__head p,
.ostad-videos__lead {
  margin: 0;
  color: var(--muted);
  font-size: 1.02rem;
  line-height: 1.55;
}

.ostad-chips {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 1.4rem 0 1.6rem;
  scrollbar-width: none;
}

.ostad-chips::-webkit-scrollbar {
  display: none;
}

.ostad-chip {
  flex: 0 0 auto;
  display: grid;
  gap: 0.15rem;
  min-width: 148px;
  padding: 0.85rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
}

.ostad-chip small {
  color: var(--muted);
  font-size: 0.78rem;
}

.ostad-chip.is-active {
  background: var(--navy);
  border-color: var(--navy);
  color: #fff;
}

.ostad-chip.is-active small {
  color: rgba(255, 255, 255, 0.72);
}

.ostad-course-grid,
.ostad-preview-grid {
  display: grid;
  gap: 1.1rem;
}

@media (min-width: 760px) {
  .ostad-course-grid,
  .ostad-preview-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1080px) {
  .ostad-course-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.ostad-see-all {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 1.5rem;
  min-height: 3rem;
  border-radius: 0.7rem;
  background: #eef1f5;
  color: var(--ink);
  text-decoration: none;
  font-weight: 700;
}

.ostad-videos {
  background:
    radial-gradient(circle at top right, rgba(245, 197, 24, 0.12), transparent 35%),
    #0b1220;
  color: #f4f7fb;
}

.ostad-videos__title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  flex-wrap: wrap;
  text-align: center;
}

.ostad-videos__lead {
  text-align: center;
  color: rgba(244, 247, 251, 0.72);
  margin: 0.7rem auto 1.6rem;
  max-width: 42ch;
}

.ostad-live {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  border-radius: 0.3rem;
  background: var(--coral);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.ostad-video-stage {
  border-radius: 1rem;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  background: #000;
  animation: ostad-fade 700ms ease both;
}

.ostad-video-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}

.ostad-video-list {
  display: grid;
  gap: 0.7rem;
  margin-top: 1rem;
}

@media (min-width: 800px) {
  .ostad-video-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

.ostad-video-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.ostad-video-item.is-active,
.ostad-video-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.ostad-video-item__watch {
  flex: 0 0 auto;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: var(--yellow);
  color: var(--yellow-ink);
  font-size: 0.72rem;
  font-weight: 800;
}

.ostad-preview {
  display: block;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  text-decoration: none;
  color: inherit;
  transition: transform 180ms ease;
}

.ostad-preview:hover {
  transform: translateY(-3px);
}

.ostad-preview__media {
  position: relative;
  aspect-ratio: 16 / 10;
  background:
    linear-gradient(135deg, #1d3b63, #0f5c66),
    center / cover no-repeat;
}

.ostad-preview__live {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  padding: 0.2rem 0.45rem;
  border-radius: 0.3rem;
  background: #fff;
  color: var(--coral);
  border: 1px solid rgba(232, 93, 76, 0.35);
  font-size: 0.72rem;
  font-weight: 800;
}

.ostad-preview__body {
  padding: 1rem;
}

.ostad-preview__body p {
  margin: 0 0 0.35rem;
  color: rgba(244, 247, 251, 0.65);
  font-size: 0.85rem;
}

.ostad-preview__body h3 {
  margin: 0 0 0.55rem;
  font-size: 1.05rem;
}

.ostad-preview__body span {
  color: var(--yellow);
  font-weight: 700;
  font-size: 0.9rem;
}

.ostad-about {
  background: var(--paper);
}

.ostad-about__text {
  margin: 0 0 1.8rem;
  max-width: 62ch;
  color: var(--muted);
  font-size: 1.05rem;
  line-height: 1.65;
}

.ostad-facts {
  display: grid;
  gap: 1rem;
}

@media (min-width: 860px) {
  .ostad-facts {
    grid-template-columns: repeat(3, 1fr);
  }
}

.ostad-facts article {
  padding: 1.2rem 1.15rem;
  border-radius: 1rem;
  background: #fff;
  border: 1px solid var(--line);
}

.ostad-facts h3 {
  margin: 0 0 0.45rem;
  font-size: 1.05rem;
}

.ostad-facts p {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

.ostad-contact {
  background: #fff;
  border-top: 1px solid var(--line);
}

.ostad-contact__inner {
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 860px) {
  .ostad-contact__inner {
    grid-template-columns: 1.4fr 1fr;
    align-items: end;
  }
}

.ostad-contact p {
  margin: 0 0 0.7rem;
  color: var(--muted);
  line-height: 1.55;
  max-width: 46ch;
}

.ostad-mail {
  color: var(--coral);
  font-weight: 700;
  text-decoration: none;
}

.ostad-contact__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.ostad-empty {
  margin: 0;
  color: var(--muted);
}

.ostad-empty--on-dark {
  color: rgba(244, 247, 251, 0.7);
  text-align: center;
}

@keyframes ostad-rise {
  from {
    opacity: 0;
    transform: translateY(22px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ostad-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes ostad-hero-in {
  from { transform: scale(1.18); opacity: 0.55; }
  to { transform: scale(1.06); opacity: 1; }
}

@keyframes ostad-drift {
  from { transform: scale(1.06) translate3d(0, 0, 0); }
  to { transform: scale(1.14) translate3d(-2%, -1.2%, 0); }
}

@keyframes ostad-orb-a {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(12%, -18%, 0) scale(1.15); }
}

@keyframes ostad-orb-b {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(-16%, 10%, 0) scale(1.2); }
}

@keyframes ostad-sheen {
  0%, 40% { background-position: 120% 0; opacity: 0; }
  50% { opacity: 0.75; }
  70%, 100% { background-position: -40% 0; opacity: 0; }
}

@keyframes ostad-rule {
  from { transform: scaleX(0); opacity: 0; }
  to { transform: scaleX(1); opacity: 1; }
}

@keyframes ostad-shimmer {
  0%, 100% { background-position: 100% 0; }
  50% { background-position: 0% 0; }
}

@keyframes ostad-cta-glow {
  0%, 100% { box-shadow: 0 10px 24px rgba(245, 197, 24, 0.32); }
  50% { box-shadow: 0 14px 34px rgba(245, 197, 24, 0.55); }
}

@keyframes ostad-scroll {
  0% { transform: scaleY(0.35); opacity: 0; }
  35% { opacity: 1; }
  100% { transform: scaleY(1); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .ostad-hero__reveal,
  .ostad-hero__media,
  .ostad-hero__shade,
  .ostad-hero__orb,
  .ostad-hero__sheen,
  .ostad-hero__rule,
  .ostad-hero__accent,
  .ostad-hero__scroll,
  .ostad-hero__scroll-line,
  .ostad-cta--pulse,
  .ostad-course,
  .ostad-preview,
  .ostad-video-stage {
    animation: none !important;
    transition: none;
  }

  .ostad-hero__reveal,
  .ostad-hero__rule,
  .ostad-hero__scroll {
    opacity: 1;
    transform: none;
  }

  .ostad-hero__accent {
    color: #f5c518;
    background: none;
    -webkit-background-clip: unset;
    background-clip: unset;
  }

  .ostad-hero__media {
    transform: scale(1.04);
    opacity: 1;
  }
}
</style>
