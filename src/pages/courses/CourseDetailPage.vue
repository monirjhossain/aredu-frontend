<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CourseCard from '../../components/marketing/CourseCard.vue'
import MarketingFooter from '../../components/marketing/MarketingFooter.vue'
import { http } from '../../services/http'
import { cacheGet, cacheSet } from '../../services/publicCache'
import { apiError } from '../../utils/apiError'
import { useAuthStore } from '../../stores/auth'
import { useCartStore } from '../../stores/cart'
import { useLocaleStore } from '../../stores/locale'
import { useUiStore } from '../../stores/ui'
import {
  discountPct,
  durationLabel,
  examLabel,
  hasDiscount,
  money,
  sellingPrice,
} from '../../utils/courseDisplay'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const cart = useCartStore()
const localeStore = useLocaleStore()
const ui = useUiStore()

const course = ref(null)
const relatedCourses = ref([])
const branding = ref({
  platform_name: 'AR Education',
  logo_url: null,
  contact_information: '',
  support_email: '',
  currency: 'BDT',
})
const loading = ref(true)
const message = ref('')
const purchaseNote = ref('')
const purchasing = ref(false)
const couponCode = ref('')
const openSections = ref([])
const relatedTrack = ref(null)

const exam = computed(() => (course.value ? examLabel(course.value, t) : ''))
const duration = computed(() => (course.value ? durationLabel(course.value, t) : null))
const price = computed(() => (course.value ? sellingPrice(course.value) : ''))
const off = computed(() => (course.value ? discountPct(course.value) : null))
const currency = computed(() => branding.value.currency || 'BDT')
const brandName = computed(() => branding.value.platform_name || t('appName'))

const lessonCount = computed(() => {
  if (!course.value?.sections) return 0
  return course.value.sections.reduce((sum, section) => sum + (section.lessons?.length || 0), 0)
})

const learnersLabel = computed(() => {
  const count = course.value?.learners_count
  if (count == null || count === '') return ''
  return t('learnersCount', { count: formatInt(count) })
})

const classStartLabel = computed(() => {
  const date = course.value?.class_starts_on
  if (!date) return ''
  return t('classStartsOn', { date: formatShortDate(date) })
})

const batchLabel = computed(() => {
  const batch = course.value?.batch_number
  if (batch == null || batch === '') return ''
  return t('batchNumber', { number: formatInt(batch) })
})

const seatsLabel = computed(() => {
  const seats = course.value?.seats_left
  if (seats == null || seats === '') return ''
  return t('seatsLeft', { count: formatInt(seats) })
})

const offerLabel = computed(() => {
  const days = course.value?.offer_days_left
  if (days == null) return ''
  if (Number(days) <= 0) return t('offerEndsToday')
  return t('offerDaysLeft', { count: formatInt(days) })
})

function formatInt(value) {
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Intl.NumberFormat(locale).format(Number(value || 0))
}

function formatShortDate(value) {
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  })
}

function lessonTime(seconds) {
  const total = Number(seconds) || 0
  if (total >= 60 && total % 60 === 0) {
    return t('minutesCount', { count: total / 60 })
  }
  return t('secondsCount', { count: total })
}

async function loadBranding() {
  const cachedLanding = cacheGet('landing')
  if (cachedLanding?.branding) {
    branding.value = { ...branding.value, ...cachedLanding.branding }
    return
  }
  try {
    const { data } = await http.get('/settings/public', { skipErrorToast: true, skipLoading: true })
    branding.value = { ...branding.value, ...(data.data || {}) }
  } catch {
    // Footer still renders with defaults.
  }
}

async function loadRelated(current) {
  relatedCourses.value = []
  if (!current?.id) return

  const pick = (rows) => (rows || []).filter((item) => item.id !== current.id).slice(0, 8)
  const fromLanding = pick(cacheGet('landing')?.courses || [])
  if (fromLanding.length) relatedCourses.value = fromLanding.slice(0, 8)

  try {
    const params = {
      exam_type: current.exam_type || undefined,
      category_id: current.category?.id || undefined,
      page: 1,
    }
    const { data } = await http.get('/courses', {
      params,
      skipErrorToast: true,
      skipLoading: true,
    })
    let rows = pick(data.data)

    if (rows.length < 3 && current.exam_type && current.category?.id) {
      const { data: fallback } = await http.get('/courses', {
        params: { exam_type: current.exam_type, page: 1 },
        skipErrorToast: true,
        skipLoading: true,
      })
      const merged = [...rows]
      for (const item of pick(fallback.data)) {
        if (!merged.some((row) => row.id === item.id)) merged.push(item)
      }
      rows = merged
    }

    relatedCourses.value = rows.slice(0, 8)
  } catch {
    if (!relatedCourses.value.length) relatedCourses.value = []
  }
}

