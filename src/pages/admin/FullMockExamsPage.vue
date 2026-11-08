<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AdminDialog from '../../components/admin/AdminDialog.vue'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { firstApiMessage } from '../../composables/useFullMockContext'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const router = useRouter()
const ui = useUiStore()

const exams = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const search = ref('')
const examType = ref('')
const published = ref('')
const loading = ref(true)
const message = ref('')
const deleteTarget = ref(null)
const deleting = ref(false)

const examTypes = computed(() => [
  { title: t('allTypes'), value: '' },
  { title: t('academic'), value: 'academic' },
  { title: t('general'), value: 'general' },
])
const statuses = computed(() => [
  { title: t('allStatuses'), value: '' },
  { title: t('published'), value: '1' },
  { title: t('unpublished'), value: '0' },
])

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/full-mocks', {
      params: {
        search: search.value || undefined,
        page: page.value,
        exam_type: examType.value || undefined,
        published: published.value === '' ? undefined : published.value,
      },
      skipErrorToast: true,
    })
    exams.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = firstApiMessage(error, t('requestFailed'))
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
  examType.value = ''
  published.value = ''
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

async function togglePublished(item, value, event) {
  try {
    await http.put(`/admin/full-mocks/${item.id}/publication`, { is_published: value }, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    item.is_published = value
    ui.success(value ? t('published') : t('unpublished'))
  } catch (error) {
    if (event?.target) event.target.checked = !value
    message.value = firstApiMessage(error, t('requestFailed'))
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await http.delete(`/admin/full-mocks/${deleteTarget.value.id}`, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    ui.success(t('fullMockDeleted'))
    deleteTarget.value = null
    await load()
  } catch (error) {
    message.value = firstApiMessage(error, t('requestFailed'))
    deleteTarget.value = null
  } finally {
    deleting.value = false
  }
}

function typeLabel(type) {
  return type === 'general' ? t('general') : t('academic')
}

function edit(item) {
  router.push({ name: 'admin-full-mock-edit', params: { id: item.id } })
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('manageFullMocks')" :lead="t('fullMockAdminLead')">
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          @click="router.push({ name: 'admin-full-mock-create' })"
        >
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newFullMock') }}
        </button>
      </template>
    </AdminPageHero>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('manageFullMocks') }}</h2>
          <p>{{ t('fullMockListCount', { count: meta.total || exams.length }) }}</p>
        </div>
      </div>

      <form class="admin-ui__filters fm-admin__filters" @submit.prevent="applyFilters">
        <label class="admin-ui__field">
          <span>{{ t('search') }}</span>
          <input v-model="search" type="search" :placeholder="t('search')">
        </label>
        <label class="admin-ui__field">
          <span>{{ t('examType') }}</span>
          <select v-model="examType">
            <option v-for="item in examTypes" :key="item.value || 'all-type'" :value="item.value">{{ item.title }}</option>
          </select>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('status') }}</span>
          <select v-model="published">
            <option v-for="item in statuses" :key="item.value || 'all-status'" :value="item.value">{{ item.title }}</option>
          </select>
        </label>
        <div class="admin-ui__filter-actions">
          <button type="submit" class="admin-ui__btn admin-ui__btn--solid">{{ t('applyFilters') }}</button>
          <button type="button" class="admin-ui__btn admin-ui__btn--ghost" @click="resetFilters">{{ t('resetFilters') }}</button>
        </div>
      </form>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal" class="mt-3">{{ message }}</v-alert>
      <div v-else-if="exams.length === 0" class="admin-ui__empty">
        <p>{{ t('noFullMocksAdmin') }}</p>
      </div>

      <div v-else class="admin-ui__list fm-admin__list">
        <article v-for="item in exams" :key="item.id" class="admin-ui__row">
          <div class="admin-ui__row-main">
            <div style="min-width: 0">
              <h3 class="admin-ui__row-title">{{ item.title }}</h3>
              <p class="admin-ui__row-meta">
                {{ typeLabel(item.exam_type) }}
                · {{ t('fullMockSectionsCount', { count: item.sections_count }) }}
              </p>
              <div class="admin-ui__chips">
                <span
                  class="admin-ui__chip"
                  :class="item.is_free ? 'admin-ui__chip--ok' : 'admin-ui__chip--premium'"
                >
                  {{ item.is_free ? t('freeSampleBadge') : t('premiumBadge') }}
                </span>
                <span class="admin-ui__chip" :class="item.is_published ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'">
                  {{ item.is_published ? t('published') : t('unpublished') }}
                </span>
              </div>
            </div>
          </div>
          <div class="admin-ui__row-actions">
            <label class="admin-ui__switch">
              <input
                type="checkbox"
                :checked="item.is_published"
                @change="togglePublished(item, $event.target.checked, $event)"
              >
              {{ item.is_published ? t('published') : t('unpublished') }}
            </label>
            <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="edit(item)">{{ t('edit') }}</button>
            <button type="button" class="admin-ui__btn admin-ui__btn--danger" @click="deleteTarget = item">{{ t('delete') }}</button>
          </div>
        </article>
      </div>

      <div v-if="meta.last_page > 1" class="fm-admin__pager">
        <button type="button" class="admin-ui__btn admin-ui__btn--ghost" :disabled="page <= 1 || loading" @click="goPage(page - 1)">
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
      :model-value="Boolean(deleteTarget)"
      :title="t('delete')"
      :max-width="420"
      danger
      @update:model-value="(open) => { if (!open) deleteTarget = null }"
    >
      <p class="admin-dialog__text">{{ t('confirmDeleteFullMock') }}</p>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="deleteTarget = null">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--danger" :disabled="deleting" @click="confirmDelete">{{ t('delete') }}</button>
      </template>
    </AdminDialog>
  </div>
</template>

<style scoped>
.fm-admin__filters {
  margin-bottom: 1rem;
  align-items: end;
}

.fm-admin__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}
</style>
