<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import MarketingFooter from '../../components/marketing/MarketingFooter.vue'
import { http } from '../../services/http'
import { cacheGet, cacheSet } from '../../services/publicCache'
import { useAuthStore } from '../../stores/auth'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const tab = ref(route.query.module === 'listening' ? 'listening' : 'reading')
const reading = ref([])
const listening = ref([])
const loading = ref(true)
const message = ref('')
const branding = ref({
  platform_name: '',
  logo_url: '',
  contact_information: '',
  support_email: '',
})

const brandName = computed(() => branding.value.platform_name || t('appName'))
const activeList = computed(() => (tab.value === 'listening' ? listening.value : reading.value))
const activeCount = computed(() => activeList.value.length)

const tabs = computed(() => [
  { key: 'reading', label: t('readingTests'), icon: 'mdi-book-open-page-variant-outline' },
  { key: 'listening', label: t('listeningTests'), icon: 'mdi-headphones' },
])

async function loadBranding() {
  const cached = cacheGet('landing')
  if (cached?.branding) {
    branding.value = { ...branding.value, ...cached.branding }
    return
  }
  try {
    const { data } = await http.get('/settings/public', { skipErrorToast: true, skipLoading: true })
    branding.value = { ...branding.value, ...(data.data || {}) }
  } catch {
    // defaults
  }
}

async function loadModule(module) {
  const key = `free-practice:${module}`
  const cached = cacheGet(key)
  if (cached) {
    if (module === 'listening') listening.value = cached
    else reading.value = cached
  }

  const { data } = await http.get(`/public/${module}-tests`, {
    skipErrorToast: true,
    skipLoading: true,
  })
  const rows = data.data || []
  if (module === 'listening') listening.value = rows
  else reading.value = rows
  cacheSet(key, rows, 60_000)
}

