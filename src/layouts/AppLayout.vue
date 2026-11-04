<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import AppToasts from '../components/AppToasts.vue'
import NotificationBell from '../components/NotificationBell.vue'
import { useAuthStore } from '../stores/auth'
import { useLocaleStore } from '../stores/locale'
import { useUiStore } from '../stores/ui'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { mdAndUp } = useDisplay()
const localeStore = useLocaleStore()
const ui = useUiStore()
const auth = useAuthStore()
const drawer = ref(false)
const studentMenuOpen = ref(false)
const studentSideCollapsed = ref(false)
const arLogo = `${import.meta.env.BASE_URL}images/ar-logo.png`

const roleLabel = computed(() => {
  const slug = auth.roles[0]
  if (slug === 'super_admin') return t('roleSuperAdmin')
  if (slug === 'teacher') return t('roleTeacher')
  if (slug === 'student') return t('roleStudent')
  return slug || ''
})

const isLanding = computed(() => !!route.meta.fullBleed)
const isStudentShell = computed(() => auth.isAuthenticated && auth.isStudent && !auth.isStaff)
const useTopChrome = computed(() => isLanding.value || isStudentShell.value)
const showStudentSide = computed(() => isStudentShell.value && !isLanding.value)
const showAdminDrawer = computed(() => !useTopChrome.value)
const landingMenuOpen = ref(false)
const redirectQuery = computed(() => (
  typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
    ? { redirect: route.query.redirect }
    : undefined
))

const studentLinks = computed(() => [
  { name: 'student-dashboard', label: t('studentDashboard'), icon: 'mdi-view-dashboard-outline' },
  { name: 'my-courses', label: t('myCourses'), icon: 'mdi-book-open-page-variant-outline' },
  { name: 'orders', label: t('myOrders'), icon: 'mdi-receipt-text-outline' },
  { name: 'reading-tests', label: t('readingTests'), icon: 'mdi-book-outline' },
  { name: 'listening-tests', label: t('listeningTests'), icon: 'mdi-headphones' },
  { name: 'writing-tasks', label: t('writingTasks'), icon: 'mdi-pencil-outline' },
  { name: 'speaking-tasks', label: t('speakingTasks'), icon: 'mdi-microphone-outline' },
  { name: 'notifications', label: t('notifications'), icon: 'mdi-bell-outline' },
  { name: 'account', label: t('account'), icon: 'mdi-account-outline' },
])

watch(mdAndUp, (desktop) => {
  drawer.value = desktop && showAdminDrawer.value
  if (desktop) studentMenuOpen.value = false
}, { immediate: true })

watch(showAdminDrawer, (show) => {
  drawer.value = show && mdAndUp.value
})

watch(() => route.fullPath, () => {
  landingMenuOpen.value = false
  studentMenuOpen.value = false
  if (!mdAndUp.value) drawer.value = false
})

function closeIfMobile() {
  if (!mdAndUp.value) drawer.value = false
}

function toggleStudentSide() {
  if (mdAndUp.value) studentSideCollapsed.value = !studentSideCollapsed.value
  else studentMenuOpen.value = !studentMenuOpen.value
}

async function logout() {
  await auth.logout()
  closeIfMobile()
  landingMenuOpen.value = false
  studentMenuOpen.value = false
  router.push({ name: 'home' })
}

function navActive(name) {
  return route.name === name
}

function studentNavActive(name) {
  if (route.name === name) return true
  const aliases = {
    'reading-tests': ['reading-test-intro', 'reading-attempt', 'reading-results'],
    'listening-tests': ['listening-test-intro', 'listening-attempt', 'listening-results'],
    'writing-tasks': ['writing-editor', 'writing-submissions'],
    'speaking-tasks': ['speaking-task-detail', 'speaking-recordings'],
    orders: ['order-detail'],
    'my-courses': ['learning-course', 'lesson-player'],
  }
  return (aliases[name] || []).includes(route.name)
}
</script>

