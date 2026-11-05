<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AdminDialog from '../../components/admin/AdminDialog.vue'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { useLocaleStore } from '../../stores/locale'
import { useUiStore } from '../../stores/ui'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const localeStore = useLocaleStore()
const ui = useUiStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const orders = ref([])
const meta = ref({ current_page: 1, last_page: 1, per_page: 20, total: 0 })
const loading = ref(true)
const message = ref('')
const page = ref(1)
const confirmingId = ref(null)
const refundingId = ref(null)
const cancellingId = ref(null)
const trxByOrder = ref({})
const detailOpen = ref(false)
const detailOrder = ref(null)
const detailLoading = ref(false)

const filters = ref({
  search: '',
  status: '',
  gateway: '',
  date_from: '',
  date_to: '',
})

const statusOptions = computed(() => [
  { value: '', label: t('allStatuses') },
  { value: 'pending', label: t('orderStatus.pending') },
  { value: 'paid', label: t('orderStatus.paid') },
  { value: 'failed', label: t('orderStatus.failed') },
  { value: 'cancelled', label: t('orderStatus.cancelled') },
  { value: 'refunded', label: t('orderStatus.refunded') },
])

const gatewayOptions = computed(() => [
  { value: '', label: t('allGateways') },
  { value: 'bkash', label: 'bKash' },
  { value: 'sslcommerz', label: 'SSLCommerz' },
])

const statusTabs = computed(() => statusOptions.value)
const canOpenStudent = computed(() => auth.hasPermission('users.manage'))

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/orders', {
      params: {
        page: page.value,
        search: filters.value.search || undefined,
        status: filters.value.status || undefined,
        gateway: filters.value.gateway || undefined,
        date_from: filters.value.date_from || undefined,
        date_to: filters.value.date_to || undefined,
      },
      skipErrorToast: true,
    })
    orders.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  load()
}

function resetFilters() {
  filters.value = {
    search: '',
    status: '',
    gateway: '',
    date_from: '',
    date_to: '',
  }
  page.value = 1
  load()
}

