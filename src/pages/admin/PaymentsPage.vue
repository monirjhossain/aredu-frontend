<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const payments = ref([])
const loading = ref(true)
const refundingId = ref(null)
const message = ref('')
const success = ref('')

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/payments', { skipErrorToast: true })
    payments.value = data.data || []
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
  success.value = ''
  try {
    await http.post(`/admin/payments/${payment.id}/refund`, {}, { skipErrorToast: true })
    success.value = t('refundDone')
    await load()
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    refundingId.value = null
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

    <v-alert v-if="success" class="mb-4" type="success" variant="tonal">{{ success }}</v-alert>

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
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
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