<template>
  <v-app :class="{ 'landing-shell': useTopChrome, 'student-shell': isStudentShell }">
    <v-progress-linear
      v-if="ui.loading"
      class="app-loading"
      color="secondary"
      indeterminate
    />

    <header v-if="useTopChrome" class="site-nav" :class="{ 'site-nav--student-app': showStudentSide }">
      <div class="site-nav__inner" :class="{ 'site-nav__inner--wide': showStudentSide }">
        <router-link
          v-if="!showStudentSide"
          class="site-nav__brand"
          :to="{ name: 'home' }"
          :aria-label="t('appName')"
        >
          <img
            class="site-nav__logo"
            :src="arLogo"
            :alt="t('appName')"
            width="140"
            height="48"
          >
        </router-link>

        <button
          v-if="showStudentSide"
          type="button"
          class="site-nav__side-toggle"
          :aria-label="t('openMenu')"
          @click="toggleStudentSide"
        >
          <v-icon icon="mdi-menu" size="22" />
        </button>

        <nav v-if="!showStudentSide" class="site-nav__links" aria-label="Primary">
          <router-link
            class="site-nav__link"
            active-class=""
            exact-active-class=""
            :class="{ 'is-active': navActive('courses') || navActive('course-detail') }"
            :to="{ name: 'courses' }"
          >
            {{ t('courses') }}
          </router-link>
          <router-link
            v-if="auth.isAuthenticated && auth.isAdmin"
            class="site-nav__link"
            active-class=""
            exact-active-class=""
            :class="{ 'is-active': String(route.name || '').startsWith('admin-') }"
            :to="{ name: 'admin-dashboard' }"
          >
            {{ t('adminDashboard') }}
          </router-link>
          <router-link
            v-else-if="auth.isAuthenticated && auth.isStudent"
            class="site-nav__link"
            active-class=""
            exact-active-class=""
            :class="{ 'is-active': navActive('student-dashboard') || studentNavActive('my-courses') }"
            :to="{ name: 'student-dashboard' }"
          >
            {{ t('studentDashboard') }}
          </router-link>
        </nav>
        <div v-else class="site-nav__spacer" />

        <div class="site-nav__actions">
          <div class="site-nav__locale" role="group" :aria-label="t('language')">
            <button
              type="button"
              class="site-nav__locale-btn"
              :class="{ 'is-active': localeStore.locale === 'en' }"
              @click="localeStore.setLocale('en')"
            >
              EN
            </button>
            <button
              type="button"
              class="site-nav__locale-btn"
              :class="{ 'is-active': localeStore.locale === 'bn' }"
              @click="localeStore.setLocale('bn')"
            >
              বাং
            </button>
          </div>
          <NotificationBell v-if="auth.isAuthenticated" />

          <v-menu v-if="auth.isAuthenticated" location="bottom end" offset="8">
            <template #activator="{ props }">
              <button
                v-bind="props"
                type="button"
                class="site-nav__account"
                :aria-label="t('account')"
              >
                <span class="site-nav__user">
                  {{ auth.user?.name }}
                  <small v-if="roleLabel">{{ roleLabel }}</small>
                </span>
                <span class="site-nav__avatar" aria-hidden="true">
                  <img
                    v-if="auth.user?.avatar_url"
                    :src="auth.user.avatar_url"
                    :alt="auth.user?.name || ''"
                  >
                  <v-icon v-else icon="mdi-account-circle" size="28" />
                </span>
              </button>
            </template>
            <v-list density="compact" min-width="180">
              <v-list-item
                :title="t('account')"
                prepend-icon="mdi-account"
                :to="{ name: 'account' }"
              />
              <v-list-item
                :title="t('logout')"
                prepend-icon="mdi-logout"
                @click="logout"
              />
            </v-list>
          </v-menu>
          <template v-else>
            <router-link
              v-if="route.name !== 'login'"
              class="site-nav__cta"
              :to="{ name: 'login', query: redirectQuery }"
            >
              {{ t('login') }}
            </router-link>
            <router-link
              v-else
              class="site-nav__cta"
              :to="{ name: 'register', query: redirectQuery }"
            >
              {{ t('register') }}
            </router-link>
          </template>

          <button
            v-if="!showStudentSide"
            type="button"
            class="site-nav__menu-btn"
            :aria-expanded="landingMenuOpen"
            :aria-label="t('openMenu')"
            @click="landingMenuOpen = !landingMenuOpen"
          >
            <v-icon :icon="landingMenuOpen ? 'mdi-close' : 'mdi-menu'" size="22" />
          </button>
        </div>
      </div>

      <div v-if="landingMenuOpen && !showStudentSide" class="site-nav__drawer">
        <router-link :to="{ name: 'courses' }" @click="landingMenuOpen = false">{{ t('courses') }}</router-link>
        <router-link
          v-if="auth.isAuthenticated && auth.isAdmin"
          :to="{ name: 'admin-dashboard' }"
          @click="landingMenuOpen = false"
        >
          {{ t('adminDashboard') }}
        </router-link>
        <template v-if="auth.isAuthenticated && auth.isStudent">
          <router-link
            v-for="link in studentLinks"
            :key="`m-${link.name}`"
            :to="{ name: link.name }"
            @click="landingMenuOpen = false"
          >
            {{ link.label }}
          </router-link>
        </template>
        <router-link
          v-if="!auth.isAuthenticated && route.name !== 'login'"
          :to="{ name: 'login', query: redirectQuery }"
          @click="landingMenuOpen = false"
        >
          {{ t('login') }}
        </router-link>
        <router-link
          v-if="!auth.isAuthenticated"
          :to="{ name: 'register', query: redirectQuery }"
          @click="landingMenuOpen = false"
        >
          {{ t('register') }}
        </router-link>
        <button v-if="auth.isAuthenticated" type="button" @click="logout">{{ t('logout') }}</button>
      </div>
    </header>

    <v-app-bar
      v-else
      class="admin-bar"
      color="#0f5c66"
      density="comfortable"
    >
      <v-app-bar-nav-icon
        v-if="!mdAndUp"
        :aria-label="t('openMenu')"
        @click="drawer = !drawer"
      />
      <v-app-bar-title>
        <router-link class="admin-bar__brand" :to="auth.isStaff ? { name: 'admin-dashboard' } : { name: 'home' }" :aria-label="t('appName')">
          <img
            class="admin-bar__logo"
            :src="arLogo"
            :alt="t('appName')"
            width="132"
            height="44"
          >
        </router-link>
      </v-app-bar-title>
      <v-spacer />
      <v-btn
        :variant="localeStore.locale === 'en' ? 'flat' : 'text'"
        :color="localeStore.locale === 'en' ? '#f5c518' : undefined"
        size="small"
        aria-label="English"
        @click="localeStore.setLocale('en')"
      >
        EN
      </v-btn>
      <v-btn
        :variant="localeStore.locale === 'bn' ? 'flat' : 'text'"
        :color="localeStore.locale === 'bn' ? '#f5c518' : undefined"
        size="small"
        aria-label="Bangla"
        @click="localeStore.setLocale('bn')"
      >
        বাংলা
      </v-btn>
      <NotificationBell />
      <v-menu v-if="auth.isAuthenticated" location="bottom end" offset="8">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            class="admin-bar__account"
            variant="text"
            :aria-label="t('account')"
          >
            <span class="admin-bar__user d-none d-md-inline">
              {{ auth.user?.name }}
              <small v-if="roleLabel">{{ roleLabel }}</small>
            </span>
            <span class="admin-bar__avatar ms-1" aria-hidden="true">
              <img
                v-if="auth.user?.avatar_url"
                :src="auth.user.avatar_url"
                :alt="auth.user?.name || ''"
              >
              <v-icon v-else icon="mdi-account-circle" size="28" />
            </span>
            <v-icon icon="mdi-chevron-down" size="18" />
          </v-btn>
        </template>
        <v-list density="compact" min-width="190">
          <v-list-item
            :title="t('account')"
            prepend-icon="mdi-account"
            :to="{ name: 'account' }"
          />
          <v-list-item
            :title="t('logout')"
            prepend-icon="mdi-logout"
            @click="logout"
          />
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-navigation-drawer
      v-if="showAdminDrawer"
      v-model="drawer"
      :permanent="mdAndUp"
      :temporary="!mdAndUp"
      mobile-breakpoint="md"
      width="272"
      class="admin-drawer"
    >
      <div v-if="auth.isAuthenticated" class="admin-drawer__user px-4 py-3">
        <div class="text-subtitle-2 text-truncate">{{ auth.user?.name }}</div>
        <div v-if="roleLabel" class="text-caption">{{ roleLabel }}</div>
      </div>
      <v-divider v-if="auth.isAuthenticated" />
      <v-list nav @click="closeIfMobile">
        <template v-if="!auth.isAuthenticated">
          <v-list-item :title="t('courses')" to="/courses" prepend-icon="mdi-school" />
          <v-list-item :title="t('login')" to="/login" prepend-icon="mdi-login" />
          <v-list-item :title="t('register')" to="/register" prepend-icon="mdi-account-plus" />
        </template>

        <template v-if="auth.isStaff">
          <v-list-item
            v-if="auth.hasPermission('reports.view')"
            :title="t('adminDashboard')"
            to="/admin"
            prepend-icon="mdi-view-dashboard"
          />
          <v-list-item
            v-if="auth.hasPermission('roles.manage')"
            :title="t('rolesPermissions')"
            to="/admin/roles"
            prepend-icon="mdi-shield-account"
          />
          <v-list-item
            v-if="auth.hasPermission('categories.manage')"
            :title="t('categories')"
            to="/admin/categories"
            prepend-icon="mdi-shape"
          />
          <v-list-item
            v-if="auth.hasPermission('users.manage')"
            :title="t('manageStudents')"
            to="/admin/students"
            prepend-icon="mdi-school-outline"
          />
          <v-list-item
            v-if="auth.hasPermission('courses.manage')"
            :title="t('manageCourses')"
            to="/admin/courses"
            prepend-icon="mdi-book-open-variant"
          />
          <v-list-item
            v-if="auth.hasPermission('payments.manage')"
            :title="t('manageOrders')"
            to="/admin/orders"
            prepend-icon="mdi-receipt-text-outline"
          />
          <v-list-item
            v-if="auth.hasPermission('payments.manage')"
            :title="t('manageFinance')"
            to="/admin/finance"
            prepend-icon="mdi-cash-multiple"
          />
          <v-list-item
            v-if="auth.hasPermission('users.manage')"
            :title="t('manageAccounts')"
            to="/admin/accounts"
            prepend-icon="mdi-account-circle-outline"
          />
          <v-list-item
            v-if="auth.hasPermission('payments.manage')"
            :title="t('managePayments')"
            to="/admin/payments"
            prepend-icon="mdi-cash-refund"
          />
          <v-list-item
            v-if="auth.hasPermission('reports.view') || auth.hasPermission('progress.view_assigned')"
            :title="t('reports')"
            to="/admin/reports"
            prepend-icon="mdi-chart-box"
          />
          <v-list-item
            v-if="auth.hasPermission('mock_tests.manage')"
            :title="t('manageReadingTests')"
            to="/admin/reading-tests"
            prepend-icon="mdi-book-open-page-variant"
          />
          <v-list-item
            v-if="auth.hasPermission('mock_tests.manage')"
            :title="t('manageListeningTests')"
            to="/admin/listening-tests"
            prepend-icon="mdi-headphones"
          />
          <v-list-item
            v-if="auth.hasPermission('mock_tests.manage')"
            :title="t('bandConversions')"
            to="/admin/band-conversions"
            prepend-icon="mdi-table"
          />
          <v-list-item
            v-if="auth.hasPermission('writing.manage')"
            :title="t('manageWritingTasks')"
            to="/admin/writing-tasks"
            prepend-icon="mdi-pencil"
          />
          <v-list-item
            v-if="auth.hasPermission('writing.evaluate')"
            :title="t('teacherWritingQueue')"
            to="/teacher/writing"
            prepend-icon="mdi-clipboard-check-outline"
          />
          <v-list-item
            v-if="auth.hasPermission('speaking.manage')"
            :title="t('manageSpeakingTasks')"
            to="/admin/speaking-tasks"
            prepend-icon="mdi-microphone"
          />
          <v-list-item
            v-if="auth.hasPermission('speaking.evaluate')"
            :title="t('teacherSpeakingQueue')"
            to="/teacher/speaking"
            prepend-icon="mdi-microphone-message"
          />
          <v-list-item
            v-if="auth.hasPermission('users.manage')"
            :title="t('users')"
            to="/admin/users"
            prepend-icon="mdi-account-group"
          />
          <v-list-item
            v-if="auth.hasPermission('settings.manage')"
            :title="t('settings')"
            to="/admin/settings"
            prepend-icon="mdi-cog"
          />
          <v-divider class="my-2" />
          <v-list-item :title="t('notifications')" to="/notifications" prepend-icon="mdi-bell-outline" />
          <v-list-item :title="t('account')" to="/account" prepend-icon="mdi-account" />
          <v-list-item :title="t('viewWebsite')" to="/" exact prepend-icon="mdi-web" />
        </template>

        <v-list-item
          v-if="auth.isAuthenticated"
          class="d-md-none"
          :title="t('logout')"
          prepend-icon="mdi-logout"
          @click="logout"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main class="admin-shell-main" :class="{ 'student-shell-main': isStudentShell }">
      <router-view v-if="isLanding" />
      <div
        v-else-if="isStudentShell"
        class="student-desk"
        :class="{
          'is-collapsed': studentSideCollapsed,
          'is-menu-open': studentMenuOpen,
        }"
      >
        <button
          v-if="studentMenuOpen"
          type="button"
          class="student-desk__scrim"
          :aria-label="t('close')"
          @click="studentMenuOpen = false"
        />
        <aside class="student-side" :aria-label="t('studentDashboard')">
          <div class="student-side__card">
            <div class="student-side__brand">
              <router-link class="student-side__logo" :to="{ name: 'home' }" :aria-label="t('appName')">
                <img :src="arLogo" :alt="t('appName')" width="140" height="48">
              </router-link>
              <button
                type="button"
                class="student-side__collapse"
                :aria-label="t('openMenu')"
                @click="toggleStudentSide"
              >
                <v-icon :icon="mdAndUp ? 'mdi-dock-left' : 'mdi-close'" size="20" />
              </button>
            </div>

            <nav class="student-side__nav">
              <router-link
                v-for="link in studentLinks"
                :key="link.name"
                class="student-side__link"
                active-class=""
                exact-active-class=""
                :class="{ 'is-active': studentNavActive(link.name) }"
                :to="{ name: link.name }"
                :title="link.label"
                @click="studentMenuOpen = false"
              >
                <v-icon :icon="link.icon" size="22" />
                <span>{{ link.label }}</span>
              </router-link>
            </nav>

            <div class="student-side__foot">
              <router-link
                class="student-side__chip"
                :to="{ name: 'courses' }"
                @click="studentMenuOpen = false"
              >
                <v-icon icon="mdi-school-outline" size="18" />
                <span>{{ t('courses') }}</span>
              </router-link>
              <router-link
                class="student-side__chip student-side__chip--dark"
                :to="{ name: 'home' }"
                @click="studentMenuOpen = false"
              >
                <v-icon icon="mdi-web" size="18" />
                <span>{{ t('viewWebsite') }}</span>
              </router-link>
            </div>
          </div>
        </aside>

        <div class="student-desk__main">
          <div class="student-main-wrap">
            <router-view />
          </div>
        </div>
      </div>
      <v-container v-else class="admin-main-wrap py-3 py-md-4" fluid>
        <router-view />
      </v-container>
    </v-main>

    <AppToasts />
  </v-app>
