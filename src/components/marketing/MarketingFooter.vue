<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth'

const props = defineProps({
  brandName: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  contactInformation: { type: String, default: '' },
  supportEmail: { type: String, default: '' },
})

const { t } = useI18n()
const auth = useAuthStore()

const name = computed(() => props.brandName || t('appName'))
const year = computed(() => new Date().getFullYear())
const logoSrc = computed(() => props.logoUrl || `${import.meta.env.BASE_URL}images/ar-logo.png`)
</script>

<template>
  <footer class="mkt-footer">
    <div class="mkt-footer__glow" aria-hidden="true" />
    <div class="mkt-footer__inner">
      <div class="mkt-footer__brand">
        <router-link class="mkt-footer__logo-link" :to="{ name: 'home' }" :aria-label="name">
          <img class="mkt-footer__logo" :src="logoSrc" :alt="name">
        </router-link>
        <p class="mkt-footer__name">{{ name }}</p>
        <p class="mkt-footer__tag">{{ t('footerTagline') }}</p>
      </div>

      <nav class="mkt-footer__col" :aria-label="t('footerExplore')">
        <h2>{{ t('footerExplore') }}</h2>
        <router-link :to="{ name: 'home' }">{{ t('home') }}</router-link>
        <router-link :to="{ name: 'free-courses' }">{{ t('navFreeCourses') }}</router-link>
        <router-link :to="{ name: 'free-practice' }">{{ t('navMocks') }}</router-link>
        <router-link :to="{ name: 'courses' }">{{ t('allCourses') }}</router-link>
        <router-link v-if="!auth.isAuthenticated" :to="{ name: 'login' }">{{ t('login') }}</router-link>
        <router-link v-if="!auth.isAuthenticated" :to="{ name: 'register' }">{{ t('register') }}</router-link>
        <router-link
          v-else-if="auth.isStudent"
          :to="{ name: 'student-dashboard' }"
        >
          {{ t('studentDashboard') }}
        </router-link>
        <router-link
          v-else-if="auth.isAdmin"
          :to="{ name: 'admin-dashboard' }"
        >
          {{ t('adminDashboard') }}
        </router-link>
      </nav>

      <div class="mkt-footer__col">
        <h2>{{ t('contactUs') }}</h2>
        <p v-if="contactInformation">{{ contactInformation }}</p>
        <p v-else>{{ t('landingContactEmpty') }}</p>
        <a
          v-if="supportEmail"
          class="mkt-footer__mail"
          :href="`mailto:${supportEmail}`"
        >
          {{ supportEmail }}
        </a>
      </div>
    </div>

    <div class="mkt-footer__bottom">
      <p>© {{ year }} {{ name }}. {{ t('footerRights') }}</p>
    </div>
  </footer>
</template>

<style scoped>
.mkt-footer {
  position: relative;
  margin-top: 0;
  padding: 3rem 0 0;
  overflow: hidden;
  color: #e8eef5;
  background:
    radial-gradient(circle at 12% 0%, rgba(245, 197, 24, 0.12), transparent 40%),
    linear-gradient(180deg, #0b1b34 0%, #081424 100%);
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.mkt-footer__glow {
  position: absolute;
  inset: auto -10% -40% 40%;
  height: 70%;
  background: radial-gradient(circle, rgba(232, 93, 76, 0.14), transparent 65%);
  pointer-events: none;
}

.mkt-footer__inner {
  position: relative;
  z-index: 1;
  width: min(960px, calc(100% - 2rem));
  margin: 0 auto;
  display: grid;
  gap: 2rem;
  padding-bottom: 2rem;
}

@media (min-width: 800px) {
  .mkt-footer__inner {
    grid-template-columns: 1.4fr 1fr 1.1fr;
    gap: 2.5rem;
    align-items: start;
  }
}

.mkt-footer__logo-link {
  display: inline-flex;
  line-height: 0;
  text-decoration: none;
}

.mkt-footer__logo {
  height: 40px;
  width: auto;
  max-width: 140px;
  object-fit: contain;
}

.mkt-footer__name {
  margin: 0.85rem 0 0.4rem;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #fff;
}

.mkt-footer__tag {
  margin: 0;
  max-width: 32ch;
  color: rgba(232, 238, 245, 0.72);
  font-size: 0.92rem;
  line-height: 1.5;
}

.mkt-footer__col {
  display: grid;
  gap: 0.55rem;
  align-content: start;
}

.mkt-footer__col h2 {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #f5c518;
}

.mkt-footer__col a,
.mkt-footer__col p {
  margin: 0;
  color: rgba(232, 238, 245, 0.78);
  font-size: 0.92rem;
  line-height: 1.45;
  text-decoration: none;
}

.mkt-footer__col a:hover {
  color: #fff;
}

.mkt-footer__mail {
  color: #f5c518 !important;
  font-weight: 700;
  word-break: break-word;
}

.mkt-footer__bottom {
  position: relative;
  z-index: 1;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1rem 1rem 1.25rem;
}

.mkt-footer__bottom p {
  margin: 0 auto;
  width: min(960px, 100%);
  color: rgba(232, 238, 245, 0.55);
  font-size: 0.8rem;
  text-align: center;
}

@media (min-width: 800px) {
  .mkt-footer__bottom p {
    text-align: left;
  }
}
</style>
