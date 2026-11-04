<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { useUiStore } from '../../stores/ui'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const ui = useUiStore()

const tab = ref('settings')
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const removingLogo = ref(false)
const message = ref('')
const formError = ref('')
const fieldErrors = ref({})
const settings = reactive({
  platform_name: '',
  contact_information: '',
  support_email: '',
  currency: 'BDT',
  about_text: '',
  landing_videos: [],
  logo_url: null,
  bkash_payment: { qr_url: null, merchant_number: '', note: '' },
  bkash_merchant_number: '',
  bkash_payment_note: '',
  payment_gateways: { sslcommerz: {}, bkash: {} },
  course_access_rules: {},
  notification_preferences: {
    notify_on_payment: true,
    notify_on_enrollment: true,
    notify_on_evaluation: true,
    notify_on_mock_result: true,
    notify_on_new_lesson: true,
  },
})

const logs = ref([])
const logMeta = ref({ current_page: 1, last_page: 1, total: 0 })
const logPage = ref(1)
const logAction = ref('')
const logLoading = ref(false)
const logoFile = ref(null)
const bkashQrFile = ref(null)
const uploadingQr = ref(false)
const removingQr = ref(false)

onMounted(async () => {
  await loadSettings()
})

async function loadSettings() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/settings', { skipErrorToast: true })
    applySettings(data.data || {})
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function applySettings(payload) {
  settings.platform_name = payload.platform_name || ''
  settings.contact_information = payload.contact_information || ''
  settings.support_email = payload.support_email || ''
  settings.currency = payload.currency || 'BDT'
  settings.about_text = payload.about_text || ''
  settings.landing_videos = Array.isArray(payload.landing_videos)
    ? payload.landing_videos.map((row) => ({ title: row.title || '', url: row.url || '' }))
    : []
  settings.logo_url = payload.logo_url || null
  settings.bkash_payment = payload.bkash_payment || { qr_url: null, merchant_number: '', note: '' }
  settings.bkash_merchant_number = payload.bkash_merchant_number || payload.bkash_payment?.merchant_number || ''
  settings.bkash_payment_note = payload.bkash_payment_note || payload.bkash_payment?.note || ''
  settings.payment_gateways = payload.payment_gateways || { sslcommerz: {}, bkash: {} }
  settings.course_access_rules = payload.course_access_rules || {}
  settings.notification_preferences = {
    notify_on_payment: !!payload.notification_preferences?.notify_on_payment,
    notify_on_enrollment: !!payload.notification_preferences?.notify_on_enrollment,
    notify_on_evaluation: !!payload.notification_preferences?.notify_on_evaluation,
    notify_on_mock_result: !!payload.notification_preferences?.notify_on_mock_result,
    notify_on_new_lesson: !!payload.notification_preferences?.notify_on_new_lesson,
  }
}

function addLandingVideo() {
  if (settings.landing_videos.length >= 8) return
  settings.landing_videos.push({ title: '', url: '' })
}

function removeLandingVideo(index) {
  settings.landing_videos.splice(index, 1)
}