function scrollRelated(dir) {
  const el = relatedTrack.value
  if (!el) return
  const amount = Math.min(320, Math.round(el.clientWidth * 0.8))
  el.scrollBy({ left: dir * amount, behavior: 'smooth' })
}

async function load() {
  const slug = route.params.slug
  const cacheKey = `course:${slug}`
  const cached = cacheGet(cacheKey)
  loading.value = !cached
  message.value = ''
  purchaseNote.value = ''
  couponCode.value = ''
  relatedCourses.value = []
  if (cached) {
    course.value = cached
    openSections.value = cached.sections?.[0]?.id ? [cached.sections[0].id] : []
    loadRelated(cached)
  } else {
    course.value = null
    openSections.value = []
  }

  try {
    const { data } = await http.get(`/courses/${slug}`, { skipErrorToast: true, skipLoading: true })
    course.value = data.data
    cacheSet(cacheKey, course.value, 60_000)
    if (course.value?.sections?.length) {
      openSections.value = [course.value.sections[0].id]
    }
    loadRelated(course.value)
  } catch (error) {
    if (!course.value) {
      message.value = apiError(error).message || t('requestFailed')
    }
  } finally {
    loading.value = false
  }
}

const inCart = computed(() => (course.value?.id ? cart.has(course.value.id) : false))

function addToCart() {
  if (!course.value?.id || course.value.is_enrolled) return
  if (cart.has(course.value.id)) {
    ui.info(t('alreadyInCart'))
    return
  }
  cart.add(course.value)
  ui.success(t('addedToCart'))
}

async function purchase() {
  if (!auth.isAuthenticated) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  if (!course.value?.id) return
  purchasing.value = true
  purchaseNote.value = ''
  message.value = ''
  try {
    const payload = { course_ids: [course.value.id] }
    const code = couponCode.value.trim()
    if (code) payload.coupon_code = code
    const { data } = await http.post('/orders', payload, { skipErrorToast: true })
    const order = data.data
    cart.remove(course.value.id)
    if (order.status === 'paid') {
      purchaseNote.value = t('freeOrderActivated')
      ui.success(purchaseNote.value)
      course.value = { ...course.value, is_enrolled: true }
      const slug = course.value.slug || route.params.slug
      router.push({ name: 'learning-course', params: { slug } })
      return
    }
    purchaseNote.value = Number(order.total) <= 0.009
      ? t('orderCreatedAwaitAdmin', { number: order.order_number })
      : t('orderCreatedPayFromOrders', {
        number: order.order_number,
        total: order.total,
      })
    ui.success(purchaseNote.value)
    router.push({ name: 'order-detail', params: { id: order.id } })
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    purchasing.value = false
  }
}

function canWatch(lesson) {
  return course.value?.is_enrolled || lesson.is_free_preview
}

function watchLesson(lesson) {
  if (!auth.isAuthenticated) {
    router.push({
      name: 'login',
      query: { redirect: `/courses/${route.params.slug}/lessons/${lesson.id}` },
    })
    return
  }
  router.push({
    name: 'lesson-player',
    params: { slug: route.params.slug, lessonId: lesson.id },
  })
}

onMounted(() => {
  loadBranding()
  load()
})
watch(() => route.params.slug, () => {
  loadBranding()
  load()
})
</script>

