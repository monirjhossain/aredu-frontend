<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { useLocaleStore } from '../../stores/locale'
import { useUiStore } from '../../stores/ui'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const localeStore = useLocaleStore()
const ui = useUiStore()

const orders = ref([])
const meta = ref({ current_page: 1, last_page: 1, per_page: 20, total: 0 })
const loading = ref(true)
const message = ref('')
const search = ref('')
const status = ref('pending')
const page = ref(1)
const confirmingId = ref(null)
const trxByOrder = ref({})

const statusTabs = computed(() => [
  { key: 'pending', label: t('orderStatus.pending') },
  { key: 'paid', label: t('orderStatus.paid') },
  { key: 'failed', label: t('orderStatus.failed') },
  { key: 'cancelled', label: t('orderStatus.cancelled') },
  { key: 'refunded', label: t('orderStatus.refunded') },
  { key: '', label: t('allStatuses') },
])

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/orders', {
      params: {
        page: page.value,
        search: search.value || undefined,
        status: status.value || undefined,
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

function applySearch() {
  page.value = 1
  load()
}

function setStatus(next) {
  status.value = next
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

async function confirmBkash(order) {
  confirmingId.value = order.id
  message.value = ''
  try {
    const trx = String(trxByOrder.value[order.id] || '').trim()
    await http.post(
      `/admin/orders/${order.id}/confirm-bkash`,
      trx ? { trx_id: trx } : {},
      { skipErrorToast: true, skipSuccessToast: true },
    )
    ui.success(t('bkashPaymentConfirmed'))
    trxByOrder.value[order.id] = ''
    await load()
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    confirmingId.value = null
  }
}

function when(value) {
  if (!value) return ''
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
    .join(', ')
}

function latestPayment(order) {
  const payments = order.payments || []
  if (!payments.length) return null
  return payments[payments.length - 1]
}

function statusTone(value) {
  if (value === 'paid') return 'ok'
  if (value === 'pending') return 'warn'
  if (value === 'failed' || value === 'cancelled' || value === 'refunded') return 'danger'
  return ''
}

onMounted(load)
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('manageOrders')" :lead="t('ordersLead')" />

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head admin-orders__head">
        <div>
          <h2>{{ t('manageOrders') }}</h2>
          <p>{{ t('ordersLead') }}</p>
        </div>
        <form class="admin-orders__search" @submit.prevent="applySearch">
          <input
            v-model="search"
            type="search"
            :placeholder="t('searchOrders')"
            :aria-label="t('searchOrders')"
          >
          <button type="submit" class="admin-ui__btn admin-ui__btn--solid">{{ t('search') }}</button>
        </form>
      </div>

      <div class="admin-orders__tabs" role="tablist">
        <button
          v-for="tab in statusTabs"
          :key="tab.key || 'all'"
          type="button"
          class="admin-orders__tab"
          :class="{ 'is-active': status === tab.key }"
          role="tab"
          :aria-selected="status === tab.key"
          @click="setStatus(tab.key)"
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
      <div v-else class="admin-ui__list">
        <article v-for="order in orders" :key="order.id" class="admin-ui__row admin-orders__row">
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
              <p class="admin-ui__row-meta">
                {{ order.user?.name || '—' }}
                <template v-if="order.user?.email"> · {{ order.user.email }}</template>
                <template v-if="order.user?.phone"> · {{ order.user.phone }}</template>
              </p>
              <p v-if="courseTitles(order)" class="admin-ui__row-meta">{{ courseTitles(order) }}</p>
              <p class="admin-ui__row-meta">
                <strong>{{ order.total }} {{ order.currency || 'BDT' }}</strong>
                · {{ when(order.created_at) }}
                <template v-if="latestPayment(order)">
                  · {{ latestPayment(order).gateway }}
                  <template v-if="latestPayment(order).gateway_reference">
                    · Trx {{ latestPayment(order).gateway_reference }}
                  </template>
                </template>
              </p>
              <label v-if="order.status === 'pending'" class="admin-ui__field mt-2">
                <span>{{ t('trxIdOptional') }}</span>
                <input v-model="trxByOrder[order.id]" type="text" :placeholder="t('trxIdOptional')">
              </label>
            </div>
          </div>
          <div class="admin-ui__row-actions">
            <button
              v-if="order.status === 'pending'"
              type="button"
              class="admin-ui__btn admin-ui__btn--solid"
              :disabled="confirmingId === order.id"
              @click="confirmBkash(order)"
            >
              {{ t('activatePackage') }}
            </button>
          </div>
        </article>
      </div>

      <div v-if="meta.last_page > 1" class="admin-orders__pager">
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost"
          :disabled="page <= 1 || loading"
          @click="goPage(page - 1)"
        >
          {{ t('previous') }}
        </button>
        <span>{{ page }} / {{ meta.last_page }}</span>
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
  </div>
</template>

<style scoped>
.admin-orders__head {
  align-items: stretch;
  gap: 0.85rem;
}

.admin-orders__search {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 100%;
}

.admin-orders__search input {
  flex: 1 1 12rem;
  min-height: 44px;
  min-width: 0;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.65rem;
  background: #fff;
}

.admin-orders__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0 0 1rem;
}

.admin-orders__tab {
  min-height: 40px;
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--admin-line);
  border-radius: 999px;
  background: #fff;
  color: var(--admin-muted);
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
}

.admin-orders__tab.is-active {
  background: var(--admin-teal);
  border-color: var(--admin-teal);
  color: #fff;
}

.admin-orders__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}

.admin-orders__row {
  align-items: flex-start;
}

.admin-orders__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

@media (min-width: 768px) {
  .admin-orders__head {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }

  .admin-orders__search {
    width: auto;
    max-width: 26rem;
  }
}
</style>