async function saveSettings() {
  saving.value = true
  formError.value = ''
  fieldErrors.value = {}
  try {
    const { data } = await http.put('/admin/settings', {
      platform_name: settings.platform_name,
      contact_information: settings.contact_information,
      support_email: settings.support_email || null,
      currency: settings.currency,
      about_text: settings.about_text || null,
      landing_videos: settings.landing_videos
        .filter((row) => row.url?.trim())
        .map((row) => ({ title: row.title?.trim() || 'Video', url: row.url.trim() })),
      bkash_merchant_number: settings.bkash_merchant_number || null,
      bkash_payment_note: settings.bkash_payment_note || null,
      ...settings.notification_preferences,
    }, { skipErrorToast: true, skipSuccessToast: true })
    applySettings(data.data || {})
    ui.success(t('settingsSaved'))
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors
    formError.value = parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

async function uploadLogo() {
  if (!logoFile.value) return
  uploading.value = true
  formError.value = ''
  try {
    const body = new FormData()
    body.append('logo', logoFile.value)
    const { data } = await http.post('/admin/settings/logo', body, { skipErrorToast: true, skipSuccessToast: true })
    applySettings(data.data || {})
    logoFile.value = null
    ui.success(t('logoUpdated'))
  } catch (error) {
    formError.value = apiError(error).message || t('requestFailed')
  } finally {
    uploading.value = false
  }
}

async function removeLogo() {
  removingLogo.value = true
  formError.value = ''
  try {
    const { data } = await http.delete('/admin/settings/logo', { skipErrorToast: true, skipSuccessToast: true })
    applySettings(data.data || {})
    ui.success(t('logoRemoved'))
  } catch (error) {
    formError.value = apiError(error).message || t('requestFailed')
  } finally {
    removingLogo.value = false
  }
}

async function uploadBkashQr() {
  const file = Array.isArray(bkashQrFile.value) ? bkashQrFile.value[0] : bkashQrFile.value
  if (!file) return
  uploadingQr.value = true
  formError.value = ''
  try {
    const body = new FormData()
    body.append('qr', file)
    const { data } = await http.post('/admin/settings/bkash-qr', body, { skipErrorToast: true, skipSuccessToast: true })
    applySettings(data.data || {})
    bkashQrFile.value = null
    ui.success(t('bkashQrUpdated'))
  } catch (error) {
    formError.value = apiError(error).message || t('requestFailed')
  } finally {
    uploadingQr.value = false
  }
}

async function removeBkashQr() {
  removingQr.value = true
  formError.value = ''
  try {
    const { data } = await http.delete('/admin/settings/bkash-qr', { skipErrorToast: true, skipSuccessToast: true })
    applySettings(data.data || {})
    ui.success(t('bkashQrRemoved'))
  } catch (error) {
    formError.value = apiError(error).message || t('requestFailed')
  } finally {
    removingQr.value = false
  }
}

async function loadLogs() {
  logLoading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/activity-logs', {
      params: {
        page: logPage.value,
        action: logAction.value || undefined,
      },
      skipErrorToast: true,
    })
    logs.value = data.data || []
    logMeta.value = data.meta || logMeta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    logLoading.value = false
  }
}

function openLogs() {
  tab.value = 'logs'
  if (!logs.value.length) loadLogs()
}

