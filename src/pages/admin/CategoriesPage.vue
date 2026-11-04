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

const categories = ref([])
const meta = ref({ current_page: 1, last_page: 1, per_page: 15, total: 0 })
const search = ref('')
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
const form = reactive({ name: '', slug: '' })

onMounted(() => load())

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/categories', {
      params: { search: search.value || undefined, page: page.value },
      skipErrorToast: true,
    })
    categories.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function applySearch() {
  page.value = 1
  load()
}

function resetSearch() {
  search.value = ''
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

function openCreate() {
  editingId.value = null
  form.name = ''
  form.slug = ''
  fieldErrors.value = {}
  formError.value = ''
  dialog.value = true
}

function openEdit(category) {
  editingId.value = category.id
  form.name = category.name
  form.slug = category.slug
  fieldErrors.value = {}
  formError.value = ''
  dialog.value = true
}

async function save() {
  saving.value = true
  fieldErrors.value = {}
  formError.value = ''
  const payload = { name: form.name, slug: form.slug }
  try {
    if (editingId.value) {
      await http.put(`/admin/categories/${editingId.value}`, payload, {
        skipErrorToast: true,
        skipSuccessToast: true,
      })
      ui.success(t('categoryUpdated'))
    } else {
      await http.post('/admin/categories', payload, {
        skipErrorToast: true,
        skipSuccessToast: true,
      })
      ui.success(t('categoryCreated'))
    }
    dialog.value = false
    await load()
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors
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
    await http.delete(`/admin/categories/${deleteTarget.value.id}`, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    ui.success(t('categoryDeleted'))
    deleteTarget.value = null
    await load()
  } catch (error) {
    const parsed = apiError(error)
    formError.value = parsed.errors.category?.[0] || parsed.message || t('requestFailed')
  } finally {
    deleting.value = false
  }
}

function askDelete(category) {
  formError.value = ''
  deleteTarget.value = category
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('categories')" :lead="t('categoriesLead')">
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          @click="openCreate"
        >
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newCategory') }}
        </button>
      </template>
    </AdminPageHero>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('categories') }}</h2>
          <p>{{ t('categoriesListCount', { count: meta.total || categories.length }) }}</p>
        </div>
      </div>

      <form class="admin-categories__filters" @submit.prevent="applySearch">
        <input
          v-model="search"
          class="admin-categories__search"
          type="search"
          :placeholder="t('searchCategories')"
          :aria-label="t('search')"
        >
        <button type="submit" class="admin-ui__btn admin-ui__btn--solid admin-categories__filter-btn">
          {{ t('search') }}
        </button>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost admin-categories__filter-btn"
          @click="resetSearch"
        >
          {{ t('resetFilters') }}
        </button>
      </form>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="categories.length === 0" class="admin-ui__empty">
        <p>{{ t('noCategories') }}</p>
      </div>

      <template v-else>
        <div class="admin-ui__table-wrap admin-categories__table-wrap">
          <table class="admin-ui__table admin-categories__table">
            <thead>
              <tr>
                <th>{{ t('name') }}</th>
                <th>{{ t('slug') }}</th>
                <th>{{ t('courses') }}</th>
                <th>{{ t('status') }}</th>
                <th>{{ t('actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="category in categories" :key="category.id">
                <td>
                  <div class="admin-categories__name">{{ category.name }}</div>
                </td>
                <td>
                  <code class="admin-categories__slug">{{ category.slug }}</code>
                </td>
                <td>
                  <strong>{{ category.courses_count ?? 0 }}</strong>
                </td>
                <td>
                  <span
                    class="admin-ui__chip"
                    :class="category.in_use ? 'admin-ui__chip--warn' : 'admin-ui__chip--ok'"
                  >
                    {{ category.in_use ? t('categoryInUse') : t('categoryUnused') }}
                  </span>
                </td>
                <td>
                  <div class="admin-categories__actions">
                    <button
                      type="button"
                      class="admin-ui__btn admin-ui__btn--soft"
                      @click="openEdit(category)"
                    >
                      {{ t('edit') }}
                    </button>
                    <button
                      type="button"
                      class="admin-ui__btn admin-ui__btn--danger"
                      :disabled="category.in_use"
                      :title="category.in_use ? t('categoryInUseHint') : t('delete')"
                      @click="askDelete(category)"
                    >
                      {{ t('delete') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-ui__list admin-categories__cards">
          <article v-for="category in categories" :key="`m-${category.id}`" class="admin-ui__row">
            <div class="admin-ui__row-main">
              <div>
                <div class="admin-categories__title-row">
                  <h3 class="admin-ui__row-title">{{ category.name }}</h3>
                  <span
                    class="admin-ui__chip"
                    :class="category.in_use ? 'admin-ui__chip--warn' : 'admin-ui__chip--ok'"
                  >
                    {{ category.in_use ? t('categoryInUse') : t('categoryUnused') }}
                  </span>
                </div>
                <p class="admin-ui__row-meta">
                  <code class="admin-categories__slug">{{ category.slug }}</code>
                </p>
                <p class="admin-ui__row-meta">
                  {{ category.courses_count ?? 0 }} {{ t('courses') }}
                </p>
              </div>
            </div>
            <div class="admin-ui__row-actions">
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--soft"
                @click="openEdit(category)"
              >
                {{ t('edit') }}
              </button>
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--danger"
                :disabled="category.in_use"
                @click="askDelete(category)"
              >
                {{ t('delete') }}
              </button>
            </div>
          </article>
        </div>
      </template>

      <div v-if="meta.last_page > 1" class="admin-categories__pager">
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

    <AdminDialog
      :model-value="dialog"
      :title="editingId ? t('editCategory') : t('newCategory')"
      :max-width="480"
      @update:model-value="dialog = $event"
    >
      <v-alert v-if="formError && dialog" class="mb-3" type="error" variant="tonal">{{ formError }}</v-alert>
      <form class="admin-ui__form-grid" @submit.prevent="save">
        <label class="admin-ui__field">
          <span>{{ t('name') }}</span>
          <input v-model="form.name" type="text" required>
          <small v-if="fieldErrors.name?.length" class="admin-categories__error">{{ fieldErrors.name[0] }}</small>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('slug') }}</span>
          <input v-model="form.slug" type="text" :placeholder="t('slugOptional')">
          <small v-if="fieldErrors.slug?.length" class="admin-categories__error">{{ fieldErrors.slug[0] }}</small>
        </label>
      </form>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="dialog = false">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--solid" :disabled="saving" @click="save">{{ t('save') }}</button>
      </template>
    </AdminDialog>

    <AdminDialog
      :model-value="deleteTarget !== null"
      :title="t('deleteCategory')"
      :max-width="420"
      danger
      @update:model-value="(open) => { if (!open) deleteTarget = null }"
    >
      <v-alert v-if="formError" class="mb-3" type="error" variant="tonal">{{ formError }}</v-alert>
      <p class="admin-dialog__text">{{ t('confirmDeleteCategory', { name: deleteTarget?.name || '' }) }}</p>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="deleteTarget = null">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--danger" :disabled="deleting" @click="confirmDelete">{{ t('delete') }}</button>
      </template>
    </AdminDialog>
  </div>
</template>

<style scoped>
.admin-categories__filters {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.admin-categories__filters::-webkit-scrollbar {
  display: none;
}

.admin-categories__search {
  flex: 1 1 14rem;
  min-width: 12rem;
  min-height: 2.4rem;
  height: 2.4rem;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.55rem;
  background: #fff;
  font: inherit;
  font-size: 0.84rem;
}

.admin-categories__filter-btn {
  flex: 0 0 auto;
  min-height: 2.4rem !important;
  height: 2.4rem;
  padding: 0 0.85rem !important;
  font-size: 0.8rem !important;
  white-space: nowrap;
}

.admin-categories__table-wrap {
  display: none;
}

.admin-categories__cards {
  display: grid;
}

.admin-categories__table {
  min-width: 720px;
}

.admin-categories__table th,
.admin-categories__table td {
  white-space: normal;
  vertical-align: middle;
}

.admin-categories__name {
  font-weight: 750;
  color: var(--admin-ink);
  word-break: break-word;
}

.admin-categories__slug {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: 0.4rem;
  background: #f3f6f7;
  color: var(--admin-muted);
  font-size: 0.78rem;
  word-break: break-all;
}

.admin-categories__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.admin-categories__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}

.admin-categories__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.admin-categories__error {
  color: #e85d4c;
}

@media (min-width: 900px) {
  .admin-categories__table-wrap {
    display: block;
  }

  .admin-categories__cards {
    display: none;
  }
}
</style>
