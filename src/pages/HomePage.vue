<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CourseCard from '../components/marketing/CourseCard.vue'
import MarketingFooter from '../components/marketing/MarketingFooter.vue'
import { http } from '../services/http'
import { cacheGet, cacheSet } from '../services/publicCache'
import { apiError } from '../utils/apiError'

const { t } = useI18n()

const loading = ref(true)
const message = ref('')
const branding = ref({
  platform_name: 'AR Education',
  logo_url: null,
  contact_information: '',
  support_email: '',
  currency: 'BDT',
})
const courses = ref([])
const courseFilter = ref('all')
const storyIndex = ref(0)
const openFaq = ref(0)
const resultCounts = ref([0, 0, 0, 0])
let storyTimer = null
let observer = null
let revealTimer = null
let resultAnimated = false

const brandName = computed(() => branding.value.platform_name || t('appName'))
const currency = computed(() => branding.value.currency || 'BDT')

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

const testimonials = computed(() => [
  { photo: '/images/grads/01.jpg', nameKey: 'landingTestimonial1Name', roleKey: 'landingTestimonial1Role', quoteKey: 'landingTestimonial1Quote' },
  { photo: '/images/grads/02.jpg', nameKey: 'landingTestimonial2Name', roleKey: 'landingTestimonial2Role', quoteKey: 'landingTestimonial2Quote' },
  { photo: '/images/grads/03.jpg', nameKey: 'landingTestimonial3Name', roleKey: 'landingTestimonial3Role', quoteKey: 'landingTestimonial3Quote' },
  { photo: '/images/grads/04.jpg', nameKey: 'landingTestimonial4Name', roleKey: 'landingTestimonial4Role', quoteKey: 'landingTestimonial4Quote' },
  { photo: '/images/grads/05.jpg', nameKey: 'landingTestimonial5Name', roleKey: 'landingTestimonial5Role', quoteKey: 'landingTestimonial5Quote' },
  { photo: '/images/grads/06.jpg', nameKey: 'landingTestimonial6Name', roleKey: 'landingTestimonial6Role', quoteKey: 'landingTestimonial6Quote' },
])

const activeStory = computed(() => testimonials.value[storyIndex.value] || testimonials.value[0])

const mockSkills = computed(() => [
  { key: 'reading', labelKey: 'landingMocksReading', to: { name: 'free-practice', query: { module: 'reading' } } },
  { key: 'listening', labelKey: 'landingMocksListening', to: { name: 'free-practice', query: { module: 'listening' } } },
  { key: 'writing', labelKey: 'landingMocksWriting', to: { name: 'courses' } },
  { key: 'speaking', labelKey: 'landingMocksSpeaking', to: { name: 'courses' } },
])

const resultStats = computed(() => [
  { target: 2400, suffix: '+', labelKey: 'landingResultLearners' },
  { target: 18000, suffix: '+', labelKey: 'landingResultMocks' },
  { target: 1.2, suffix: '', labelKey: 'landingResultBand', decimals: 1 },
  { target: 9600, suffix: '+', labelKey: 'landingResultTeachers' },
])

const faqs = computed(() => [
  { q: 'landingFaq1Q', a: 'landingFaq1A' },
  { q: 'landingFaq2Q', a: 'landingFaq2A' },
  { q: 'landingFaq3Q', a: 'landingFaq3A' },
  { q: 'landingFaq4Q', a: 'landingFaq4A' },
  { q: 'landingFaq5Q', a: 'landingFaq5A' },
])

onMounted(() => {
  startStoryRotation()
  revealTimer = window.setTimeout(setupReveal, 40)
  const cached = cacheGet('landing')
  if (cached) {
    branding.value = { ...branding.value, ...(cached.branding || {}) }
    courses.value = cached.courses || []
    loading.value = false
    revealTimer = window.setTimeout(setupReveal, 40)
  }
  loadLanding({ silent: Boolean(cached) })
})

