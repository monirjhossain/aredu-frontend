<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminDialog from '../../components/admin/AdminDialog.vue'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { useLocaleStore } from '../../stores/locale'
import { useUiStore } from '../../stores/ui'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const localeStore = useLocaleStore()
const ui = useUiStore()

const tab = ref('income')
const loading = ref(true)
const message = ref('')
const summary = ref(null)

const income = ref([])
const incomeMeta = ref({ current_page: 1, last_page: 1, total: 0 })
const incomePage = ref(1)
const incomeLoading = ref(false)

const expenses = ref([])
const expenseMeta = ref({ current_page: 1, last_page: 1, total: 0 })
const expensePage = ref(1)
const expenseLoading = ref(false)

const dialog = ref(false)
const deleteTarget = ref(null)
const editing = ref(null)
const saving = ref(false)
const deleting = ref(false)
const formError = ref('')
const fieldErrors = ref({})

const filters = ref({
  date_from: monthStart(),
  date_to: today(),
  search: '',
  gateway: '',
  category: '',
})

const form = reactive({
  title: '',
  category: 'other',
  amount: '',
  spent_on: today(),
  payment_method: '',
  notes: '',
})

const categoryOptions = computed(() => [
  { value: '', label: t('allCategories') },
  { value: 'rent', label: t('expenseCategory.rent') },
  { value: 'salary', label: t('expenseCategory.salary') },
  { value: 'marketing', label: t('expenseCategory.marketing') },
  { value: 'tools', label: t('expenseCategory.tools') },
  { value: 'utility', label: t('expenseCategory.utility') },
  { value: 'other', label: t('expenseCategory.other') },
])

const formCategoryOptions = computed(() => categoryOptions.value.filter((item) => item.value))

const gatewayOptions = computed(() => [
  { value: '', label: t('allGateways') },
  { value: 'bkash', label: 'bKash' },
  { value: 'sslcommerz', label: 'SSLCommerz' },
])

