<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { useAuthStore } from '../../stores/auth'
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
const ui = useUiStore()

const course = ref(null)
const loading = ref(true)
const message = ref('')
const purchaseNote = ref('')
const purchasing = ref(false)
const openSections = ref([])

const exam = computed(() => (course.value ? examLabel(course.value, t) : ''))
const duration = computed(() => (course.value ? durationLabel(course.value, t) : null))
const price = computed(() => (course.value ? sellingPrice(course.value) : ''))
const off = computed(() => (course.value ? discountPct(course.value) : null))
const currency = computed(() => 'BDT')

const lessonCount = computed(() => {
  if (!course.value?.sections) return 0
  return course.value.sections.reduce((sum, section) => sum + (section.lessons?.length || 0), 0)
})

function lessonTime(seconds) {
  const total = Number(seconds) || 0
  if (total >= 60 && total % 60 === 0) {
    return t('minutesCount', { count: total / 60 })
  }
  return t('secondsCount', { count: total })
}

async function load() {
  loading.value = true
  message.value = ''
  purchaseNote.value = ''
  course.value = null
  openSections.value = []
  try {
    const { data } = await http.get(`/courses/${route.params.slug}`, { skipErrorToast: true })
    course.value = data.data
    if (course.value?.sections?.length) {
      openSections.value = [course.value.sections[0].id]
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
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
    const { data } = await http.post('/orders', { course_ids: [course.value.id] }, { skipErrorToast: true })
    const order = data.data
    purchaseNote.value = t('orderCreatedPayFromOrders', {
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

onMounted(load)
watch(() => route.params.slug, load)
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
            <div class="site-buy__prices">
              <strong>{{ money(price, currency) }}</strong>
              <s v-if="hasDiscount(course)">{{ money(course.price, currency) }}</s>
              <span v-if="off" class="site-buy__off">{{ off }}% {{ t('landingOff') }}</span>
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
              <button
                type="button"
                class="site-btn site-btn--primary"
                :disabled="purchasing"
                @click="purchase"
              >
                {{ purchasing ? t('loading') : (auth.isAuthenticated ? t('purchase') : t('loginToPurchase')) }}
              </button>
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
    </template>
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
  gap: 0.85rem;
  position: sticky;
  top: 5rem;
}

.site-buy__prices {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.site-buy__prices strong {
  font-size: 1.55rem;
  font-weight: 800;
}

.site-buy__prices s {
  color: #98a2b3;
}

.site-buy__off {
  padding: 0.35rem 0.65rem 0.35rem 0.9rem;
  background: var(--yellow);
  color: #1a1400;
  font-size: 0.78rem;
  font-weight: 800;
  clip-path: polygon(12px 0%, 100% 0%, 100% 100%, 12px 100%, 12px 75%, 0 50%, 12px 25%);
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
</style>