onBeforeUnmount(() => {
  if (storyTimer) window.clearInterval(storyTimer)
  if (revealTimer) window.clearTimeout(revealTimer)
  observer?.disconnect()
})

async function loadLanding({ silent = false } = {}) {
  if (!silent) {
    loading.value = true
    message.value = ''
  }
  try {
    const { data } = await http.get('/landing', { skipErrorToast: true, skipLoading: true })
    const payload = data.data || {}
    branding.value = { ...branding.value, ...(payload.branding || {}) }
    courses.value = payload.courses || []
    cacheSet('landing', {
      branding: branding.value,
      courses: courses.value,
    }, 90_000)
  } catch (error) {
    if (!silent || !courses.value.length) {
      message.value = apiError(error).message || t('requestFailed')
    }
  } finally {
    loading.value = false
    revealTimer = window.setTimeout(setupReveal, 60)
  }
}

function startStoryRotation() {
  if (storyTimer) window.clearInterval(storyTimer)
  storyTimer = window.setInterval(() => {
    storyIndex.value = (storyIndex.value + 1) % testimonials.value.length
  }, 5200)
}

function selectStory(index) {
  storyIndex.value = index
  startStoryRotation()
}

function toggleFaq(index) {
  openFaq.value = openFaq.value === index ? -1 : index
}

function setupReveal() {
  observer?.disconnect()
  const markIn = (el) => {
    el.classList.add('is-in')
    for (const child of el.querySelectorAll('.land-reveal')) {
      child.classList.add('is-in')
    }
    if (el.id === 'landing-results') animateResults()
  }
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          markIn(entry.target)
          observer?.unobserve(entry.target)
        }
      }
    },
    { threshold: 0.08, rootMargin: '0px 0px -4% 0px' },
  )
  for (const el of document.querySelectorAll('.land-section')) {
    observer.observe(el)
  }
  window.setTimeout(() => {
    for (const el of document.querySelectorAll('.land-section, .land-reveal')) {
      if (!el.classList.contains('is-in')) el.classList.add('is-in')
    }
    animateResults()
  }, 1600)
}

