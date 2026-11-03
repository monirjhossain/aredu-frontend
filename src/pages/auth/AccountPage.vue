<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth'
import { useLocaleStore } from '../../stores/locale'
import { apiError } from '../../utils/apiError'

const auth = useAuthStore()
const localeStore = useLocaleStore()
const { t } = useI18n()

const profile = reactive({
  name: auth.user?.name || '',
  phone: auth.user?.phone || '',
  locale: auth.user?.locale || localeStore.locale,
})
const passwordForm = reactive({
  current_password: '',
  password: '',
  password_confirmation: '',
})
const profileErrors = ref({})
const passwordErrors = ref({})
const profileMessage = ref('')
const passwordMessage = ref('')
const profileSuccess = ref('')
const passwordSuccess = ref('')
const savingProfile = ref(false)
const savingPassword = ref(false)

const locales = [
  { title: 'English', value: 'en' },
  { title: 'বাংলা', value: 'bn' },
]

onMounted(async () => {
  try {
    await auth.fetchMe()
    profile.name = auth.user?.name || ''
    profile.phone = auth.user?.phone || ''
    profile.locale = auth.user?.locale || 'en'
  } catch (error) {
    profileMessage.value = apiError(error).message || t('requestFailed')
  }
})

async function saveProfile() {
  profileErrors.value = {}
  profileMessage.value = ''
  profileSuccess.value = ''
  savingProfile.value = true
  try {
    profileSuccess.value = await auth.updateProfile({
      name: profile.name,
      phone: profile.phone || null,
      locale: profile.locale,
    })
    localeStore.setLocale(profile.locale)
  } catch (error) {
    const parsed = apiError(error)
    profileErrors.value = parsed.errors
    profileMessage.value = parsed.message || t('requestFailed')
  } finally {
    savingProfile.value = false
  }
}

async function savePassword() {
  passwordErrors.value = {}
  passwordMessage.value = ''
  passwordSuccess.value = ''
  savingPassword.value = true
  try {
    passwordSuccess.value = await auth.changePassword({ ...passwordForm })
    passwordForm.current_password = ''
    passwordForm.password = ''
    passwordForm.password_confirmation = ''
  } catch (error) {
    const parsed = apiError(error)
    passwordErrors.value = parsed.errors
    passwordMessage.value = parsed.message || t('requestFailed')
  } finally {
    savingPassword.value = false
  }
}
</script>

<template>
<v-row>
    <v-col cols="12" md="6">
      <v-card>
        <v-card-title>{{ t('account') }}</v-card-title>
        <v-card-text>
          <v-alert v-if="profileSuccess" class="mb-4" type="success" variant="tonal">{{ profileSuccess }}</v-alert>
          <v-alert v-if="profileMessage" class="mb-4" type="error" variant="tonal">{{ profileMessage }}</v-alert>
          <v-form @submit.prevent="saveProfile">
            <v-text-field v-model="profile.name" :label="t('name')" :error-messages="profileErrors.name || []" />
            <v-text-field v-model="profile.phone" :label="t('phone')" :error-messages="profileErrors.phone || []" />
            <v-select
              v-model="profile.locale"
              :items="locales"
              :label="t('locale')"
              :error-messages="profileErrors.locale || []"
            />
            <v-btn color="primary" type="submit" :loading="savingProfile">{{ t('save') }}</v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="12" md="6">
      <v-card>
        <v-card-title>{{ t('changePassword') }}</v-card-title>
        <v-card-text>
          <v-alert v-if="passwordSuccess" class="mb-4" type="success" variant="tonal">{{ passwordSuccess }}</v-alert>
          <v-alert v-if="passwordMessage" class="mb-4" type="error" variant="tonal">{{ passwordMessage }}</v-alert>
          <v-form @submit.prevent="savePassword">
            <v-text-field
              v-model="passwordForm.current_password"
              :label="t('currentPassword')"
              type="password"
              autocomplete="current-password"
              :error-messages="passwordErrors.current_password || []"
            />
            <v-text-field
              v-model="passwordForm.password"
              :label="t('newPassword')"
              type="password"
              autocomplete="new-password"
              :error-messages="passwordErrors.password || []"
            />
            <v-text-field
              v-model="passwordForm.password_confirmation"
              :label="t('passwordConfirmation')"
              type="password"
              autocomplete="new-password"
            />
            <v-btn color="primary" type="submit" :loading="savingPassword">{{ t('save') }}</v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