<template>
  <div class="site">
    <div class="site-wrap site-top">
      <router-link class="site-back" :to="{ name: 'courses' }">← {{ t('backToCourses') }}</router-link>
    </div>

    <div v-if="loading" class="site-wrap">
      <v-progress-linear indeterminate color="#f5c518" />
    </div>
    <div v-else-if="message" class="site-wrap">
      <v-alert type="error" variant="tonal">{{ message }}</v-alert>
    </div>

    <template v-else-if="course">
      <section class="site-hero">
        <div class="site-wrap site-hero__grid">
          <div
            class="site-hero__media"
            :style="course.thumbnail_url ? { backgroundImage: `url(${course.thumbnail_url})` } : undefined"
          >
            <span v-if="!course.thumbnail_url" class="site-hero__fallback">{{ course.title }}</span>
            <span class="site-hero__badge">
              <span class="site-hero__dot" aria-hidden="true" />
              {{ exam }}
            </span>
          </div>

          <div class="site-hero__copy">
            <p class="site-kicker">{{ course.category?.name || t('courses') }}</p>
            <h1>{{ course.title }}</h1>
            <p v-if="course.description" class="site-lead">{{ course.description }}</p>
            <div class="site-chips">
              <span>{{ exam }}</span>
              <span v-if="duration">{{ duration }}</span>
              <span>{{ lessonCount }} {{ t('lessons') }}</span>
            </div>
          </div>

          <aside class="site-buy">
            <div v-if="learnersLabel || classStartLabel" class="site-buy__topmeta">
              <div v-if="learnersLabel" class="site-buy__learners">
                <span class="site-buy__avatars" aria-hidden="true">
                  <span /><span /><span />
                </span>
                <span>{{ learnersLabel }}</span>
              </div>
              <span v-if="classStartLabel" class="site-buy__start">
                <span class="site-buy__start-dot" aria-hidden="true" />
                {{ classStartLabel }}
              </span>
            </div>

            <div v-if="batchLabel || seatsLabel" class="site-buy__chips">
              <span v-if="batchLabel" class="site-buy__chip">
                <v-icon size="14" icon="mdi-file-document-outline" />
                {{ batchLabel }}
              </span>
              <span v-if="seatsLabel" class="site-buy__chip">
                <v-icon size="14" icon="mdi-seat" />
                {{ seatsLabel }}
              </span>
            </div>

            <div class="site-buy__prices">
              <div class="site-buy__price-main">
                <strong>{{ money(price, currency) }}</strong>
                <s v-if="hasDiscount(course)">{{ money(course.price, currency) }}</s>
              </div>
              <span v-if="off" class="site-buy__off">{{ off }}% {{ t('landingOff') }}</span>
            </div>

            <div v-if="offerLabel" class="site-buy__offer">
              <v-icon size="15" icon="mdi-timer-sand" />
              <span>{{ offerLabel }}</span>
            </div>

            <p class="site-buy__note">{{ t('lifetimeAccessHint') }}</p>

            <template v-if="course.is_enrolled">
              <div class="site-buy__enrolled">{{ t('alreadyEnrolled') }}</div>
              <router-link
                class="site-btn site-btn--primary"
                :to="{ name: 'learning-course', params: { slug: course.slug } }"
              >
                {{ t('openCourse') }}
              </router-link>
            </template>
            <template v-else>
              <label class="site-buy__coupon">
                <span>{{ t('couponCode') }}</span>
                <input
                  v-model="couponCode"
                  type="text"
                  maxlength="50"
                  :placeholder="t('couponCodePlaceholder')"
                  autocomplete="off"
                  :disabled="purchasing"
                >
              </label>
              <div class="site-buy__actions">
                <button
                  type="button"
                  class="site-btn site-btn--primary"
                  :disabled="purchasing"
                  @click="purchase"
                >
                  {{ purchasing ? t('loading') : (auth.isAuthenticated ? t('purchase') : t('loginToPurchase')) }}
                </button>
                <button
                  v-if="!inCart"
                  type="button"
                  class="site-btn site-btn--ghost"
                  @click="addToCart"
                >
                  {{ t('addToCart') }}
                </button>
                <router-link
                  v-else
                  class="site-btn site-btn--ghost"
                  :to="{ name: 'cart' }"
                >
                  {{ t('viewCart') }}
                </router-link>
              </div>
              <p v-if="purchaseNote" class="site-buy__info">{{ purchaseNote }}</p>
            </template>
          </aside>
        </div>
      </section>

      <section class="site-section">
        <div class="site-wrap site-split">
          <div>
            <h2>{{ t('aboutCourse') }}</h2>
            <p class="site-body">{{ course.description || t('landingAboutFallback') }}</p>

            <h2 class="mt-section">{{ t('teachers') }}</h2>
            <p v-if="!course.teachers?.length" class="site-empty">{{ t('noListedTeachers') }}</p>
            <div v-else class="site-teachers">
              <div v-for="teacher in course.teachers" :key="teacher.id" class="site-teacher">
                <span class="site-teacher__avatar">{{ teacher.name?.charAt(0) || '?' }}</span>
                <div>
                  <strong>{{ teacher.name }}</strong>
                  <small>{{ t('roleTeacher') }}</small>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="site-curriculum-head">
              <h2>{{ t('curriculum') }}</h2>
              <span>{{ course.sections?.length || 0 }} {{ t('sections') }} · {{ lessonCount }} {{ t('lessons') }}</span>
            </div>
            <p v-if="!course.sections?.length" class="site-empty">{{ t('noPublicLessons') }}</p>
            <div v-else class="site-modules">
              <details
                v-for="section in course.sections"
                :key="section.id"
                class="site-module"
                :open="openSections.includes(section.id)"
              >
                <summary>
                  <span>{{ section.position }}. {{ section.title }}</span>
                  <small>{{ section.lessons?.length || 0 }} {{ t('lessons') }}</small>
                </summary>
                <ul>
                  <li v-for="lesson in section.lessons" :key="lesson.id">
                    <div>
                      <strong>{{ lesson.position }}. {{ lesson.title }}</strong>
                      <span>
                        {{ lessonTime(lesson.duration_seconds) }}
                        <em v-if="lesson.is_free_preview"> · {{ t('freePreview') }}</em>
                      </span>
                    </div>
                    <button
                      v-if="canWatch(lesson)"
                      type="button"
                      class="site-btn site-btn--ghost"
                      @click="watchLesson(lesson)"
                    >
                      {{ t('watchLesson') }}
                    </button>
                  </li>
                </ul>
              </details>
            </div>
          </div>
        </div>
      </section>

      <section v-if="relatedCourses.length" class="site-section site-related">
        <div class="site-wrap">
          <div class="site-related__head">
            <div>
              <p class="site-kicker">{{ t('courses') }}</p>
              <h2>{{ t('relatedCourses') }}</h2>
              <p>{{ t('relatedCoursesLead') }}</p>
            </div>
            <div class="site-related__nav">
              <button type="button" class="site-related__btn" :aria-label="t('previous')" @click="scrollRelated(-1)">
                <v-icon icon="mdi-chevron-left" size="22" />
              </button>
              <button type="button" class="site-related__btn" :aria-label="t('next')" @click="scrollRelated(1)">
                <v-icon icon="mdi-chevron-right" size="22" />
              </button>
            </div>
          </div>

          <div class="site-related__stage">
            <div ref="relatedTrack" class="site-related__track" tabindex="0">
              <div class="site-related__rail">
                <div v-for="item in relatedCourses" :key="item.id" class="site-related__card">
                  <CourseCard :course="item" :currency="currency" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <MarketingFooter
      :brand-name="brandName"
      :logo-url="branding.logo_url || ''"
      :contact-information="branding.contact_information || ''"
      :support-email="branding.support_email || ''"
    />
  </div>