</template>

<style scoped>
.app-loading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2000;
}

.admin-bar {
  color: #f7f9fc !important;
}

.admin-bar__brand {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  line-height: 0;
}

.admin-bar__logo {
  display: block;
  height: 40px;
  width: auto;
  max-width: 140px;
  object-fit: contain;
}

.admin-bar :deep(.v-toolbar-title),
.admin-bar :deep(.v-btn),
.admin-bar :deep(.v-icon) {
  color: #f7f9fc !important;
}

.admin-bar :deep(.v-btn.v-btn--flat) {
  color: #1a1400 !important;
}

.admin-bar__account {
  text-transform: none !important;
  letter-spacing: 0 !important;
}

.admin-bar__user {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.15;
  margin-right: 0.15rem;
  text-align: right;
  opacity: 0.95;
}

.admin-bar__user small {
  font-size: 0.7rem;
  opacity: 0.8;
  font-weight: 600;
}

.admin-bar__avatar {
  display: inline-flex;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.16);
}

.admin-bar__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.admin-drawer {
  overflow-x: hidden !important;
}

.admin-drawer :deep(.v-navigation-drawer__content) {
  overflow-x: hidden !important;
  overflow-y: auto;
}

.admin-drawer :deep(.v-list) {
  padding-inline: 0.35rem;
}

