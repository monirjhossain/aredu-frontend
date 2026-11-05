<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminDialog from '../../components/admin/AdminDialog.vue'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const ui = useUiStore()

const coupons = ref([])
const meta = ref({ current_page: 1, last_page: 1, per_page: 15, total: 0 })
const search = ref('')
const activeFilter = ref('all')
const page = ref(1)
const loading = ref(true)
const message = ref('')
const saving = ref(false)
const formError = ref('')
const fieldErrors = ref({})
const dialog = ref(false)
const editingId = ref(null)
const deleteTarget = ref(null)
const deleting = ref(false)

const form = reactive({
  code: '',
  type: 'percent',
  value: 10,
  starts_at: '',
  ends_at: '',
  max_uses: '',
  is_active: true,
})

onMounted(() => load())

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/coupons', {
      params: {
        search: search.value || undefined,
        active: activeFilter.value === 'all' ? undefined : activeFilter.value,
        page: page.value,
      },
      skipErrorToast: true,
    })
    coupons.value = data.data || []
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
  search.value = ''
  activeFilter.value = 'all'
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

function toDateInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function openCreate() {
  editingId.value = null
  form.code = ''
  form.type = 'percent'
  form.value = 10
  form.starts_at = ''
  form.ends_at = ''
  form.max_uses = ''
  form.is_active = true
  fieldErrors.value = {}
  formError.value = ''
  dialog.value = true
}

function openEdit(coupon) {
  editingId.value = coupon.id
  form.code = coupon.code || ''
  form.type = coupon.type || 'percent'
  form.value = Number(coupon.value) || 0
  form.starts_at = toDateInput(coupon.starts_at)
  form.ends_at = toDateInput(coupon.ends_at)
  form.max_uses = coupon.max_uses ?? ''
  form.is_active = Boolean(coupon.is_active)
  fieldErrors.value = {}
  formError.value = ''
  dialog.value = true
}

function payload() {
  return {
    code: form.code,
    type: form.type,
    value: Number(form.value),
    starts_at: form.starts_at || null,
    ends_at: form.ends_at || null,
    max_uses: form.max_uses === '' || form.max_uses === null ? null : Number(form.max_uses),
    is_active: Boolean(form.is_active),
  }
}