function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function today() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function money(value, currency = 'BDT') {
  const amount = Number(value || 0)
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-BD'
  try {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount)} ${currency}`
  } catch {
    return `${amount} ${currency}`
  }
}

function when(value) {
  if (!value) return '—'
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function dateOnly(value) {
  if (!value) return '—'
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function categoryLabel(value) {
  return t(`expenseCategory.${value || 'other'}`)
}

function statusTone(value) {
  if (value === 'paid') return 'ok'
  if (value === 'refunded') return 'danger'
  return 'warn'
}

async function loadSummary() {
  const { data } = await http.get('/admin/finance/summary', {
    params: {
      date_from: filters.value.date_from || undefined,
      date_to: filters.value.date_to || undefined,
    },
    skipErrorToast: true,
  })
  summary.value = data.data || null
}

async function loadIncome() {
  incomeLoading.value = true
  try {
    const { data } = await http.get('/admin/finance/income', {
      params: {
        page: incomePage.value,
        date_from: filters.value.date_from || undefined,
        date_to: filters.value.date_to || undefined,
        gateway: filters.value.gateway || undefined,
        search: filters.value.search || undefined,
      },
      skipErrorToast: true,
    })
    income.value = data.data || []
    incomeMeta.value = data.meta || incomeMeta.value
  } finally {
    incomeLoading.value = false
  }
}

async function loadExpenses() {
  expenseLoading.value = true
  try {
    const { data } = await http.get('/admin/finance/expenses', {
      params: {
        page: expensePage.value,
        date_from: filters.value.date_from || undefined,
        date_to: filters.value.date_to || undefined,
        category: filters.value.category || undefined,
        search: filters.value.search || undefined,
      },
      skipErrorToast: true,
    })
    expenses.value = data.data || []
    expenseMeta.value = data.meta || expenseMeta.value
  } finally {
    expenseLoading.value = false
  }
}

async function loadAll() {
  loading.value = true
  message.value = ''
  try {
    await loadSummary()
    if (tab.value === 'income') await loadIncome()
    else await loadExpenses()
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  incomePage.value = 1
  expensePage.value = 1
  loadAll()
}

function resetFilters() {
  filters.value = {
    date_from: monthStart(),
    date_to: today(),
    search: '',
    gateway: '',
    category: '',
  }
  incomePage.value = 1
  expensePage.value = 1
  loadAll()
}

function setTab(next) {
  tab.value = next
}

function resetForm() {
  form.title = ''
  form.category = 'other'
  form.amount = ''
  form.spent_on = today()
  form.payment_method = ''
  form.notes = ''
  fieldErrors.value = {}
  formError.value = ''
}

function openCreate() {
  editing.value = null
  resetForm()
  dialog.value = true
}

function openEdit(expense) {
  editing.value = expense
  form.title = expense.title || ''
  form.category = expense.category || 'other'
  form.amount = String(expense.amount ?? '')
  form.spent_on = expense.spent_on || today()
  form.payment_method = expense.payment_method || ''
  form.notes = expense.notes || ''
  fieldErrors.value = {}
  formError.value = ''
  dialog.value = true
}

async function saveExpense() {
  saving.value = true
  formError.value = ''
  fieldErrors.value = {}
  const payload = {
    title: form.title,
    category: form.category,
    amount: Number(form.amount),
    spent_on: form.spent_on,
    payment_method: form.payment_method || null,
    notes: form.notes || null,
    currency: 'BDT',
  }
  try {
    if (editing.value) {
      await http.put(`/admin/finance/expenses/${editing.value.id}`, payload, {
        skipErrorToast: true,
        skipSuccessToast: true,
      })
      ui.success(t('expenseUpdated'))
    } else {
      await http.post('/admin/finance/expenses', payload, {
        skipErrorToast: true,
        skipSuccessToast: true,
      })
      ui.success(t('expenseCreated'))
    }
    dialog.value = false
    await loadAll()
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors || {}
    formError.value = parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  formError.value = ''
  try {
    await http.delete(`/admin/finance/expenses/${deleteTarget.value.id}`, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    ui.success(t('expenseDeleted'))
    deleteTarget.value = null
    await loadAll()
  } catch (error) {
    formError.value = apiError(error).message || t('requestFailed')
  } finally {
    deleting.value = false
  }
}

watch(tab, async (next) => {
  message.value = ''
  try {
    if (next === 'income') await loadIncome()
    else await loadExpenses()
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  }
})

onMounted(loadAll)
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('manageFinance')" :lead="t('financeLead')">
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          @click="openCreate"
        >
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newExpense') }}
        </button>
      </template>
    </AdminPageHero>

    <section class="admin-ui__panel">
      <form class="admin-finance__filters" @submit.prevent="applyFilters">
        <input
          v-model="filters.date_from"
          class="admin-finance__filter-input"
          type="date"
          :aria-label="t('dateFrom')"
        >
        <input
          v-model="filters.date_to"
          class="admin-finance__filter-input"
          type="date"
          :aria-label="t('dateTo')"
        >
        <input
          v-model="filters.search"
          class="admin-finance__filter-input admin-finance__filter-input--search"
          type="search"
          :placeholder="tab === 'income' ? t('searchIncome') : t('searchExpenses')"
        >
        <select
          v-if="tab === 'income'"
          v-model="filters.gateway"
          class="admin-finance__filter-input"
        >
          <option v-for="option in gatewayOptions" :key="option.value || 'gw'" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <select
          v-else
          v-model="filters.category"
          class="admin-finance__filter-input"
        >
          <option v-for="option in categoryOptions" :key="option.value || 'cat'" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <button type="submit" class="admin-ui__btn admin-ui__btn--solid admin-finance__filter-btn">
          {{ t('applyFilters') }}
        </button>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost admin-finance__filter-btn"
          @click="resetFilters"
        >
          {{ t('resetFilters') }}
        </button>
      </form>

      <div v-if="loading && !summary" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>

      <div v-else-if="summary" class="admin-finance__stats">
        <article class="admin-finance__stat admin-finance__stat--income">
          <span>{{ t('incomeGross') }}</span>
          <strong>{{ money(summary.income_gross, summary.currency) }}</strong>
        </article>
        <article class="admin-finance__stat">
          <span>{{ t('incomeRefunded') }}</span>
          <strong>{{ money(summary.income_refunded, summary.currency) }}</strong>
        </article>
        <article class="admin-finance__stat admin-finance__stat--net">
          <span>{{ t('incomeNet') }}</span>
          <strong>{{ money(summary.income_net, summary.currency) }}</strong>
        </article>
        <article class="admin-finance__stat admin-finance__stat--expense">
          <span>{{ t('expenseTotal') }}</span>
          <strong>{{ money(summary.expense_total, summary.currency) }}</strong>
        </article>
        <article
          class="admin-finance__stat"
          :class="Number(summary.profit) >= 0 ? 'admin-finance__stat--profit' : 'admin-finance__stat--loss'"
        >
          <span>{{ t('netProfit') }}</span>
          <strong>{{ money(summary.profit, summary.currency) }}</strong>
        </article>
      </div>

      <div v-if="summary" class="admin-finance__breakdown">
        <div class="admin-finance__break-card">
          <h3>{{ t('incomeByGateway') }}</h3>
          <ul v-if="(summary.income_by_gateway || []).length">
            <li v-for="row in summary.income_by_gateway" :key="row.gateway">
              <span>{{ row.gateway }}</span>
              <strong>{{ money(row.total, summary.currency) }}</strong>
            </li>
          </ul>
          <p v-else class="admin-finance__muted">{{ t('noIncomeInRange') }}</p>
        </div>
        <div class="admin-finance__break-card">
          <h3>{{ t('expensesByCategory') }}</h3>
          <ul v-if="(summary.expenses_by_category || []).length">
            <li v-for="row in summary.expenses_by_category" :key="row.category">
              <span>{{ categoryLabel(row.category) }}</span>
              <strong>{{ money(row.total, summary.currency) }}</strong>
            </li>
          </ul>
          <p v-else class="admin-finance__muted">{{ t('noExpensesInRange') }}</p>
        </div>
      </div>
    </section>

    <section class="admin-ui__panel">
      <div class="admin-finance__tabs" role="tablist">
        <button
          type="button"
          class="admin-finance__tab"
          :class="{ 'is-active': tab === 'income' }"
          role="tab"
          @click="setTab('income')"
        >
          {{ t('income') }}
        </button>
        <button
          type="button"
          class="admin-finance__tab"
          :class="{ 'is-active': tab === 'expenses' }"
          role="tab"
          @click="setTab('expenses')"
        >
          {{ t('expenses') }}
        </button>
      </div>

      <template v-if="tab === 'expenses'">
        <div v-if="expenseLoading" class="admin-ui__loading">
          <v-progress-circular indeterminate color="#0f5c66" size="32" />
        </div>
        <div v-else-if="expenses.length === 0" class="admin-ui__empty">
          <p>{{ t('noExpensesInRange') }}</p>
        </div>
        <template v-else>
          <div class="admin-ui__table-wrap admin-finance__table-wrap">
            <table class="admin-ui__table">
              <thead>
                <tr>
                  <th>{{ t('title') }}</th>
                  <th>{{ t('category') }}</th>
                  <th>{{ t('amount') }}</th>
                  <th>{{ t('date') }}</th>
                  <th>{{ t('paymentMethod') }}</th>
                  <th>{{ t('actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="expense in expenses" :key="expense.id">
                  <td>
                    <div class="admin-finance__name">{{ expense.title }}</div>
                    <div v-if="expense.notes" class="admin-finance__meta">{{ expense.notes }}</div>
                  </td>
                  <td>{{ categoryLabel(expense.category) }}</td>
                  <td><strong>{{ money(expense.amount, expense.currency) }}</strong></td>
                  <td>{{ dateOnly(expense.spent_on) }}</td>
                  <td>{{ expense.payment_method || '—' }}</td>
                  <td>
                    <div class="admin-finance__actions">
                      <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="openEdit(expense)">
                        {{ t('edit') }}
                      </button>
                      <button
                        type="button"
                        class="admin-ui__btn admin-ui__btn--danger"
                        @click="formError = ''; deleteTarget = expense"
                      >
                        {{ t('delete') }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="admin-ui__list admin-finance__cards">
            <article v-for="expense in expenses" :key="`e-${expense.id}`" class="admin-ui__row">
              <div class="admin-ui__row-main">
                <div>
                  <h3 class="admin-ui__row-title">{{ expense.title }}</h3>
                  <p class="admin-ui__row-meta">
                    {{ categoryLabel(expense.category) }} · {{ dateOnly(expense.spent_on) }}
                  </p>
                  <p class="admin-ui__row-meta">
                    <strong>{{ money(expense.amount, expense.currency) }}</strong>
                    <template v-if="expense.payment_method"> · {{ expense.payment_method }}</template>
                  </p>
                </div>
              </div>
              <div class="admin-ui__row-actions">
                <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="openEdit(expense)">
                  {{ t('edit') }}
                </button>
                <button
                  type="button"
                  class="admin-ui__btn admin-ui__btn--danger"
                  @click="formError = ''; deleteTarget = expense"
                >
                  {{ t('delete') }}
                </button>
              </div>
            </article>
          </div>
        </template>

        <div v-if="expenseMeta.last_page > 1" class="admin-finance__pager">
          <button
            type="button"
            class="admin-ui__btn admin-ui__btn--ghost"
            :disabled="expensePage <= 1 || expenseLoading"
            @click="expensePage -= 1; loadExpenses()"
          >
            {{ t('previous') }}
          </button>
          <span>{{ expensePage }} / {{ expenseMeta.last_page }}</span>
          <button
            type="button"
            class="admin-ui__btn admin-ui__btn--ghost"
            :disabled="expensePage >= expenseMeta.last_page || expenseLoading"
            @click="expensePage += 1; loadExpenses()"
          >
            {{ t('next') }}
          </button>
        </div>
      </template>

      <template v-else>
        <div v-if="incomeLoading" class="admin-ui__loading">
          <v-progress-circular indeterminate color="#0f5c66" size="32" />
        </div>
        <div v-else-if="income.length === 0" class="admin-ui__empty">
          <p>{{ t('noIncomeInRange') }}</p>
        </div>
        <template v-else>
          <div class="admin-ui__table-wrap admin-finance__table-wrap">
            <table class="admin-ui__table">
              <thead>
                <tr>
                  <th>{{ t('orderNumber') }}</th>
                  <th>{{ t('student') }}</th>
                  <th>{{ t('paymentGateway') }}</th>
                  <th>{{ t('amount') }}</th>
                  <th>{{ t('status') }}</th>
                  <th>{{ t('date') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in income" :key="row.id">
                  <td>
                    <div class="admin-finance__name">{{ row.order?.order_number || `#${row.order_id}` }}</div>
                    <div v-if="row.gateway_reference" class="admin-finance__meta">Trx {{ row.gateway_reference }}</div>
                  </td>
                  <td>
                    <div class="admin-finance__name">{{ row.order?.user?.name || '—' }}</div>
                    <div class="admin-finance__meta">{{ row.order?.user?.email }}</div>
                  </td>
                  <td>{{ row.gateway }}</td>
                  <td><strong>{{ money(row.amount, row.currency) }}</strong></td>
                  <td>
                    <span
                      class="admin-ui__chip"
                      :class="{
                        'admin-ui__chip--ok': statusTone(row.status) === 'ok',
                        'admin-ui__chip--danger': statusTone(row.status) === 'danger',
                      }"
                    >
                      {{ t(`paymentStatuses.${row.status}`) }}
                    </span>
                  </td>
                  <td>{{ when(row.status === 'refunded' ? row.updated_at : row.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="admin-ui__list admin-finance__cards">
            <article v-for="row in income" :key="`i-${row.id}`" class="admin-ui__row">
              <div class="admin-ui__row-main">
                <div>
                  <div class="admin-finance__title-row">
                    <h3 class="admin-ui__row-title">{{ row.order?.order_number || `#${row.order_id}` }}</h3>
                    <span
                      class="admin-ui__chip"
                      :class="{
                        'admin-ui__chip--ok': statusTone(row.status) === 'ok',
                        'admin-ui__chip--danger': statusTone(row.status) === 'danger',
                      }"
                    >
                      {{ t(`paymentStatuses.${row.status}`) }}
                    </span>
                  </div>
                  <p class="admin-ui__row-meta">
                    {{ row.order?.user?.name || '—' }} · {{ row.gateway }}
                  </p>
                  <p class="admin-ui__row-meta">
                    <strong>{{ money(row.amount, row.currency) }}</strong>
                    · {{ when(row.status === 'refunded' ? row.updated_at : row.created_at) }}
                  </p>
                </div>
              </div>
            </article>
          </div>
        </template>

        <div v-if="incomeMeta.last_page > 1" class="admin-finance__pager">
          <button
            type="button"
            class="admin-ui__btn admin-ui__btn--ghost"
            :disabled="incomePage <= 1 || incomeLoading"
            @click="incomePage -= 1; loadIncome()"
          >
            {{ t('previous') }}
          </button>
          <span>{{ incomePage }} / {{ incomeMeta.last_page }}</span>
          <button
            type="button"
            class="admin-ui__btn admin-ui__btn--ghost"
            :disabled="incomePage >= incomeMeta.last_page || incomeLoading"
            @click="incomePage += 1; loadIncome()"
          >
            {{ t('next') }}
          </button>
        </div>
      </template>
    </section>

    <AdminDialog
      v-model="dialog"
      :title="editing ? t('editExpense') : t('newExpense')"
      :max-width="520"
    >
      <v-alert v-if="formError" type="error" variant="tonal" class="mb-3">{{ formError }}</v-alert>
      <form class="admin-ui__form-grid" @submit.prevent="saveExpense">
        <label class="admin-ui__field">
          <span>{{ t('title') }}</span>
          <input v-model="form.title" type="text" required>
          <small v-if="fieldErrors.title?.length" class="admin-finance__error">{{ fieldErrors.title[0] }}</small>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('category') }}</span>
          <select v-model="form.category">
            <option v-for="option in formCategoryOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('amount') }}</span>
          <input v-model="form.amount" type="number" min="0.01" step="0.01" required>
          <small v-if="fieldErrors.amount?.length" class="admin-finance__error">{{ fieldErrors.amount[0] }}</small>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('date') }}</span>
          <input v-model="form.spent_on" type="date" required>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('paymentMethod') }}</span>
          <input v-model="form.payment_method" type="text" :placeholder="t('paymentMethodHint')">
        </label>
        <label class="admin-ui__field">
          <span>{{ t('notes') }}</span>
          <textarea v-model="form.notes" rows="3" />
        </label>
      </form>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="dialog = false">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--solid" :disabled="saving" @click="saveExpense">
          {{ t('save') }}
        </button>
      </template>
    </AdminDialog>

    <AdminDialog
      :model-value="deleteTarget !== null"
      :title="t('deleteExpense')"
      :max-width="420"
      danger
      @update:model-value="(open) => { if (!open) deleteTarget = null }"
    >
      <v-alert v-if="formError" type="error" variant="tonal" class="mb-3">{{ formError }}</v-alert>
      <p class="admin-dialog__text">
        {{ t('confirmDeleteExpense', { title: deleteTarget?.title || '' }) }}
      </p>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="deleteTarget = null">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--danger" :disabled="deleting" @click="confirmDelete">
          {{ t('delete') }}
        </button>
      </template>
    </AdminDialog>
  </div>