function animateResults() {
  if (resultAnimated) return
  resultAnimated = true
  const duration = 1400
  const start = performance.now()
  const tick = (now) => {
    const p = Math.min(1, (now - start) / duration)
    const eased = 1 - (1 - p) ** 3
    resultCounts.value = resultStats.value.map((stat) => {
      const value = stat.target * eased
      return stat.decimals ? Number(value.toFixed(stat.decimals)) : Math.round(value)
    })
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function formatStat(value, decimals = 0) {
  if (decimals) return Number(value).toFixed(decimals)
  return Number(value).toLocaleString()
}

function scrollToCourses() {
  document.getElementById('landing-courses')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="land">
    <section class="land-hero" aria-label="Hero">
      <div class="land-hero__media" aria-hidden="true" />
      <div class="land-hero__shade" aria-hidden="true" />
      <div class="land-hero__glow" aria-hidden="true" />
      <div class="land-hero__inner land-wrap">
        <p class="land-hero__brand land-rise">{{ brandName }}</p>
        <span class="land-hero__rule" aria-hidden="true" />
        <h1 class="land-hero__title land-rise">
          {{ t('landingHeadlineLead') }}
          <span>{{ t('landingHeadlineAccent') }}</span>
        </h1>
        <p class="land-hero__sub land-rise">{{ t('landingSupport') }}</p>
        <div class="land-hero__actions land-rise">
          <button type="button" class="land-btn land-btn--primary" @click="scrollToCourses">
            {{ t('landingStartLearning') }}
            <span aria-hidden="true">→</span>
          </button>
          <router-link class="land-btn land-btn--ghost" :to="{ name: 'courses' }">
            {{ t('browseCourses') }}
          </router-link>
        </div>
      </div>
    </section>

    <section id="landing-courses" class="land-section land-courses">
      <div class="land-wrap">
        <div class="land-section__head land-reveal">
          <p class="land-kicker">{{ t('courses') }}</p>
          <h2>{{ t('landingCourses') }}</h2>
          <p>{{ t('landingCoursesLead') }}</p>
        </div>

        <div v-if="loading" class="land-loader">
          <v-progress-circular indeterminate color="#e54c10" size="36" />
        </div>
        <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
        <template v-else>
          <div class="land-chips land-reveal" role="tablist" :aria-label="t('courses')">
            <button
              v-for="chip in courseFilters"
              :key="chip.key"
              type="button"
              class="land-chip"
              :class="{ 'is-active': courseFilter === chip.key }"
              role="tab"
              :aria-selected="courseFilter === chip.key"
              @click="courseFilter = chip.key"
            >
              <span>{{ chip.label }}</span>
              <small>{{ chip.count }}</small>
            </button>
          </div>

          <div v-if="filteredCourses.length" class="land-course-grid land-reveal">
            <CourseCard
              v-for="course in filteredCourses"
              :key="course.id"
              :course="course"
              :currency="currency"
            />
          </div>
          <p v-else class="land-empty land-reveal">{{ t('noCourses') }}</p>

          <router-link class="land-see-all land-reveal" :to="{ name: 'courses' }">
            {{ t('viewAllCourses') }}
            <span aria-hidden="true">→</span>
          </router-link>
        </template>
      </div>
    </section>

    <section id="landing-mocks" class="land-section land-mocks">
      <div class="land-wrap land-split">
        <div class="land-split__copy land-reveal">
          <p class="land-kicker">{{ t('landingMocksKicker') }}</p>
          <h2>{{ t('landingMocksTitle') }}</h2>
          <p>{{ t('landingMocksLead') }}</p>
          <div class="land-skill-grid">
            <router-link
              v-for="skill in mockSkills"
              :key="skill.key"
              class="land-skill"
              :to="skill.to"
            >
              <span class="land-skill__dot" aria-hidden="true" />
              <span>{{ t(skill.labelKey) }}</span>
            </router-link>
          </div>
          <router-link class="land-btn land-btn--solid" :to="{ name: 'courses' }">
            {{ t('landingMocksCta') }}
            <span aria-hidden="true">→</span>
          </router-link>
        </div>
        <figure class="land-media land-reveal">
          <img
            src="/images/land/land-mocks.jpg"
            :alt="t('landingMocksTitle')"
            width="1280"
            height="720"
          >
        </figure>
      </div>
    </section>

    <section id="landing-cta" class="land-section land-cta">
      <div class="land-cta__media" aria-hidden="true">
        <img src="/images/land/land-cta.jpg" alt="" width="1600" height="900">
      </div>
      <div class="land-cta__shade" aria-hidden="true" />
      <div class="land-wrap land-cta__inner land-reveal">
        <p class="land-kicker land-kicker--light">{{ t('landingCtaKicker') }}</p>
        <h2>{{ t('landingCtaTitle') }}</h2>
        <p>{{ t('landingCtaLead') }}</p>
        <div class="land-hero__actions">
          <router-link class="land-btn land-btn--primary" :to="{ name: 'register' }">
            {{ t('landingCtaPrimary') }}
            <span aria-hidden="true">→</span>
          </router-link>
          <router-link class="land-btn land-btn--ghost" :to="{ name: 'courses' }">
            {{ t('landingCtaSecondary') }}
          </router-link>
        </div>
      </div>
    </section>

    <section id="landing-results" class="land-section land-results">
      <div class="land-wrap land-split land-split--flip">
        <figure class="land-media land-reveal">
          <img
            src="/images/land/land-results.jpg"
            :alt="t('landingResultsTitle')"
            width="1280"
            height="720"
          >
        </figure>
        <div class="land-split__copy land-reveal">
          <p class="land-kicker">{{ t('landingResultsKicker') }}</p>
          <h2>{{ t('landingResultsTitle') }}</h2>
          <p>{{ t('landingResultsLead') }}</p>
          <div class="land-stat-grid">
            <div v-for="(stat, index) in resultStats" :key="stat.labelKey" class="land-stat">
              <strong>
                {{ formatStat(resultCounts[index], stat.decimals || 0) }}{{ stat.suffix }}
              </strong>
              <span>{{ t(stat.labelKey) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      class="land-section land-stories"
      aria-labelledby="landing-stories-title"
    >
      <div class="land-stories__bg" aria-hidden="true" />
      <div class="land-stories__wrap land-wrap">
        <div class="land-section__head land-section__head--light land-reveal">
          <p class="land-kicker land-kicker--light">{{ t('landingStoriesKicker') }}</p>
          <h2 id="landing-stories-title">{{ t('landingStoriesTitle') }}</h2>
          <p>{{ t('landingStoriesLead') }}</p>
        </div>

        <div class="land-stories__stage land-reveal">
          <figure class="land-stories__photo">
            <Transition name="land-fade" mode="out-in">
              <img
                :key="activeStory.photo"
                :src="activeStory.photo"
                :alt="t(activeStory.nameKey)"
                width="640"
                height="640"
              >
            </Transition>
          </figure>

          <div class="land-stories__copy">
            <Transition name="land-fade" mode="out-in">
              <blockquote :key="activeStory.quoteKey" class="land-stories__quote">
                <p>{{ t(activeStory.quoteKey) }}</p>
                <footer>
                  <strong>{{ t(activeStory.nameKey) }}</strong>
                  <span>{{ t(activeStory.roleKey) }}</span>
                </footer>
              </blockquote>
            </Transition>

            <div class="land-stories__thumbs" role="tablist" :aria-label="t('landingStoriesTitle')">
              <button
                v-for="(item, index) in testimonials"
                :key="item.nameKey"
                type="button"
                class="land-stories__thumb"
                :class="{ 'is-active': index === storyIndex }"
                role="tab"
                :aria-selected="index === storyIndex"
                :aria-label="t(item.nameKey)"
                @click="selectStory(index)"
              >
                <img :src="item.photo" :alt="t(item.nameKey)" width="72" height="72">
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="landing-faq" class="land-section land-faq">
      <div class="land-wrap">
        <div class="land-section__head land-reveal">
          <p class="land-kicker">{{ t('landingFaqKicker') }}</p>
          <h2>{{ t('landingFaqTitle') }}</h2>
          <p>{{ t('landingFaqLead') }}</p>
        </div>
        <div class="land-faq__list land-reveal">
          <div
            v-for="(item, index) in faqs"
            :key="item.q"
            class="land-faq__item"
            :class="{ 'is-open': openFaq === index }"
          >
            <button
              type="button"
              class="land-faq__q"
              :aria-expanded="openFaq === index"
              @click="toggleFaq(index)"
            >
              <span>{{ t(item.q) }}</span>
              <span class="land-faq__icon" aria-hidden="true">{{ openFaq === index ? '−' : '+' }}</span>
            </button>
            <div v-show="openFaq === index" class="land-faq__a">
              <p>{{ t(item.a) }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <MarketingFooter
      :brand-name="brandName"
      :logo-url="branding.logo_url || ''"
      :contact-information="branding.contact_information || ''"
      :support-email="branding.support_email || ''"
    />
  </div>
</template>

<style scoped>
.land {
  --ink: #102a2e;
  --muted: #5b7378;
  --line: #d9e6e8;
  --yellow: #e54c10;
  --yellow-ink: #ffffff;
  --teal: #0f5c66;
  --deep: #0a2a3a;
  --shell: 960px;
  color: var(--ink);
  background: #f7fafb;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.land-shell,
.land-wrap {
  width: min(var(--shell), calc(100% - 1.5rem));
  margin: 0 auto;
}

.land-hero {
  position: relative;
  width: 100%;
  min-height: min(38rem, calc(100dvh - 4.5rem));
  display: grid;
  align-items: end;
  overflow: hidden;
  color: #fff;
  padding: 2.25rem 0 2.75rem;
}

.land-hero__media {
  position: absolute;
  inset: -3%;
  background: url('/images/hero-study.jpg') center / cover no-repeat;
  animation: land-hero-in 1.35s cubic-bezier(0.22, 1, 0.36, 1) both, land-drift 24s ease-in-out 1.3s infinite alternate;
  will-change: transform;
}

.land-hero__shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, rgba(8, 28, 34, 0.92) 0%, rgba(10, 42, 58, 0.62) 48%, rgba(10, 42, 58, 0.28) 100%),
    linear-gradient(180deg, rgba(8, 28, 34, 0.2) 0%, rgba(8, 28, 34, 0.78) 100%);
  pointer-events: none;
}

.land-hero__glow {
  position: absolute;
  width: min(48vw, 420px);
  height: min(48vw, 420px);
  left: -8%;
  bottom: 4%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(229, 76, 16, 0.38), transparent 68%);
  filter: blur(28px);
  pointer-events: none;
  animation: land-glow 10s ease-in-out infinite alternate;
}

.land-hero__inner {
  position: relative;
  z-index: 1;
}

.land-hero__inner > * {
  max-width: 42rem;
}

.land-rise {
  opacity: 0;
  animation: land-rise 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.land-hero__brand.land-rise { animation-delay: 160ms; }
.land-hero__title.land-rise { animation-delay: 360ms; }
.land-hero__sub.land-rise { animation-delay: 500ms; }
.land-hero__actions.land-rise { animation-delay: 640ms; }

.land-hero__brand {
  margin: 0 0 0.55rem;
  font-size: clamp(2rem, 6vw, 3.2rem);
  font-weight: 800;
  letter-spacing: -0.045em;
  line-height: 1.02;
  text-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
}

.land-hero__rule {
  display: block;
  width: 3rem;
  height: 3px;
  margin: 0 0 1rem;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--yellow), rgba(229, 76, 16, 0.12));
  transform-origin: left center;
  opacity: 0;
  animation: land-rule 900ms cubic-bezier(0.22, 1, 0.36, 1) 320ms both;
}

.land-hero__title {
  margin: 0 0 0.85rem;
  font-size: clamp(1.2rem, 2.6vw, 1.65rem);
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.3;
  max-width: 18ch;
}

.land-hero__title span {
  color: var(--yellow);
}

.land-hero__sub {
  margin: 0 0 1.5rem;
  max-width: 34ch;
  color: rgba(255, 255, 255, 0.88);
  font-size: 1.02rem;
  line-height: 1.55;
}

.land-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}

.land-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 48px;
  min-width: min(16rem, 100%);
  padding: 0 1.2rem;
  border-radius: 0.65rem;
  border: 0;
  font: inherit;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.land-btn--primary {
  background: var(--yellow);
  color: var(--yellow-ink);
  box-shadow: 0 10px 24px rgba(229, 76, 16, 0.28);
}

.land-btn--ghost {
  background: transparent;
  color: #fff;
  border: 1.5px solid rgba(255, 255, 255, 0.55);
  min-width: min(12rem, 100%);
}

.land-btn--solid {
  background: var(--teal);
  color: #fff;
  margin-top: 0.35rem;
}

.land-loader {
  display: grid;
  place-items: center;
  min-height: 8rem;
}

.land-section {
  padding: 2.5rem 0 2.75rem;
}

.land-section__head {
  max-width: 40rem;
  margin-bottom: 1.35rem;
}

.land-section__head h2,
.land-split__copy h2 {
  margin: 0.2rem 0 0.45rem;
  font-size: clamp(1.45rem, 3vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.land-section__head p,
.land-split__copy > p {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
}

.land-section__head--light h2,
.land-section__head--light p {
  color: #fff;
}

.land-section__head--light p {
  opacity: 0.86;
}

.land-kicker {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--teal);
}

.land-kicker--light {
  color: rgba(229, 76, 16, 0.95);
}

.land-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.15rem;
}

.land-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 42px;
  padding: 0 0.9rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: var(--muted);
  font: inherit;
  font-size: 0.86rem;
  font-weight: 750;
  cursor: pointer;
}

.land-chip small {
  opacity: 0.75;
  font-weight: 700;
}

.land-chip.is-active {
  background: var(--teal);
  border-color: var(--teal);
  color: #fff;
}

.land-course-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.95rem;
}

