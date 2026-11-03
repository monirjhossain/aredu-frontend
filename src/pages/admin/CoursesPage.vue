<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const router = useRouter()

const courses = ref([])
const categories = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const search = ref('')
const examType = ref('')
const categoryId = ref('')
const published = ref('')
const loading = ref(true)
const message = ref('')
const deleteTarget = ref(null)
const deleteError = ref('')
const deleting = ref(false)

const examTypes = computed(() => [
  { title: t('allExamTypes'), value: '' },
  { title: t('academic'), value: 'academic' },
  { title: t('general'), value: 'general' },
])
const statuses = computed(() => [
  { title: t('allStatuses'), value: '' },
  { title: t('published'), value: '1' },
  { title: t('unpublished'), value: '0' },
])
const categoryItems = computed(() => [
  { title: t('allCourses'), value: '' },
  ...categories.value.map((item) => ({ title: item.name, value: String(item.id) })),
])

onMounted(async () => {
  await Promise.all([loadOptions(), load()])
})

async function loadOptions() {
  try {
    const { data } = await http.get('/admin/courses/form-options', { skipErrorToast: true })
    categories.value = data.data.categories || []
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  }
}

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/courses', {
      params: {
        search: search.value || undefined,
        page: page.value,
        exam_type: examType.value || undefined,
        category_id: categoryId.value || undefined,
        is_published: published.value === '' ? undefined : published.value,
      },
      skipErrorToast: true,
    })
    courses.value = data.data || []
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

async function togglePublished(course, value) {
  try {
    await http.put(`/admin/courses/${course.id}/publication`, { is_published: value }, { skipErrorToast: true })
    course.is_published = value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await http.delete(`/admin/courses/${deleteTarget.value.id}`, { skipErrorToast: true })
    deleteTarget.value = null
    await load()
  } catch (error) {
    deleteError.value = apiError(error).message || t('requestFailed')
  } finally {
    deleting.value = false
  }
}

function typeLabel(value) {
  return value === 'general' ? t('general') : t('academic')
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('courses')" :lead="t('coursesAdminLead')">
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          @click="router.push({ name: 'admin-course-create' })"
        >
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newCourse') }}
        </button>
      </template>
    </AdminPageHero>

    <section class="admin-ui__panel">
      <form @submit.prevent="applyFilters">
        <div class="admin-ui__filters">
          <label class="admin-ui__field">
            <span>{{ t('search') }}</span>
            <input v-model="search" type="search">
          </label>
          <label class="admin-ui__field">
            <span>{{ t('examType') }}</span>
            <select v-model="examType">
              <option v-for="item in examTypes" :key="item.value" :value="item.value">{{ item.title }}</option>
            </select>
          </label>
          <label class="admin-ui__field">
            <span>{{ t('categories') }}</span>
            <select v-model="categoryId">
              <option v-for="item in categoryItems" :key="item.value" :value="item.value">{{ item.title }}</option>
            </select>
          </label>
          <label class="admin-ui__field">
            <span>{{ t('published') }}</span>
            <select v-model="published">
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
          <h2>{{ t('courses') }}</h2>
          <p>{{ t('reportTotal', { count: meta.total || courses.length }) }}</p>
        </div>
      </div>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="courses.length === 0" class="admin-ui__empty">
        <p>{{ t('noCourses') }}</p>
      </div>
      <div v-else class="admin-ui__list">
        <article v-for="course in courses" :key="course.id" class="admin-ui__row">
          <div class="admin-ui__row-main">
            <img
              v-if="course.thumbnail_url"
              class="admin-ui__thumb"
              :src="course.thumbnail_url"
              :alt="course.title"
            >
            <div>
              <h3 class="admin-ui__row-title">{{ course.title }}</h3>
              <p class="admin-ui__row-meta">
                {{ course.category?.name }} · {{ typeLabel(course.exam_type) }} · {{ course.price }} BDT
                <span v-if="course.discount_price"> ({{ course.discount_price }} BDT)</span>
              </p>
              <div class="admin-ui__chips">
                <span class="admin-ui__chip" :class="course.is_published ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'">
                  {{ course.is_published ? t('published') : t('unpublished') }}
                </span>
              </div>
            </div>
          </div>
          <div class="admin-ui__row-actions">
            <label class="admin-ui__switch">
              <input
                type="checkbox"
                :checked="course.is_published"
                @change="togglePublished(course, $event.target.checked)"
              >
              {{ course.is_published ? t('published') : t('unpublished') }}
            </label>
            <button
              type="button"
              class="admin-ui__icon-btn"
              :aria-label="t('edit')"
              @click="router.push({ name: 'admin-course-edit', params: { id: course.id } })"
            >
              <v-icon size="18">mdi-pencil</v-icon>
            </button>
            <button
              type="button"
              class="admin-ui__icon-btn"
              :aria-label="t('courseContent')"
              @click="router.push({ name: 'admin-course-content', params: { id: course.id } })"
            >
              <v-icon size="18">mdi-format-list-bulleted</v-icon>
            </button>
            <button
              type="button"
              class="admin-ui__icon-btn admin-ui__icon-btn--danger"
              :aria-label="t('delete')"
              @click="deleteError = ''; deleteTarget = course"
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

    <v-dialog :model-value="deleteTarget !== null" max-width="420" @update:model-value="deleteTarget = null">
      <v-card rounded="lg">
        <v-card-title>{{ t('deleteCourse') }}</v-card-title>
        <v-card-text>
          <v-alert v-if="deleteError" class="mb-4" type="error" variant="tonal">{{ deleteError }}</v-alert>
          {{ t('confirmDeleteCourse', { name: deleteTarget?.title || '' }) }}
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