function setStatus(next) {
  filters.value.status = next
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

async function confirmBkash(order) {
  const trx = String(trxByOrder.value[order.id] || '').trim()
  if (!trx) {
    ui.toastError(t('trxIdRequired'))
    return
  }

  confirmingId.value = order.id
  message.value = ''
  try {
    await http.post(
      `/admin/orders/${order.id}/confirm-bkash`,
      { trx_id: trx },
      { skipErrorToast: true, skipSuccessToast: true },
    )
    ui.success(t('bkashPaymentConfirmed'))
    trxByOrder.value[order.id] = ''
    await load()
    if (detailOrder.value?.id === order.id) {
      await openDetails(order)
    }
  } catch (error) {
    const err = apiError(error)
    const trxError = Array.isArray(err.errors?.trx_id) ? err.errors.trx_id[0] : ''
    const orderError = Array.isArray(err.errors?.order) ? err.errors.order[0] : ''
    ui.toastError(trxError || orderError || err.message || t('requestFailed'))
  } finally {
    confirmingId.value = null
  }
}

async function refundOrder(order) {
  const payment = paidPayment(order)
  if (!payment?.id) {
    ui.toastError(t('noPaidPaymentToRefund'))
    return
  }
  if (!window.confirm(t('confirmRefund'))) return

  refundingId.value = order.id
  message.value = ''
  try {
    await http.post(`/admin/payments/${payment.id}/refund`, {}, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    ui.success(t('refundDone'))
    await load()
    if (detailOrder.value?.id === order.id) {
      await openDetails(order)
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    refundingId.value = null
  }
}

async function cancelOrder(order) {
  if (!window.confirm(t('confirmCancelOrder'))) return

  cancellingId.value = order.id
  message.value = ''
  try {
    await http.post(`/admin/orders/${order.id}/cancel`, {}, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    ui.success(t('orderCancelled'))
    await load()
    if (detailOrder.value?.id === order.id) {
      await openDetails(order)
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    cancellingId.value = null
  }
}

async function openDetails(order) {
  detailOpen.value = true
  detailLoading.value = true
  detailOrder.value = order
  try {
    const { data } = await http.get(`/admin/orders/${order.id}`, {
      skipErrorToast: true,
      skipLoading: true,
    })
    detailOrder.value = data.data || order
  } catch (error) {
    ui.toastError(apiError(error).message || t('requestFailed'))
  } finally {
    detailLoading.value = false
  }
}

function openStudent(order) {
  if (!order?.user?.id || !canOpenStudent.value) return
  router.push({ name: 'admin-student-detail', params: { id: order.user.id } })
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

function courseTitles(order) {
  return (order.items || [])
    .map((item) => item.course_title || item.course?.title)
    .filter(Boolean)
    .join(', ') || '—'
}

function studentLine(order) {
  const parts = [order.user?.name, order.user?.email, order.user?.phone].filter(Boolean)
  return parts.join(' · ') || '—'
}

function latestPayment(order) {
  const payments = order.payments || []
  if (!payments.length) return null
  return [...payments].sort((a, b) => Number(b.id) - Number(a.id))[0]
}

function paidPayment(order) {
  const payments = order.payments || []
  return payments.find((payment) => payment.status === 'paid') || null
}

function canCancel(order) {
  return order?.status === 'pending' || order?.status === 'failed'
}

function statusTone(value) {
  if (value === 'paid') return 'ok'
  if (value === 'pending') return 'warn'
  if (value === 'failed' || value === 'cancelled' || value === 'refunded') return 'danger'
  return ''
}

function money(order) {
  return `${order.total} ${order.currency || 'BDT'}`
}

function syncSearchFromQuery() {
  const q = typeof route.query.search === 'string' ? route.query.search.trim() : ''
  if (q) {
    filters.value.search = q
  }
}

onMounted(() => {
  syncSearchFromQuery()
  load()
})

watch(
  () => route.query.search,
  () => {
    syncSearchFromQuery()
    page.value = 1
    load()
  },
)
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('manageOrders')" :lead="t('ordersLead')" />

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('manageOrders') }}</h2>
          <p>{{ t('ordersListCount', { count: meta.total || orders.length }) }}</p>
        </div>
      </div>

      <form class="admin-orders__filters" @submit.prevent="applyFilters">
        <input
          v-model="filters.search"
          class="admin-orders__filter-input admin-orders__filter-input--search"
          type="search"
          :placeholder="t('searchOrders')"
          :aria-label="t('search')"
        >
        <select
          v-model="filters.status"
          class="admin-orders__filter-input"
          :aria-label="t('status')"
        >
          <option v-for="option in statusOptions" :key="option.value || 'all'" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <select
          v-model="filters.gateway"
          class="admin-orders__filter-input"
          :aria-label="t('paymentGateway')"
        >
          <option v-for="option in gatewayOptions" :key="option.value || 'all-gw'" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <input
          v-model="filters.date_from"
          class="admin-orders__filter-input admin-orders__filter-input--date"
          type="date"
          :aria-label="t('dateFrom')"
        >
        <input
          v-model="filters.date_to"
          class="admin-orders__filter-input admin-orders__filter-input--date"
          type="date"
          :aria-label="t('dateTo')"
        >
        <button type="submit" class="admin-ui__btn admin-ui__btn--solid admin-orders__filter-btn">
          {{ t('applyFilters') }}
        </button>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost admin-orders__filter-btn"
          @click="resetFilters"
        >
          {{ t('resetFilters') }}
        </button>
      </form>

      <div class="admin-orders__tabs" role="tablist">
        <button
          v-for="tab in statusTabs"
          :key="tab.value || 'all'"
          type="button"
          class="admin-orders__tab"
          :class="{ 'is-active': filters.status === tab.value }"
          role="tab"
          :aria-selected="filters.status === tab.value"
          @click="setStatus(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal" class="mb-3">{{ message }}</v-alert>
      <div v-else-if="orders.length === 0" class="admin-ui__empty">
        <p>{{ t('noOrders') }}</p>
      </div>

      <template v-else>
        <div class="admin-ui__table-wrap admin-orders__table-wrap">
          <table class="admin-ui__table admin-orders__table">
            <thead>
              <tr>
                <th>{{ t('orderNumber') }}</th>
                <th>{{ t('student') }}</th>
                <th>{{ t('courses') }}</th>
                <th>{{ t('amount') }}</th>
                <th>{{ t('status') }}</th>
                <th>{{ t('date') }}</th>
                <th>{{ t('actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in orders" :key="order.id">
                <td>
                  <div class="admin-orders__cell-title">{{ order.order_number }}</div>
                  <div v-if="latestPayment(order)?.gateway" class="admin-orders__cell-sub">
                    {{ latestPayment(order).gateway }}
                    <template v-if="latestPayment(order)?.gateway_reference">
                      · Trx {{ latestPayment(order).gateway_reference }}
                    </template>
                  </div>
                </td>
                <td>
                  <div class="admin-orders__cell-title">{{ order.user?.name || '—' }}</div>
                  <div class="admin-orders__cell-sub">
                    <template v-if="order.user?.email">{{ order.user.email }}</template>
                    <template v-if="order.user?.phone"> · {{ order.user.phone }}</template>
                  </div>
                </td>
                <td>
                  <div class="admin-orders__cell-wrap">{{ courseTitles(order) }}</div>
                </td>
                <td><strong>{{ money(order) }}</strong></td>
                <td>
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
                </td>
                <td>{{ when(order.created_at) }}</td>
                <td>
                  <div class="admin-orders__actions">
                    <button
                      type="button"
                      class="admin-ui__btn admin-ui__btn--soft"
                      @click="openDetails(order)"
                    >
                      {{ t('viewDetails') }}
                    </button>
                    <template v-if="order.status === 'pending'">
                      <input
                        v-model="trxByOrder[order.id]"
                        type="text"
                        class="admin-orders__trx"
                        :placeholder="t('trxIdRequired')"
                        :aria-label="t('trxIdRequired')"
                        required
                      >
                      <button
                        type="button"
                        class="admin-ui__btn admin-ui__btn--solid"
                        :disabled="confirmingId === order.id || !String(trxByOrder[order.id] || '').trim()"
                        @click="confirmBkash(order)"
                      >
                        {{ t('activatePackage') }}
                      </button>
                      <button
                        type="button"
                        class="admin-ui__btn admin-ui__btn--ghost"
                        :disabled="cancellingId === order.id"
                        @click="cancelOrder(order)"
                      >
                        {{ t('cancelOrder') }}
                      </button>
                    </template>
                    <button
                      v-else-if="order.status === 'paid' && paidPayment(order)"
                      type="button"
                      class="admin-ui__btn admin-ui__btn--danger"
                      :disabled="refundingId === order.id"
                      @click="refundOrder(order)"
                    >
                      {{ t('refund') }}
                    </button>
                    <button
                      v-else-if="canCancel(order)"
                      type="button"
                      class="admin-ui__btn admin-ui__btn--ghost"
                      :disabled="cancellingId === order.id"
                      @click="cancelOrder(order)"
                    >
                      {{ t('cancelOrder') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-ui__list admin-orders__cards">
          <article v-for="order in orders" :key="`m-${order.id}`" class="admin-ui__row">
            <div class="admin-ui__row-main">
              <div>
                <div class="admin-orders__title-row">
                  <h3 class="admin-ui__row-title">{{ order.order_number }}</h3>
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
                </div>
                <p class="admin-ui__row-meta">{{ studentLine(order) }}</p>
                <p class="admin-ui__row-meta">{{ courseTitles(order) }}</p>
                <p class="admin-ui__row-meta">
                  <strong>{{ money(order) }}</strong> · {{ when(order.created_at) }}
                </p>
                <label v-if="order.status === 'pending'" class="admin-ui__field mt-2">
                  <span>{{ t('trxIdRequired') }}</span>
                  <input v-model="trxByOrder[order.id]" type="text" :placeholder="t('trxIdRequired')" required>
                </label>
              </div>
            </div>
            <div class="admin-ui__row-actions">
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--soft"
                @click="openDetails(order)"
              >
                {{ t('viewDetails') }}
              </button>
              <button
                v-if="order.status === 'pending'"
                type="button"
                class="admin-ui__btn admin-ui__btn--solid"
                :disabled="confirmingId === order.id || !String(trxByOrder[order.id] || '').trim()"
                @click="confirmBkash(order)"
              >
                {{ t('activatePackage') }}
              </button>
              <button
                v-if="canCancel(order)"
                type="button"
                class="admin-ui__btn admin-ui__btn--ghost"
                :disabled="cancellingId === order.id"
                @click="cancelOrder(order)"
              >
                {{ t('cancelOrder') }}
              </button>
              <button
                v-if="order.status === 'paid' && paidPayment(order)"
                type="button"
                class="admin-ui__btn admin-ui__btn--danger"
                :disabled="refundingId === order.id"
                @click="refundOrder(order)"
              >
                {{ t('refund') }}
              </button>
            </div>
          </article>
        </div>
      </template>

      <div v-if="meta.last_page > 1" class="admin-orders__pager">
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost"
          :disabled="page <= 1 || loading"
          @click="goPage(page - 1)"
        >
          {{ t('previous') }}
        </button>
        <span>{{ page }} / {{ meta.last_page }} · {{ meta.total }}</span>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost"
          :disabled="page >= meta.last_page || loading"
          @click="goPage(page + 1)"
        >
          {{ t('next') }}
        </button>
      </div>
    </section>

    <AdminDialog
      v-model="detailOpen"
      :title="detailOrder?.order_number || t('orderDetails')"
      :max-width="640"
    >
      <div v-if="detailLoading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="32" />
      </div>
      <div v-else-if="detailOrder" class="admin-orders__detail">
        <div class="admin-orders__detail-grid">
          <div>
            <span>{{ t('status') }}</span>
            <strong>{{ t(`orderStatus.${detailOrder.status}`) }}</strong>
          </div>
          <div>
            <span>{{ t('amount') }}</span>
            <strong>{{ money(detailOrder) }}</strong>
          </div>
          <div>
            <span>{{ t('date') }}</span>
            <strong>{{ when(detailOrder.created_at) }}</strong>
          </div>
          <div>
            <span>{{ t('paymentGateway') }}</span>
            <strong>{{ latestPayment(detailOrder)?.gateway || '—' }}</strong>
          </div>
        </div>

        <div class="admin-orders__detail-block">
          <h3>{{ t('student') }}</h3>
          <p>{{ studentLine(detailOrder) }}</p>
          <button
            v-if="canOpenStudent && detailOrder.user?.id"
            type="button"
            class="admin-ui__btn admin-ui__btn--soft"
            @click="openStudent(detailOrder)"
          >
            {{ t('openStudent') }}
          </button>
        </div>

        <div class="admin-orders__detail-block">
          <h3>{{ t('courses') }}</h3>
          <ul>
            <li v-for="item in (detailOrder.items || [])" :key="item.id">
              {{ item.course_title || item.course?.title || '—' }}
              <span>· {{ item.line_total ?? item.unit_price }} {{ detailOrder.currency || 'BDT' }}</span>
            </li>
          </ul>
        </div>

        <div v-if="(detailOrder.payments || []).length" class="admin-orders__detail-block">
          <h3>{{ t('payments') }}</h3>
          <ul>
            <li v-for="payment in detailOrder.payments" :key="payment.id">
              {{ payment.gateway }} · {{ payment.status }}
              <template v-if="payment.gateway_reference"> · Trx {{ payment.gateway_reference }}</template>
              · {{ payment.amount }} {{ payment.currency || 'BDT' }}
            </li>
          </ul>
        </div>

        <div class="admin-orders__detail-actions">
          <template v-if="detailOrder.status === 'pending'">
            <input
              v-model="trxByOrder[detailOrder.id]"
              type="text"
              class="admin-orders__trx"
              :placeholder="t('trxIdRequired')"
              required
            >
            <button
              type="button"
              class="admin-ui__btn admin-ui__btn--solid"
              :disabled="confirmingId === detailOrder.id || !String(trxByOrder[detailOrder.id] || '').trim()"
              @click="confirmBkash(detailOrder)"
            >
              {{ t('activatePackage') }}
            </button>
          </template>
          <button
            v-if="canCancel(detailOrder)"
            type="button"
            class="admin-ui__btn admin-ui__btn--ghost"
            :disabled="cancellingId === detailOrder.id"
            @click="cancelOrder(detailOrder)"
          >
            {{ t('cancelOrder') }}
          </button>
          <button
            v-if="detailOrder.status === 'paid' && paidPayment(detailOrder)"
            type="button"
            class="admin-ui__btn admin-ui__btn--danger"
            :disabled="refundingId === detailOrder.id"
            @click="refundOrder(detailOrder)"
          >
            {{ t('refund') }}
          </button>
        </div>
      </div>
    </AdminDialog>
  </div>
</template>

<style scoped>
.admin-orders__filters {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 0.1rem;
}

.admin-orders__filters::-webkit-scrollbar {
  display: none;
}

.admin-orders__filter-input {
  flex: 0 0 auto;
  box-sizing: border-box;
  min-height: 2.4rem;
  height: 2.4rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.55rem;
  background: #fff;
  color: var(--admin-ink);
  font: inherit;
  font-size: 0.84rem;
  line-height: 1.25;
}

.admin-orders__filter-input--search {
  flex: 1 1 12rem;
  min-width: 11rem;
  max-width: 18rem;
}

.admin-orders__filter-input--date {
  min-width: 8.5rem;
  max-width: 10.5rem;
}

.admin-orders__filter-input:focus {
  outline: 2px solid rgba(15, 92, 102, 0.18);
  outline-offset: 1px;
  border-color: var(--admin-teal);
}

.admin-orders__filter-btn {
  flex: 0 0 auto;
  min-height: 2.4rem !important;
  height: 2.4rem;
  padding: 0 0.85rem !important;
  font-size: 0.8rem !important;
  white-space: nowrap;
}

.admin-orders__tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.45rem;
  margin: 0 0 1rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 0.15rem;
}

.admin-orders__tabs::-webkit-scrollbar {
  display: none;
}

.admin-orders__tab {
  flex: 0 0 auto;
  min-height: 40px;
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--admin-line);
  border-radius: 999px;
  background: #fff;
  color: var(--admin-muted);
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
}

.admin-orders__tab.is-active {
  background: var(--admin-teal);
  border-color: var(--admin-teal);
  color: #fff;
}

.admin-orders__table-wrap {
  display: none;
}

.admin-orders__cards {
  display: grid;
}

.admin-orders__table {
  min-width: 920px;
}

.admin-orders__table th,
.admin-orders__table td {
  white-space: normal;
  vertical-align: top;
}

.admin-orders__cell-title {
  font-weight: 750;
  color: var(--admin-ink);
  word-break: break-word;
}

.admin-orders__cell-sub {
  margin-top: 0.2rem;
  color: var(--admin-muted);
  font-size: 0.78rem;
  line-height: 1.35;
  word-break: break-word;
}

.admin-orders__cell-wrap {
  max-width: 16rem;
  white-space: normal;
  word-break: break-word;
  line-height: 1.35;
}

.admin-orders__actions {
  display: grid;
  gap: 0.45rem;
  min-width: 11rem;
}

.admin-orders__trx {
  width: 100%;
  min-height: 40px;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.55rem;
  background: #fff;
  font: inherit;
  font-size: 0.82rem;
}

.admin-orders__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}

.admin-orders__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.admin-orders__detail {
  display: grid;
  gap: 1rem;
}

.admin-orders__detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.admin-orders__detail-grid > div {
  display: grid;
  gap: 0.2rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.65rem;
  background: #fff;
}

.admin-orders__detail-grid span {
  color: var(--admin-muted);
  font-size: 0.75rem;
  font-weight: 650;
}

.admin-orders__detail-block h3 {
  margin: 0 0 0.35rem;
  font-size: 0.92rem;
}

.admin-orders__detail-block p,
.admin-orders__detail-block li {
  margin: 0;
  color: var(--admin-muted);
  line-height: 1.45;
  word-break: break-word;
}

.admin-orders__detail-block ul {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.35rem;
}

.admin-orders__detail-block .admin-ui__btn {
  margin-top: 0.55rem;
}

.admin-orders__detail-actions {
  display: grid;
  gap: 0.5rem;
}

@media (min-width: 768px) {
  .admin-orders__tabs {
    flex-wrap: wrap;
    overflow: visible;
  }

  .admin-orders__detail-actions {
    grid-template-columns: 1fr auto auto;
    align-items: center;
  }
}

@media (min-width: 900px) {
  .admin-orders__table-wrap {
    display: block;
  }

  .admin-orders__cards {
    display: none;
  }
}

@media (max-width: 560px) {
  .admin-orders__detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
