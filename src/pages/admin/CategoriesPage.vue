<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()

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
      params: { search: search.value, page: page.value },
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
      await http.put(`/admin/categories/${editingId.value}`, payload, { skipErrorToast: true })
    } else {
      await http.post('/admin/categories', payload, { skipErrorToast: true })
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
    await http.delete(`/admin/categories/${deleteTarget.value.id}`, { skipErrorToast: true })
    deleteTarget.value = null
    await load()
  } catch (error) {
    const parsed = apiError(error)
    formError.value = parsed.errors.category?.[0] || parsed.message || t('requestFailed')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('categories')" :lead="t('categoriesLead')">
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm" @click="openCreate">
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newCategory') }}
        </button>
      </template>
    </AdminPageHero>

    <section class="admin-ui__panel">
      <form class="admin-ui__filters admin-ui__filters--3" @submit.prevent="applySearch">
        <label class="admin-ui__field" style="grid-column: 1 / -1">
          <span>{{ t('search') }}</span>
          <input v-model="search" type="search" :placeholder="t('search')">
        </label>
      </form>
      <div class="admin-ui__filter-actions">
        <button type="button" class="admin-ui__btn admin-ui__btn--solid" @click="applySearch">{{ t('search') }}</button>
      </div>
    </section>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('categories') }}</h2>
          <p>{{ t('reportTotal', { count: meta.total || categories.length }) }}</p>
        </div>
      </div>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="categories.length === 0" class="admin-ui__empty">
        <p>{{ t('noCategories') }}</p>
      </div>
      <div v-else class="admin-ui__list">
        <article v-for="category in categories" :key="category.id" class="admin-ui__row">
          <div class="admin-ui__row-main">
            <div>
              <h3 class="admin-ui__row-title">{{ category.name }}</h3>
              <p class="admin-ui__row-meta">{{ category.slug }}</p>
              <div class="admin-ui__chips">
                <span class="admin-ui__chip">{{ category.courses_count }} {{ t('courses') }}</span>
              </div>
            </div>
          </div>
          <div class="admin-ui__row-actions">
            <button type="button" class="admin-ui__icon-btn" :aria-label="t('edit')" @click="openEdit(category)">
              <v-icon size="18">mdi-pencil</v-icon>
            </button>
            <button
              type="button"
              class="admin-ui__icon-btn admin-ui__icon-btn--danger"
              :aria-label="t('delete')"
              :disabled="category.in_use"
              @click="formError = ''; deleteTarget = category"
            >
              <v-icon size="18">mdi-delete</v-icon>
            </button>
          </div>
        </article>
      </div>

      <div v-if="meta.last_page > 1" class="admin-ui__pager">
        <v-pagination v-model="page" :length="meta.last_page" active-color="#0f5c66" total-visible="5" @update:model-value="load" />
      </div>
    </section>

    <v-dialog v-model="dialog" max-width="480">
      <v-card rounded="lg">
        <v-card-title>{{ editingId ? t('editCategory') : t('newCategory') }}</v-card-title>
        <v-card-text>
          <v-alert v-if="formError && dialog" class="mb-4" type="error" variant="tonal">{{ formError }}</v-alert>
          <v-form @submit.prevent="save">
            <v-text-field v-model="form.name" :label="t('name')" :error-messages="fieldErrors.name || []" />
            <v-text-field v-model="form.slug" :label="t('slug')" :error-messages="fieldErrors.slug || []" />
            <div class="d-flex justify-end ga-2">
              <v-btn variant="text" @click="dialog = false">{{ t('cancel') }}</v-btn>
              <v-btn color="#0f5c66" type="submit" :loading="saving">{{ t('save') }}</v-btn>
            </div>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog :model-value="deleteTarget !== null" max-width="420" @update:model-value="deleteTarget = null">
      <v-card rounded="lg">
        <v-card-title>{{ t('deleteCategory') }}</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" class="mb-4" type="error" variant="tonal">{{ formError }}</v-alert>
          {{ t('confirmDeleteCategory', { name: deleteTarget?.name || '' }) }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteTarget = null">{{ t('cancel') }}</v-btn>
          <v-btn color="error" :loading="deleting" @click="confirmDelete">{{ t('delete') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