</template>

<style scoped>
.site {
  --ink: #0b1b34;
  --muted: #5b6b7c;
  --yellow: #f5c518;
  --line: #e6ebf2;
  --paper: #f7f9fc;
  color: var(--ink);
  background: #fff;
  min-height: 100%;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.site-wrap {
  width: min(960px, calc(100% - 2rem));
  margin: 0 auto;
}

.site-top {
  padding: 1.1rem 0 0;
}

.site-back {
  color: var(--muted);
  text-decoration: none;
  font-weight: 650;
}

.site-back:hover {
  color: var(--ink);
}

.site-hero {
  padding: 1.25rem 0 2.5rem;
  background: linear-gradient(180deg, #eaf2ff 0%, #ffffff 70%);
}

.site-hero__grid {
  display: grid;
  gap: 1.25rem;
}

@media (min-width: 980px) {
  .site-hero__grid {
    grid-template-columns: 1.15fr 1fr 0.85fr;
    align-items: start;
  }
}

.site-hero__media {
  position: relative;
  min-height: 240px;
  border-radius: 1.1rem;
  overflow: hidden;
  background:
    linear-gradient(145deg, #0b3d36 0%, #145c4f 45%, #0a2a3a 100%) center / cover no-repeat;
  display: grid;
  place-items: center;
  box-shadow: 0 16px 40px rgba(11, 27, 52, 0.12);
}

.site-hero__fallback {
  max-width: 80%;
  text-align: center;
  color: #fff;
  font-size: clamp(1.3rem, 3vw, 1.8rem);
  font-weight: 800;
  line-height: 1.2;
}

.site-hero__badge {
  position: absolute;
  top: 0.9rem;
  right: 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: #fff;
  font-size: 0.75rem;
  font-weight: 700;
}

.site-hero__dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--yellow);
}

.site-kicker {
  margin: 0 0 0.5rem;
  color: #e85d4c;
  font-weight: 750;
  font-size: 0.9rem;
}

.site-hero__copy h1 {
  margin: 0 0 0.75rem;
  font-size: clamp(1.7rem, 4vw, 2.4rem);
  line-height: 1.15;
  letter-spacing: -0.03em;
  font-weight: 800;
}

.site-lead {
  margin: 0 0 1rem;
  color: var(--muted);
  line-height: 1.6;
  font-size: 1.02rem;
}

.site-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.site-chips span {
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: #fff;
  border: 1px solid var(--line);
  font-size: 0.84rem;
  font-weight: 650;
  color: var(--muted);
}

.site-buy {
  padding: 1.15rem;
  border-radius: 1rem;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 14px 36px rgba(11, 27, 52, 0.08);
  display: grid;
  gap: 0.75rem;
  position: sticky;
  top: 5rem;
}

.site-buy__topmeta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.site-buy__learners {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #475467;
  font-size: 0.8rem;
  font-weight: 700;
}

.site-buy__avatars {
  display: inline-flex;
  align-items: center;
}

.site-buy__avatars span {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 1.5px solid #fff;
  background: linear-gradient(135deg, #7dd3c7, #14919b);
}

.site-buy__avatars span + span {
  margin-left: -0.28rem;
}

.site-buy__avatars span:nth-child(2) {
  background: linear-gradient(135deg, #f5c518, #e8a317);
}

.site-buy__avatars span:nth-child(3) {
  background: linear-gradient(135deg, #94a3b8, #64748b);
}

.site-buy__start {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.28rem 0.6rem;
  border-radius: 999px;
  background: #fff8e1;
  color: #1f2a37;
  font-size: 0.74rem;
  font-weight: 700;
}

.site-buy__start-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--yellow);
  flex: 0 0 auto;
}

.site-buy__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.site-buy__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  min-height: 1.75rem;
  padding: 0.15rem 0.55rem;
  border-radius: 0.45rem;
  background: #f3f5f8;
  color: #475467;
  font-size: 0.76rem;
  font-weight: 700;
}

.site-buy__prices {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;
}

.site-buy__price-main {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
}

.site-buy__prices strong {
  font-size: 1.55rem;
  font-weight: 800;
}

.site-buy__prices s {
  color: #98a2b3;
  font-size: 0.95rem;
}

.site-buy__off {
  padding: 0.35rem 0.65rem 0.35rem 0.9rem;
  background: var(--yellow);
  color: #1a1400;
  font-size: 0.78rem;
  font-weight: 800;
  clip-path: polygon(12px 0%, 100% 0%, 100% 100%, 12px 100%, 12px 75%, 0 50%, 12px 25%);
  white-space: nowrap;
}

.site-buy__offer {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.5rem 0.65rem;
  border-radius: 0.5rem;
  background: #fff8e1;
  color: #8a6a00;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.35;
}

.site-buy__note,
.site-buy__info {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.45;
}

.site-buy__enrolled {
  padding: 0.7rem 0.8rem;
  border-radius: 0.65rem;
  background: #e8f8ef;
  color: #146c43;
  font-weight: 700;
  font-size: 0.92rem;
}

.site-buy__coupon {
  display: grid;
  gap: 0.35rem;
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 700;
}

.site-buy__coupon input {
  min-height: 44px;
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 0.55rem;
  padding: 0.55rem 0.75rem;
  font: inherit;
  font-weight: 600;
  color: var(--ink);
  background: #fff;
  box-sizing: border-box;
}

.site-buy__coupon input:disabled {
  opacity: 0.7;
}

.site-buy__actions {
  display: grid;
  gap: 0.55rem;
}

.site-buy__actions .site-btn--ghost {
  width: 100%;
  min-height: 2.85rem;
  font-size: inherit;
}

.site-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.85rem;
  padding: 0 1rem;
  border-radius: 0.55rem;
  border: 0;
  font: inherit;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.site-btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

.site-btn--primary {
  width: 100%;
  background: #f5c518;
  color: #1a1400;
  box-shadow: 0 10px 24px rgba(245, 197, 24, 0.28);
}

.site-btn--ghost {
  min-height: 2.2rem;
  padding: 0 0.75rem;
  background: #eef2f7;
  color: var(--ink);
  font-size: 0.82rem;
}

.site-section {
  padding: 0 0 4rem;
  background: var(--paper);
}

.site-split {
  display: grid;
  gap: 2rem;
  padding-top: 2rem;
}

@media (min-width: 980px) {
  .site-split {
    grid-template-columns: 0.9fr 1.1fr;
  }
}

.site-section h2 {
  margin: 0 0 0.75rem;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.mt-section {
  margin-top: 2rem !important;
}

.site-body {
  margin: 0;
  color: var(--muted);
  line-height: 1.7;
  font-size: 1.02rem;
}

.site-empty {
  margin: 0;
  color: var(--muted);
}

.site-teachers {
  display: grid;
  gap: 0.75rem;
}

.site-teacher {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 0.95rem;
  border-radius: 0.85rem;
  background: #fff;
  border: 1px solid var(--line);
}

.site-teacher__avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #0b1b34;
  color: #fff;
  font-weight: 800;
}

.site-teacher strong {
  display: block;
  font-size: 0.98rem;
}

.site-teacher small {
  color: var(--muted);
}

.site-curriculum-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: end;
  margin-bottom: 0.85rem;
}