@media (min-width: 720px) {
  .land-course-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1040px) {
  .land-course-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.land-empty {
  margin: 0;
  color: var(--muted);
}

.land-see-all {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 1.25rem;
  min-height: 44px;
  color: var(--teal);
  font-weight: 800;
  text-decoration: none;
}

.land-courses {
  background:
    radial-gradient(circle at top right, rgba(15, 92, 102, 0.06), transparent 40%),
    #f7fafb;
}

.land-split {
  display: grid;
  gap: 1.5rem;
  align-items: center;
}

@media (min-width: 860px) {
  .land-split {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
    gap: 2rem;
  }

  .land-split--flip {
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  }
}

.land-split__copy {
  display: grid;
  gap: 0.85rem;
  justify-items: start;
}

.land-media {
  margin: 0;
  border-radius: 1.1rem;
  overflow: hidden;
  aspect-ratio: 16 / 10;
  background: #d9e6e8;
  box-shadow: 0 18px 40px rgba(16, 42, 46, 0.12);
}

.land-media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: land-drift 22s ease-in-out infinite alternate;
  transform-origin: center;
}

.land-mocks {
  background: #fff;
}

.land-skill-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  width: 100%;
}

.land-skill {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 48px;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  background: #f7fafb;
  color: var(--ink);
  text-decoration: none;
  font-weight: 750;
  font-size: 0.92rem;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}

