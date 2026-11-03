<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const order = ref(null)
const loading = ref(true)
const message = ref('')
const payingKey = ref('')

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

async function pay(gateway) {
  if (!order.value) return
  payingKey.value = gateway
  message.value = ''
  try {
    const path = gateway === 'bkash'
      ? `/orders/${order.value.id}/payments/bkash`
      : `/orders/${order.value.id}/payments/sslcommerz`
    const { data } = await http.post(path, {}, { skipErrorToast: true })
    const url = data.data.gateway_url
    if (!url) throw new Error(t('paymentStartFailed'))
    window.location.href = url
  } catch (error) {
    message.value = apiError(error).message || t('paymentStartFailed')
    payingKey.value = ''
  }
}

onMounted(load)
watch(() => route.params.id, load)
</script>

<template>
<div>
    <v-btn class="mb-4" variant="text" @click="router.push({ name: 'orders' })">{{ t('backToOrders') }}</v-btn>
          <v-progress-circular v-if="loading" indeterminate color="primary" />
          <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
          <template v-else-if="order">
            <h1 class="text-h5 mb-2">{{ order.order_number }}</h1>
            <div class="text-body-1 mb-4">
              {{ t('orderStatus.' + order.status) }} · {{ order.total }} {{ t('currencyBdt') }}
    <h2 class="text-h6 mb-2">{{ t('orderItems') }}</h2>
            <v-list class="mb-4" density="comfortable">
              <v-list-item v-for="item in order.items || []" :key="item.id">
                <v-list-item-title>{{ item.course?.title || ('#' + item.course_id) }}</v-list-item-title>
                <v-list-item-subtitle>{{ item.line_total }} {{ t('currencyBdt') }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <h2 class="text-h6 mb-2">{{ t('paymentStatus') }}</h2>
            <v-alert v-if="!(order.payments || []).length" type="info" variant="tonal" class="mb-4">
              {{ t('noPaymentsYet') }}
            </v-alert>
            <v-list v-else class="mb-4" density="comfortable">
              <v-list-item v-for="payment in order.payments" :key="payment.id">
                <v-list-item-title>{{ payment.gateway }} · {{ t('paymentStatuses.' + payment.status) }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ payment.amount }} {{ payment.currency }}
                  <span v-if="payment.gateway_transaction_id"> · {{ payment.gateway_transaction_id }}</span>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <div v-if="order.status === 'pending'" class="d-flex flex-wrap ga-2">
              <v-btn color="primary" :loading="payingKey === 'sslcommerz'" @click="pay('sslcommerz')">
                {{ t('paySslcommerz') }}
              </v-btn>
              <v-btn color="pink-darken-2" :loading="payingKey === 'bkash'" @click="pay('bkash')">
                {{ t('payBkash') }}
              </v-btn>
            </div>

      </div>
  </template></div>
</template>
