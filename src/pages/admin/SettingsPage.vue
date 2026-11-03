<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()

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
      ...settings.notification_preferences,
    }, { skipErrorToast: true })
    applySettings(data.data || {})
    message.value = t('settingsSaved')
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
    const { data } = await http.post('/admin/settings/logo', body, { skipErrorToast: true })
    applySettings(data.data || {})
    logoFile.value = null
    message.value = t('logoUpdated')
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
    const { data } = await http.delete('/admin/settings/logo', { skipErrorToast: true })
    applySettings(data.data || {})
    message.value = t('logoRemoved')
  } catch (error) {
    formError.value = apiError(error).message || t('requestFailed')
  } finally {
    removingLogo.value = false
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

    <v-alert v-if="message" type="info" variant="tonal" class="mb-4" density="compact">{{ message }}</v-alert>
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
              <h2>{{ t('paymentGatewayStatus') }}</h2>
            </div>
            <div class="admin-ui__list">
              <article class="admin-ui__row">
                <div class="admin-ui__row-main">
                  <div>
                    <h3 class="admin-ui__row-title">SSLCommerz</h3>
                    <p class="admin-ui__row-meta">
                      {{ settings.payment_gateways.sslcommerz?.configured ? t('configured') : t('notConfigured') }}
                      · {{ settings.payment_gateways.sslcommerz?.sandbox ? t('sandbox') : t('live') }}
                    </p>
                  </div>
                </div>
              </article>
              <article class="admin-ui__row">
                <div class="admin-ui__row-main">
                  <div>
                    <h3 class="admin-ui__row-title">bKash</h3>
                    <p class="admin-ui__row-meta">
                      {{ settings.payment_gateways.bkash?.configured ? t('configured') : t('notConfigured') }}
                      · {{ settings.payment_gateways.bkash?.sandbox ? t('sandbox') : t('live') }}
                    </p>
                  </div>
                </div>
              </article>
            </div>
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