.land-skill:hover {
  transform: translateY(-2px);
  border-color: rgba(15, 92, 102, 0.35);
  background: #fff;
}

.land-skill__dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: var(--yellow);
  box-shadow: 0 0 0 4px rgba(229, 76, 16, 0.18);
  flex: 0 0 auto;
}

.land-results {
  background:
    radial-gradient(circle at left bottom, rgba(229, 76, 16, 0.12), transparent 36%),
    #f7fafb;
}

.land-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.35rem;
}

.land-stat {
  display: grid;
  gap: 0.2rem;
  padding: 0.9rem 0.95rem;
  border-radius: 0.85rem;
  background: #fff;
  border: 1px solid var(--line);
}

.land-stat strong {
  font-size: clamp(1.35rem, 3vw, 1.8rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--teal);
}

.land-stat span {
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 650;
}

.land-stories {
  position: relative;
  width: 100%;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(145deg, #0b3d36 0%, #0f5c66 48%, #0a2a3a 100%);
  padding: 2.75rem 0 3rem;
}

.land-stories__bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 12% 20%, rgba(229, 76, 16, 0.16), transparent 34%),
    radial-gradient(circle at 88% 70%, rgba(255, 255, 255, 0.08), transparent 36%);
  pointer-events: none;
}

.land-stories__wrap {
  position: relative;
  z-index: 1;
}