.site-curriculum-head span {
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 600;
}

.site-modules {
  display: grid;
  gap: 0.75rem;
}

.site-module {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 0.9rem;
  overflow: hidden;
}

.site-module summary {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.05rem;
  cursor: pointer;
  font-weight: 750;
  list-style: none;
}

.site-module summary::-webkit-details-marker {
  display: none;
}

.site-module summary small {
  color: var(--muted);
  font-weight: 600;
}

.site-module ul {
  margin: 0;
  padding: 0 1.05rem 1.05rem;
  list-style: none;
  display: grid;
  gap: 0.65rem;
}

.site-module li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 0.8rem;
  border-radius: 0.7rem;
  background: #f5f7fa;
}

.site-module li strong {
  display: block;
  font-size: 0.95rem;
}

.site-module li span {
  color: var(--muted);
  font-size: 0.82rem;
}

.site-module li em {
  font-style: normal;
  color: #e85d4c;
  font-weight: 700;
}

.site-related {
  background:
    radial-gradient(circle at top right, rgba(15, 92, 102, 0.06), transparent 42%),
    #f7f9fc;
  padding: 2.25rem 0 2.75rem;
}

.site-related__head {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 0.85rem;
  margin-bottom: 1.15rem;
}

.site-related__head h2 {
  margin: 0.15rem 0 0.35rem;
}

