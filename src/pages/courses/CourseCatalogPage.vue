<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import CourseCard from '../../components/marketing/CourseCard.vue'
import MarketingFooter from '../../components/marketing/MarketingFooter.vue'
import SearchSparkIcon from '../../components/SearchSparkIcon.vue'
import TypedSearchPlaceholder from '../../components/TypedSearchPlaceholder.vue'
import { http } from '../../services/http'
import { cacheGet, cacheKey, cacheSet } from '../../services/publicCache'
import { apiError } from '../../utils/apiError'

const props = defineProps({
  freeOnly: { type: Boolean, default: false },
})

const { t } = useI18n()
const route = useRoute()

const isFreeCatalog = computed(() => props.freeOnly || !!route.meta.freeOnly)

const courses = ref([])
const relatedCourses = ref([])
const relatedTrack = ref(null)
const categories = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const search = ref(typeof route.query.search === 'string' ? route.query.search : '')
const searchFocused = ref(false)
const examType = ref(
  route.query.exam_type === 'academic' || route.query.exam_type === 'general'
    ? route.query.exam_type
    : 'all',
)
const categoryId = ref('')
const loading = ref(true)
const message = ref('')
const branding = ref({
  platform_name: '',
  logo_url: '',
  contact_information: '',
  support_email: '',
  currency: 'BDT',
})

const brandName = computed(() => branding.value.platform_name || t('appName'))
const currency = computed(() => branding.value.currency || 'BDT')
const pageTitle = computed(() => (isFreeCatalog.value ? t('freeCoursesTitle') : t('catalogTitle')))
const pageLead = computed(() => (isFreeCatalog.value ? t('freeCoursesLead') : t('catalogLead')))
const emptyLabel = computed(() => (isFreeCatalog.value ? t('noFreeCourses') : t('noPublicCourses')))
const showRelatedSlider = computed(() => isFreeCatalog.value && relatedCourses.value.length > 0)
const placeholderFull = computed(() => t('catalogSearchPlaceholder'))
const showTypedPlaceholder = computed(() => !String(search.value || '').trim())
const showTypedCaret = computed(() => showTypedPlaceholder.value && !searchFocused.value)

const examFilters = computed(() => [
  { key: 'all', label: t('landingFilterAll') },
  { key: 'academic', label: t('academic') },
  { key: 'general', label: t('general') },
])

const hasActiveFilters = computed(() => (
  Boolean(search.value.trim())
  || examType.value !== 'all'
  || Boolean(categoryId.value)
))

const resultLabel = computed(() => {
  if (loading.value && !courses.value.length) return ''
  const count = meta.value.total || courses.value.length || 0
  return isFreeCatalog.value
    ? t('freeCoursesResults', { count })
    : t('catalogResults', { count })
})

function coursesCacheKey() {
  return cacheKey([
    isFreeCatalog.value ? 'free-courses' : 'courses',
    page.value,
    search.value || '',
    examType.value,
    categoryId.value || '',
  ])
}

async function loadCategories() {
  const cached = cacheGet('categories')
  if (cached) categories.value = cached
  const { data } = await http.get('/categories', { skipErrorToast: true, skipLoading: true })
  categories.value = data.data || []
  cacheSet('categories', categories.value, 5 * 60_000)
}

