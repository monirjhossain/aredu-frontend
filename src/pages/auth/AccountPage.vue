<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth'
import { useLocaleStore } from '../../stores/locale'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'

const auth = useAuthStore()
const localeStore = useLocaleStore()
const { t } = useI18n()
const ui = useUiStore()

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
const avatarMessage = ref('')
const savingProfile = ref(false)
const savingPassword = ref(false)
const savingAvatar = ref(false)
const avatarInput = ref(null)

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
  savingProfile.value = true
  try {
    await auth.updateProfile({
      name: profile.name,
      phone: profile.phone || null,
      locale: profile.locale,
    })
    localeStore.setLocale(profile.locale)
    ui.success(t('profileSaved'))
  } catch (error) {
    const parsed = apiError(error)
    profileErrors.value = parsed.errors
    profileMessage.value = parsed.message || t('requestFailed')
  } finally {
    savingProfile.value = false
  }
}

async function onAvatarPicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  avatarMessage.value = ''
  savingAvatar.value = true
  try {
    await auth.updateAvatar(file)
    ui.success(t('avatarSaved'))
  } catch (error) {
    const parsed = apiError(error)
    avatarMessage.value = parsed.errors?.avatar?.[0] || parsed.message || t('requestFailed')
  } finally {
    savingAvatar.value = false
  }
}

async function removeAvatar() {
  avatarMessage.value = ''
  savingAvatar.value = true
  try {
    await auth.deleteAvatar()
    ui.success(t('avatarRemoved'))
  } catch (error) {
    avatarMessage.value = apiError(error).message || t('requestFailed')
  } finally {
    savingAvatar.value = false
  }
}