.admin-drawer :deep(.v-list-item) {
  margin-inline: 0;
  padding-inline: 0.75rem 0.85rem !important;
  min-height: 44px;
}

.admin-drawer :deep(.v-list-item__prepend) {
  margin-inline-end: 0.75rem !important;
  width: 1.5rem;
  justify-content: center;
}

.admin-drawer :deep(.v-list-item-title) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
  line-height: 1.3;
}

.admin-drawer :deep(.v-list-item--active) {
  background: rgba(15, 92, 102, 0.12);
  color: #0a3d44;
}

.admin-drawer__user {
  background: #0f5c66;
  color: #f7f9fc;
}

.admin-drawer__user .text-caption {
  color: rgba(247, 249, 252, 0.72);
}

.admin-shell-main {
  min-width: 0;
}

.admin-shell-main :deep(.v-main__wrap) {
  min-width: 0;
  overflow-x: hidden;
}

.admin-main-wrap {
  width: 100%;
  max-width: 1280px;
  margin-inline: auto;
  min-width: 0;
}

.student-shell .v-main {
  padding: 0 !important;
}

.student-desk {
  --side-w: 260px;
  --side-collapsed: 88px;
  display: grid;
  grid-template-columns: var(--side-w) minmax(0, 1fr);
  gap: 0.85rem;
  min-height: calc(100dvh - 64px);
  padding: 0.85rem 0.85rem 1.25rem;
  background: #f3f5f8;
  transition: grid-template-columns 220ms ease;
}