function applyLogFilter() {
  logPage.value = 1
  loadLogs()
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('settings')">
      <template v-if="tab === 'settings'" #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          :disabled="saving || loading"
          @click="saveSettings"
        >
          <v-icon size="18">mdi-content-save</v-icon>
          {{ t('save') }}
        </button>
      </template>
    </AdminPageHero>

    <v-alert v-if="message" type="error" variant="tonal" class="mb-4" density="compact">{{ message }}</v-alert>
    <v-alert v-if="formError" type="error" variant="tonal" class="mb-4" density="compact">{{ formError }}</v-alert>

    <section class="admin-ui__panel">
      <v-tabs v-model="tab" color="#0f5c66" show-arrows>
        <v-tab value="settings" @click="tab = 'settings'">{{ t('settings') }}</v-tab>
        <v-tab value="logs" @click="openLogs">{{ t('activityLogs') }}</v-tab>
      </v-tabs>
    </section>

    <v-window v-model="tab">
      <v-window-item value="settings">
        <div v-if="loading" class="admin-ui__loading">
          <v-progress-circular indeterminate color="#0f5c66" size="36" />
        </div>
        <template v-else>
          <section class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <h2>{{ t('platformName') }}</h2>
            </div>
            <v-text-field
              v-model="settings.platform_name"
              :label="t('platformName')"
              :error-messages="fieldErrors.platform_name"
              class="mb-2"
            />
            <v-textarea
              v-model="settings.contact_information"
              :label="t('contactInformation')"
              :error-messages="fieldErrors.contact_information"
              rows="3"
              class="mb-2"
            />
            <div class="admin-ui__form-grid admin-ui__form-grid--2">
              <v-text-field
                v-model="settings.support_email"
                :label="t('supportEmail')"
                :error-messages="fieldErrors.support_email"
              />
              <v-text-field
                v-model="settings.currency"
                :label="t('currency')"
                :error-messages="fieldErrors.currency"
                readonly
              />
            </div>
            <v-textarea
              v-model="settings.about_text"
              :label="t('aboutCompany')"
              :error-messages="fieldErrors.about_text"
              :hint="t('aboutTextHint')"
              persistent-hint
              rows="4"
            />
          </section>

          <section class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <div>
                <h2>{{ t('landingVideos') }}</h2>
                <p>{{ t('landingVideosAdminHint') }}</p>
              </div>
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--soft"
                :disabled="settings.landing_videos.length >= 8"
                @click="addLandingVideo"
              >
                <v-icon size="18">mdi-plus</v-icon>
                {{ t('addLandingVideo') }}
              </button>
            </div>
            <div class="admin-ui__list">
              <article v-for="(video, index) in settings.landing_videos" :key="index" class="admin-ui__row">
                <div class="admin-ui__row-main">
                  <div class="admin-ui__form-grid admin-ui__form-grid--2" style="flex: 1; min-width: 0">
                    <v-text-field
                      v-model="video.title"
                      :label="t('videoTitle')"
                      density="compact"
                      hide-details
                    />
                    <v-text-field
                      v-model="video.url"
                      :label="t('videoUrl')"
                      density="compact"
                      hide-details="auto"
                      :error-messages="fieldErrors[`landing_videos.${index}.url`]"
                    />
                  </div>
                </div>
                <div class="admin-ui__row-actions">
                  <button
                    type="button"
                    class="admin-ui__icon-btn admin-ui__icon-btn--danger"
                    :aria-label="t('remove')"
                    @click="removeLandingVideo(index)"
                  >
                    <v-icon size="18">mdi-delete</v-icon>
                  </button>
                </div>
              </article>
            </div>
          </section>

          <section class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <h2>{{ t('notificationPreferences') }}</h2>
            </div>
            <v-switch v-model="settings.notification_preferences.notify_on_payment" :label="t('notifyOnPayment')" color="#0f5c66" hide-details density="comfortable" />
            <v-switch v-model="settings.notification_preferences.notify_on_enrollment" :label="t('notifyOnEnrollment')" color="#0f5c66" hide-details density="comfortable" />
            <v-switch v-model="settings.notification_preferences.notify_on_evaluation" :label="t('notifyOnEvaluation')" color="#0f5c66" hide-details density="comfortable" />
            <v-switch v-model="settings.notification_preferences.notify_on_mock_result" :label="t('notifyOnMockResult')" color="#0f5c66" hide-details density="comfortable" />
            <v-switch v-model="settings.notification_preferences.notify_on_new_lesson" :label="t('notifyOnNewLesson')" color="#0f5c66" hide-details density="comfortable" />
          </section>

          <section class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <h2>{{ t('platformLogo') }}</h2>
            </div>
            <v-img v-if="settings.logo_url" :src="settings.logo_url" max-height="120" contain class="mb-3" />
            <v-file-input
              v-model="logoFile"
              :label="t('uploadLogo')"
              accept="image/png,image/jpeg,image/webp"
              prepend-icon="mdi-image"
              show-size
              class="mb-2"
            />
            <div class="admin-ui__row-actions">
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--solid"
                :disabled="!logoFile || uploading"
                @click="uploadLogo"
              >
                {{ t('upload') }}
              </button>
              <button
                v-if="settings.logo_url"
                type="button"
                class="admin-ui__btn admin-ui__btn--danger"
                :disabled="removingLogo"
                @click="removeLogo"
              >
                {{ t('remove') }}
              </button>
            </div>
          </section>

          <section class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <div>
                <h2>{{ t('bkashQrSettings') }}</h2>
                <p>{{ t('bkashQrSettingsLead') }}</p>
              </div>
            </div>
            <img
              v-if="settings.bkash_payment?.qr_url"
              :src="settings.bkash_payment.qr_url"
              alt=""
              class="admin-dialog__cover mb-3"
            >
            <v-file-input
              v-model="bkashQrFile"
              :label="t('uploadBkashQr')"
              accept="image/jpeg,image/png,image/webp"
              show-size
              class="mb-2"
            />
            <div class="d-flex flex-wrap ga-2 mb-3">
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--solid"
                :disabled="!bkashQrFile || uploadingQr"
                @click="uploadBkashQr"
              >
                {{ t('uploadBkashQr') }}
              </button>
              <button
                v-if="settings.bkash_payment?.qr_url"
                type="button"
                class="admin-ui__btn admin-ui__btn--danger"
                :disabled="removingQr"
                @click="removeBkashQr"
              >
                {{ t('remove') }}
              </button>
            </div>
            <label class="admin-ui__field mb-3">
              <span>{{ t('bkashNumber') }}</span>
              <input v-model="settings.bkash_merchant_number" type="text" placeholder="01XXXXXXXXX">
            </label>
            <label class="admin-ui__field">
              <span>{{ t('bkashPaymentNote') }}</span>
              <textarea v-model="settings.bkash_payment_note" rows="3" />
            </label>
          </section>

          <section class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <h2>{{ t('courseAccessRules') }}</h2>
            </div>
            <v-alert type="info" variant="tonal" density="compact">
              {{ t('courseAccessRulesHint') }}
            </v-alert>
            <ul class="mt-2 text-body-2">
              <li>{{ t('ruleOneTimePurchase') }}</li>
              <li>{{ t('ruleLifetimeAccess') }}</li>
              <li>{{ t('ruleMultipleCourses') }}</li>
              <li>{{ t('ruleManualRefund') }}</li>
            </ul>
          </section>

          <div class="admin-ui__form-actions">
            <button
              type="button"
              class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
              :disabled="saving"
              @click="saveSettings"
            >
              {{ t('save') }}
            </button>
          </div>
        </template>
      </v-window-item>

      <v-window-item value="logs">
        <section class="admin-ui__panel">
          <form @submit.prevent="applyLogFilter">
            <div class="admin-ui__filters admin-ui__filters--3">
              <label class="admin-ui__field">
                <span>{{ t('actionFilter') }}</span>
                <input v-model="logAction" type="search">
              </label>
            </div>
            <div class="admin-ui__filter-actions">
              <button type="submit" class="admin-ui__btn admin-ui__btn--solid">{{ t('filter') }}</button>
            </div>
          </form>
        </section>

        <section class="admin-ui__panel">
          <div class="admin-ui__panel-head">
            <div>
              <h2>{{ t('activityLogs') }}</h2>
              <p>{{ t('reportTotal', { count: logMeta.total || logs.length }) }}</p>
            </div>
          </div>
          <div v-if="logLoading" class="admin-ui__loading">
            <v-progress-circular indeterminate color="#0f5c66" size="36" />
          </div>
          <div v-else-if="!logs.length" class="admin-ui__empty">
            <p>{{ t('noActivityLogs') }}</p>
          </div>
          <div v-else class="admin-ui__list">
            <article v-for="row in logs" :key="row.id" class="admin-ui__row">
              <div class="admin-ui__row-main">
                <div>
                  <h3 class="admin-ui__row-title">{{ row.action }}</h3>
                  <p class="admin-ui__row-meta">{{ row.description }}</p>
                  <div class="admin-ui__chips">
                    <span class="admin-ui__chip">{{ row.user?.name || '—' }}</span>
                    <span class="admin-ui__chip">{{ row.created_at }}</span>
                  </div>
                </div>
              </div>
            </article>
          </div>
          <div v-if="logMeta.last_page > 1" class="admin-ui__pager">
            <v-pagination
              v-model="logPage"
              :length="logMeta.last_page"
              active-color="#0f5c66"
              total-visible="5"
              density="comfortable"
              @update:model-value="loadLogs"
            />
          </div>
        </section>
      </v-window-item>
    </v-window>
  </div>
</template>
