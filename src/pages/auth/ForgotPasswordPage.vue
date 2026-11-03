<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'

const auth = useAuthStore()
const route = useRoute()
const { t } = useI18n()
const ui = useUiStore()

const email = ref('')
const errors = ref({})
const message = ref('')
const submitting = ref(false)

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
    await auth.forgotPassword(email.value)
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
        <h1>{{ t('forgotPassword') }}</h1>
        <p>{{ t('forgotPasswordLead') }}</p>
      </aside>

      <section class="auth-panel">
        <h2>{{ t('sendResetLink') }}</h2>
        <p class="auth-panel__lead">{{ t('forgotPasswordFormLead') }}</p>

        <div v-if="message" class="auth-alert auth-alert--error">{{ message }}</div>

        <form class="auth-form" @submit.prevent="submit">
          <label>
            <span>{{ t('email') }}</span>
            <input v-model="email" type="email" autocomplete="username" required>
            <small v-if="errors.email?.length">{{ errors.email[0] }}</small>
          </label>
          <button class="auth-btn" type="submit" :disabled="submitting">
            {{ submitting ? t('loading') : t('sendResetLink') }}
          </button>
        </form>

        <div class="auth-links">
          <router-link :to="withRedirect('login')">{{ t('login') }}</router-link>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.auth {
  --ink: #0b1b34;
  --muted: #5b6b7c;
  --yellow: #f5c518;
  --line: #e6ebf2;
  min-height: calc(100vh - 64px);
  min-height: calc(100dvh - 64px);
  display: grid;
  place-items: center;
  padding: 1.5rem 1rem 2.5rem;
  background:
    radial-gradient(circle at 20% 0%, rgba(245, 197, 24, 0.18), transparent 40%),
    linear-gradient(180deg, #eaf2ff 0%, #f7f9fc 45%, #ffffff 100%);
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: var(--ink);
}

.auth-shell {
  width: min(860px, 100%);
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
  font-size: clamp(1.5rem, 3vw, 2rem);
  line-height: 1.2;
  font-weight: 800;
}

.auth-brand p {
  margin: 0;
  color: rgba(247, 249, 252, 0.8);
  line-height: 1.55;
}

.auth-panel {
  padding: 2rem 1.5rem;
}

.auth-panel h2 {
  margin: 0 0 0.35rem;
  font-size: 1.45rem;
  font-weight: 800;
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

.auth-alert--ok {
  background: #e8f8ef;
  color: #146c43;
}

.auth-form {
  display: grid;
  gap: 0.85rem;
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
  min-height: 3rem;
  padding: 0 0.95rem;
  border-radius: 0.65rem;
  border: 1px solid var(--line);
  font: inherit;
}

.auth-form small {
  color: #b42318;
}

.auth-btn {
  min-height: 3rem;
  border: 0;
  border-radius: 0.65rem;
  background: var(--yellow);
  color: #1a1400;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.auth-btn:disabled {
  opacity: 0.7;
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