async function loadAll() {
  loading.value = true
  message.value = ''
  try {
    await Promise.all([loadModule('reading'), loadModule('listening')])
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function setTab(key) {
  tab.value = key
  router.replace({ query: { ...route.query, module: key === 'reading' ? undefined : key } })
}

function minutes(seconds) {
  return t('minutesCount', { count: Math.round(Number(seconds || 0) / 60) })
}

function examLabel(type) {
  return type === 'general' ? t('general') : t('academic')
}

function openTest(item) {
  const name = tab.value === 'listening' ? 'listening-test-intro' : 'reading-test-intro'
  const target = { name, params: { slug: item.slug } }
  if (!auth.isAuthenticated) {
    router.push({ name: 'login', query: { redirect: router.resolve(target).fullPath } })
    return
  }
  router.push(target)
}

onMounted(() => {
  loadBranding()
  loadAll()
})

watch(() => route.query.module, (module) => {
  tab.value = module === 'listening' ? 'listening' : 'reading'
})
</script>

<template>
  <div class="fprac">
    <section class="fprac-hero">
      <div class="fprac-hero__media" aria-hidden="true" />
      <div class="fprac-hero__shade" aria-hidden="true" />
      <div class="fprac-wrap fprac-hero__inner">
        <p class="fprac-hero__brand">{{ brandName }}</p>
        <span class="fprac-hero__rule" aria-hidden="true" />
        <h1>{{ t('freePracticeTitle') }}</h1>
        <p class="fprac-hero__lead">{{ t('freePracticeLead') }}</p>
        <div class="fprac-hero__actions">
          <a class="fprac-btn fprac-btn--primary" href="#free-mocks">
            {{ t('freePracticeStart') }}
            <span aria-hidden="true">→</span>
          </a>
          <router-link class="fprac-btn fprac-btn--ghost" :to="{ name: 'courses' }">
            {{ t('browseCourses') }}
          </router-link>
        </div>
      </div>
    </section>

    <section id="free-mocks" class="fprac-body">
      <div class="fprac-wrap">
        <div class="fprac-panel">
          <div class="fprac-tabs" role="tablist">
            <button
              v-for="item in tabs"
              :key="item.key"
              type="button"
              class="fprac-tab"
              :class="{ 'is-active': tab === item.key }"
              role="tab"
              :aria-selected="tab === item.key"
              @click="setTab(item.key)"
            >
              <v-icon :icon="item.icon" size="18" />
              <span>{{ item.label }}</span>
            </button>
          </div>

          <div class="fprac-meta">
            <p>{{ t('freePracticeResults', { count: activeCount }) }}</p>
            <p class="fprac-meta__note">{{ t('freePracticeLoginNote') }}</p>
          </div>

          <div v-if="loading" class="fprac-loader">
            <v-progress-circular indeterminate color="#e54c10" size="36" />
          </div>
          <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
          <div v-else-if="!activeList.length" class="fprac-empty">
            <span class="fprac-empty__mark" aria-hidden="true" />
            <p>{{ t('freePracticeEmpty') }}</p>
            <router-link class="fprac-btn fprac-btn--soft" :to="{ name: 'courses' }">
              {{ t('browseCourses') }}
            </router-link>
          </div>
          <div v-else class="fprac-grid">
            <article
              v-for="(item, index) in activeList"
              :key="item.id"
              class="fprac-card"
              :style="{ '--i': index }"
            >
              <div class="fprac-card__top">
                <span class="fprac-card__badge">{{ t('freeSampleBadge') }}</span>
                <span class="fprac-card__exam">{{ examLabel(item.exam_type) }}</span>
              </div>
              <h2>{{ item.title }}</h2>
              <p class="fprac-card__time">{{ minutes(item.duration_seconds) }}</p>
              <p v-if="item.instructions" class="fprac-card__copy">{{ item.instructions }}</p>
              <button type="button" class="fprac-card__cta" @click="openTest(item)">
                {{ auth.isAuthenticated ? t('tryFreeMock') : t('loginToTryFreeMock') }}
                <span aria-hidden="true">→</span>
              </button>
            </article>
          </div>
        </div>

        <aside class="fprac-cta">
          <p class="fprac-cta__kicker">{{ t('freePracticeCtaKicker') }}</p>
          <h2>{{ t('freePracticeCtaTitle') }}</h2>
          <p>{{ t('freePracticeCtaLead') }}</p>
          <div class="fprac-cta__actions">
            <router-link class="fprac-btn fprac-btn--primary" :to="{ name: 'courses' }">
              {{ t('browseCourses') }}
            </router-link>
            <router-link class="fprac-btn fprac-btn--ghost-dark" :to="{ name: 'free-courses' }">
              {{ t('navFreeCourses') }}
            </router-link>
          </div>
        </aside>
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
.fprac {
  --ink: #102a2e;
  --muted: #5b7378;
  --line: #d9e6e8;
  --yellow: #e54c10;
  --yellow-ink: #ffffff;
  --teal: #0f5c66;
  --shell: 1080px;
  color: var(--ink);
  background: #f7fafb;
  min-height: 100%;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.fprac-wrap {
  width: min(var(--shell), calc(100% - 1.5rem));
  margin: 0 auto;
}

.fprac-hero {
  position: relative;
  overflow: hidden;
  color: #fff;
  padding: 1.6rem 0 2rem;
  min-height: clamp(12rem, 28vw, 16rem);
  display: grid;
  align-items: end;
}

.fprac-hero__media {
  position: absolute;
  inset: -4%;
  background: url('/images/land/land-mocks.jpg') center / cover no-repeat;
}

.fprac-hero__shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, rgba(8, 28, 34, 0.94) 0%, rgba(10, 42, 58, 0.68) 55%, rgba(10, 42, 58, 0.4) 100%),
    linear-gradient(180deg, rgba(8, 28, 34, 0.15) 0%, rgba(8, 28, 34, 0.72) 100%);
}

.fprac-hero__inner {
  position: relative;
  z-index: 1;
  max-width: 40rem;
}

.fprac-hero__brand {
  margin: 0 0 0.3rem;
  font-size: clamp(1.4rem, 4vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.04em;
}

.fprac-hero__rule {
  display: block;
  width: 2.25rem;
  height: 2px;
  margin: 0 0 0.6rem;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--yellow), rgba(229, 76, 16, 0.15));
}

