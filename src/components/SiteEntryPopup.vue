<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { http } from '../services/http'

const STORAGE_KEY = 'site-entry-popup-dismissed'

const { t } = useI18n()
const router = useRouter()

const open = ref(false)
const popup = ref({
  enabled: false,
  title: '',
  body: '',
  cta_label: '',
  cta_url: '/courses',
})

const ctaLabel = computed(() => popup.value.cta_label || t('browseCourses'))

function wasDismissed() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}

function close() {
  open.value = false
  markDismissed()
}

function goCta() {
  const raw = String(popup.value.cta_url || '/courses').trim() || '/courses'
  close()
  if (/^https?:\/\//i.test(raw)) {
    window.location.assign(raw)
    return
  }
  router.push(raw.startsWith('/') ? raw : `/${raw}`)
}

async function loadPopup() {
  if (wasDismissed()) return
  try {
    const { data } = await http.get('/settings/public', { skipErrorToast: true, skipLoading: true })
    const entry = data.data?.entry_popup
    if (!entry?.enabled) return
    popup.value = {
      enabled: true,
      title: entry.title || '',
      body: entry.body || '',
      cta_label: entry.cta_label || '',
      cta_url: entry.cta_url || '/courses',
    }
    open.value = true
  } catch {
    // silent
  }
}

onMounted(loadPopup)

watch(open, (value) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = value ? 'hidden' : ''
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="entry-pop"
      role="dialog"
      aria-modal="true"
      :aria-label="popup.title || t('sitePopupTitle')"
    >
      <button type="button" class="entry-pop__scrim" :aria-label="t('close')" @click="close" />
      <div class="entry-pop__card">
        <button type="button" class="entry-pop__close" :aria-label="t('close')" @click="close">
          <v-icon icon="mdi-close" size="20" />
        </button>
        <p class="entry-pop__kicker">{{ t('landingNewBadge') }}</p>
        <h2>{{ popup.title }}</h2>
        <p v-if="popup.body" class="entry-pop__body">{{ popup.body }}</p>
        <div class="entry-pop__actions">
          <button type="button" class="entry-pop__btn entry-pop__btn--primary" @click="goCta">
            {{ ctaLabel }}
          </button>
          <button type="button" class="entry-pop__btn entry-pop__btn--ghost" @click="close">
            {{ t('close') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.entry-pop {
  position: fixed;
  inset: 0;
  z-index: 2400;
  display: grid;
  place-items: center;
  padding: 1rem;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.entry-pop__scrim {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(8, 28, 34, 0.55);
  backdrop-filter: blur(4px);
  cursor: pointer;
  animation: entry-pop-fade 280ms ease both;
}

.entry-pop__card {
  position: relative;
  z-index: 1;
  width: min(420px, 100%);
  padding: 1.35rem 1.25rem 1.2rem;
  border-radius: 1.1rem;
  background:
    radial-gradient(circle at top right, rgba(245, 197, 24, 0.22), transparent 42%),
    #fff;
  box-shadow: 0 24px 60px rgba(8, 28, 34, 0.28);
  animation: entry-pop-rise 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.entry-pop__close {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: 999px;
  background: #f3f4f6;
  color: #374151;
  cursor: pointer;
}

.entry-pop__kicker {
  margin: 0 0 0.45rem;
  color: #e11d48;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.entry-pop__card h2 {
  margin: 0 0 0.55rem;
  padding-right: 2rem;
  color: #102a2e;
  font-size: clamp(1.25rem, 3vw, 1.55rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.entry-pop__body {
  margin: 0 0 1.15rem;
  color: #5b7378;
  line-height: 1.55;
  font-size: 0.95rem;
}

.entry-pop__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.entry-pop__btn {
  min-height: 44px;
  padding: 0 1.05rem;
  border-radius: 0.7rem;
  border: 0;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.entry-pop__btn--primary {
  background: #f5c518;
  color: #1a1400;
  box-shadow: 0 8px 18px rgba(245, 197, 24, 0.28);
}

.entry-pop__btn--ghost {
  background: transparent;
  color: #0f5c66;
  border: 1.5px solid rgba(15, 92, 102, 0.28);
}

@keyframes entry-pop-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes entry-pop-rise {
  from { opacity: 0; transform: translateY(16px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .entry-pop__scrim,
  .entry-pop__card {
    animation: none;
  }
}
</style>
