<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { useLocaleStore } from '../../stores/locale'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const localeStore = useLocaleStore()

const certificate = ref(null)
const loading = ref(true)
const message = ref('')
const logoUrl = `${import.meta.env.BASE_URL}images/ar-logo.png`

onMounted(load)
watch(() => route.params.id, load)

async function load() {
  loading.value = true
  message.value = ''
  certificate.value = null
  try {
    const { data } = await http.get(`/student/certificates/${route.params.id}`, { skipErrorToast: true })
    certificate.value = data.data
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

const examLabel = computed(() => {
  const type = certificate.value?.course?.exam_type
  if (type === 'general') return t('general')
  if (type === 'academic') return t('academic')
  return type || ''
})

const issuedLabel = computed(() => {
  const value = certificate.value?.issued_at
  if (!value) return '—'
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

function printCertificate() {
  window.print()
}

function backToCourse() {
  const slug = certificate.value?.course?.slug
  if (slug) {
    router.push({ name: 'learning-course', params: { slug } })
    return
  }
  router.push({ name: 'my-courses' })
}
</script>

<template>
  <div class="cert-page">
    <div class="cert-page__toolbar no-print">
      <button type="button" class="cert-page__btn cert-page__btn--ghost" @click="backToCourse">
        ← {{ t('backToCourse') }}
      </button>
      <div class="cert-page__toolbar-actions">
        <button
          type="button"
          class="cert-page__btn"
          :disabled="!certificate"
          @click="printCertificate"
        >
          {{ t('printOrSaveCertificate') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="cert-page__status no-print">
      <v-progress-circular indeterminate color="#0f5c66" />
    </div>
    <v-alert v-else-if="message" type="error" variant="tonal" class="no-print">{{ message }}</v-alert>

    <article v-else-if="certificate" class="cert-sheet" aria-label="Certificate">
      <div class="cert-sheet__frame">
        <header class="cert-sheet__brand">
          <img :src="logoUrl" alt="" class="cert-sheet__logo" width="72" height="72">
          <div>
            <p class="cert-sheet__eyebrow">{{ t('appName') }}</p>
            <h1>{{ t('certificateOfCompletion') }}</h1>
          </div>
        </header>

        <p class="cert-sheet__intro">{{ t('certificatePresentedTo') }}</p>
        <p class="cert-sheet__name">{{ certificate.student_name }}</p>
        <p class="cert-sheet__body">
          {{ t('certificateCourseLine', { course: certificate.course?.title || '—' }) }}
        </p>
        <p v-if="examLabel" class="cert-sheet__meta">{{ examLabel }}</p>

        <dl class="cert-sheet__facts">
          <div>
            <dt>{{ t('certificateNumber') }}</dt>
            <dd>{{ certificate.certificate_number }}</dd>
          </div>
          <div>
            <dt>{{ t('certificateIssuedOn') }}</dt>
            <dd>{{ issuedLabel }}</dd>
          </div>
        </dl>

        <footer class="cert-sheet__footer">
          <p>{{ t('certificateDisclaimer') }}</p>
        </footer>
      </div>
    </article>
  </div>
</template>

<style scoped>
.cert-page {
  width: min(960px, 100%);
  margin: 0 auto;
  padding: 1rem 1rem 2.5rem;
}

.cert-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.cert-page__toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.cert-page__btn {
  min-height: 44px;
  padding: 0.55rem 1rem;
  border: 0;
  border-radius: 0.55rem;
  background: #0f5c66;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.cert-page__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cert-page__btn--ghost {
  background: transparent;
  color: #0f5c66;
  border: 1px solid rgba(15, 92, 102, 0.28);
}

.cert-page__status {
  display: grid;
  place-items: center;
  min-height: 12rem;
}

.cert-sheet {
  background:
    radial-gradient(circle at top right, rgba(229, 76, 16, 0.18), transparent 42%),
    linear-gradient(165deg, #f7fbfb 0%, #eef6f6 55%, #f8faf9 100%);
  border: 1px solid rgba(15, 92, 102, 0.18);
  border-radius: 1rem;
  padding: clamp(1rem, 3vw, 1.5rem);
  box-shadow: 0 18px 40px rgba(16, 42, 46, 0.08);
}

.cert-sheet__frame {
  border: 2px solid rgba(15, 92, 102, 0.35);
  border-radius: 0.75rem;
  padding: clamp(1.25rem, 4vw, 2.5rem);
  background: rgba(255, 255, 255, 0.88);
  text-align: center;
}

.cert-sheet__brand {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.85rem 1rem;
  margin-bottom: 1.5rem;
}

.cert-sheet__logo {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.cert-sheet__eyebrow {
  margin: 0;
  color: #0f5c66;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.cert-sheet__brand h1 {
  margin: 0.2rem 0 0;
  color: #102a2e;
  font-size: clamp(1.35rem, 3.5vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.cert-sheet__intro,
.cert-sheet__body,
.cert-sheet__meta,
.cert-sheet__footer p {
  margin: 0;
  color: rgba(16, 42, 46, 0.72);
  line-height: 1.55;
}

.cert-sheet__intro {
  margin-top: 0.5rem;
  font-size: 0.95rem;
}

.cert-sheet__name {
  margin: 0.65rem 0 0.85rem;
  color: #0f5c66;
  font-size: clamp(1.6rem, 5vw, 2.4rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.cert-sheet__body {
  max-width: 36rem;
  margin-inline: auto;
  font-size: 1rem;
}

.cert-sheet__meta {
  margin-top: 0.55rem;
  font-weight: 700;
  color: #102a2e;
}

.cert-sheet__facts {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem;
  margin: 1.75rem auto 0;
  max-width: 28rem;
  text-align: left;
}

.cert-sheet__facts div {
  padding: 0.75rem 0.9rem;
  border-radius: 0.65rem;
  background: rgba(15, 92, 102, 0.06);
  border: 1px solid rgba(15, 92, 102, 0.12);
}

.cert-sheet__facts dt {
  margin: 0;
  color: rgba(16, 42, 46, 0.6);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cert-sheet__facts dd {
  margin: 0.25rem 0 0;
  color: #102a2e;
  font-size: 0.95rem;
  font-weight: 700;
  word-break: break-word;
}

.cert-sheet__footer {
  margin-top: 1.75rem;
  padding-top: 1rem;
  border-top: 1px dashed rgba(15, 92, 102, 0.25);
}

.cert-sheet__footer p {
  font-size: 0.78rem;
}

@media (min-width: 640px) {
  .cert-sheet__facts {
    grid-template-columns: 1fr 1fr;
    max-width: none;
  }
}

@media print {
  .no-print {
    display: none !important;
  }

  .cert-page {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
  }

  .cert-sheet {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #fff;
    padding: 0;
  }

  .cert-sheet__frame {
    border-width: 2px;
    min-height: 90vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}
</style>

<style>
@media print {
  body * {
    visibility: hidden;
  }

  .cert-page,
  .cert-page * {
    visibility: visible;
  }

  .cert-page {
    position: absolute;
    inset: 0;
    width: 100%;
  }

  .v-navigation-drawer,
  .v-app-bar,
  .v-snackbar,
  .app-toasts,
  .site-entry-popup {
    display: none !important;
  }
}
</style>