async function load({ silent = false } = {}) {
  const key = coursesCacheKey()
  const cached = cacheGet(key)
  if (cached) {
    courses.value = cached.courses || []
    meta.value = cached.meta || meta.value
    loading.value = false
    silent = true
    if (isFreeCatalog.value) loadRelatedCourses()
  }

  if (!silent) {
    loading.value = true
    message.value = ''
  }

  try {
    const { data } = await http.get('/courses', {
      params: {
        search: search.value || undefined,
        page: page.value,
        exam_type: examType.value === 'all' ? undefined : examType.value,
        category_id: categoryId.value ? categoryId.value : undefined,
        free: isFreeCatalog.value ? 1 : undefined,
      },
      skipErrorToast: true,
      skipLoading: true,
    })
    courses.value = data.data || []
    meta.value = data.meta || meta.value
    cacheSet(key, { courses: courses.value, meta: meta.value }, 60_000)
    if (isFreeCatalog.value) loadRelatedCourses()
  } catch (error) {
    if (!courses.value.length) {
      message.value = apiError(error).message || t('requestFailed')
    }
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  load()
}

function setExam(key) {
  examType.value = key
  applyFilters()
}

function setCategory(id) {
  categoryId.value = id === categoryId.value ? '' : id
  applyFilters()
}

function clearFilters() {
  search.value = ''
  examType.value = 'all'
  categoryId.value = ''
  applyFilters()
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

async function loadRelatedCourses() {
  if (!isFreeCatalog.value) {
    relatedCourses.value = []
    return
  }

  const freeIds = new Set(courses.value.map((item) => item.id))
  const fromLanding = (cacheGet('landing')?.courses || [])
    .filter((item) => !freeIds.has(item.id))
    .slice(0, 8)
  if (fromLanding.length) relatedCourses.value = fromLanding

  try {
    const { data } = await http.get('/courses', {
      params: { page: 1 },
      skipErrorToast: true,
      skipLoading: true,
    })
    relatedCourses.value = (data.data || [])
      .filter((item) => !freeIds.has(item.id))
      .slice(0, 8)
  } catch {
    if (!relatedCourses.value.length) relatedCourses.value = []
  }
}

function scrollRelated(direction) {
  const el = relatedTrack.value
  if (!el) return
  const step = Math.max(240, Math.floor(el.clientWidth * 0.75))
  el.scrollBy({ left: direction * step, behavior: 'smooth' })
}

function syncFromRoute() {
  search.value = typeof route.query.search === 'string' ? route.query.search : ''
  examType.value = route.query.exam_type === 'academic' || route.query.exam_type === 'general'
    ? route.query.exam_type
    : 'all'
  page.value = 1
  load()
}

watch(() => [route.query.search, route.query.exam_type], syncFromRoute)

onMounted(() => {
  Promise.all([
    loadBranding(),
    loadCategories().catch((error) => {
      if (!categories.value.length) {
        message.value = apiError(error).message || t('requestFailed')
      }
    }),
    load(),
  ])
})

watch(isFreeCatalog, (free) => {
  if (free) loadRelatedCourses()
  else relatedCourses.value = []
})
</script>

<template>
  <div class="cat">
    <section class="cat-hero" aria-label="Courses">
      <div class="cat-hero__media" aria-hidden="true" />
      <div class="cat-hero__shade" aria-hidden="true" />
      <div class="cat-hero__glow" aria-hidden="true" />
      <div class="cat-wrap cat-hero__inner">
        <p class="cat-hero__brand cat-rise">{{ brandName }}</p>
        <span class="cat-hero__rule" aria-hidden="true" />
        <h1 class="cat-rise">{{ pageTitle }}</h1>
        <p class="cat-hero__lead cat-rise">{{ pageLead }}</p>
      </div>
    </section>

    <section class="cat-body">
      <div class="cat-wrap">
        <form class="cat-panel cat-rise" @submit.prevent="applyFilters">
          <div class="cat-search">
            <label class="cat-search__field">
              <span class="cat-search__icon" aria-hidden="true">
                <SearchSparkIcon :size="18" />
              </span>
              <TypedSearchPlaceholder
                :text="placeholderFull"
                :visible="showTypedPlaceholder"
                :show-caret="showTypedCaret"
                pad-left="2.35rem"
                pad-right="0.8rem"
              />
              <input
                v-model="search"
                type="search"
                :aria-label="placeholderFull"
                autocomplete="off"
                @focus="searchFocused = true"
                @blur="searchFocused = false"
              >
            </label>
            <button type="submit" class="cat-btn">{{ t('search') }}</button>
          </div>

          <div class="cat-filters" role="tablist" :aria-label="t('courses')">
            <button
              v-for="chip in examFilters"
              :key="chip.key"
              type="button"
              class="cat-chip"
              :class="{ 'is-active': examType === chip.key }"
              role="tab"
              :aria-selected="examType === chip.key"
              @click="setExam(chip.key)"
            >
              {{ chip.label }}
            </button>
          </div>

          <div v-if="categories.length" class="cat-cats">
            <button
              v-for="cat in categories"
              :key="cat.id"
              type="button"
              class="cat-cat"
              :class="{ 'is-active': String(categoryId) === String(cat.id) }"
              @click="setCategory(cat.id)"
            >
              {{ cat.name }}
            </button>
          </div>
        </form>

        <div class="cat-meta">
          <p v-if="resultLabel" class="cat-meta__count">{{ resultLabel }}</p>
          <button
            v-if="hasActiveFilters"
            type="button"
            class="cat-meta__clear"
            @click="clearFilters"
          >
            {{ t('clearFilters') }}
          </button>
        </div>

        <div v-if="loading && !courses.length" class="cat-loader">
          <v-progress-circular indeterminate color="#f5c518" size="36" />
        </div>
        <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
        <div v-else-if="!courses.length" class="cat-empty">
          <span class="cat-empty__mark" aria-hidden="true" />
          <p>{{ emptyLabel }}</p>
          <button v-if="hasActiveFilters" type="button" class="cat-btn cat-btn--ghost" @click="clearFilters">
            {{ t('clearFilters') }}
          </button>
        </div>
        <div v-else class="cat-grid" :class="{ 'is-refreshing': loading }">
          <CourseCard
            v-for="(course, index) in courses"
            :key="course.id"
            :course="course"
            :currency="currency"
            class="cat-card"
            :style="{ '--i': index }"
          />
        </div>

        <div v-if="!loading && meta.last_page > 1" class="cat-pager">
          <v-pagination
            v-model="page"
            :length="meta.last_page"
            density="comfortable"
            active-color="#0f5c66"
            @update:model-value="load"
          />
        </div>
      </div>
    </section>

    <section v-if="showRelatedSlider" class="cat-related">
      <div class="cat-wrap">
        <div class="cat-related__head">
          <div>
            <p class="cat-related__kicker">{{ t('courses') }}</p>
            <h2>{{ t('freeRelatedCourses') }}</h2>
            <p>{{ t('freeRelatedCoursesLead') }}</p>
          </div>
          <div class="cat-related__nav">
            <button type="button" class="cat-related__btn" :aria-label="t('previous')" @click="scrollRelated(-1)">
              <v-icon icon="mdi-chevron-left" size="22" />
            </button>
            <button type="button" class="cat-related__btn" :aria-label="t('next')" @click="scrollRelated(1)">
              <v-icon icon="mdi-chevron-right" size="22" />
            </button>
          </div>
        </div>

        <div class="cat-related__stage">
          <div ref="relatedTrack" class="cat-related__track" tabindex="0">
            <div class="cat-related__rail">
              <div v-for="item in relatedCourses" :key="item.id" class="cat-related__card">
                <CourseCard :course="item" :currency="currency" />
              </div>
            </div>
          </div>
        </div>

        <div class="cat-related__foot">
          <router-link class="cat-btn cat-btn--ghost" :to="{ name: 'courses' }">
            {{ t('viewAllCourses') }}
            <span aria-hidden="true">→</span>
          </router-link>
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
.cat {
  --ink: #102a2e;
  --muted: #5b7378;
  --line: #d9e6e8;
  --yellow: #f5c518;
  --yellow-ink: #1a1400;
  --teal: #0f5c66;
  --deep: #0a2a3a;
  --shell: 1080px;
  color: var(--ink);
  background: #f7fafb;
  min-height: 100%;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.cat-wrap {
  width: min(var(--shell), calc(100% - 1.5rem));
  margin: 0 auto;
}

.cat-hero {
  position: relative;
  overflow: hidden;
  color: #fff;
  padding: 1.5rem 0 1.85rem;
  min-height: clamp(10.5rem, 24vw, 13.5rem);
  display: grid;
  align-items: end;
}

.cat-hero__media {
  position: absolute;
  inset: -4%;
  background: url('/images/hero-study.jpg') center / cover no-repeat;
  animation: cat-hero-in 1.1s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.cat-hero__shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, rgba(8, 28, 34, 0.94) 0%, rgba(10, 42, 58, 0.7) 52%, rgba(10, 42, 58, 0.42) 100%),
    linear-gradient(180deg, rgba(8, 28, 34, 0.18) 0%, rgba(8, 28, 34, 0.72) 100%);
  pointer-events: none;
}

.cat-hero__glow {
  position: absolute;
  width: min(50vw, 360px);
  height: min(50vw, 360px);
  left: -6%;
  bottom: -20%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245, 197, 24, 0.36), transparent 68%);
  filter: blur(24px);
  pointer-events: none;
  animation: cat-glow 9s ease-in-out infinite alternate;
}

