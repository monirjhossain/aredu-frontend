<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { useLocaleStore } from '../../stores/locale'
import { useUiStore } from '../../stores/ui'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const auth = useAuthStore()
const localeStore = useLocaleStore()
const ui = useUiStore()

const dashboard = ref(null)
const message = ref('')
const loading = ref(true)
const activatingId = ref(null)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return t('goodMorning')
  if (hour < 18) return t('goodAfternoon')
  return t('goodEvening')
})

const todayLabel = computed(() => {
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date().toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

const cards = computed(() => {
  if (!dashboard.value) return []
  return [
    { key: 'students', label: t('students'), value: formatInt(dashboard.value.students), icon: 'mdi-school', tone: 'teal' },
    { key: 'teachers', label: t('teachers'), value: formatInt(dashboard.value.teachers), icon: 'mdi-human-male-board', tone: 'cyan' },
    { key: 'courses', label: t('courses'), value: formatInt(dashboard.value.courses), icon: 'mdi-book-open-variant', tone: 'amber' },
    { key: 'enrollments', label: t('enrollments'), value: formatInt(dashboard.value.enrollments), icon: 'mdi-account-check', tone: 'green' },
    { key: 'revenue', label: t('revenue'), value: revenueLabel(dashboard.value.revenue), icon: 'mdi-cash', tone: 'coral' },
    { key: 'pending', label: t('pendingEvaluations'), value: formatInt(dashboard.value.pending_evaluations.total), icon: 'mdi-clipboard-text-clock', tone: 'violet' },
  ]
})

const registrationSeries = computed(() => dashboard.value?.charts?.registrations_daily || [])
const enrollmentSeries = computed(() => dashboard.value?.charts?.enrollments_daily || [])
const revenueSeries = computed(() => dashboard.value?.charts?.revenue_monthly || [])
const userMix = computed(() => dashboard.value?.charts?.user_mix || [])
const orderStatus = computed(() => dashboard.value?.charts?.order_status || [])
const topCourses = computed(() => dashboard.value?.charts?.top_courses || [])

const registrationTotal = computed(() => registrationSeries.value.reduce((sum, row) => sum + row.value, 0))
const enrollmentTotal = computed(() => enrollmentSeries.value.reduce((sum, row) => sum + row.value, 0))
const revenuePeriodTotal = computed(() => revenueSeries.value.reduce((sum, row) => sum + Number(row.value || 0), 0))

const registrationLine = computed(() => buildLineChart(registrationSeries.value, '#0f5c66'))
const enrollmentBars = computed(() => buildBarChart(enrollmentSeries.value, '#14919b'))
const revenueBars = computed(() => buildBarChart(revenueSeries.value, '#e8a317', true))

const userMixDonut = computed(() => buildDonut(
  userMix.value.map((row) => ({
    key: row.key,
    label: t(row.label),
    value: row.value,
    color: row.key === 'students' ? '#0f5c66' : '#14919b',
  })),
))

const orderStatusDonut = computed(() => buildDonut(
  orderStatus.value.map((row) => ({
    key: row.key,
    label: statusLabel(row.key),
    value: row.value,
    color: statusColor(row.key),
  })),
))

const topCourseMax = computed(() => Math.max(...topCourses.value.map((row) => row.value), 1))

const evaluationMix = computed(() => {
  const writing = dashboard.value?.pending_evaluations?.writing || 0
  const speaking = dashboard.value?.pending_evaluations?.speaking || 0
  return [
    { key: 'writing', label: t('writing'), value: writing, color: '#0f5c66' },
    { key: 'speaking', label: t('speaking'), value: speaking, color: '#e85d4c' },
  ]
})

const quickLinks = computed(() => [
  { to: { name: 'admin-roles' }, icon: 'mdi-shield-account-outline', label: t('rolesPermissions'), show: auth.hasPermission('roles.manage') },
  { to: { name: 'admin-categories' }, icon: 'mdi-shape-outline', label: t('categories'), show: auth.hasPermission('categories.manage') },
  { to: { name: 'admin-students' }, icon: 'mdi-school-outline', label: t('manageStudents'), show: auth.hasPermission('users.manage') },
  { to: { name: 'admin-courses' }, icon: 'mdi-book-plus-outline', label: t('manageCourses'), show: auth.hasPermission('courses.manage') },
  { to: { name: 'admin-orders' }, icon: 'mdi-receipt-text-outline', label: t('manageOrders'), show: auth.hasPermission('payments.manage') },
  { to: { name: 'admin-finance' }, icon: 'mdi-cash-multiple', label: t('manageFinance'), show: auth.hasPermission('payments.manage') },
  { to: { name: 'admin-accounts' }, icon: 'mdi-account-circle-outline', label: t('manageAccounts'), show: auth.hasPermission('users.manage') },
  { to: { name: 'admin-payments' }, icon: 'mdi-credit-card-outline', label: t('managePayments'), show: auth.hasPermission('payments.manage') },
  {
    to: { name: 'admin-reports' },
    icon: 'mdi-chart-box-outline',
    label: t('reports'),
    show: auth.hasPermission('reports.view') || auth.hasPermission('progress.view_assigned'),
  },
].filter((item) => item.show))

async function loadDashboard() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/dashboard', { skipErrorToast: true })
    dashboard.value = data.data
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

async function activatePackage(order) {
  if (!auth.hasPermission('payments.manage') || order.status !== 'pending') return
  activatingId.value = order.id
  try {
    await http.post(`/admin/orders/${order.id}/confirm-bkash`, {}, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    ui.success(t('packageActivated'))
    await loadDashboard()
  } catch (error) {
    ui.toastError(apiError(error).message || t('requestFailed'))
  } finally {
    activatingId.value = null
  }
}

onMounted(loadDashboard)

function formatInt(value) {
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Intl.NumberFormat(locale).format(Number(value || 0))
}

function revenueLabel(rows) {
  if (!rows?.length) return `0 ${t('currencyBdt')}`
  return rows.map((row) => `${row.total} ${row.currency}`).join(' · ')
}

function money(value) {
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function when(value) {
  if (!value) return ''
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(status) {
  const key = `orderStatus.${status}`
  const label = t(key)
  return label === key ? status : label
}

function statusColor(status) {
  const map = {
    paid: '#14919b',
    pending: '#e8a317',
    failed: '#e85d4c',
    cancelled: '#94a3b8',
    refunded: '#7c3aed',
  }
  return map[status] || '#0f5c66'
}

function evaluationLabel(type) {
  return type === 'speaking' ? t('speaking') : t('writing')
}

function buildLineChart(series, color) {
  const width = 360
  const height = 160
  const padX = 12
  const padY = 18
  const values = series.map((row) => Number(row.value || 0))
  const max = Math.max(...values, 1)
  const step = series.length > 1 ? (width - padX * 2) / (series.length - 1) : 0

  const points = series.map((row, index) => {
    const x = padX + index * step
    const y = height - padY - (Number(row.value || 0) / max) * (height - padY * 2)
    return { x, y, label: row.label, value: row.value }
  })

  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = points.length
    ? `M ${points[0].x} ${height - padY} L ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} L ${points[points.length - 1].x} ${height - padY} Z`
    : ''

  return { width, height, points, line, area, color, labels: series.map((row) => row.label) }
}

function buildBarChart(series, color, moneyMode = false) {
  const width = 360
  const height = 160
  const padX = 16
  const padY = 18
  const values = series.map((row) => Number(row.value || 0))
  const max = Math.max(...values, 1)
  const gap = 8
  const barWidth = series.length
    ? Math.max(10, (width - padX * 2 - gap * (series.length - 1)) / series.length)
    : 0

  const bars = series.map((row, index) => {
    const value = Number(row.value || 0)
    const barHeight = (value / max) * (height - padY * 2)
    const x = padX + index * (barWidth + gap)
    const y = height - padY - barHeight
    return {
      x,
      y,
      width: barWidth,
      height: Math.max(barHeight, value > 0 ? 3 : 0),
      label: row.label,
      value,
      display: moneyMode ? money(value) : formatInt(value),
    }
  })

  return { width, height, bars, color, padY }
}

function buildDonut(items) {
  const total = items.reduce((sum, row) => sum + Number(row.value || 0), 0)
  if (!total) {
    return {
      total: 0,
      items: [],
      style: { background: 'conic-gradient(#e6eef0 0 100%)' },
    }
  }

  let cursor = 0
  const stops = []
  const enriched = items.map((row) => {
    const value = Number(row.value || 0)
    const start = cursor
    const share = (value / total) * 100
    cursor += share
    stops.push(`${row.color} ${start}% ${cursor}%`)
    return { ...row, value, percent: Math.round(share) }
  })

  return {
    total,
    items: enriched,
    style: { background: `conic-gradient(${stops.join(', ')})` },
  }
}
</script>

<template>
  <div class="admin-dash">
    <header class="admin-dash__hero">
      <div>
        <p class="admin-dash__eyebrow">{{ t('adminDashboard') }}</p>
        <h1 class="admin-dash__title">{{ greeting }}, {{ auth.user?.name?.split(' ')[0] || t('roleSuperAdmin') }}</h1>
        <p class="admin-dash__sub">{{ todayLabel }} · {{ t('dashboardOverviewLead') }}</p>
      </div>
      <div v-if="quickLinks.length" class="admin-dash__quick">
        <router-link
          v-for="link in quickLinks"
          :key="link.label"
          class="admin-dash__quick-link"
          :to="link.to"
        >
          <v-icon size="18">{{ link.icon }}</v-icon>
          <span>{{ link.label }}</span>
        </router-link>
      </div>
    </header>

    <div v-if="loading" class="admin-dash__loading">
      <v-progress-circular indeterminate color="#0f5c66" size="42" />
    </div>
    <v-alert v-else-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>

    <template v-else-if="dashboard">
      <section class="admin-dash__stats">
        <article
          v-for="card in cards"
          :key="card.key"
          class="admin-stat"
          :data-tone="card.tone"
        >
          <div class="admin-stat__icon">
            <v-icon size="22">{{ card.icon }}</v-icon>
          </div>
          <div>
            <p class="admin-stat__label">{{ card.label }}</p>
            <p class="admin-stat__value">{{ card.value }}</p>
          </div>
        </article>
      </section>

      <section class="admin-dash__charts">
        <article class="admin-panel admin-panel--wide">
          <div class="admin-panel__head">
            <div>
              <h2>{{ t('registrationsTrend') }}</h2>
              <p>{{ t('last14Days') }}</p>
            </div>
            <div class="admin-panel__metric">
              <strong>{{ formatInt(registrationTotal) }}</strong>
              <span>{{ t('newStudents') }}</span>
            </div>
          </div>
          <div class="admin-chart">
            <svg
              class="admin-chart__svg"
              :viewBox="`0 0 ${registrationLine.width} ${registrationLine.height}`"
              role="img"
              :aria-label="t('registrationsTrend')"
            >
              <defs>
                <linearGradient id="regFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#0f5c66" stop-opacity="0.28" />
                  <stop offset="100%" stop-color="#0f5c66" stop-opacity="0.02" />
                </linearGradient>
              </defs>
              <path :d="registrationLine.area" fill="url(#regFill)" />
              <polyline
                fill="none"
                stroke="#0f5c66"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                :points="registrationLine.line"
              />
              <circle
                v-for="(point, index) in registrationLine.points"
                :key="`reg-${index}`"
                :cx="point.x"
                :cy="point.y"
                r="3.5"
                fill="#fff"
                stroke="#0f5c66"
                stroke-width="2"
              />
            </svg>
            <div class="admin-chart__axis">
              <span
                v-for="(label, index) in registrationLine.labels"
                :key="`reg-label-${index}`"
                :class="{ 'is-edge': index === 0 || index === registrationLine.labels.length - 1 || index % 3 === 0 }"
              >
                {{ index === 0 || index === registrationLine.labels.length - 1 || index % 3 === 0 ? label : '' }}
              </span>
            </div>
          </div>
        </article>

        <article class="admin-panel">
          <div class="admin-panel__head">
            <div>
              <h2>{{ t('userMix') }}</h2>
              <p>{{ t('students') }} · {{ t('teachers') }}</p>
            </div>
          </div>
          <div class="admin-donut-wrap">
            <div class="admin-donut" :style="userMixDonut.style">
              <div class="admin-donut__hole">
                <strong>{{ formatInt(userMixDonut.total) }}</strong>
                <span>{{ t('users') }}</span>
              </div>
            </div>
            <ul class="admin-legend">
              <li v-for="item in userMixDonut.items" :key="item.key">
                <span class="admin-legend__swatch" :style="{ background: item.color }" />
                <span>{{ item.label }}</span>
                <strong>{{ formatInt(item.value) }}</strong>
              </li>
              <li v-if="!userMixDonut.items.length" class="admin-legend__empty">{{ t('noChartData') }}</li>
            </ul>
          </div>
        </article>

        <article class="admin-panel">
          <div class="admin-panel__head">
            <div>
              <h2>{{ t('enrollmentsTrend') }}</h2>
              <p>{{ t('last14Days') }}</p>
            </div>
            <div class="admin-panel__metric">
              <strong>{{ formatInt(enrollmentTotal) }}</strong>
              <span>{{ t('enrollments') }}</span>
            </div>
          </div>
          <div class="admin-chart">
            <svg
              class="admin-chart__svg"
              :viewBox="`0 0 ${enrollmentBars.width} ${enrollmentBars.height}`"
              role="img"
              :aria-label="t('enrollmentsTrend')"
            >
              <rect
                v-for="(bar, index) in enrollmentBars.bars"
                :key="`enroll-${index}`"
                :x="bar.x"
                :y="bar.y"
                :width="bar.width"
                :height="bar.height"
                rx="4"
                :fill="enrollmentBars.color"
                opacity="0.9"
              />
            </svg>
            <div class="admin-chart__axis">
              <span
                v-for="(bar, index) in enrollmentBars.bars"
                :key="`enroll-label-${index}`"
              >
                {{ index === 0 || index === enrollmentBars.bars.length - 1 || index % 3 === 0 ? bar.label : '' }}
              </span>
            </div>
          </div>
        </article>

        <article class="admin-panel">
          <div class="admin-panel__head">
            <div>
              <h2>{{ t('revenueTrend') }}</h2>
              <p>{{ t('last6Months') }}</p>
            </div>
            <div class="admin-panel__metric">
              <strong>{{ money(revenuePeriodTotal) }}</strong>
              <span>{{ t('currencyBdt') }}</span>
            </div>
          </div>
          <div class="admin-chart">
            <svg
              class="admin-chart__svg"
              :viewBox="`0 0 ${revenueBars.width} ${revenueBars.height}`"
              role="img"
              :aria-label="t('revenueTrend')"
            >
              <rect
                v-for="(bar, index) in revenueBars.bars"
                :key="`rev-${index}`"
                :x="bar.x"
                :y="bar.y"
                :width="bar.width"
                :height="bar.height || 2"
                rx="5"
                :fill="bar.height ? revenueBars.color : '#d7e4e6'"
              />
            </svg>
            <div class="admin-chart__axis">
              <span v-for="(bar, index) in revenueBars.bars" :key="`rev-label-${index}`">{{ bar.label }}</span>
            </div>
          </div>
        </article>

        <article class="admin-panel">
          <div class="admin-panel__head">
            <div>
              <h2>{{ t('orderStatusBreakdown') }}</h2>
              <p>{{ t('ordersOverview') }}</p>
            </div>
          </div>
          <div class="admin-donut-wrap">
            <div class="admin-donut" :style="orderStatusDonut.style">
              <div class="admin-donut__hole">
                <strong>{{ formatInt(orderStatusDonut.total) }}</strong>
                <span>{{ t('orders') }}</span>
              </div>
            </div>
            <ul class="admin-legend">
              <li v-for="item in orderStatusDonut.items" :key="item.key">
                <span class="admin-legend__swatch" :style="{ background: item.color }" />
                <span>{{ item.label }}</span>
                <strong>{{ formatInt(item.value) }}</strong>
              </li>
              <li v-if="!orderStatusDonut.items.length" class="admin-legend__empty">{{ t('noOrders') }}</li>
            </ul>
          </div>
        </article>

        <article class="admin-panel">
          <div class="admin-panel__head">
            <div>
              <h2>{{ t('topCourses') }}</h2>
              <p>{{ t('byActiveEnrollments') }}</p>
            </div>
          </div>
          <div v-if="topCourses.length" class="admin-bars">
            <div v-for="course in topCourses" :key="course.id" class="admin-bars__row">
              <div class="admin-bars__meta">
                <span>{{ course.title }}</span>
                <strong>{{ formatInt(course.value) }}</strong>
              </div>
              <div class="admin-bars__track">
                <span
                  class="admin-bars__fill"
                  :style="{ width: `${(course.value / topCourseMax) * 100}%` }"
                />
              </div>
            </div>
          </div>
          <p v-else class="admin-empty">{{ t('noEnrollmentsYet') }}</p>

          <div class="admin-eval-mix">
            <p class="admin-eval-mix__title">{{ t('pendingEvaluations') }}</p>
            <div class="admin-eval-mix__rows">
              <div v-for="item in evaluationMix" :key="item.key" class="admin-eval-mix__row">
                <span class="admin-legend__swatch" :style="{ background: item.color }" />
                <span>{{ item.label }}</span>
                <strong>{{ formatInt(item.value) }}</strong>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section class="admin-dash__lists">
        <article class="admin-panel">
          <div class="admin-panel__head">
            <div>
              <h2>{{ t('recentOrders') }}</h2>
              <p>{{ t('latestActivity') }}</p>
            </div>
            <router-link
              v-if="auth.hasPermission('payments.manage')"
              class="admin-panel__link"
              :to="{ name: 'admin-orders' }"
            >
              {{ t('viewAll') }}
            </router-link>
          </div>
          <div v-if="dashboard.recent_orders.length === 0" class="admin-empty">{{ t('noOrders') }}</div>
          <ul v-else class="admin-feed">
            <li v-for="order in dashboard.recent_orders" :key="order.id" class="admin-feed__order">
              <div>
                <strong>{{ order.order_number }}</strong>
                <p>{{ order.user.name }} · {{ order.total }} {{ order.currency }}</p>
              </div>
              <div class="admin-feed__order-actions">
                <v-chip size="small" variant="tonal" :color="statusColor(order.status)">
                  {{ statusLabel(order.status) }}
                </v-chip>
                <button
                  v-if="order.status === 'pending' && auth.hasPermission('payments.manage')"
                  type="button"
                  class="admin-ui__btn admin-ui__btn--solid"
                  :disabled="activatingId === order.id"
                  @click="activatePackage(order)"
                >
                  {{ t('activatePackage') }}
                </button>
              </div>
            </li>
          </ul>
        </article>

        <article class="admin-panel">
          <div class="admin-panel__head">
            <div>
              <h2>{{ t('recentRegistrations') }}</h2>
              <p>{{ t('latestActivity') }}</p>
            </div>
          </div>
          <div v-if="dashboard.recent_registrations.length === 0" class="admin-empty">{{ t('noRegistrations') }}</div>
          <ul v-else class="admin-feed">
            <li v-for="user in dashboard.recent_registrations" :key="user.id">
              <div class="admin-feed__avatar" aria-hidden="true">{{ user.name?.charAt(0) || '?' }}</div>
              <div class="admin-feed__body">
                <strong>{{ user.name }}</strong>
                <p>{{ user.email }}</p>
              </div>
              <span class="admin-feed__time">{{ when(user.created_at) }}</span>
            </li>
          </ul>
        </article>

        <article class="admin-panel">
          <div class="admin-panel__head">
            <div>
              <h2>{{ t('pendingEvaluations') }}</h2>
              <p>{{ t('latestActivity') }}</p>
            </div>
          </div>
          <div v-if="dashboard.pending_evaluations.items.length === 0" class="admin-empty">{{ t('noPendingEvaluations') }}</div>
          <ul v-else class="admin-feed">
            <li v-for="item in dashboard.pending_evaluations.items" :key="`${item.type}-${item.id}`">
              <div class="admin-feed__body">
                <strong>{{ item.title }}</strong>
                <p>{{ item.student_name }} · {{ when(item.submitted_at) }}</p>
              </div>
              <v-chip size="small" variant="tonal" color="#0f5c66">
                {{ evaluationLabel(item.type) }}
              </v-chip>
            </li>
          </ul>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped>
.admin-dash {
  --teal: #0f5c66;
  --teal-soft: #e7f4f5;
  --ink: #102a2e;
  --muted: #5b7378;
  --line: #d9e6e8;
  --paper: #f4f8f9;
  color: var(--ink);
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  min-width: 0;
  width: 100%;
  overflow-x: clip;
}

.admin-dash__hero {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem 1.5rem;
  margin-bottom: 1.25rem;
  padding: 1.25rem 1.35rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at 100% 0%, rgba(245, 197, 24, 0.18), transparent 42%),
    linear-gradient(135deg, #0f5c66 0%, #14919b 55%, #0a3d44 100%);
  color: #f7fbfb;
  box-shadow: 0 16px 40px rgba(15, 92, 102, 0.22);
}

.admin-dash__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.8;
}

.admin-dash__title {
  margin: 0;
  font-size: clamp(1.35rem, 2.4vw, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.admin-dash__sub {
  margin: 0.4rem 0 0;
  opacity: 0.86;
  font-size: 0.95rem;
}

.admin-dash__quick {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-content: flex-start;
}

.admin-dash__quick-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.35rem;
  padding: 0 0.85rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #fff;
  text-decoration: none;
  font-size: 0.86rem;
  font-weight: 650;
  transition: background 160ms ease, transform 160ms ease;
}

.admin-dash__quick-link:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.admin-dash__loading {
  display: grid;
  place-items: center;
  min-height: 220px;
}

.admin-dash__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  margin-bottom: 1rem;
}

@media (min-width: 900px) {
  .admin-dash__stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1200px) {
  .admin-dash__stats {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

.admin-stat {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  padding: 0.95rem 1rem;
  border-radius: 0.95rem;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 8px 20px rgba(16, 42, 46, 0.04);
  animation: dash-rise 520ms ease both;
}

.admin-stat:nth-child(2) { animation-delay: 40ms; }
.admin-stat:nth-child(3) { animation-delay: 80ms; }
.admin-stat:nth-child(4) { animation-delay: 120ms; }
.admin-stat:nth-child(5) { animation-delay: 160ms; }
.admin-stat:nth-child(6) { animation-delay: 200ms; }

.admin-stat__icon {
  display: grid;
  place-items: center;
  width: 2.55rem;
  height: 2.55rem;
  border-radius: 0.8rem;
  color: #fff;
  flex: 0 0 auto;
}

.admin-stat[data-tone='teal'] .admin-stat__icon { background: #0f5c66; }
.admin-stat[data-tone='cyan'] .admin-stat__icon { background: #14919b; }
.admin-stat[data-tone='amber'] .admin-stat__icon { background: #d97706; }
.admin-stat[data-tone='green'] .admin-stat__icon { background: #0f766e; }
.admin-stat[data-tone='coral'] .admin-stat__icon { background: #e85d4c; }
.admin-stat[data-tone='violet'] .admin-stat__icon { background: #7c3aed; }

.admin-stat__label {
  margin: 0;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 650;
}

.admin-stat__value {
  margin: 0.15rem 0 0;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
  word-break: break-word;
}

.admin-dash__charts,
.admin-dash__lists {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.95rem;
  margin-bottom: 1rem;
  align-items: stretch;
}

@media (min-width: 760px) {
  .admin-dash__lists {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 960px) {
  .admin-dash__charts {
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  }

  .admin-panel--wide {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1200px) {
  .admin-dash__charts {
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.9fr) minmax(0, 1fr);
  }

  .admin-panel--wide {
    grid-column: span 2;
  }

  .admin-dash__lists {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.admin-panel {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  padding: 1.05rem 1.1rem 1.15rem;
  border-radius: 1rem;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 10px 28px rgba(16, 42, 46, 0.045);
  animation: dash-rise 650ms ease both;
  position: relative;
  z-index: 0;
}

.admin-panel__head {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
  margin-bottom: 0.9rem;
}

.admin-panel__head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.admin-panel__head p {
  margin: 0.2rem 0 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.admin-panel__metric {
  text-align: right;
}

.admin-panel__metric strong {
  display: block;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--teal);
  line-height: 1.1;
}

.admin-panel__metric span {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 650;
}

.admin-panel__link {
  color: var(--teal);
  font-size: 0.85rem;
  font-weight: 700;
  text-decoration: none;
}

.admin-chart__svg {
  display: block;
  width: 100%;
  height: auto;
}

.admin-chart__axis {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 0.15rem;
  margin-top: 0.35rem;
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 650;
}

.admin-chart__axis span {
  text-align: center;
  min-height: 1em;
}

.admin-donut-wrap {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  align-items: center;
}

.admin-donut {
  width: 132px;
  height: 132px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.admin-donut__hole {
  width: 78px;
  height: 78px;
  border-radius: 50%;
  background: #fff;
  display: grid;
  place-content: center;
  text-align: center;
}

.admin-donut__hole strong {
  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1;
}

.admin-donut__hole span {
  margin-top: 0.2rem;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 650;
}

.admin-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}

.admin-legend li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.55rem;
  align-items: center;
  font-size: 0.86rem;
}

.admin-legend__swatch {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
}

.admin-legend__empty,
.admin-empty {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.admin-bars {
  display: grid;
  gap: 0.75rem;
}

.admin-bars__meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.3rem;
  font-size: 0.86rem;
}

.admin-bars__meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-bars__track {
  height: 0.55rem;
  border-radius: 999px;
  background: var(--teal-soft);
  overflow: hidden;
}

.admin-bars__fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0f5c66, #14919b);
}

.admin-eval-mix {
  margin-top: 1.1rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--line);
}

.admin-eval-mix__title {
  margin: 0 0 0.55rem;
  font-size: 0.82rem;
  font-weight: 750;
}

.admin-eval-mix__rows {
  display: grid;
  gap: 0.45rem;
}

.admin-eval-mix__row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.55rem;
  align-items: center;
  font-size: 0.86rem;
}

.admin-feed {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.7rem;
}

.admin-feed li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem 0.7rem;
  padding: 0.65rem 0.7rem;
  border-radius: 0.75rem;
  background: var(--paper);
  min-width: 0;
}

.admin-feed__order {
  justify-content: space-between;
}

.admin-feed__order-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.admin-feed__order-actions .admin-ui__btn {
  min-height: 2rem;
  padding: 0 0.7rem;
  font-size: 0.8rem;
}

.admin-feed__avatar {
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #0f5c66;
  color: #fff;
  font-weight: 800;
  font-size: 0.85rem;
  flex: 0 0 auto;
}

.admin-feed__body {
  min-width: 0;
  flex: 1;
}

.admin-feed strong,
.admin-feed li > div strong {
  display: block;
  font-size: 0.9rem;
  font-weight: 750;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-feed p {
  margin: 0.15rem 0 0;
  color: var(--muted);
  font-size: 0.78rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-feed__time {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 650;
  white-space: nowrap;
  margin-left: auto;
  flex: 0 0 auto;
}

@keyframes dash-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-stat,
  .admin-panel {
    animation: none;
  }
}
</style>