.land-stories__stage {
  display: grid;
  gap: 1.25rem;
  align-items: center;
}

@media (min-width: 860px) {
  .land-stories__stage {
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
    gap: 1.75rem;
  }
}

.land-stories__photo {
  margin: 0;
  border-radius: 1.1rem;
  overflow: hidden;
  aspect-ratio: 1;
  max-width: 28rem;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.28);
  background: rgba(255, 255, 255, 0.08);
}

.land-stories__photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.land-stories__quote {
  margin: 0;
}

.land-stories__quote p {
  margin: 0 0 1.1rem;
  font-size: clamp(1.05rem, 2.2vw, 1.35rem);
  line-height: 1.55;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.land-stories__quote footer {
  display: grid;
  gap: 0.15rem;
}

.land-stories__quote strong {
  font-size: 1rem;
}

.land-stories__quote span {
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.88rem;
}

.land-stories__thumbs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.55rem;
  margin-top: 1.25rem;
  overflow-x: auto;
  padding-bottom: 0.2rem;
  scrollbar-width: thin;
}

.land-stories__thumb {
  flex: 0 0 auto;
  width: 3.4rem;
  height: 3.4rem;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
  cursor: pointer;
  opacity: 0.72;
  transition: transform 180ms ease, opacity 180ms ease, border-color 180ms ease;
}