.fprac-hero h1 {
  margin: 0 0 0.4rem;
  font-size: clamp(1.2rem, 2.6vw, 1.55rem);
  font-weight: 750;
  letter-spacing: -0.02em;
}

.fprac-hero__lead {
  margin: 0 0 1rem;
  max-width: 42ch;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.5;
  font-size: 0.95rem;
}

.fprac-hero__actions,
.fprac-cta__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.fprac-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 1rem;
  border-radius: 0.65rem;
  border: 0;
  font: inherit;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.fprac-btn--primary {
  background: var(--yellow);
  color: var(--yellow-ink);
  box-shadow: 0 8px 18px rgba(229, 76, 16, 0.25);
}

.fprac-btn--ghost {
  background: transparent;
  color: #fff;
  border: 1.5px solid rgba(255, 255, 255, 0.5);
}

.fprac-btn--ghost-dark {
  background: transparent;
  color: var(--teal);
  border: 1.5px solid rgba(15, 92, 102, 0.28);
}

.fprac-btn--soft {
  background: #eef6f7;
  color: var(--teal);
}

.fprac-body {
  padding: 0 0 2.5rem;
  margin-top: -1rem;
  position: relative;
  z-index: 2;
}

.fprac-panel {
  padding: 0.85rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid var(--line);
  box-shadow: 0 14px 34px rgba(10, 42, 58, 0.08);
}

.fprac-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}

.fprac-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 2.55rem;
  border-radius: 0.7rem;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.fprac-tab.is-active {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
}

.fprac-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.45rem;
  margin-bottom: 0.85rem;
}

.fprac-meta p {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 650;
}

.fprac-meta__note {
  font-weight: 550 !important;
}

.fprac-loader,
.fprac-empty {
  display: grid;
  place-items: center;
  gap: 0.75rem;
  min-height: 10rem;
  text-align: center;
}

.fprac-empty {
  justify-items: center;
  padding: 1.5rem 1rem;
  border: 1px dashed var(--line);
  border-radius: 0.85rem;
}

.fprac-empty__mark {
  width: 2.4rem;
  height: 3px;
  border-radius: 999px;
  background: var(--yellow);
}

.fprac-empty p {
  margin: 0;
  color: var(--muted);
  max-width: 36ch;
}

.fprac-grid {
  display: grid;
  gap: 0.85rem;
}

@media (min-width: 760px) {
  .fprac-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.fprac-card {
  display: grid;
  gap: 0.55rem;
  padding: 1rem;
  border-radius: 0.9rem;
  background: #f7fafb;
  border: 1px solid var(--line);
  animation: fprac-in 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--i, 0) * 55ms);
}

.fprac-card__top {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.fprac-card__badge,
.fprac-card__exam {
  display: inline-flex;
  align-items: center;
  min-height: 1.55rem;
  padding: 0 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
}

.fprac-card__badge {
  background: #fef3c7;
  color: #92400e;
}

.fprac-card__exam {
  background: #eef6f7;
  color: var(--teal);
}

.fprac-card h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.fprac-card__time {
  margin: 0;
  color: var(--muted);
  font-size: 0.86rem;
  font-weight: 650;
}

.fprac-card__copy {
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fprac-card__cta {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 2.4rem;
  margin-top: 0.2rem;
  padding: 0 0.9rem;
  border: 0;
  border-radius: 0.6rem;
  background: var(--ink);
  color: #fff;
  font: inherit;
  font-weight: 750;
  cursor: pointer;
}

.fprac-cta {
  margin-top: 1.1rem;
  padding: 1.15rem 1rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at top right, rgba(229, 76, 16, 0.18), transparent 42%),
    linear-gradient(135deg, #0f5c66 0%, #14919b 55%, #0a3d44 100%);
  color: #fff;
}

.fprac-cta__kicker {
  margin: 0 0 0.3rem;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #fde68a;
}

.fprac-cta h2 {
  margin: 0 0 0.4rem;
  font-size: clamp(1.15rem, 2.4vw, 1.4rem);
  font-weight: 800;
}

.fprac-cta > p {
  margin: 0 0 0.95rem;
  max-width: 46ch;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.5;
}

@keyframes fprac-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .fprac-card { animation: none; }
}
</style>
