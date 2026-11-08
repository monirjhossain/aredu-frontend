<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth'
import { useLocaleStore } from '../../stores/locale'
import { apiError } from '../../utils/apiError'

const auth = useAuthStore()
const localeStore = useLocaleStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const form = reactive({
  name: '',
  email: '',
  phone: '',
  password: '',
  password_confirmation: '',
})
const errors = ref({})
const message = ref('')
const submitting = ref(false)

function safeRedirect() {
  const redirect = route.query.redirect
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect
  }
  return auth.postLoginRoute()
}

function withRedirect(name) {
  const redirect = route.query.redirect
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return { name, query: { redirect } }
  }
  return { name }
}

async function submit() {
  errors.value = {}
  message.value = ''
  submitting.value = true
  try {
    await auth.register({
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      password: form.password,
      password_confirmation: form.password_confirmation,
      locale: localeStore.locale,
    })
    router.push(safeRedirect())
  } catch (error) {
    const parsed = apiError(error)
    errors.value = parsed.errors
    message.value = parsed.message || t('requestFailed')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth">
    <div class="auth-shell">
      <aside class="auth-brand">
        <p class="auth-brand__kicker">{{ t('appName') }}</p>
        <h1>{{ t('registerHeadline') }}</h1>
        <p>{{ t('registerLead') }}</p>
      </aside>

      <section class="auth-panel">
        <h2>{{ t('register') }}</h2>
        <p class="auth-panel__lead">{{ t('registerFormLead') }}</p>

        <div v-if="message" class="auth-alert auth-alert--error">{{ message }}</div>

        <form class="auth-form" @submit.prevent="submit">
          <label>
            <span>{{ t('name') }}</span>
            <input v-model="form.name" type="text" autocomplete="name" required>
            <small v-if="errors.name?.length">{{ errors.name[0] }}</small>
          </label>

          <label>
            <span>{{ t('email') }}</span>
            <input v-model="form.email" type="email" autocomplete="username" required>
            <small v-if="errors.email?.length">{{ errors.email[0] }}</small>
          </label>

          <label>
            <span>{{ t('phone') }}</span>
            <input v-model="form.phone" type="tel" autocomplete="tel">
            <small v-if="errors.phone?.length">{{ errors.phone[0] }}</small>
          </label>

          <label>
            <span>{{ t('password') }}</span>
            <input v-model="form.password" type="password" autocomplete="new-password" required>
            <small v-if="errors.password?.length">{{ errors.password[0] }}</small>
          </label>

          <label>
            <span>{{ t('passwordConfirmation') }}</span>
            <input v-model="form.password_confirmation" type="password" autocomplete="new-password" required>
          </label>

          <button class="auth-btn" type="submit" :disabled="submitting">
            {{ submitting ? t('loading') : t('register') }}
          </button>
        </form>

        <div class="auth-links">
          <router-link :to="withRedirect('login')">{{ t('alreadyHaveAccount') }}</router-link>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.auth {
  --ink: #0b1b34;
  --muted: #5b6b7c;
  --yellow: #e54c10;
  --line: #e6ebf2;
  min-height: calc(100vh - 64px);
  min-height: calc(100dvh - 64px);
  display: grid;
  place-items: center;
  padding: 1.5rem 1rem 2.5rem;
  background:
    radial-gradient(circle at 20% 0%, rgba(229, 76, 16, 0.18), transparent 40%),
    linear-gradient(180deg, #eaf2ff 0%, #f7f9fc 45%, #ffffff 100%);
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: var(--ink);
}

.auth-shell {
  width: min(920px, 100%);
  display: grid;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid var(--line);
  background: #fff;
  box-shadow: 0 24px 60px rgba(11, 27, 52, 0.1);
}

@media (min-width: 860px) {
  .auth-shell {
    grid-template-columns: 0.95fr 1.05fr;
  }
}

.auth-brand {
  padding: 2rem 1.6rem;
  background: linear-gradient(160deg, #0b1b34 0%, #12324a 55%, #0f5c66 100%);
  color: #f7f9fc;
}

.auth-brand__kicker {
  margin: 0 0 0.75rem;
  color: var(--yellow);
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.78rem;
}

.auth-brand h1 {
  margin: 0 0 0.75rem;
  font-size: clamp(1.6rem, 3vw, 2.1rem);
  line-height: 1.2;
  letter-spacing: -0.03em;
  font-weight: 800;
}

.auth-brand p {
  margin: 0;
  color: rgba(247, 249, 252, 0.8);
  line-height: 1.55;
  max-width: 28ch;
}

.auth-panel {
  padding: 2rem 1.5rem;
}

@media (min-width: 860px) {
  .auth-panel {
    padding: 2.2rem 2rem;
  }
}

.auth-panel h2 {
  margin: 0 0 0.35rem;
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.auth-panel__lead {
  margin: 0 0 1.1rem;
  color: var(--muted);
}

.auth-alert {
  margin-bottom: 1rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.65rem;
  font-size: 0.92rem;
}

.auth-alert--error {
  background: #fdecee;
  color: #b42318;
}

.auth-form {
  display: grid;
  gap: 0.8rem;
}

.auth-form label {
  display: grid;
  gap: 0.3rem;
}

.auth-form span {
  font-size: 0.88rem;
  font-weight: 700;
}

.auth-form input {
  min-height: 2.9rem;
  padding: 0 0.95rem;
  border-radius: 0.65rem;
  border: 1px solid var(--line);
  font: inherit;
  color: var(--ink);
  background: #fff;
}

.auth-form input:focus {
  outline: 2px solid rgba(229, 76, 16, 0.55);
  border-color: #e54c10;
}

.auth-form small {
  color: #b42318;
  font-size: 0.8rem;
}

.auth-btn {
  margin-top: 0.25rem;
  min-height: 3rem;
  border: 0;
  border-radius: 0.65rem;
  background: var(--yellow);
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(229, 76, 16, 0.28);
}

.auth-btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

.auth-links {
  margin-top: 1.1rem;
}

.auth-links a {
  color: #e85d4c;
  font-weight: 700;
  text-decoration: none;
}
</style>