.land-stories__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.land-stories__thumb.is-active {
  opacity: 1;
  border-color: var(--yellow);
  transform: translateY(-2px);
}

.land-faq {
  background: #fff;
}

.land-faq__list {
  display: grid;
  gap: 0.65rem;
}

.land-faq__item {
  border: 1px solid var(--line);
  border-radius: 0.9rem;
  background: #f7fafb;
  overflow: hidden;
  transition: border-color 180ms ease, background 180ms ease;
}

.land-faq__item.is-open {
  border-color: rgba(15, 92, 102, 0.35);
  background: #fff;
}

.land-faq__q {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 52px;
  padding: 0.95rem 1rem;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-weight: 750;
  text-align: left;
  cursor: pointer;
}

.land-faq__icon {
  flex: 0 0 auto;
  width: 1.6rem;
  height: 1.6rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(15, 92, 102, 0.1);
  color: var(--teal);
  font-size: 1.1rem;
  line-height: 1;
}

.land-faq__a {
  padding: 0 1rem 1rem;
}

.land-faq__a p {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

.land-cta {
  position: relative;
  overflow: hidden;
  color: #fff;
  min-height: min(26rem, 70vw);
  display: grid;
  align-items: end;
  padding: 3rem 0;
}

.land-cta__media,
.land-cta__shade {
  position: absolute;
  inset: 0;
}

.land-cta__media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: land-drift 28s ease-in-out infinite alternate;
}

.land-cta__shade {
  background:
    linear-gradient(115deg, rgba(8, 28, 34, 0.92) 0%, rgba(10, 42, 58, 0.55) 55%, rgba(10, 42, 58, 0.28) 100%),
    linear-gradient(180deg, rgba(8, 28, 34, 0.2), rgba(8, 28, 34, 0.72));
}

.land-cta__inner {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  max-width: min(var(--shell), calc(100% - 1.5rem));
}

.land-cta__inner h2 {
  margin: 0;
  max-width: 16ch;
  font-size: clamp(1.55rem, 3.4vw, 2.25rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.land-cta__inner > p {
  margin: 0 0 0.35rem;
  max-width: 36ch;
  color: rgba(255, 255, 255, 0.86);
  line-height: 1.5;
}

.land-reveal {
  opacity: 0;
  transform: translateY(18px);
  transition: opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
}

.land-reveal.is-in {
  opacity: 1;
  transform: none;
}

.land-fade-enter-active,
.land-fade-leave-active {
  transition: opacity 280ms ease, transform 280ms ease;
}

.land-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.land-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@keyframes land-hero-in {
  from { opacity: 0; transform: scale(1.08); }
  to { opacity: 1; transform: scale(1.02); }
}

@keyframes land-drift {
  from { transform: scale(1.02) translate3d(0, 0, 0); }
  to { transform: scale(1.07) translate3d(-1.2%, -0.8%, 0); }
}

@keyframes land-rise {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: none; }
}

@keyframes land-rule {
  from { opacity: 0; transform: scaleX(0.2); }
  to { opacity: 1; transform: scaleX(1); }
}

@keyframes land-glow {
  from { transform: translate3d(0, 0, 0); opacity: 0.55; }
  to { transform: translate3d(8%, -6%, 0); opacity: 0.85; }
}

@media (prefers-reduced-motion: reduce) {
  .land-hero__media,
  .land-hero__glow,
  .land-rise,
  .land-hero__rule,
  .land-media img,
  .land-cta__media img {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }

  .land-reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>
