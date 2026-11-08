<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AdminDialog from '../../components/admin/AdminDialog.vue'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { useLocaleStore } from '../../stores/locale'
import { useUiStore } from '../../stores/ui'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const auth = useAuthStore()
const localeStore = useLocaleStore()
const ui = useUiStore()
const router = useRouter()

const accounts = ref([])
const roles = ref([])
const meta = ref({ current_page: 1, last_page: 1, per_page: 20, total: 0 })
const loading = ref(true)
const message = ref('')
const page = ref(1)
const saving = ref(false)
const togglingId = ref(null)
const dialog = ref(false)
const passwordDialog = ref(false)
const editing = ref(null)
const passwordTarget = ref(null)
const formError = ref('')
const fieldErrors = ref({})
const passwordError = ref('')
const newPassword = ref('')

const filters = ref({
  search: '',
  role: '',
  status: '',
})

const form = reactive({
  name: '',
  email: '',
  phone: '',
  locale: 'en',
  password: '',
  roles: [],
  is_active: true,
})

const roleOptions = computed(() => roles.value.map((role) => ({
  value: role.slug,
  label: role.name || role.slug,
})))

const statusOptions = computed(() => [
  { value: '', label: t('allStatuses') },
  { value: 'active', label: t('accountActive') },
  { value: 'inactive', label: t('accountInactive') },
])

const roleFilterOptions = computed(() => [
  { value: '', label: t('allRoles') },
  ...roleOptions.value,
])

const localeOptions = computed(() => [
  { value: 'en', label: 'EN' },
  { value: 'bn', label: 'বাং' },
])

const dialogTitle = computed(() => (
  editing.value ? t('editAccount') : t('newAccount')
))

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/accounts', {
      params: {
        page: page.value,
        search: filters.value.search || undefined,
        role: filters.value.role || undefined,
        status: filters.value.status || undefined,
      },
      skipErrorToast: true,
    })
    accounts.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  try {
    const { data } = await http.get('/admin/roles', { skipErrorToast: true })
    roles.value = data.data || []
  } catch {
    roles.value = [
      { slug: 'student', name: 'Student' },
      { slug: 'teacher', name: 'Teacher' },
      { slug: 'super_admin', name: 'Super Admin' },
    ]
  }
}

function applyFilters() {
  page.value = 1
  load()
}

