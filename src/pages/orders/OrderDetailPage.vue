<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BkashPayDialog from '../../components/payments/BkashPayDialog.vue'
import { http } from '../../services/http'
import { useLocaleStore } from '../../stores/locale'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const localeStore = useLocaleStore()
const route = useRoute()
const router = useRouter()

const order = ref(null)
const loading = ref(true)
const message = ref('')
const showBkash = ref(false)

const isPending = computed(() => order.value?.status === 'pending')
const isPaid = computed(() => order.value?.status === 'paid')

async function load() {
  loading.value = true
  message.value = ''
  order.value = null
  try {
    const { data } = await http.get(`/orders/${route.params.id}`, { skipErrorToast: true })
    order.value = data.data
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
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

function statusTone(value) {
  if (value === 'paid') return 'ok'
  if (value === 'pending' || value === 'initiated') return 'warn'
  if (value === 'failed' || value === 'cancelled' || value === 'refunded') return 'danger'
  return ''
}

function money(amount, currency = 'BDT') {
  return `${amount} ${currency || t('currencyBdt')}`
}

onMounted(load)
watch(() => route.params.id, load)
</script>

<template>
  <div class="order-detail">
    <header class="order-detail__hero">
      <button type="button" class="order-detail__back" @click="router.push({ name: 'orders' })">
        <span aria-hidden="true">←</span>
        {{ t('backToOrders') }}
      </button>
      <p class="order-detail__eyebrow">{{ t('myOrders') }}</p>
      <h1>{{ order?.order_number || t('orderDetails') }}</h1>
      <p>{{ t('orderDetailLead') }}</p>
    </header>

    <v-progress-circular v-if="loading" class="order-detail__loader" indeterminate color="#0f5c66" />
    <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>

    <template v-else-if="order">
      <section class="order-detail__summary">
        <div class="order-detail__summary-main">
          <span
            class="order-detail__chip"
            :class="{
              'is-ok': statusTone(order.status) === 'ok',
              'is-warn': statusTone(order.status) === 'warn',
              'is-danger': statusTone(order.status) === 'danger',
            }"
          >
            {{ t(`orderStatus.${order.status}`) }}
          </span>
          <strong class="order-detail__total">{{ money(order.total, order.currency) }}</strong>
          <p>{{ t('orderPlacedOn', { date: when(order.created_at) }) }}</p>
        </div>

        <div v-if="isPending" class="order-detail__cta-box">
          <p>{{ t('payToUnlock') }}</p>
          <button type="button" class="order-detail__pay" @click="showBkash = true">
            {{ t('payBkash') }}
          </button>
          <small>{{ t('bkashWaitAdmin') }}</small>
        </div>

        <div v-else-if="isPaid" class="order-detail__cta-box order-detail__cta-box--ok">
          <p>{{ t('orderPaidReady') }}</p>
          <router-link class="order-detail__link-btn" :to="{ name: 'my-courses' }">
            {{ t('goToMyCourses') }}
            <span aria-hidden="true">→</span>
          </router-link>
        </div>
      </section>

      <section class="order-detail__panel">
        <div class="order-detail__panel-head">
          <h2>{{ t('orderItems') }}</h2>
          <p>{{ (order.items || []).length }} {{ t('courses') }}</p>
        </div>

        <div v-if="!(order.items || []).length" class="order-detail__empty">
          <p>{{ t('noOrderItems') }}</p>
        </div>
        <ul v-else class="order-detail__items">
          <li v-for="item in order.items" :key="item.id">
            <div>
              <strong>{{ item.course?.title || ('#' + item.course_id) }}</strong>
              <span v-if="item.course?.slug" class="order-detail__muted">{{ item.course.slug }}</span>
            </div>
            <em>{{ money(item.line_total ?? item.unit_price, order.currency) }}</em>
          </li>
        </ul>
      </section>

      <section class="order-detail__panel">
        <div class="order-detail__panel-head">
          <h2>{{ t('paymentStatus') }}</h2>
          <p>{{ (order.payments || []).length }} {{ t('payments') }}</p>
        </div>

        <div v-if="!(order.payments || []).length" class="order-detail__empty">
          <p>{{ t('noPaymentsYet') }}</p>
          <button
            v-if="isPending"
            type="button"
            class="order-detail__pay order-detail__pay--inline"
            @click="showBkash = true"
          >
            {{ t('payBkash') }}
          </button>
        </div>
        <ul v-else class="order-detail__payments">
          <li v-for="payment in order.payments" :key="payment.id">
            <div class="order-detail__payment-top">
              <strong>{{ payment.gateway }}</strong>
              <span
                class="order-detail__chip order-detail__chip--sm"
                :class="{
                  'is-ok': statusTone(payment.status) === 'ok',
                  'is-warn': statusTone(payment.status) === 'warn',
                  'is-danger': statusTone(payment.status) === 'danger',
                }"
              >
                {{ t(`paymentStatuses.${payment.status}`) }}
              </span>
            </div>
            <p>
              {{ money(payment.amount, payment.currency) }}
              <template v-if="payment.gateway_reference || payment.gateway_transaction_id">
                · {{ payment.gateway_reference || payment.gateway_transaction_id }}
              </template>
            </p>
          </li>
        </ul>
      </section>
    </template>

    <BkashPayDialog v-model="showBkash" :order="order" />
  </div>
