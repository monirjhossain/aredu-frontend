<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AdminDialog from '../../components/admin/AdminDialog.vue'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const router = useRouter()
const ui = useUiStore()

const tests = ref([])
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
    const { data } = await http.get('/admin/reading-tests', {
      params: {
        search: search.value || undefined,
        page: page.value,
        exam_type: examType.value || undefined,
        is_published: published.value === '' ? undefined : published.value,
      },
      skipErrorToast: true,
    })
    tests.value = data.data || []
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
  examType.value = ''
  published.value = ''
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

async function togglePublished(item, value) {
  try {
    await http.put(`/admin/reading-tests/${item.id}/publication`, { is_published: value }, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    item.is_published = value
    ui.success(value ? t('published') : t('unpublished'))
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await http.delete(`/admin/reading-tests/${deleteTarget.value.id}`, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    ui.success(t('readingTestDeleted'))
    deleteTarget.value = null
    await load()
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    deleting.value = false
  }
}

function durationLabel(seconds) {
  return t('minutesCount', { count: Math.round(Number(seconds || 0) / 60) })
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('manageReadingTests')" :lead="t('readingAdminLead')">
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          @click="router.push({ name: 'admin-reading-test-create' })"
        >
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newReadingTest') }}
        </button>
      </template>
    </AdminPageHero>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('manageReadingTests') }}</h2>
          <p>{{ t('readingTestsListCount', { count: meta.total || tests.length }) }}</p>
        </div>
      </div>

      <form class="admin-reading__filters" @submit.prevent="applyFilters">
        <input
          v-model="search"
          class="admin-reading__filter-input admin-reading__filter-input--search"
          type="search"
          :placeholder="t('search')"
        >
        <select v-model="examType" class="admin-reading__filter-input">
          <option v-for="item in examTypes" :key="item.value || 'all-type'" :value="item.value">
            {{ item.title }}
          </option>
        </select>
        <select v-model="published" class="admin-reading__filter-input">
          <option v-for="item in statuses" :key="item.value || 'all-status'" :value="item.value">
            {{ item.title }}
          </option>
        </select>
        <button type="submit" class="admin-ui__btn admin-ui__btn--solid admin-reading__filter-btn">
          {{ t('applyFilters') }}
        </button>
        <button type="button" class="admin-ui__btn admin-ui__btn--ghost admin-reading__filter-btn" @click="resetFilters">
          {{ t('resetFilters') }}
        </button>
      </form>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="tests.length === 0" class="admin-ui__empty">
        <p>{{ t('noReadingTests') }}</p>
      </div>

      <template v-else>
        <div class="admin-ui__table-wrap admin-reading__table-wrap">
          <table class="admin-ui__table">
            <thead>
              <tr>
                <th>{{ t('title') }}</th>
                <th>{{ t('examType') }}</th>
                <th>{{ t('duration') }}</th>
                <th>{{ t('sections') }}</th>
                <th>{{ t('status') }}</th>
                <th>{{ t('actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in tests" :key="item.id">
                <td>
                  <div class="admin-reading__name">{{ item.title }}</div>
                </td>
                <td>{{ item.exam_type === 'general' ? t('general') : t('academic') }}</td>
                <td>{{ durationLabel(item.duration_seconds) }}</td>
                <td>{{ item.sections_count ?? 0 }}</td>
                <td>
                  <span
                    class="admin-ui__chip"
                    :class="item.is_published ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'"
                  >
                    {{ item.is_published ? t('published') : t('unpublished') }}
                  </span>
                </td>
                <td>
                  <div class="admin-reading__actions">
                    <label class="admin-ui__switch">
                      <input
                        type="checkbox"
                        :checked="item.is_published"
                        @change="togglePublished(item, $event.target.checked)"
                      >
                      {{ item.is_published ? t('published') : t('unpublished') }}
                    </label>
                    <button
                      type="button"
                      class="admin-ui__btn admin-ui__btn--soft"
                      @click="router.push({ name: 'admin-reading-test-builder', params: { id: item.id } })"
                    >
                      {{ t('buildContent') }}
                    </button>
                    <button
                      type="button"
                      class="admin-ui__btn admin-ui__btn--ghost"
                      @click="router.push({ name: 'admin-reading-test-edit', params: { id: item.id } })"
                    >
                      {{ t('edit') }}
                    </button>
                    <button
                      type="button"
                      class="admin-ui__btn admin-ui__btn--danger"
                      @click="deleteTarget = item"
                    >
                      {{ t('delete') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-ui__list admin-reading__cards">
          <article v-for="item in tests" :key="`m-${item.id}`" class="admin-ui__row">
            <div class="admin-ui__row-main">
              <div>
                <div class="admin-reading__title-row">
                  <h3 class="admin-ui__row-title">{{ item.title }}</h3>
                  <span
                    class="admin-ui__chip"
                    :class="item.is_published ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'"
                  >
                    {{ item.is_published ? t('published') : t('unpublished') }}
                  </span>
                </div>
                <p class="admin-ui__row-meta">
                  {{ item.exam_type === 'general' ? t('general') : t('academic') }}
                  · {{ durationLabel(item.duration_seconds) }}
                  · {{ t('sections') }} {{ item.sections_count ?? 0 }}
                </p>
              </div>
            </div>
            <div class="admin-ui__row-actions">
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--soft"
                @click="router.push({ name: 'admin-reading-test-builder', params: { id: item.id } })"
              >
                {{ t('buildContent') }}
              </button>
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--ghost"
                @click="router.push({ name: 'admin-reading-test-edit', params: { id: item.id } })"
              >
                {{ t('edit') }}
              </button>
              <button type="button" class="admin-ui__btn admin-ui__btn--danger" @click="deleteTarget = item">
                {{ t('delete') }}
              </button>
            </div>
          </article>
        </div>
      </template>

      <div v-if="meta.last_page > 1" class="admin-reading__pager">
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
      <p class="admin-dialog__text">{{ t('confirmDeleteReadingTest') }}</p>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="deleteTarget = null">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--danger" :disabled="deleting" @click="confirmDelete">{{ t('delete') }}</button>
      </template>
    </AdminDialog>
  </div>
</template>

<style scoped>
.admin-reading__filters {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.admin-reading__filters::-webkit-scrollbar {
  display: none;
}

.admin-reading__filter-input {
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

.admin-reading__filter-input--search {
  flex: 1 1 12rem;
  min-width: 11rem;
  max-width: 18rem;
}

.admin-reading__filter-btn {
  flex: 0 0 auto;
  min-height: 2.4rem !important;
  height: 2.4rem;
  padding: 0 0.85rem !important;
  font-size: 0.8rem !important;
  white-space: nowrap;
}

.admin-reading__table-wrap {
  display: none;
}

.admin-reading__cards {
  display: grid;
}

.admin-reading__name {
  font-weight: 750;
  word-break: break-word;
}

.admin-reading__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.admin-reading__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.2rem;
}

.admin-reading__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

@media (min-width: 960px) {
  .admin-reading__table-wrap {
    display: block;
  }

  .admin-reading__cards {
    display: none;
  }
}
</style>