.student-desk.is-collapsed {
  grid-template-columns: var(--side-collapsed) minmax(0, 1fr);
}

.student-desk__scrim {
  display: none;
}

.student-side {
  position: sticky;
  top: 0.85rem;
  align-self: start;
  height: calc(100dvh - 64px - 1.7rem);
  z-index: 5;
}

.student-side__card {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 1.15rem;
  background: #fff;
  box-shadow: 0 10px 28px rgba(16, 24, 40, 0.08);
  border: 1px solid #eef2f6;
  overflow: hidden;
}

.student-side__brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.85rem 0.85rem 0.65rem;
}

.student-side__logo {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  text-decoration: none;
  line-height: 0;
}

.student-side__logo img {
  display: block;
  height: 40px;
  width: auto;
  max-width: 132px;
  object-fit: contain;
}

.student-side__collapse {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid #e6ebf2;
  border-radius: 0.55rem;
  background: #fff;
  color: #475467;
  cursor: pointer;
}

.student-side__nav {
  display: grid;
  gap: 0.2rem;
  padding: 0.35rem 0.65rem 0.75rem;
  overflow-y: auto;
  flex: 1 1 auto;
}

.student-side__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 46px;
  padding: 0.55rem 0.8rem;
  border-radius: 0.75rem;
  color: #667085;
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 700;
  transition: background 160ms ease, color 160ms ease;
}

