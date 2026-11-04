<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BkashPayDialog from '../../components/payments/BkashPayDialog.vue'
import { http } from '../../services/http'
import { useLocaleStore } from '../../stores/locale'
import { useUiStore } from '../../stores/ui'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const ui = useUiStore()
const localeStore = useLocaleStore()
const route = useRoute()
const router = useRouter()
const orders = ref([])
const loading = ref(true)
const message = ref('')
const payOrder = ref(null)

const paymentNotice = computed(() => {
  const status = route.query.payment
  if (status === 'success') return t('paymentSuccess')
  if (status === 'failed') return t('paymentFailed')
  if (status === 'cancelled') return t('paymentCancelled')
  return ''
})

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/orders', { skipErrorToast: true })
    orders.value = data.data || []
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function openBkash(order) {
  payOrder.value = order
}

function openDetail(order) {
  router.push({ name: 'order-detail', params: { id: order.id } })
}

function when(value) {
  if (!value) return '—'
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function courseTitles(order) {
  return (order.items || [])
    .map((item) => item.course?.title)
    .filter(Boolean)
    .join(', ') || t('orderItems')
}

function statusTone(value) {
  if (value === 'paid') return 'ok'
  if (value === 'pending') return 'warn'
  if (value === 'failed' || value === 'cancelled' || value === 'refunded') return 'danger'
  return ''
}

onMounted(async () => {
  const status = route.query.payment
  if (paymentNotice.value) {
    if (status === 'success') ui.success(paymentNotice.value)
    else if (status === 'failed') ui.toastError(paymentNotice.value)
    else ui.info(paymentNotice.value)
  }
  await load()
})
</script>

<template>
  <div class="orders-page">
    <header class="orders-page__hero">
      <div>
        <p class="orders-page__eyebrow">{{ t('account') }}</p>
        <h1>{{ t('myOrders') }}</h1>
        <p>{{ t('myOrdersLead') }}</p>
      </div>
      <router-link class="orders-page__browse" :to="{ name: 'courses' }">
        {{ t('browseCourses') }}
        <span aria-hidden="true">→</span>
      </router-link>
    </header>

    <v-progress-circular v-if="loading" class="orders-page__loader" indeterminate color="#0f5c66" />
    <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>

    <section v-else class="orders-page__panel">
      <div class="orders-page__head">
        <div>
          <h2>{{ t('myOrders') }}</h2>
          <p>{{ orders.length }} {{ t('orders') }}</p>
        </div>
      </div>

      <div v-if="orders.length === 0" class="orders-page__empty">
        <strong>{{ t('noOrders') }}</strong>
        <p>{{ t('myOrdersEmptyLead') }}</p>
        <router-link class="orders-page__browse orders-page__browse--inline" :to="{ name: 'courses' }">
          {{ t('browseCourses') }}
          <span aria-hidden="true">→</span>
        </router-link>
      </div>

      <div v-else class="orders-page__list">
        <article
          v-for="order in orders"
          :key="order.id"
          class="order-card"
          role="button"
          tabindex="0"
          @click="openDetail(order)"
          @keydown.enter.prevent="openDetail(order)"
        >
          <div class="order-card__top">
            <div>
              <h3>{{ order.order_number }}</h3>
              <p>{{ courseTitles(order) }}</p>
            </div>
            <span
              class="order-card__chip"
              :class="{
                'is-ok': statusTone(order.status) === 'ok',
                'is-warn': statusTone(order.status) === 'warn',
                'is-danger': statusTone(order.status) === 'danger',
              }"
            >
              {{ t(`orderStatus.${order.status}`) }}
            </span>
          </div>

          <div class="order-card__meta">
            <strong>{{ order.total }} {{ t('currencyBdt') }}</strong>
            <span>{{ when(order.created_at) }}</span>
          </div>

          <div class="order-card__actions" @click.stop>
            <button
              v-if="order.status === 'pending'"
              type="button"
              class="order-card__pay"
              @click="openBkash(order)"
            >
              {{ t('payBkash') }}
            </button>
            <button type="button" class="order-card__details" @click="openDetail(order)">
              {{ t('orderDetails') }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <BkashPayDialog
      :model-value="payOrder !== null"
      :order="payOrder"
      @update:model-value="(open) => { if (!open) payOrder = null }"
    />
  </div>
</template>

<style scoped>
.orders-page {
  display: grid;
  gap: 1rem;
}

.orders-page__hero {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.15rem 1.2rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at top right, rgba(245, 197, 24, 0.22), transparent 42%),
    linear-gradient(135deg, #0b3d36 0%, #0f5c66 55%, #0a2a3a 100%);
  color: #fff;
}

@media (min-width: 720px) {
  .orders-page__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.orders-page__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.orders-page__hero h1 {
  margin: 0;
  font-size: clamp(1.4rem, 2.8vw, 1.85rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.orders-page__hero p {
  margin: 0.35rem 0 0;
  max-width: 42ch;
  opacity: 0.9;
  font-size: 0.92rem;
  line-height: 1.45;
}

.orders-page__browse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 1rem;
  border-radius: 0.65rem;
  background: #f5c518;
  color: #1a1400;
  text-decoration: none;
  font-size: 0.86rem;
  font-weight: 800;
  width: fit-content;
}

.orders-page__browse--inline {
  margin-top: 0.35rem;
}

.orders-page__loader {
  margin: 1rem auto;
  display: block;
}

.orders-page__panel {
  padding: 1rem;
  border-radius: 1rem;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.orders-page__head h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.orders-page__head p {
  margin: 0.2rem 0 0;
  color: var(--muted);
  font-size: 0.84rem;
}

.orders-page__empty {
  display: grid;
  gap: 0.45rem;
  justify-items: start;
  padding: 1.25rem 0.25rem 0.5rem;
}

.orders-page__empty strong {
  font-size: 1rem;
}

.orders-page__empty p {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.45;
}

.orders-page__list {
  display: grid;
  gap: 0.85rem;
  margin-top: 1rem;
}

.order-card {
  display: grid;
  gap: 0.75rem;
  padding: 0.95rem;
  border: 1px solid var(--line);
  border-radius: 0.85rem;
  background: #fbfcfd;
  cursor: pointer;
}

.order-card:focus-visible {
  outline: 2px solid rgba(15, 92, 102, 0.35);
  outline-offset: 2px;
}

.order-card__top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.55rem;
}

.order-card__top h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  word-break: break-word;
}

.order-card__top p {
  margin: 0.3rem 0 0;
  color: var(--muted);
  font-size: 0.84rem;
  line-height: 1.4;
  word-break: break-word;
}

.order-card__chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.7rem;
  padding: 0.15rem 0.65rem;
  border-radius: 999px;
  background: #eef2f5;
  color: var(--ink);
  font-size: 0.75rem;
  font-weight: 800;
  white-space: nowrap;
}

.order-card__chip.is-ok {
  background: rgba(15, 92, 102, 0.12);
  color: #0f5c66;
}

.order-card__chip.is-warn {
  background: rgba(180, 120, 10, 0.14);
  color: #8a5a00;
}

.order-card__chip.is-danger {
  background: rgba(170, 40, 40, 0.12);
  color: #9b1c1c;
}

.order-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  color: var(--muted);
  font-size: 0.84rem;
}

.order-card__meta strong {
  color: var(--ink);
  font-size: 0.98rem;
}

.order-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.order-card__pay,
.order-card__details {
  min-height: 40px;
  padding: 0 0.9rem;
  border-radius: 0.6rem;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
}

.order-card__pay {
  border: 0;
  background: #e2136e;
  color: #fff;
}

.order-card__details {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
}
</style>
