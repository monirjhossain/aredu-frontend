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
const arLogo = `${import.meta.env.BASE_URL}images/ar-logo.png`

const roleLabel = computed(() => {
  const slug = auth.roles[0]
  if (slug === 'super_admin') return t('roleSuperAdmin')
  if (slug === 'teacher') return t('roleTeacher')
  if (slug === 'student') return t('roleStudent')
  return slug || ''
})

watch(mdAndUp, (desktop) => {
  drawer.value = desktop
}, { immediate: true })

const isLanding = computed(() => !!route.meta.fullBleed)
const landingMenuOpen = ref(false)
const redirectQuery = computed(() => (
  typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
    ? { redirect: route.query.redirect }
    : undefined
))

watch(() => route.fullPath, () => {
  landingMenuOpen.value = false
  if (!mdAndUp.value) {
    drawer.value = false
  }
})

function closeIfMobile() {
  if (!mdAndUp.value) {
    drawer.value = false
  }
}

async function logout() {
  await auth.logout()
  closeIfMobile()
  landingMenuOpen.value = false
  router.push({ name: 'home' })
}

function navActive(name) {
  return route.name === name
}
</script>

<template>
  <v-app :class="{ 'landing-shell': isLanding }">
    <v-progress-linear
      v-if="ui.loading"
      class="app-loading"
      color="secondary"
      indeterminate
    />

    <header v-if="isLanding" class="site-nav">
      <div class="site-nav__inner">
        <router-link class="site-nav__brand" :to="{ name: 'home' }" :aria-label="t('appName')">
          <img
            class="site-nav__logo"
            :src="arLogo"
            :alt="t('appName')"
            width="140"
            height="48"
          >
        </router-link>

        <nav class="site-nav__links" aria-label="Primary">
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
            :class="{ 'is-active': navActive('student-dashboard') }"
            :to="{ name: 'student-dashboard' }"
          >
            {{ t('studentDashboard') }}
          </router-link>
        </nav>

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
                  <v-icon icon="mdi-account-circle" size="28" />
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

      <div v-if="landingMenuOpen" class="site-nav__drawer">
        <router-link :to="{ name: 'courses' }" @click="landingMenuOpen = false">{{ t('courses') }}</router-link>
        <router-link
          v-if="auth.isAuthenticated && auth.isAdmin"
          :to="{ name: 'admin-dashboard' }"
          @click="landingMenuOpen = false"
        >
          {{ t('adminDashboard') }}
        </router-link>
        <router-link
          v-else-if="auth.isAuthenticated && auth.isStudent"
          :to="{ name: 'student-dashboard' }"
          @click="landingMenuOpen = false"
        >
          {{ t('studentDashboard') }}
        </router-link>
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
            <v-icon icon="mdi-account-circle" size="28" class="ms-1" />
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
      v-if="!isLanding"
      v-model="drawer"
      :permanent="mdAndUp"
      :temporary="!mdAndUp"
      mobile-breakpoint="md"
      width="260"
      class="admin-drawer"
    >
      <div v-if="auth.isAuthenticated" class="admin-drawer__user px-4 py-3">
        <div class="text-subtitle-2 text-truncate">{{ auth.user?.name }}</div>
        <div v-if="roleLabel" class="text-caption">{{ roleLabel }}</div>
      </div>
      <v-divider v-if="auth.isAuthenticated" />
      <v-list nav @click="closeIfMobile">
        <template v-if="!auth.isAuthenticated || auth.isStudent">
          <v-list-item :title="t('courses')" to="/courses" prepend-icon="mdi-school" />
        </template>

        <template v-if="auth.isStudent">
          <v-list-item
            :title="t('studentDashboard')"
            to="/dashboard"
            prepend-icon="mdi-view-dashboard-outline"
          />
          <v-list-item :title="t('notifications')" to="/notifications" prepend-icon="mdi-bell-outline" />
          <v-list-item :title="t('myCourses')" to="/my-courses" prepend-icon="mdi-bookshelf" />
          <v-list-item :title="t('myOrders')" to="/orders" prepend-icon="mdi-receipt-text" />
          <v-list-item :title="t('readingTests')" to="/reading-tests" prepend-icon="mdi-book-open-blank-variant" />
          <v-list-item :title="t('readingResults')" to="/reading-results" prepend-icon="mdi-chart-box-outline" />
          <v-list-item :title="t('listeningTests')" to="/listening-tests" prepend-icon="mdi-headphones" />
          <v-list-item :title="t('listeningResults')" to="/listening-results" prepend-icon="mdi-chart-timeline-variant" />
          <v-list-item :title="t('writingTasks')" to="/writing-tasks" prepend-icon="mdi-pencil-outline" />
          <v-list-item :title="t('myWritingSubmissions')" to="/writing-submissions" prepend-icon="mdi-file-document-edit-outline" />
          <v-list-item :title="t('speakingTasks')" to="/speaking-tasks" prepend-icon="mdi-microphone-outline" />
          <v-list-item :title="t('mySpeakingRecordings')" to="/speaking-recordings" prepend-icon="mdi-record-circle-outline" />
          <v-list-item :title="t('account')" to="/account" prepend-icon="mdi-account" />
        </template>

        <template v-if="!auth.isAuthenticated">
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
            v-if="auth.hasPermission('reports.view') || auth.hasPermission('progress.view_assigned')"
            :title="t('reports')"
            to="/admin/reports"
            prepend-icon="mdi-chart-box"
          />
          <v-list-item
            v-if="auth.hasPermission('categories.manage')"
            :title="t('categories')"
            to="/admin/categories"
            prepend-icon="mdi-shape"
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
            :title="t('managePayments')"
            to="/admin/payments"
            prepend-icon="mdi-cash-refund"
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
            :title="t('manageStudents')"
            to="/admin/students"
            prepend-icon="mdi-school-outline"
          />
          <v-list-item
            v-if="auth.hasPermission('users.manage')"
            :title="t('users')"
            to="/admin/users"
            prepend-icon="mdi-account-group"
          />
          <v-list-item
            v-if="auth.hasPermission('roles.manage')"
            :title="t('rolesPermissions')"
            to="/admin/roles"
            prepend-icon="mdi-shield-account"
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

    <v-main>
      <router-view v-if="isLanding" />
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

.admin-main-wrap {
  max-width: 1180px;
  margin-inline: auto;
}
</style>