async function savePassword() {
  passwordErrors.value = {}
  passwordMessage.value = ''
  savingPassword.value = true
  try {
    await auth.changePassword({ ...passwordForm })
    passwordForm.current_password = ''
    passwordForm.password = ''
    passwordForm.password_confirmation = ''
    ui.success(t('passwordChanged'))
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
  <div class="account-page">
    <header class="account-page__hero">
      <div>
        <p class="account-page__eyebrow">{{ t('account') }}</p>
        <h1>{{ t('profile') }}</h1>
        <p>{{ t('accountLead') }}</p>
      </div>
      <div class="account-page__hero-meta">
        <strong>{{ auth.user?.name }}</strong>
        <span>{{ auth.user?.email }}</span>
      </div>
    </header>

    <section class="account-page__panel account-page__photo">
      <div class="account-page__panel-head">
        <h2>{{ t('profilePhoto') }}</h2>
        <p>{{ t('profilePhotoLead') }}</p>
      </div>

      <v-alert v-if="avatarMessage" type="error" variant="tonal" class="mb-3">{{ avatarMessage }}</v-alert>

      <div class="account-page__avatar-row">
        <div class="account-page__avatar" aria-hidden="true">
          <img
            v-if="auth.user?.avatar_url"
            :src="auth.user.avatar_url"
            :alt="auth.user?.name || t('profilePhoto')"
          >
          <span v-else>{{ auth.user?.name?.charAt(0) || '?' }}</span>
        </div>
        <div class="account-page__avatar-actions">
          <input
            ref="avatarInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="account-page__file"
            @change="onAvatarPicked"
          >
          <button
            type="button"
            class="account-page__btn"
            :disabled="savingAvatar"
            @click="avatarInput?.click()"
          >
            {{ savingAvatar ? t('loading') : (auth.user?.avatar_url ? t('changePhoto') : t('uploadPhoto')) }}
          </button>
          <button
            v-if="auth.user?.avatar_url"
            type="button"
            class="account-page__btn account-page__btn--ghost"
            :disabled="savingAvatar"
            @click="removeAvatar"
          >
            {{ t('removePhoto') }}
          </button>
          <p class="account-page__hint">{{ t('avatarHint') }}</p>
        </div>
      </div>
    </section>

    <div class="account-page__grid">
      <section class="account-page__panel">
        <div class="account-page__panel-head">
          <h2>{{ t('profile') }}</h2>
          <p>{{ t('profileLead') }}</p>
        </div>

        <v-alert v-if="profileMessage" type="error" variant="tonal" class="mb-3">{{ profileMessage }}</v-alert>

        <form class="account-page__form" @submit.prevent="saveProfile">
          <label class="account-page__field">
            <span>{{ t('name') }}</span>
            <input v-model="profile.name" type="text" required autocomplete="name">
            <small v-if="profileErrors.name?.length" class="account-page__error">{{ profileErrors.name[0] }}</small>
          </label>

          <label class="account-page__field">
            <span>{{ t('phone') }}</span>
            <input v-model="profile.phone" type="tel" autocomplete="tel">
            <small v-if="profileErrors.phone?.length" class="account-page__error">{{ profileErrors.phone[0] }}</small>
          </label>

          <label class="account-page__field">
            <span>{{ t('locale') }}</span>
            <select v-model="profile.locale">
              <option value="en">English</option>
              <option value="bn">বাংলা</option>
            </select>
            <small v-if="profileErrors.locale?.length" class="account-page__error">{{ profileErrors.locale[0] }}</small>
          </label>

          <button type="submit" class="account-page__btn" :disabled="savingProfile">
            {{ savingProfile ? t('loading') : t('save') }}
          </button>
        </form>
      </section>

      <section class="account-page__panel">
        <div class="account-page__panel-head">
          <h2>{{ t('changePassword') }}</h2>
          <p>{{ t('passwordLead') }}</p>
        </div>

        <v-alert v-if="passwordMessage" type="error" variant="tonal" class="mb-3">{{ passwordMessage }}</v-alert>

        <form class="account-page__form" @submit.prevent="savePassword">
          <label class="account-page__field">
            <span>{{ t('currentPassword') }}</span>
            <input
              v-model="passwordForm.current_password"
              type="password"
              required
              autocomplete="current-password"
            >
            <small v-if="passwordErrors.current_password?.length" class="account-page__error">
              {{ passwordErrors.current_password[0] }}
            </small>
          </label>

          <label class="account-page__field">
            <span>{{ t('newPassword') }}</span>
            <input
              v-model="passwordForm.password"
              type="password"
              required
              autocomplete="new-password"
            >
            <small v-if="passwordErrors.password?.length" class="account-page__error">
              {{ passwordErrors.password[0] }}
            </small>
          </label>

          <label class="account-page__field">
            <span>{{ t('passwordConfirmation') }}</span>
            <input
              v-model="passwordForm.password_confirmation"
              type="password"
              required
              autocomplete="new-password"
            >
          </label>

          <button type="submit" class="account-page__btn" :disabled="savingPassword">
            {{ savingPassword ? t('loading') : t('save') }}
          </button>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.account-page {
  display: grid;
  gap: 1rem;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: #102a2e;
}

.account-page__hero {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.2rem 1.25rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at top right, rgba(229, 76, 16, 0.22), transparent 42%),
    linear-gradient(135deg, #0b3d36 0%, #0f5c66 55%, #0a2a3a 100%);
  color: #fff;
}

@media (min-width: 720px) {
  .account-page__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.account-page__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.account-page__hero h1 {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 1.85rem);
  font-weight: 800;
}

.account-page__hero p {
  margin: 0.4rem 0 0;
  max-width: 42ch;
  opacity: 0.9;
  font-size: 0.92rem;
  line-height: 1.45;
}

.account-page__hero-meta {
  display: grid;
  gap: 0.15rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.7rem;
  background: rgba(255, 255, 255, 0.12);
  width: fit-content;
}

.account-page__hero-meta strong {
  font-size: 0.95rem;
}

.account-page__hero-meta span {
  font-size: 0.82rem;
  opacity: 0.85;
  word-break: break-all;
}

.account-page__photo {
  margin-bottom: 0;
}

.account-page__avatar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.account-page__avatar {
  width: 88px;
  height: 88px;
  border-radius: 999px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: rgba(15, 92, 102, 0.12);
  color: #0f5c66;
  font-size: 1.8rem;
  font-weight: 800;
  flex: 0 0 auto;
}

.account-page__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.account-page__avatar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  flex: 1 1 14rem;
}

.account-page__file {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.account-page__hint {
  margin: 0;
  width: 100%;
  color: #5b7378;
  font-size: 0.8rem;
}

.account-page__btn--ghost {
  background: #fff;
  color: #0f5c66;
  border: 1px solid #d9e6e8;
}

.account-page__grid {
  display: grid;
  gap: 1rem;
}

@media (min-width: 900px) {
  .account-page__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.account-page__panel {
  padding: 1.1rem;
  border-radius: 1rem;
  border: 1px solid #d9e6e8;
  background: #fff;
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
  min-width: 0;
}

.account-page__panel-head h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.account-page__panel-head p {
  margin: 0.35rem 0 0;
  color: #5b7378;
  font-size: 0.88rem;
  line-height: 1.4;
}

.account-page__form {
  display: grid;
  gap: 0.85rem;
  margin-top: 1rem;
}

.account-page__field {
  display: grid;
  gap: 0.35rem;
}

.account-page__field > span {
  font-size: 0.8rem;
  font-weight: 750;
  color: #35555a;
}

.account-page__field input,
.account-page__field select {
  min-height: 44px;
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.65rem;
  background: #fbfcfd;
  font: inherit;
  color: inherit;
}

.account-page__field input:focus,
.account-page__field select:focus {
  outline: 2px solid rgba(15, 92, 102, 0.25);
  border-color: #0f5c66;
}

.account-page__error {
  color: #b42318;
  font-size: 0.78rem;
}

.account-page__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 1.1rem;
  border: 0;
  border-radius: 0.7rem;
  background: #0f5c66;
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  width: 100%;
}

@media (min-width: 560px) {
  .account-page__btn {
    width: auto;
  }
}

.account-page__btn:disabled {
  opacity: 0.7;
  cursor: wait;
}
</style>