</template>

<style scoped>
.order-detail {
  display: grid;
  gap: 1rem;
  max-width: 760px;
}

.order-detail__hero {
  padding: 1.15rem 1.2rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at top right, rgba(245, 197, 24, 0.22), transparent 42%),
    linear-gradient(135deg, #0b3d36 0%, #0f5c66 55%, #0a2a3a 100%);
  color: #fff;
}

.order-detail__back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 40px;
  margin: 0 0 0.65rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  font: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
}

.order-detail__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.order-detail__hero h1 {
  margin: 0;
  font-size: clamp(1.35rem, 3vw, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  word-break: break-word;
}

.order-detail__hero > p {
  margin: 0.4rem 0 0;
  max-width: 42ch;
  opacity: 0.9;
  font-size: 0.92rem;
  line-height: 1.45;
}

.order-detail__loader {
  margin: 1rem auto;
  display: block;
}

.order-detail__summary {
  display: grid;
  gap: 0.9rem;
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid var(--line);
  background: #fff;
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

@media (min-width: 720px) {
  .order-detail__summary {
    grid-template-columns: 1.2fr 1fr;
    align-items: stretch;
  }
}

.order-detail__summary-main {
  display: grid;
  gap: 0.45rem;
  align-content: start;
}

.order-detail__summary-main p {
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.4;
}

.order-detail__total {
  font-size: clamp(1.35rem, 3vw, 1.7rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--ink);
}

.order-detail__chip {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 1.7rem;
  padding: 0.15rem 0.65rem;
  border-radius: 999px;
  background: #eef2f5;
  color: var(--ink);
  font-size: 0.75rem;
  font-weight: 800;
}

.order-detail__chip--sm {
  min-height: 1.45rem;
  font-size: 0.7rem;
}

.order-detail__chip.is-ok {
  background: rgba(15, 92, 102, 0.12);
  color: #0f5c66;
}

.order-detail__chip.is-warn {
  background: rgba(180, 120, 10, 0.14);
  color: #8a5a00;
}

.order-detail__chip.is-danger {
  background: rgba(170, 40, 40, 0.12);
  color: #9b1c1c;
}

.order-detail__cta-box {
  display: grid;
  gap: 0.55rem;
  align-content: start;
  padding: 0.9rem;
  border-radius: 0.85rem;
  background: linear-gradient(160deg, #fff7e8, #fff);
  border: 1px solid rgba(245, 197, 24, 0.45);
}

.order-detail__cta-box--ok {
  background: linear-gradient(160deg, #eef8f6, #fff);
  border-color: rgba(15, 92, 102, 0.2);
}

.order-detail__cta-box p {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.4;
}

.order-detail__cta-box small {
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.4;
}

.order-detail__pay,
.order-detail__link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 1rem;
  border: 0;
  border-radius: 0.65rem;
  background: #e2136e;
  color: #fff;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
  width: fit-content;
}

.order-detail__link-btn {
  background: #0f5c66;
}

.order-detail__pay--inline {
  margin-top: 0.35rem;
}

.order-detail__panel {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid var(--line);
  background: #fff;
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.order-detail__panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem 0.75rem;
  margin-bottom: 0.85rem;
}

.order-detail__panel-head h2 {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 800;
}

.order-detail__panel-head p {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.order-detail__empty {
  display: grid;
  gap: 0.5rem;
  justify-items: start;
}

.order-detail__empty p {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.45;
}

.order-detail__items,
.order-detail__payments {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.65rem;
}

.order-detail__items li,
.order-detail__payments li {
  display: grid;
  gap: 0.35rem;
  padding: 0.85rem;
  border-radius: 0.75rem;
  border: 1px solid var(--line);
  background: #fbfcfd;
}

@media (min-width: 560px) {
  .order-detail__items li {
    grid-template-columns: 1fr auto;
    align-items: center;
  }
}

.order-detail__items strong,
.order-detail__payments strong {
  display: block;
  font-size: 0.95rem;
  color: var(--ink);
  word-break: break-word;
}

.order-detail__muted {
  display: block;
  margin-top: 0.2rem;
  color: var(--muted);
  font-size: 0.78rem;
}

.order-detail__items em {
  font-style: normal;
  font-weight: 800;
  color: var(--ink);
  white-space: nowrap;
}

.order-detail__payment-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.order-detail__payments p {
  margin: 0;
  color: var(--muted);
  font-size: 0.84rem;
  line-height: 1.4;
  word-break: break-word;
}
</style>