</template>

<style scoped>
.admin-finance__filters {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.admin-finance__filters::-webkit-scrollbar {
  display: none;
}

.admin-finance__filter-input {
  flex: 0 0 auto;
  min-height: 2.4rem;
  height: 2.4rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.55rem;
  background: #fff;
  font: inherit;
  font-size: 0.84rem;
}

.admin-finance__filter-input--search {
  flex: 1 1 12rem;
  min-width: 11rem;
  max-width: 16rem;
}

.admin-finance__filter-btn {
  flex: 0 0 auto;
  min-height: 2.4rem !important;
  height: 2.4rem;
  padding: 0 0.85rem !important;
  font-size: 0.8rem !important;
  white-space: nowrap;
}

.admin-finance__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.admin-finance__stat {
  display: grid;
  gap: 0.3rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.85rem;
  background: #fff;
}

.admin-finance__stat span {
  color: var(--admin-muted);
  font-size: 0.75rem;
  font-weight: 700;
}

.admin-finance__stat strong {
  font-size: 1.05rem;
  color: var(--admin-ink);
  word-break: break-word;
}

.admin-finance__stat--income {
  background: linear-gradient(160deg, #eef8f6, #fff);
}

.admin-finance__stat--net,
.admin-finance__stat--profit {
  background: linear-gradient(160deg, #f3faf1, #fff);
}

.admin-finance__stat--expense,
.admin-finance__stat--loss {
  background: linear-gradient(160deg, #fff5f3, #fff);
}

.admin-finance__breakdown {
  display: grid;
  gap: 0.75rem;
}

@media (min-width: 760px) {
  .admin-finance__breakdown {
    grid-template-columns: 1fr 1fr;
  }
}

.admin-finance__break-card {
  padding: 0.9rem 1rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.85rem;
  background: #fbfcfd;
}

.admin-finance__break-card h3 {
  margin: 0 0 0.55rem;
  font-size: 0.9rem;
}

.admin-finance__break-card ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}

.admin-finance__break-card li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.86rem;
}

.admin-finance__muted {
  margin: 0;
  color: var(--admin-muted);
  font-size: 0.86rem;
}

.admin-finance__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 1rem;
}

.admin-finance__tab {
  min-height: 40px;
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--admin-line);
  border-radius: 999px;
  background: #fff;
  color: var(--admin-muted);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 750;
  cursor: pointer;
}

.admin-finance__tab.is-active {
  background: var(--admin-teal);
  border-color: var(--admin-teal);
  color: #fff;
}

.admin-finance__table-wrap {
  display: none;
}

.admin-finance__cards {
  display: grid;
}

.admin-finance__name {
  font-weight: 750;
  word-break: break-word;
}

.admin-finance__meta {
  margin-top: 0.15rem;
  color: var(--admin-muted);
  font-size: 0.78rem;
  word-break: break-word;
}

.admin-finance__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.admin-finance__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.2rem;
}

.admin-finance__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.admin-finance__error {
  color: #e85d4c;
}

@media (min-width: 900px) {
  .admin-finance__table-wrap {
    display: block;
  }

  .admin-finance__cards {
    display: none;
  }
}
</style>
