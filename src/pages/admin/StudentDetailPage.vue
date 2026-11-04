<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { useLocaleStore } from '../../stores/locale'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const localeStore = useLocaleStore()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const message = ref('')
const student = ref(null)
const stats = ref({ orders: 0, active_enrollments: 0, pending_orders: 0 })
const enrollments = ref([])
const orders = ref([])

const studentId = computed(() => Number(route.params.id))

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get(`/admin/students/${studentId.value}`, {
      skipErrorToast: true,
    })
    const payload = data.data || {}
    student.value = payload.student || null
    stats.value = payload.stats || stats.value
    enrollments.value = payload.enrollments || []
    orders.value = payload.orders || []
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
    student.value = null
  } finally {
    loading.value = false
  }
}

function when(value) {
  if (!value) return '—'
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function money(order) {
  return `${order.total} ${order.currency || 'BDT'}`
}

function courseTitles(order) {
  return (order.items || [])
    .map((item) => item.course_title || item.course?.title)
    .filter(Boolean)
    .join(', ') || '—'
}

function statusTone(value) {
  if (value === 'paid' || value === 'active') return 'ok'
  if (value === 'pending') return 'warn'
  if (value === 'failed' || value === 'cancelled' || value === 'refunded') return 'danger'
  return ''
}

function openOrder(order) {
  router.push({ name: 'admin-orders', query: { search: order.order_number } })
}

onMounted(load)
watch(studentId, load)
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero
      :title="student?.name || t('studentDetails')"
      :lead="t('studentDetailsLead')"
    />

    <div class="admin-student-detail__toolbar">
      <button
        type="button"
        class="admin-ui__btn admin-ui__btn--ghost"
        @click="router.push({ name: 'admin-students' })"
      >
        {{ t('backToStudents') }}
      </button>
    </div>

    <div v-if="loading" class="admin-ui__loading">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>

    <template v-else-if="student">
      <section class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <div>
            <h2>{{ student.name }}</h2>
            <p>{{ student.email }}<template v-if="student.phone"> · {{ student.phone }}</template></p>
          </div>
        </div>

        <div class="admin-student-detail__stats">
          <div class="admin-student-detail__stat">
            <span>{{ t('orders') }}</span>
            <strong>{{ stats.orders }}</strong>
          </div>
          <div class="admin-student-detail__stat">
            <span>{{ t('activeEnrollments') }}</span>
            <strong>{{ stats.active_enrollments }}</strong>
          </div>
          <div class="admin-student-detail__stat">
            <span>{{ t('pendingOrders') }}</span>
            <strong>{{ stats.pending_orders }}</strong>
          </div>
        </div>
      </section>

      <section class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <div>
            <h2>{{ t('enrollments') }}</h2>
            <p>{{ t('studentEnrollmentsLead') }}</p>
          </div>
        </div>

        <div v-if="enrollments.length === 0" class="admin-ui__empty">
          <p>{{ t('noEnrollments') }}</p>
        </div>
        <div v-else class="admin-ui__list">
          <article v-for="row in enrollments" :key="row.id" class="admin-ui__row">
            <div class="admin-ui__row-main">
              <div>
                <h3 class="admin-ui__row-title">{{ row.course?.title || '—' }}</h3>
                <p class="admin-ui__row-meta">
                  {{ row.course?.exam_type || '—' }} · {{ when(row.enrolled_at) }}
                </p>
              </div>
            </div>
            <span
              class="admin-ui__chip"
              :class="{
                'admin-ui__chip--ok': statusTone(row.status) === 'ok',
                'admin-ui__chip--warn': statusTone(row.status) === 'warn',
                'admin-ui__chip--danger': statusTone(row.status) === 'danger',
              }"
            >
              {{ row.status }}
            </span>
          </article>
        </div>
      </section>

      <section class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <div>
            <h2>{{ t('orders') }}</h2>
            <p>{{ t('studentOrdersLead') }}</p>
          </div>
        </div>

        <div v-if="orders.length === 0" class="admin-ui__empty">
          <p>{{ t('noOrders') }}</p>
        </div>
        <div v-else class="admin-ui__list">
          <article v-for="order in orders" :key="order.id" class="admin-ui__row">
            <div class="admin-ui__row-main">
              <div>
                <h3 class="admin-ui__row-title">{{ order.order_number }}</h3>
                <p class="admin-ui__row-meta">{{ courseTitles(order) }}</p>
                <p class="admin-ui__row-meta">
                  <strong>{{ money(order) }}</strong> · {{ when(order.created_at) }}
                </p>
              </div>
            </div>
            <div class="admin-ui__row-actions">
              <span
                class="admin-ui__chip"
                :class="{
                  'admin-ui__chip--ok': statusTone(order.status) === 'ok',
                  'admin-ui__chip--warn': statusTone(order.status) === 'warn',
                  'admin-ui__chip--danger': statusTone(order.status) === 'danger',
                }"
              >
                {{ t(`orderStatus.${order.status}`) }}
              </span>
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--soft"
                @click="openOrder(order)"
              >
                {{ t('viewOrder') }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.admin-student-detail__toolbar {
  margin: 0 0 0.85rem;
}

.admin-student-detail__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.75rem;
}

.admin-student-detail__stat {
  display: grid;
  gap: 0.25rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.75rem;
  background: #fff;
}

.admin-student-detail__stat span {
  color: var(--admin-muted);
  font-size: 0.78rem;
  font-weight: 650;
}

.admin-student-detail__stat strong {
  font-size: 1.25rem;
  color: var(--admin-ink);
}
</style>