async function save() {
  saving.value = true
  fieldErrors.value = {}
  formError.value = ''
  try {
    if (editingId.value) {
      await http.put(`/admin/coupons/${editingId.value}`, payload(), {
        skipErrorToast: true,
        skipSuccessToast: true,
      })
      ui.success(t('couponUpdated'))
    } else {
      await http.post('/admin/coupons', payload(), {
        skipErrorToast: true,
        skipSuccessToast: true,
      })
      ui.success(t('couponCreated'))
    }
    dialog.value = false
    await load()
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors || {}
    formError.value = parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

async function toggleActive(coupon, next) {
  try {
    await http.put(`/admin/coupons/${coupon.id}`, {
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      starts_at: coupon.starts_at,
      ends_at: coupon.ends_at,
      max_uses: coupon.max_uses,
      is_active: next,
    }, { skipErrorToast: true, skipSuccessToast: true })
    ui.success(t('couponUpdated'))
    await load()
  } catch (error) {
    ui.toastError(apiError(error).message || t('requestFailed'))
  }
}

function askDelete(coupon) {
  formError.value = ''
  deleteTarget.value = coupon
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  formError.value = ''
  try {
    await http.delete(`/admin/coupons/${deleteTarget.value.id}`, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    ui.success(t('couponDeleted'))
    deleteTarget.value = null
    await load()
  } catch (error) {
    const parsed = apiError(error)
    formError.value = parsed.errors?.coupon?.[0] || parsed.message || t('requestFailed')
  } finally {
    deleting.value = false
  }
}

function typeLabel(value) {
  return value === 'fixed' ? t('couponTypeFixed') : t('couponTypePercent')
}

function valueLabel(coupon) {
  if (coupon.type === 'percent') return `${Number(coupon.value)}%`
  return `৳${Number(coupon.value).toLocaleString()}`
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('manageCoupons')" :lead="t('manageCouponsLead')">
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          @click="openCreate"
        >
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newCoupon') }}
        </button>
      </template>
    </AdminPageHero>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('manageCoupons') }}</h2>
          <p>{{ t('couponsListCount', { count: meta.total || coupons.length }) }}</p>
        </div>
      </div>

      <form class="admin-ui__filters admin-ui__filters--3" @submit.prevent="applyFilters">
        <label class="admin-ui__field">
          <span>{{ t('search') }}</span>
          <input v-model="search" type="search" :placeholder="t('searchCoupons')">
        </label>
        <label class="admin-ui__field">
          <span>{{ t('status') }}</span>
          <select v-model="activeFilter">
            <option value="all">{{ t('contextAll') }}</option>
            <option value="1">{{ t('couponActive') }}</option>
            <option value="0">{{ t('couponInactive') }}</option>
          </select>
        </label>
        <div class="admin-ui__form-actions admin-coupons__filter-actions">
          <button type="submit" class="admin-ui__btn admin-ui__btn--solid">{{ t('filter') }}</button>
          <button type="button" class="admin-ui__btn admin-ui__btn--ghost" @click="resetFilters">{{ t('resetFilters') }}</button>
        </div>
      </form>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="coupons.length === 0" class="admin-ui__empty">
        <p>{{ t('noCoupons') }}</p>
      </div>
      <template v-else>
        <div class="admin-ui__table-wrap admin-coupons__desktop">
          <table class="admin-ui__table">
            <thead>
              <tr>
                <th>{{ t('couponCode') }}</th>
                <th>{{ t('couponType') }}</th>
                <th>{{ t('couponValue') }}</th>
                <th>{{ t('couponUses') }}</th>
                <th>{{ t('status') }}</th>
                <th>{{ t('actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="coupon in coupons" :key="coupon.id">
                <td><strong>{{ coupon.code }}</strong></td>
                <td>{{ typeLabel(coupon.type) }}</td>
                <td>{{ valueLabel(coupon) }}</td>
                <td>
                  {{ coupon.usages_count || 0 }}
                  <span v-if="coupon.max_uses">/ {{ coupon.max_uses }}</span>
                </td>
                <td>
                  <span class="admin-ui__chip" :class="coupon.is_active ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'">
                    {{ coupon.is_active ? t('couponActive') : t('couponInactive') }}
                  </span>
                </td>
                <td>
                  <div class="admin-coupons__actions">
                    <label class="admin-ui__switch">
                      <input
                        type="checkbox"
                        :checked="coupon.is_active"
                        @change="toggleActive(coupon, $event.target.checked)"
                      >
                      {{ coupon.is_active ? t('couponActive') : t('couponInactive') }}
                    </label>
                    <button type="button" class="admin-ui__btn admin-ui__btn--ghost" @click="openEdit(coupon)">
                      {{ t('edit') }}
                    </button>
                    <button type="button" class="admin-ui__btn admin-ui__btn--danger" @click="askDelete(coupon)">
                      {{ t('delete') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-ui__list admin-coupons__mobile">
          <article v-for="coupon in coupons" :key="`m-${coupon.id}`" class="admin-ui__row">
            <div class="admin-ui__row-main">
              <div class="admin-coupons__title-row">
                <h3 class="admin-ui__row-title">{{ coupon.code }}</h3>
                <span class="admin-ui__chip" :class="coupon.is_active ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'">
                  {{ coupon.is_active ? t('couponActive') : t('couponInactive') }}
                </span>
              </div>
              <p class="admin-ui__row-meta">
                {{ typeLabel(coupon.type) }} · {{ valueLabel(coupon) }}
                · {{ t('couponUses') }}: {{ coupon.usages_count || 0 }}
                <template v-if="coupon.max_uses"> / {{ coupon.max_uses }}</template>
              </p>
            </div>
            <div class="admin-ui__row-actions">
              <button type="button" class="admin-ui__btn admin-ui__btn--ghost" @click="openEdit(coupon)">{{ t('edit') }}</button>
              <button type="button" class="admin-ui__btn admin-ui__btn--danger" @click="askDelete(coupon)">{{ t('delete') }}</button>
            </div>
          </article>
        </div>
      </template>

      <div v-if="meta.last_page > 1" class="admin-coupons__pager">
        <button type="button" class="admin-ui__btn admin-ui__btn--ghost" :disabled="page <= 1 || loading" @click="goPage(page - 1)">
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

    <AdminDialog v-model="dialog" :title="editingId ? t('editCoupon') : t('newCoupon')" :max-width="560" persistent>
      <v-alert v-if="formError" type="error" variant="tonal" class="mb-3">{{ formError }}</v-alert>
      <form class="admin-ui__form-grid admin-ui__form-grid--2" @submit.prevent="save">
        <label class="admin-ui__field">
          <span>{{ t('couponCode') }}</span>
          <input v-model="form.code" type="text" maxlength="50" required>
          <small v-if="fieldErrors.code?.length" class="admin-coupons__error">{{ fieldErrors.code[0] }}</small>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('couponType') }}</span>
          <select v-model="form.type">
            <option value="percent">{{ t('couponTypePercent') }}</option>
            <option value="fixed">{{ t('couponTypeFixed') }}</option>
          </select>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('couponValue') }}</span>
          <input v-model.number="form.value" type="number" min="0.01" step="0.01" required>
          <small v-if="fieldErrors.value?.length" class="admin-coupons__error">{{ fieldErrors.value[0] }}</small>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('couponMaxUses') }}</span>
          <input v-model="form.max_uses" type="number" min="1" step="1" :placeholder="t('couponUnlimited')">
        </label>
        <label class="admin-ui__field">
          <span>{{ t('couponStartsAt') }}</span>
          <input v-model="form.starts_at" type="date">
        </label>
        <label class="admin-ui__field">
          <span>{{ t('couponEndsAt') }}</span>
          <input v-model="form.ends_at" type="date">
          <small v-if="fieldErrors.ends_at?.length" class="admin-coupons__error">{{ fieldErrors.ends_at[0] }}</small>
        </label>
        <label class="admin-ui__switch admin-coupons__switch">
          <input v-model="form.is_active" type="checkbox">
          {{ t('couponActive') }}
        </label>
      </form>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--ghost" @click="dialog = false">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--primary" :disabled="saving" @click="save">
          {{ saving ? t('loading') : t('save') }}
        </button>
      </template>
    </AdminDialog>

    <AdminDialog
      :model-value="Boolean(deleteTarget)"
      :title="t('confirmDeleteCoupon')"
      danger
      persistent
      :max-width="440"
      @update:model-value="(open) => { if (!open) deleteTarget = null }"
    >
      <p v-if="deleteTarget">{{ t('confirmDeleteCouponBody', { code: deleteTarget.code }) }}</p>
      <v-alert v-if="formError" type="error" variant="tonal" class="mt-3">{{ formError }}</v-alert>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--ghost" @click="deleteTarget = null">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--danger" :disabled="deleting" @click="confirmDelete">
          {{ deleting ? t('loading') : t('delete') }}
        </button>
      </template>
    </AdminDialog>
  </div>
</template>

<style scoped>
.admin-coupons__filter-actions {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.admin-coupons__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.admin-coupons__title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  justify-content: space-between;
}

.admin-coupons__desktop {
  display: none;
}

.admin-coupons__mobile {
  display: grid;
}

.admin-coupons__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.85rem;
}

.admin-coupons__error {
  color: #b42318;
  font-size: 0.75rem;
}

.admin-coupons__switch {
  grid-column: 1 / -1;
  margin-top: 0.25rem;
}

@media (min-width: 960px) {
  .admin-coupons__desktop {
    display: block;
  }

  .admin-coupons__mobile {
    display: none;
  }
}
</style>