.cat-hero__inner {
  position: relative;
  z-index: 1;
  max-width: 40rem;
}

.cat-hero__brand {
  margin: 0 0 0.25rem;
  font-size: clamp(1.35rem, 3.8vw, 1.9rem);
  font-weight: 800;
  letter-spacing: -0.045em;
  line-height: 1.05;
  text-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}

.cat-hero__rule {
  display: block;
  width: 2.25rem;
  height: 2px;
  margin: 0 0 0.55rem;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--yellow), rgba(245, 197, 24, 0.12));
  transform-origin: left center;
  opacity: 0;
  animation: cat-rule 850ms cubic-bezier(0.22, 1, 0.36, 1) 280ms both;
}

.cat-hero h1 {
  margin: 0 0 0.35rem;
  font-size: clamp(1.1rem, 2.4vw, 1.4rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.cat-hero__lead {
  margin: 0;
  max-width: 42ch;
  color: rgba(255, 255, 255, 0.88);
  font-size: 0.92rem;
  line-height: 1.45;
}

.cat-rise {
  opacity: 0;
  animation: cat-rise 850ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.cat-hero__brand.cat-rise { animation-delay: 120ms; }
.cat-hero h1.cat-rise { animation-delay: 280ms; }
.cat-hero__lead.cat-rise { animation-delay: 400ms; }
.cat-panel.cat-rise { animation-delay: 120ms; }

.cat-body {
  padding: 0 0 2.25rem;
  margin-top: -0.95rem;
  position: relative;
  z-index: 2;
}

.cat-panel {
  display: grid;
  gap: 0.55rem;
  padding: 0.65rem;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid rgba(217, 230, 232, 0.95);
  box-shadow: 0 10px 24px rgba(10, 42, 58, 0.08);
}

.cat-search {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.45rem;
}

@media (min-width: 720px) {
  .cat-search {
    grid-template-columns: 1fr auto;
    align-items: center;
  }
}

.cat-search__field {
  position: relative;
  display: block;
  min-width: 0;
  background: #fff;
  border-radius: 0.55rem;
  font-size: 0.92rem;
}

.cat-search__icon {
  position: absolute;
  left: 0.65rem;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  color: var(--ink);
  pointer-events: none;
  z-index: 2;
  overflow: visible;
}

.cat-search input {
  position: relative;
  z-index: 2;
  width: 100%;
  min-height: 2.55rem;
  padding: 0 0.8rem 0 2.35rem;
  border-radius: 0.55rem;
  border: 1px solid var(--line);
  background: transparent;
  font: inherit;
  font-size: 0.92rem;
  color: var(--ink);
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
  appearance: none;
}

.cat-search input::-webkit-search-decoration,
.cat-search input::-webkit-search-cancel-button,
.cat-search input::-webkit-search-results-button {
  display: none;
}

.cat-search input:focus {
  border-color: rgba(15, 92, 102, 0.45);
  box-shadow: 0 0 0 3px rgba(15, 92, 102, 0.1);
}

.cat-btn {
  min-height: 2.55rem;
  min-width: 5.75rem;
  padding: 0 0.95rem;
  border: 0;
  border-radius: 0.55rem;
  background: var(--yellow);
  color: var(--yellow-ink);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(245, 197, 24, 0.2);
}

.cat-btn--ghost {
  background: transparent;
  color: var(--teal);
  border: 1.5px solid rgba(15, 92, 102, 0.28);
  box-shadow: none;
  min-width: auto;
}

.cat-filters,
.cat-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.cat-chip,
.cat-cat {
  min-height: 2.1rem;
  padding: 0 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 650;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
}

.cat-chip.is-active {
  background: var(--deep);
  border-color: var(--deep);
  color: #fff;
}

.cat-cat {
  background: #eef6f7;
  border-color: transparent;
  color: var(--teal);
  font-weight: 700;
  font-size: 0.8rem;
}

.cat-cat.is-active {
  background: var(--teal);
  color: #fff;
}

.cat-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0.75rem 0 0.55rem;
  min-height: 1.25rem;
}

.cat-meta__count {
  margin: 0;
  color: var(--muted);
  font-weight: 650;
  font-size: 0.95rem;
}

.cat-meta__clear {
  border: 0;
  background: transparent;
  color: var(--teal);
  font: inherit;
  font-weight: 750;
  cursor: pointer;
  min-height: 2.5rem;
  padding: 0 0.35rem;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.cat-loader {
  display: grid;
  place-items: center;
  min-height: 10rem;
}

.cat-empty {
  display: grid;
  justify-items: start;
  gap: 0.85rem;
  padding: 2rem 1.25rem;
  border-radius: 1rem;
  background: #fff;
  border: 1px dashed var(--line);
}

.cat-empty__mark {
  width: 2.5rem;
  height: 3px;
  border-radius: 999px;
  background: var(--yellow);
}

.cat-empty p {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
  max-width: 36ch;
}

.cat-grid {
  display: grid;
  gap: 1.1rem;
  transition: opacity 180ms ease;
}

.cat-grid.is-refreshing {
  opacity: 0.55;
}

.cat-card {
  animation: cat-card-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--i, 0) * 55ms);
}

@media (min-width: 760px) {
  .cat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1080px) {
  .cat-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.cat-pager {
  display: flex;
  justify-content: center;
  margin-top: 1.75rem;
}

.cat-related {
  padding: 2.25rem 0 2.75rem;
  background:
    radial-gradient(circle at top right, rgba(15, 92, 102, 0.06), transparent 42%),
    #eef5f6;
}

.cat-related__head {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 0.85rem;
  margin-bottom: 1.15rem;
}

.cat-related__kicker {
  margin: 0 0 0.2rem;
  color: #e85d4c;
  font-weight: 750;
  font-size: 0.9rem;
}

.cat-related__head h2 {
  margin: 0 0 0.35rem;
  font-size: clamp(1.3rem, 2.8vw, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.cat-related__head p {
  margin: 0;
  color: var(--muted);
  max-width: 40ch;
  line-height: 1.45;
}

.cat-related__nav {
  display: flex;
  gap: 0.45rem;
}

.cat-related__btn {
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

.cat-related__btn:hover {
  border-color: rgba(15, 92, 102, 0.35);
  color: var(--teal);
}

.cat-related__stage {
  position: relative;
  margin: 0 -0.15rem;
}

.cat-related__stage::before,
.cat-related__stage::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0.75rem;
  width: 1.25rem;
  z-index: 1;
  pointer-events: none;
}

.cat-related__stage::before {
  left: 0;
  background: linear-gradient(90deg, #eef5f6, transparent);
}

.cat-related__stage::after {
  right: 0;
  background: linear-gradient(270deg, #eef5f6, transparent);
}

.cat-related__track {
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 0.35rem 0.15rem 1rem;
}

.cat-related__track::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.cat-related__rail {
  display: flex;
  gap: 1rem;
  width: max-content;
  padding-right: 0.35rem;
}

.cat-related__card {
  flex: 0 0 min(260px, 78vw);
  scroll-snap-align: start;
  min-width: 0;
}

@media (min-width: 720px) {
  .cat-related__card {
    flex-basis: 280px;
  }
}

.cat-related__card :deep(.m-course) {
  height: 100%;
  box-shadow: 0 10px 24px rgba(11, 27, 52, 0.07);
}

.cat-related__foot {
  display: flex;
  justify-content: center;
  margin-top: 0.35rem;
}

.cat-related__foot .cat-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  text-decoration: none;
}

@keyframes cat-hero-in {
  from { transform: scale(1.06); opacity: 0.65; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes cat-glow {
  from { opacity: 0.55; transform: translateY(0); }
  to { opacity: 0.95; transform: translateY(-10px); }
}

@keyframes cat-rise {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes cat-rule {
  from { opacity: 0; transform: scaleX(0.2); }
  to { opacity: 1; transform: scaleX(1); }
}

@keyframes cat-card-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .cat-hero__media,
  .cat-hero__glow,
  .cat-rise,
  .cat-hero__rule,
  .cat-card {
    animation: none !important;
    opacity: 1;
    transform: none;
  }
}
</style>