.student-side__link :deep(.v-icon) {
  flex: 0 0 auto;
}

.student-side__link span {
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.25;
}

.student-side__link:hover {
  background: #f2f4f7;
  color: #0b1b34;
}

.student-side__link.is-active {
  background: #f5c518;
  color: #1a1400;
  box-shadow: inset 3px 0 0 #e0b000;
}

.student-side__foot {
  display: grid;
  gap: 0.55rem;
  padding: 0.75rem;
  border-top: 1px solid #eef2f6;
}

.student-side__chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 42px;
  padding: 0 0.8rem;
  border-radius: 0.7rem;
  border: 1.5px solid #f04438;
  color: #f04438;
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 800;
  background: #fff;
}

.student-side__chip--dark {
  border-color: transparent;
  background: linear-gradient(135deg, #0f5c66, #0a2a3a);
  color: #fff;
}

.student-desk.is-collapsed .student-side__logo img,
.student-desk.is-collapsed .student-side__link span,
.student-desk.is-collapsed .student-side__chip span {
  display: none;
}

.student-desk.is-collapsed .student-side__brand {
  justify-content: center;
  padding-inline: 0.5rem;
}

.student-desk.is-collapsed .student-side__link {
  justify-content: center;
  padding-inline: 0.55rem;
}

.student-desk.is-collapsed .student-side__chip {
  padding-inline: 0.4rem;
}

.student-desk__main {
  min-width: 0;
}

.student-main-wrap {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0.25rem 0.15rem 0.5rem;
  min-width: 0;
}

@media (max-width: 959px) {
  .student-desk {
    grid-template-columns: minmax(0, 1fr);
    padding: 0.65rem 0.65rem 1rem;
  }

  .student-side {
    position: fixed;
    top: 64px;
    left: 0.65rem;
    bottom: 0.65rem;
    width: min(280px, calc(100vw - 1.3rem));
    height: auto;
    z-index: 120;
    transform: translateX(calc(-100% - 1rem));
    transition: transform 220ms ease;
  }

  .student-desk.is-menu-open .student-side {
    transform: none;
  }

  .student-desk__scrim {
    display: block;
    position: fixed;
    inset: 64px 0 0;
    z-index: 110;
    border: 0;
    background: rgba(11, 27, 52, 0.42);
    cursor: pointer;
  }

  .student-desk.is-collapsed {
    grid-template-columns: minmax(0, 1fr);
  }

  .student-desk.is-collapsed .student-side__logo img,
  .student-desk.is-collapsed .student-side__link span,
  .student-desk.is-collapsed .student-side__chip span {
    display: inline;
  }

  .student-desk.is-collapsed .student-side__link {
    justify-content: flex-start;
    padding-inline: 0.8rem;
  }
}
</style>
