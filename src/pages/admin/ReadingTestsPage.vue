<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AdminDialog from '../../components/admin/AdminDialog.vue'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const router = useRouter()

const tests = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const search = ref('')
const examType = ref(null)
const published = ref(null)
const loading = ref(true)
const message = ref('')
const deleteTarget = ref(null)
const deleting = ref(false)

const examTypes = computed(() => [
  { title: t('academic'), value: 'academic' },
  { title: t('general'), value: 'general' },
])
const statuses = computed(() => [
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
        is_published: published.value ?? undefined,
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

async function togglePublished(item, value) {
  try {
    await http.put(`/admin/reading-tests/${item.id}/publication`, { is_published: value }, { skipErrorToast: true })
    item.is_published = value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await http.delete(`/admin/reading-tests/${deleteTarget.value.id}`, { skipErrorToast: true })
    deleteTarget.value = null
    await load()
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    deleting.value = false
  }
}

function durationLabel(seconds) {
  const mins = Math.round(Number(seconds || 0) / 60)
  return t('minutesCount', { count: mins })
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('manageReadingTests')">
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
      <form @submit.prevent="applyFilters">
        <div class="admin-ui__filters admin-ui__filters--3">
          <label class="admin-ui__field">
            <span>{{ t('search') }}</span>
            <input v-model="search" type="search">
          </label>
          <label class="admin-ui__field">
            <span>{{ t('examType') }}</span>
            <select v-model="examType">
              <option :value="null">{{ t('allTypes') }}</option>
              <option v-for="item in examTypes" :key="item.value" :value="item.value">{{ item.title }}</option>
            </select>
          </label>
          <label class="admin-ui__field">
            <span>{{ t('status') }}</span>
            <select v-model="published">
              <option :value="null">{{ t('allStatuses') }}</option>
              <option v-for="item in statuses" :key="item.value" :value="item.value">{{ item.title }}</option>
            </select>
          </label>
        </div>
        <div class="admin-ui__filter-actions">
          <button type="submit" class="admin-ui__btn admin-ui__btn--solid">{{ t('filter') }}</button>
        </div>
      </form>
    </section>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('manageReadingTests') }}</h2>
          <p>{{ t('reportTotal', { count: meta.total || tests.length }) }}</p>
        </div>
      </div>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="tests.length === 0" class="admin-ui__empty">
        <p>{{ t('noReadingTests') }}</p>
      </div>
      <div v-else class="admin-ui__list">
        <article v-for="item in tests" :key="item.id" class="admin-ui__row">
          <div class="admin-ui__row-main">
            <div>
              <h3 class="admin-ui__row-title">{{ item.title }}</h3>
              <p class="admin-ui__row-meta">
                {{ item.exam_type === 'general' ? t('general') : t('academic') }}
                · {{ durationLabel(item.duration_seconds) }}
                · {{ t('sections') }}: {{ item.sections_count ?? 0 }}
              </p>
              <div class="admin-ui__chips">
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
                @change="togglePublished(item, $event.target.checked)"
              >
              {{ item.is_published ? t('published') : t('unpublished') }}
            </label>
            <button
              type="button"
              class="admin-ui__btn admin-ui__btn--soft"
              @click="router.push({ name: 'admin-reading-test-builder', params: { id: item.id } })"
            >
              <v-icon size="18">mdi-format-list-bulleted</v-icon>
              {{ t('buildContent') }}
            </button>
            <button
              type="button"
              class="admin-ui__icon-btn"
              :aria-label="t('edit')"
              @click="router.push({ name: 'admin-reading-test-edit', params: { id: item.id } })"
            >
              <v-icon size="18">mdi-pencil</v-icon>
            </button>
            <button
              type="button"
              class="admin-ui__icon-btn admin-ui__icon-btn--danger"
              :aria-label="t('delete')"
              @click="deleteTarget = item"
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