.site-related__head p {
  margin: 0;
  color: var(--muted);
  max-width: 40ch;
  line-height: 1.45;
}

.site-related__nav {
  display: flex;
  gap: 0.45rem;
}

.site-related__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(11, 27, 52, 0.05);
}

.site-related__btn:hover {
  border-color: rgba(15, 92, 102, 0.35);
  color: #0f5c66;
}

.site-related__stage {
  position: relative;
  margin: 0 -0.15rem;
}

.site-related__stage::before,
.site-related__stage::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0.75rem;
  width: 1.25rem;
  z-index: 1;
  pointer-events: none;
}

.site-related__stage::before {
  left: 0;
  background: linear-gradient(90deg, #f7f9fc, transparent);
}

.site-related__stage::after {
  right: 0;
  background: linear-gradient(270deg, #f7f9fc, transparent);
}

.site-related__track {
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 0.35rem 0.15rem 1rem;
}

.site-related__track::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.site-related__rail {
  display: flex;
  gap: 1rem;
  width: max-content;
  padding-right: 0.35rem;
}

.site-related__card {
  flex: 0 0 min(260px, 78vw);
  scroll-snap-align: start;
  min-width: 0;
}

@media (min-width: 720px) {
  .site-related__card {
    flex-basis: 280px;
  }
}

.site-related__card :deep(.m-course) {
  height: 100%;
  box-shadow: 0 10px 24px rgba(11, 27, 52, 0.07);
}
</style>