function resetFilters() {
  filters.value = { search: '', role: '', status: '' }
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

function resetForm() {
  form.name = ''
  form.email = ''
  form.phone = ''
  form.locale = 'en'
  form.password = ''
  form.roles = ['student']
  form.is_active = true
  fieldErrors.value = {}
  formError.value = ''
}

function openCreate() {
  editing.value = null
  resetForm()
  dialog.value = true
}

function openEdit(account) {
  editing.value = account
  form.name = account.name || ''
  form.email = account.email || ''
  form.phone = account.phone || ''
  form.locale = account.locale || 'en'
  form.password = ''
  form.roles = [...(account.roles || [])]
  form.is_active = account.is_active !== false
  fieldErrors.value = {}
  formError.value = ''
  dialog.value = true
}

function openPassword(account) {
  passwordTarget.value = account
  newPassword.value = ''
  passwordError.value = ''
  passwordDialog.value = true
}

function toggleRole(slug) {
  if (form.roles.includes(slug)) {
    form.roles = form.roles.filter((role) => role !== slug)
  } else {
    form.roles = [...form.roles, slug]
  }
}

async function save() {
  saving.value = true
  formError.value = ''
  fieldErrors.value = {}
  const payload = {
    name: form.name,
    email: form.email,
    phone: form.phone || null,
    locale: form.locale,
    roles: form.roles,
    is_active: form.is_active,
  }
  if (!editing.value || form.password) {
    payload.password = form.password
  }

  try {
    if (editing.value) {
      await http.put(`/admin/accounts/${editing.value.id}`, payload, {
        skipErrorToast: true,
        skipSuccessToast: true,
      })
      ui.success(t('accountUpdated'))
    } else {
      await http.post('/admin/accounts', payload, {
        skipErrorToast: true,
        skipSuccessToast: true,
      })
      ui.success(t('accountCreated'))
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

async function toggleActive(account) {
  const next = !(account.is_active !== false)
  if (!next && !window.confirm(t('confirmDeactivateAccount', { name: account.name }))) return

  togglingId.value = account.id
  message.value = ''
  try {
    await http.post(`/admin/accounts/${account.id}/active`, { is_active: next }, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    ui.success(next ? t('accountActivated') : t('accountDeactivated'))
    await load()
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    togglingId.value = null
  }
}

async function savePassword() {
  if (!passwordTarget.value) return
  saving.value = true
  passwordError.value = ''
  try {
    await http.post(`/admin/accounts/${passwordTarget.value.id}/reset-password`, {
      password: newPassword.value,
    }, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    ui.success(t('accountPasswordReset'))
    passwordDialog.value = false
  } catch (error) {
    const parsed = apiError(error)
    passwordError.value = parsed.errors?.password?.[0] || parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

function openStudent(account) {
  if (!(account.roles || []).includes('student')) return
  router.push({ name: 'admin-student-detail', params: { id: account.id } })
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

function roleLabel(slug) {
  return roles.value.find((role) => role.slug === slug)?.name || slug
}

function isSelf(account) {
  return Number(account?.id) === Number(auth.user?.id)
}

onMounted(async () => {
  await Promise.all([loadRoles(), load()])
})
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('manageAccounts')" :lead="t('accountsLead')">
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          @click="openCreate"
        >
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newAccount') }}
        </button>
      </template>
    </AdminPageHero>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('manageAccounts') }}</h2>
          <p>{{ t('accountsListCount', { count: meta.total || accounts.length }) }}</p>
        </div>
      </div>

      <form class="admin-accounts__filters" @submit.prevent="applyFilters">
        <input
          v-model="filters.search"
          class="admin-accounts__filter-input admin-accounts__filter-input--search"
          type="search"
          :placeholder="t('searchAccounts')"
          :aria-label="t('search')"
        >
        <select v-model="filters.role" class="admin-accounts__filter-input" :aria-label="t('roles')">
          <option v-for="option in roleFilterOptions" :key="option.value || 'all-roles'" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <select v-model="filters.status" class="admin-accounts__filter-input" :aria-label="t('status')">
          <option v-for="option in statusOptions" :key="option.value || 'all-status'" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <button type="submit" class="admin-ui__btn admin-ui__btn--solid admin-accounts__filter-btn">
          {{ t('applyFilters') }}
        </button>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost admin-accounts__filter-btn"
          @click="resetFilters"
        >
          {{ t('resetFilters') }}
        </button>
      </form>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="accounts.length === 0" class="admin-ui__empty">
        <p>{{ t('noAccounts') }}</p>
      </div>

      <template v-else>
        <div class="admin-ui__table-wrap admin-accounts__table-wrap">
          <table class="admin-ui__table admin-accounts__table">
            <thead>
              <tr>
                <th>{{ t('name') }}</th>
                <th>{{ t('roles') }}</th>
                <th>{{ t('phone') }}</th>
                <th>{{ t('status') }}</th>
                <th>{{ t('joined') }}</th>
                <th>{{ t('actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="account in accounts" :key="account.id">
                <td>
                  <div class="admin-accounts__name">{{ account.name }}</div>
                  <div class="admin-accounts__meta">{{ account.email }}</div>
                </td>
                <td>
                  <div class="admin-ui__chips">
                    <span v-for="role in (account.roles || [])" :key="role" class="admin-ui__chip">
                      {{ roleLabel(role) }}
                    </span>
                  </div>
                </td>
                <td>{{ account.phone || '—' }}</td>
                <td>
                  <span
                    class="admin-ui__chip"
                    :class="account.is_active !== false ? 'admin-ui__chip--ok' : 'admin-ui__chip--danger'"
                  >
                    {{ account.is_active !== false ? t('accountActive') : t('accountInactive') }}
                  </span>
                </td>
                <td>{{ when(account.created_at) }}</td>
                <td>
                  <div class="admin-accounts__actions">
                    <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="openEdit(account)">
                      {{ t('edit') }}
                    </button>
                    <button
                      type="button"
                      class="admin-ui__btn admin-ui__btn--ghost"
                      @click="openPassword(account)"
                    >
                      {{ t('resetPassword') }}
                    </button>
                    <button
                      type="button"
                      class="admin-ui__btn"
                      :class="account.is_active !== false ? 'admin-ui__btn--danger' : 'admin-ui__btn--solid'"
                      :disabled="togglingId === account.id || isSelf(account)"
                      @click="toggleActive(account)"
                    >
                      {{ account.is_active !== false ? t('deactivate') : t('activate') }}
                    </button>
                    <button
                      v-if="(account.roles || []).includes('student')"
                      type="button"
                      class="admin-ui__btn admin-ui__btn--soft"
                      @click="openStudent(account)"
                    >
                      {{ t('openStudent') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-ui__list admin-accounts__cards">
          <article v-for="account in accounts" :key="`m-${account.id}`" class="admin-ui__row">
            <div class="admin-ui__row-main">
              <div>
                <div class="admin-accounts__title-row">
                  <h3 class="admin-ui__row-title">{{ account.name }}</h3>
                  <span
                    class="admin-ui__chip"
                    :class="account.is_active !== false ? 'admin-ui__chip--ok' : 'admin-ui__chip--danger'"
                  >
                    {{ account.is_active !== false ? t('accountActive') : t('accountInactive') }}
                  </span>
                </div>
                <p class="admin-ui__row-meta">{{ account.email }}</p>
                <p class="admin-ui__row-meta">
                  {{ account.phone || '—' }} · {{ when(account.created_at) }}
                </p>
                <div class="admin-ui__chips">
                  <span v-for="role in (account.roles || [])" :key="role" class="admin-ui__chip">
                    {{ roleLabel(role) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="admin-ui__row-actions">
              <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="openEdit(account)">
                {{ t('edit') }}
              </button>
              <button type="button" class="admin-ui__btn admin-ui__btn--ghost" @click="openPassword(account)">
                {{ t('resetPassword') }}
              </button>
              <button
                type="button"
                class="admin-ui__btn"
                :class="account.is_active !== false ? 'admin-ui__btn--danger' : 'admin-ui__btn--solid'"
                :disabled="togglingId === account.id || isSelf(account)"
                @click="toggleActive(account)"
              >
                {{ account.is_active !== false ? t('deactivate') : t('activate') }}
              </button>
            </div>
          </article>
        </div>
      </template>

      <div v-if="meta.last_page > 1" class="admin-accounts__pager">
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost"
          :disabled="page <= 1 || loading"
          @click="goPage(page - 1)"
        >
          {{ t('previous') }}
        </button>
        <span>{{ page }} / {{ meta.last_page }} · {{ meta.total }}</span>
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

    <AdminDialog v-model="dialog" :title="dialogTitle" :max-width="560">
      <v-alert v-if="formError" type="error" variant="tonal" class="mb-3">{{ formError }}</v-alert>
      <form class="admin-ui__form-grid" @submit.prevent="save">
        <label class="admin-ui__field">
          <span>{{ t('name') }}</span>
          <input v-model="form.name" type="text" required>
          <small v-if="fieldErrors.name?.length" class="admin-accounts__error">{{ fieldErrors.name[0] }}</small>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('email') }}</span>
          <input v-model="form.email" type="email" required>
          <small v-if="fieldErrors.email?.length" class="admin-accounts__error">{{ fieldErrors.email[0] }}</small>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('phone') }}</span>
          <input v-model="form.phone" type="text">
        </label>
        <label class="admin-ui__field">
          <span>{{ t('locale') }}</span>
          <select v-model="form.locale">
            <option v-for="option in localeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label class="admin-ui__field">
          <span>{{ editing ? t('passwordOptional') : t('password') }}</span>
          <input v-model="form.password" type="password" :required="!editing" autocomplete="new-password">
          <small v-if="fieldErrors.password?.length" class="admin-accounts__error">{{ fieldErrors.password[0] }}</small>
        </label>
        <div class="admin-ui__field">
          <span>{{ t('roles') }}</span>
          <div class="admin-accounts__role-picks">
            <button
              v-for="option in roleOptions"
              :key="option.value"
              type="button"
              class="admin-accounts__role-pick"
              :class="{ 'is-active': form.roles.includes(option.value) }"
              @click="toggleRole(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <small v-if="fieldErrors.roles?.length" class="admin-accounts__error">{{ fieldErrors.roles[0] }}</small>
        </div>
        <label class="admin-ui__switch">
          <input v-model="form.is_active" type="checkbox">
          <span>{{ t('accountActive') }}</span>
        </label>
      </form>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="dialog = false">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--solid" :disabled="saving" @click="save">
          {{ t('save') }}
        </button>
      </template>
    </AdminDialog>

    <AdminDialog
      v-model="passwordDialog"
      :title="t('resetPassword')"
      :max-width="420"
    >
      <v-alert v-if="passwordError" type="error" variant="tonal" class="mb-3">{{ passwordError }}</v-alert>
      <p class="admin-dialog__text">{{ passwordTarget?.name }} · {{ passwordTarget?.email }}</p>
      <label class="admin-ui__field mt-3">
        <span>{{ t('newPassword') }}</span>
        <input v-model="newPassword" type="password" required autocomplete="new-password">
      </label>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="passwordDialog = false">
          {{ t('cancel') }}
        </button>
        <button type="button" class="admin-ui__btn admin-ui__btn--solid" :disabled="saving" @click="savePassword">
          {{ t('save') }}
        </button>
      </template>
    </AdminDialog>
  </div>
</template>

<style scoped>
.admin-accounts__filters {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.admin-accounts__filters::-webkit-scrollbar {
  display: none;
}

.admin-accounts__filter-input {
  flex: 0 0 auto;
  box-sizing: border-box;
  min-height: 2.4rem;
  height: 2.4rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.55rem;
  background: #fff;
  color: var(--admin-ink);
  font: inherit;
  font-size: 0.84rem;
}

.admin-accounts__filter-input--search {
  flex: 1 1 12rem;
  min-width: 11rem;
  max-width: 18rem;
}

.admin-accounts__filter-btn {
  flex: 0 0 auto;
  min-height: 2.4rem !important;
  height: 2.4rem;
  padding: 0 0.85rem !important;
  font-size: 0.8rem !important;
  white-space: nowrap;
}

.admin-accounts__table-wrap {
  display: none;
}

.admin-accounts__cards {
  display: grid;
}

.admin-accounts__table {
  min-width: 960px;
}

.admin-accounts__table th,
.admin-accounts__table td {
  white-space: normal;
  vertical-align: top;
}

.admin-accounts__name {
  font-weight: 750;
  color: var(--admin-ink);
  word-break: break-word;
}

.admin-accounts__meta {
  margin-top: 0.2rem;
  color: var(--admin-muted);
  font-size: 0.78rem;
  word-break: break-word;
}

.admin-accounts__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-width: 12rem;
}

.admin-accounts__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}

.admin-accounts__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.admin-accounts__error {
  color: #e85d4c;
}

.admin-accounts__role-picks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.admin-accounts__role-pick {
  min-height: 2.2rem;
  padding: 0 0.8rem;
  border: 1px solid var(--admin-line);
  border-radius: 999px;
  background: #fff;
  color: var(--admin-muted);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.admin-accounts__role-pick.is-active {
  background: var(--admin-teal);
  border-color: var(--admin-teal);
  color: #fff;
}

@media (min-width: 900px) {
  .admin-accounts__table-wrap {
    display: block;
  }

  .admin-accounts__cards {
    display: none;
  }
}
</style>
