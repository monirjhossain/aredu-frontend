<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const ui = useUiStore()
const payments = ref([])
const pendingOrders = ref([])
const loading = ref(true)
const refundingId = ref(null)
const confirmingId = ref(null)
const message = ref('')
const trxByOrder = ref({})

async function load() {
  loading.value = true
  message.value = ''
  try {
    const [paymentsRes, pendingRes] = await Promise.all([
      http.get('/admin/payments', { skipErrorToast: true }),
      http.get('/admin/payments/pending-orders', { skipErrorToast: true }),
    ])
    payments.value = paymentsRes.data.data || []
    pendingOrders.value = pendingRes.data.data || []
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

async function refund(payment) {
  if (!window.confirm(t('confirmRefund'))) return
  refundingId.value = payment.id
  message.value = ''
  try {
    await http.post(`/admin/payments/${payment.id}/refund`, {}, { skipErrorToast: true, skipSuccessToast: true })
    ui.success(t('refundDone'))
    await load()
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    refundingId.value = null
  }
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

onMounted(load)

function statusTone(status) {
  if (status === 'paid') return 'ok'
  if (status === 'refunded' || status === 'failed') return 'warn'
  return ''
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('managePayments')" :lead="t('paymentsLead')" />

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('pendingBkashOrders') }}</h2>
          <p>{{ t('bkashWaitAdmin') }}</p>
        </div>
      </div>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal" class="mb-3">{{ message }}</v-alert>
      <div v-else-if="pendingOrders.length === 0" class="admin-ui__empty">
        <p>{{ t('noOrders') }}</p>
      </div>
      <div v-else class="admin-ui__list">
        <article v-for="order in pendingOrders" :key="order.id" class="admin-ui__row">
          <div class="admin-ui__row-main">
            <div>
              <h3 class="admin-ui__row-title">{{ order.order_number }}</h3>
              <p class="admin-ui__row-meta">
                {{ order.user?.name }} · {{ order.user?.email }} · {{ order.total }} {{ order.currency || 'BDT' }}
              </p>
              <p v-if="order.items?.length" class="admin-ui__row-meta">
                {{ order.items.map((item) => item.course_title).filter(Boolean).join(', ') }}
              </p>
              <label class="admin-ui__field mt-2">
                <span>{{ t('trxIdOptional') }}</span>
                <input v-model="trxByOrder[order.id]" type="text" :placeholder="t('trxIdOptional')">
              </label>
            </div>
          </div>
          <div class="admin-ui__row-actions">
            <button
              type="button"
              class="admin-ui__btn admin-ui__btn--solid"
              :disabled="confirmingId === order.id"
              @click="confirmBkash(order)"
            >
              {{ t('confirmBkashPayment') }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('managePayments') }}</h2>
          <p>{{ t('latestActivity') }}</p>
        </div>
      </div>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <div v-else-if="payments.length === 0" class="admin-ui__empty">
        <p>{{ t('noPaymentsAdmin') }}</p>
      </div>
      <div v-else class="admin-ui__list">
        <article v-for="payment in payments" :key="payment.id" class="admin-ui__row">
          <div class="admin-ui__row-main">
            <div>
              <h3 class="admin-ui__row-title">#{{ payment.id }} · {{ payment.gateway }}</h3>
              <p class="admin-ui__row-meta">
                {{ payment.order?.order_number }} · {{ payment.amount }} {{ payment.currency }}
              </p>
              <div class="admin-ui__chips">
                <span
                  class="admin-ui__chip"
                  :class="{
                    'admin-ui__chip--ok': statusTone(payment.status) === 'ok',
                    'admin-ui__chip--warn': statusTone(payment.status) === 'warn',
                  }"
                >
                  {{ t('paymentStatuses.' + payment.status) }}
                </span>
              </div>
            </div>
          </div>
          <div class="admin-ui__row-actions">
            <button
              v-if="payment.status === 'paid'"
              type="button"
              class="admin-ui__btn admin-ui__btn--danger"
              :disabled="refundingId === payment.id"
              @click="refund(payment)"
            >
              {{ t('refund') }}
            </button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
