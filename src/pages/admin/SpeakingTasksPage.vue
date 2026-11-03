<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()

const tasks = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const page = ref(1)
const search = ref('')
const part = ref(null)
const published = ref(null)
const loading = ref(true)
const message = ref('')
const deleteTarget = ref(null)
const deleting = ref(false)

const parts = computed(() => [
  { title: t('speakingPart1'), value: 1 },
  { title: t('speakingPart2'), value: 2 },
  { title: t('speakingPart3'), value: 3 },
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
    const { data } = await http.get('/admin/speaking-tasks', {
      params: {
        search: search.value || undefined,
        page: page.value,
        part: part.value || undefined,
        is_published: published.value ?? undefined,
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

function partLabel(value) {
  if (Number(value) === 1) return t('speakingPart1')
  if (Number(value) === 2) return t('speakingPart2')
  if (Number(value) === 3) return t('speakingPart3')
  return value
}

async function togglePublished(item, value) {
  try {
    await http.put(`/admin/speaking-tasks/${item.id}/publication`, { is_published: value }, { skipErrorToast: true })
    item.is_published = value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
    await load()
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await http.delete(`/admin/speaking-tasks/${deleteTarget.value.id}`, { skipErrorToast: true })
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
    <AdminPageHero :title="t('manageSpeakingTasks')">
      <template #actions>
        <RouterLink
          :to="{ name: 'admin-speaking-task-create' }"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
        >
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newSpeakingTask') }}
        </RouterLink>
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
            <span>{{ t('speakingPart') }}</span>
            <select v-model="part">
              <option :value="null">{{ t('allTypes') }}</option>
              <option v-for="item in parts" :key="item.value" :value="item.value">{{ item.title }}</option>
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
          <h2>{{ t('manageSpeakingTasks') }}</h2>
          <p>{{ t('reportTotal', { count: meta.total || tasks.length }) }}</p>
        </div>
      </div>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="tasks.length === 0" class="admin-ui__empty">
        <p>{{ t('noSpeakingTasks') }}</p>
      </div>
      <div v-else class="admin-ui__list">
        <article v-for="item in tasks" :key="item.id" class="admin-ui__row">
          <div class="admin-ui__row-main">
            <div>
              <h3 class="admin-ui__row-title">{{ item.title }}</h3>
              <p class="admin-ui__row-meta">
                {{ partLabel(item.part) }}
                · {{ t('questions') }}: {{ item.questions_count ?? 0 }}
                · {{ t('prepTime') }}: {{ item.preparation_seconds }}s
                · {{ t('responseTime') }}: {{ item.response_seconds }}s
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
            <RouterLink
              :to="{ name: 'admin-speaking-task-edit', params: { id: item.id } }"
              class="admin-ui__icon-btn"
              :aria-label="t('edit')"
            >
              <v-icon size="18">mdi-pencil</v-icon>
            </RouterLink>
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

    <v-dialog :model-value="Boolean(deleteTarget)" max-width="420" @update:model-value="(open) => { if (!open) deleteTarget = null }">
      <v-card rounded="lg">
        <v-card-title>{{ t('delete') }}</v-card-title>
        <v-card-text>{{ t('confirmDeleteSpeakingTask') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteTarget = null">{{ t('cancel') }}</v-btn>
          <v-btn color="error" :loading="deleting" @click="confirmDelete">{{ t('delete') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
