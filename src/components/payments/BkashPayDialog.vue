<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  order: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

const loading = ref(false)
const message = ref('')
const bkash = ref({
  qr_url: null,
  merchant_number: '',
  note: '',
})

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

async function loadInstructions() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/settings/public', { skipErrorToast: true, skipAuthRedirect: true })
    bkash.value = data.data?.bkash_payment || { qr_url: null, merchant_number: '', note: '' }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (open.value) loadInstructions()
})
watch(open, (value) => {
  if (value) loadInstructions()
})
</script>

<template>
  <v-dialog v-model="open" max-width="420" content-class="admin-dialog">
    <div class="admin-dialog__card">
      <header class="admin-dialog__head">
        <div>
          <h2>{{ t('payBkash') }}</h2>
        </div>
        <button type="button" class="admin-dialog__close" :aria-label="t('cancel')" @click="open = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </header>

      <div class="admin-dialog__body">
        <v-progress-circular v-if="loading" indeterminate color="pink-darken-2" class="mx-auto" />
        <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
        <template v-else>
          <p class="admin-dialog__text">
            {{ t('bkashPayLead', {
              amount: order?.total ?? '—',
              number: order?.order_number || '',
            }) }}
          </p>

          <div v-if="bkash.qr_url" class="bkash-qr">
            <img :src="bkash.qr_url" :alt="t('bkashQr')" class="bkash-qr__img">
          </div>
          <v-alert v-else type="warning" variant="tonal">{{ t('bkashQrMissing') }}</v-alert>

          <div v-if="bkash.merchant_number" class="bkash-meta">
            <span>{{ t('bkashNumber') }}</span>
            <strong>{{ bkash.merchant_number }}</strong>
          </div>

          <p class="admin-dialog__text">{{ bkash.note || t('bkashPayHint') }}</p>
          <p class="admin-dialog__text">{{ t('bkashWaitAdmin') }}</p>
        </template>
      </div>

      <footer class="admin-dialog__actions">
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="open = false">{{ t('close') }}</button>
      </footer>
    </div>
  </v-dialog>
</template>

<style scoped>
.bkash-qr {
  display: grid;
  place-items: center;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: #f7fbfb;
  border: 1px solid #d9e6e8;
}

.bkash-qr__img {
  width: min(100%, 260px);
  height: auto;
  display: block;
}

.bkash-meta {
  display: grid;
  gap: 0.2rem;
  padding: 0.75rem 0.85rem;
  border-radius: 0.6rem;
  background: rgba(233, 30, 99, 0.06);
  border: 1px solid rgba(233, 30, 99, 0.16);
}

.bkash-meta span {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b7378;
}

.bkash-meta strong {
  font-size: 1.05rem;
  letter-spacing: 0.02em;
}
</style>
