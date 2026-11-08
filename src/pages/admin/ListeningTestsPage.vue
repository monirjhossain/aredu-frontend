<script setup>
import { onMounted, ref } from 'vue'
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

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/listening-tests', {
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
    await http.put(`/admin/listening-tests/${item.id}/publication`, { is_published: value }, {
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
    await http.delete(`/admin/listening-tests/${deleteTarget.value.id}`, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    ui.success(t('listeningTestDeleted'))
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

function examLabel(type) {
  return type === 'general' ? t('general') : t('academic')
}

function openBuilder(item) {
  router.push({ name: 'admin-listening-test-builder', params: { id: item.id } })
}

function openEdit(item) {
  router.push({ name: 'admin-listening-test-edit', params: { id: item.id } })
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('manageListeningTests')" :lead="t('listeningAdminLead')">
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          @click="router.push({ name: 'admin-listening-test-create' })"
        >
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newListeningTest') }}
        </button>
      </template>
    </AdminPageHero>

    <section class="admin-ui__panel">
      <form @submit.prevent="applyFilters">
        <div class="admin-ui__filters admin-ui__filters--3">
          <label class="admin-ui__field">
            <span>{{ t('search') }}</span>
            <input v-model="search" type="search" :placeholder="t('searchListeningTests')">
          </label>
          <label class="admin-ui__field">
            <span>{{ t('examType') }}</span>
            <select v-model="examType">
              <option value="">{{ t('allTypes') }}</option>
              <option value="academic">{{ t('academic') }}</option>
              <option value="general">{{ t('general') }}</option>
            </select>
          </label>
          <label class="admin-ui__field">
            <span>{{ t('status') }}</span>
            <select v-model="published">
              <option value="">{{ t('allStatuses') }}</option>
              <option value="1">{{ t('published') }}</option>
              <option value="0">{{ t('unpublished') }}</option>
            </select>
          </label>
        </div>
        <div class="admin-ui__filter-actions">
          <button type="submit" class="admin-ui__btn admin-ui__btn--solid">{{ t('applyFilters') }}</button>
          <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="resetFilters">{{ t('resetFilters') }}</button>
        </div>
      </form>
    </section>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('manageListeningTests') }}</h2>
          <p>{{ t('listeningTestsListCount', { count: meta.total || tests.length }) }}</p>
        </div>
      </div>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="tests.length === 0" class="admin-ui__empty">
        <v-icon icon="mdi-headphones" size="36" color="#0f5c66" />
        <p>{{ t('noListeningTests') }}</p>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary"
          @click="router.push({ name: 'admin-listening-test-create' })"
        >
          {{ t('newListeningTest') }}
        </button>
      </div>

      <template v-else>
        <div class="admin-ui__table-wrap admin-listening__table-wrap">
          <table class="admin-ui__table admin-listening__table">
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
                  <div class="admin-listening__title-cell">
                    <span class="admin-listening__icon" aria-hidden="true">
                      <v-icon icon="mdi-headphones" size="18" />
                    </span>
                    <div>
                      <strong>{{ item.title }}</strong>
                      <small v-if="item.slug">/{{ item.slug }}</small>
                      <div v-if="item.is_free_sample" class="admin-ui__chips">
                        <span class="admin-ui__chip admin-ui__chip--ok">{{ t('freeSampleBadge') }}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="admin-ui__chip">{{ examLabel(item.exam_type) }}</span>
                </td>
                <td>{{ durationLabel(item.duration_seconds) }}</td>
                <td>{{ item.sections_count ?? 0 }}</td>
                <td>
                  <label class="admin-ui__switch">
                    <input
                      type="checkbox"
                      :checked="item.is_published"
                      @change="togglePublished(item, $event.target.checked)"
                    >
                    <span
                      class="admin-ui__chip"
                      :class="item.is_published ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'"
                    >
                      {{ item.is_published ? t('published') : t('unpublished') }}
                    </span>
                  </label>
                </td>
                <td>
                  <div class="admin-listening__actions">
                    <button
                      type="button"
                      class="admin-ui__btn admin-ui__btn--solid"
                      @click="openBuilder(item)"
                    >
                      <v-icon size="16">mdi-hammer-screwdriver</v-icon>
                      {{ t('buildContent') }}
                    </button>
                    <button
                      type="button"
                      class="admin-ui__icon-btn"
                      :aria-label="t('edit')"
                      @click="openEdit(item)"
                    >
                      <v-icon size="18">mdi-pencil-outline</v-icon>
                    </button>
                    <button
                      type="button"
                      class="admin-ui__icon-btn admin-ui__icon-btn--danger"
                      :aria-label="t('delete')"
                      @click="deleteTarget = item"
                    >
                      <v-icon size="18">mdi-delete-outline</v-icon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-ui__list admin-listening__cards">
          <article v-for="item in tests" :key="`m-${item.id}`" class="admin-ui__row admin-listening__card">
            <div class="admin-ui__row-main">
              <span class="admin-listening__icon admin-listening__icon--lg" aria-hidden="true">
                <v-icon icon="mdi-headphones" size="20" />
              </span>
              <div class="admin-listening__card-body">
                <div class="admin-listening__title-row">
                  <h3 class="admin-ui__row-title">{{ item.title }}</h3>
                  <span
                    class="admin-ui__chip"
                    :class="item.is_published ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'"
                  >
                    {{ item.is_published ? t('published') : t('unpublished') }}
                  </span>
                </div>
                <p v-if="item.slug" class="admin-ui__row-meta">/{{ item.slug }}</p>
                <div class="admin-ui__chips">
                  <span class="admin-ui__chip">{{ examLabel(item.exam_type) }}</span>
                  <span class="admin-ui__chip">{{ durationLabel(item.duration_seconds) }}</span>
                  <span class="admin-ui__chip">{{ t('sections') }} {{ item.sections_count ?? 0 }}</span>
                  <span v-if="item.is_free_sample" class="admin-ui__chip admin-ui__chip--ok">
                    {{ t('freeSampleBadge') }}
                  </span>
                </div>
              </div>
            </div>
            <div class="admin-ui__row-actions">
              <label class="admin-ui__switch">
                <input
                  type="checkbox"
                  :checked="item.is_published"
                  @change="togglePublished(item, $event.target.checked)"
                >
                {{ item.is_published ? t('published') : t('unpublished') }}
              </label>
              <button type="button" class="admin-ui__btn admin-ui__btn--solid" @click="openBuilder(item)">
                {{ t('buildContent') }}
              </button>
              <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="openEdit(item)">
                {{ t('edit') }}
              </button>
              <button type="button" class="admin-ui__btn admin-ui__btn--danger" @click="deleteTarget = item">
                {{ t('delete') }}
              </button>
            </div>
          </article>
        </div>
      </template>

      <div v-if="meta.last_page > 1" class="admin-listening__pager">
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
      :model-value="Boolean(deleteTarget)"
      :title="t('delete')"
      :max-width="420"
      danger
      @update:model-value="(open) => { if (!open) deleteTarget = null }"
    >
      <p class="admin-dialog__text">{{ t('confirmDeleteListeningTest') }}</p>
      <p v-if="deleteTarget" class="admin-listening__delete-name">{{ deleteTarget.title }}</p>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="deleteTarget = null">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--danger" :disabled="deleting" @click="confirmDelete">{{ t('delete') }}</button>
      </template>
    </AdminDialog>
  </div>
</template>

<style scoped>
.admin-listening__table-wrap {
  display: none;
}

.admin-listening__cards {
  display: grid;
}

.admin-listening__table {
  min-width: 880px;
}

.admin-listening__table th,
.admin-listening__table td {
  white-space: normal;
  vertical-align: middle;
}

.admin-listening__title-cell {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
  min-width: 14rem;
}

.admin-listening__title-cell strong {
  display: block;
  font-weight: 780;
  overflow-wrap: anywhere;
}

.admin-listening__title-cell small {
  display: block;
  margin-top: 0.15rem;
  color: var(--admin-muted);
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.admin-listening__icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.65rem;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  background: linear-gradient(145deg, #0f5c66, #14919b);
  color: #fff;
  box-shadow: 0 8px 16px rgba(15, 92, 102, 0.18);
}

.admin-listening__icon--lg {
  width: 2.6rem;
  height: 2.6rem;
}

.admin-listening__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.admin-listening__card-body {
  min-width: 0;
  flex: 1;
}

.admin-listening__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.15rem;
}

.admin-listening__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.admin-listening__delete-name {
  margin: 0.55rem 0 0;
  color: var(--admin-ink);
  font-weight: 750;
}

@media (min-width: 960px) {
  .admin-listening__table-wrap {
    display: block;
  }

  .admin-listening__cards {
    display: none;
  }
}
</style>
