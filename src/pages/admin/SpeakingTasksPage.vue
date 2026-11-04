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

const tasks = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const search = ref('')
const part = ref('')
const published = ref('')
const loading = ref(true)
const message = ref('')
const deleteTarget = ref(null)
const deleting = ref(false)

const parts = computed(() => [
  { title: t('allTypes'), value: '' },
  { title: t('speakingPart1'), value: '1' },
  { title: t('speakingPart2'), value: '2' },
  { title: t('speakingPart3'), value: '3' },
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
    const { data } = await http.get('/admin/speaking-tasks', {
      params: {
        search: search.value || undefined,
        page: page.value,
        part: part.value || undefined,
        is_published: published.value === '' ? undefined : published.value,
      },
      skipErrorToast: true,
    })
    tasks.value = data.data || []
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
  part.value = ''
  published.value = ''
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

function partLabel(value) {
  if (Number(value) === 1) return t('speakingPart1')
  if (Number(value) === 2) return t('speakingPart2')
  if (Number(value) === 3) return t('speakingPart3')
  return value
}

async function togglePublished(item, value) {
  try {
    await http.put(`/admin/speaking-tasks/${item.id}/publication`, { is_published: value }, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    item.is_published = value
    ui.success(value ? t('published') : t('unpublished'))
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
    await load()
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await http.delete(`/admin/speaking-tasks/${deleteTarget.value.id}`, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    ui.success(t('speakingTaskDeleted'))
    deleteTarget.value = null
    await load()
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('manageSpeakingTasks')" :lead="t('speakingAdminLead')">
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          @click="router.push({ name: 'admin-speaking-task-create' })"
        >
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newSpeakingTask') }}
        </button>
      </template>
    </AdminPageHero>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('manageSpeakingTasks') }}</h2>
          <p>{{ t('speakingTasksListCount', { count: meta.total || tasks.length }) }}</p>
        </div>
      </div>

      <form class="admin-speaking__filters" @submit.prevent="applyFilters">
        <input
          v-model="search"
          class="admin-speaking__filter-input admin-speaking__filter-input--search"
          type="search"
          :placeholder="t('search')"
        >
        <select v-model="part" class="admin-speaking__filter-input" :aria-label="t('speakingPart')">
          <option v-for="item in parts" :key="item.value || 'all-part'" :value="item.value">
            {{ item.title }}
          </option>
        </select>
        <select v-model="published" class="admin-speaking__filter-input" :aria-label="t('status')">
          <option v-for="item in statuses" :key="item.value || 'all-status'" :value="item.value">
            {{ item.title }}
          </option>
        </select>
        <button type="submit" class="admin-ui__btn admin-ui__btn--solid admin-speaking__filter-btn">
          {{ t('applyFilters') }}
        </button>
        <button type="button" class="admin-ui__btn admin-ui__btn--ghost admin-speaking__filter-btn" @click="resetFilters">
          {{ t('resetFilters') }}
        </button>
      </form>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="tasks.length === 0" class="admin-ui__empty">
        <p>{{ t('noSpeakingTasks') }}</p>
      </div>

      <template v-else>
        <div class="admin-ui__table-wrap admin-speaking__table-wrap">
          <table class="admin-ui__table">
            <thead>
              <tr>
                <th>{{ t('title') }}</th>
                <th>{{ t('speakingPart') }}</th>
                <th>{{ t('questions') }}</th>
                <th>{{ t('prepTime') }}</th>
                <th>{{ t('responseTime') }}</th>
                <th>{{ t('status') }}</th>
                <th>{{ t('actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in tasks" :key="item.id">
                <td>
                  <div class="admin-speaking__name">{{ item.title }}</div>
                </td>
                <td>{{ partLabel(item.part) }}</td>
                <td>{{ item.questions_count ?? 0 }}</td>
                <td>{{ item.preparation_seconds }}s</td>
                <td>{{ item.response_seconds }}s</td>
                <td>
                  <span class="admin-ui__chip" :class="item.is_published ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'">
                    {{ item.is_published ? t('published') : t('unpublished') }}
                  </span>
                </td>
                <td>
                  <div class="admin-speaking__actions">
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
                      class="admin-ui__btn admin-ui__btn--ghost"
                      @click="router.push({ name: 'admin-speaking-task-edit', params: { id: item.id } })"
                    >
                      {{ t('edit') }}
                    </button>
                    <button type="button" class="admin-ui__btn admin-ui__btn--danger" @click="deleteTarget = item">
                      {{ t('delete') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-ui__list admin-speaking__cards">
          <article v-for="item in tasks" :key="`m-${item.id}`" class="admin-ui__row">
            <div class="admin-ui__row-main">
              <div>
                <div class="admin-speaking__title-row">
                  <h3 class="admin-ui__row-title">{{ item.title }}</h3>
                  <span class="admin-ui__chip" :class="item.is_published ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'">
                    {{ item.is_published ? t('published') : t('unpublished') }}
                  </span>
                </div>
                <p class="admin-ui__row-meta">
                  {{ partLabel(item.part) }}
                  · {{ t('questions') }}: {{ item.questions_count ?? 0 }}
                  · {{ t('prepTime') }}: {{ item.preparation_seconds }}s
                  · {{ t('responseTime') }}: {{ item.response_seconds }}s
                </p>
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
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--ghost"
                @click="router.push({ name: 'admin-speaking-task-edit', params: { id: item.id } })"
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

      <div v-if="meta.last_page > 1" class="admin-speaking__pager">
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
      <p class="admin-dialog__text">{{ t('confirmDeleteSpeakingTask') }}</p>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="deleteTarget = null">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--danger" :disabled="deleting" @click="confirmDelete">{{ t('delete') }}</button>
      </template>
    </AdminDialog>
  </div>
</template>

<style scoped>
.admin-speaking__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.admin-speaking__filter-input {
  flex: 1 1 9rem;
  min-width: 0;
  min-height: 44px;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.55rem;
  background: #fff;
  font: inherit;
  font-size: 0.84rem;
}

.admin-speaking__filter-input--search {
  flex: 2 1 14rem;
}

.admin-speaking__filter-btn {
  flex: 0 0 auto;
  white-space: nowrap;
}

.admin-speaking__table-wrap {
  display: none;
}

.admin-speaking__cards {
  display: grid;
}

.admin-speaking__name {
  font-weight: 750;
  word-break: break-word;
}

.admin-speaking__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.admin-speaking__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.2rem;
}

.admin-speaking__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

@media (min-width: 960px) {
  .admin-speaking__table-wrap {
    display: block;
  }

  .admin-speaking__cards {
    display: none;
  }
}
</style>
