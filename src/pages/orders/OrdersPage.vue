<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { useUiStore } from '../../stores/ui'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const orders = ref([])
const loading = ref(true)
const payingKey = ref('')
const message = ref('')
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

async function pay(order, gateway) {
  payingKey.value = `${order.id}:${gateway}`
  message.value = ''
  try {
    const path = gateway === 'bkash'
      ? `/orders/${order.id}/payments/bkash`
      : `/orders/${order.id}/payments/sslcommerz`
    const { data } = await http.post(path, {}, { skipErrorToast: true })
    const url = data.data.gateway_url
    if (!url) {
      throw new Error(t('paymentStartFailed'))
    }
    window.location.href = url
  } catch (error) {
    message.value = apiError(error).message || t('paymentStartFailed')
    payingKey.value = ''
  }
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
<div>
    <h1 class="text-h5 mb-4">{{ t('myOrders') }}</h1>
          <v-progress-circular v-if="loading" indeterminate color="primary" />
          <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
          <v-alert v-else-if="orders.length === 0" type="info" variant="tonal">{{ t('noOrders') }}</v-alert>
          <v-list v-else lines="two">
            <v-list-item v-for="order in orders" :key="order.id" @click="router.push({ name: 'order-detail', params: { id: order.id } })">
              <v-list-item-title>{{ order.order_number }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ t('orderStatus.' + order.status) }} · {{ order.total }} {{ t('currencyBdt') }}
                <span v-if="order.items?.length"> · {{ order.items.map((item) => item.course?.title).filter(Boolean).join(', ') }}</span>
              </v-list-item-subtitle>
              <template #append>
                <div v-if="order.status === 'pending'" class="d-flex flex-wrap ga-2" @click.stop>
                  <v-btn
                    color="primary"
                    size="small"
                    :loading="payingKey === `${order.id}:sslcommerz`"
                    @click="pay(order, 'sslcommerz')"
                  >
                    {{ t('paySslcommerz') }}
                  </v-btn>
                  <v-btn
                    color="pink-darken-2"
                    size="small"
                    :loading="payingKey === `${order.id}:bkash`"
                    @click="pay(order, 'bkash')"
                  >
                    {{ t('payBkash') }}
                  </v-btn>
                </div>
                <v-btn v-else variant="text" size="small" @click.stop="router.push({ name: 'order-detail', params: { id: order.id } })">
                  {{ t('orderDetails') }}
                </v-btn>
              </template>
            </v-list-item>
      </v-list>
  </div>
</template>
