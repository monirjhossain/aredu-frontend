<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const editing = computed(() => route.name === 'admin-course-edit')
const categories = ref([])
const teachers = ref([])
const selectedTeachers = ref([])
const contentTeachers = ref([])
const thumbnailUrl = ref('')
const file = ref(null)
const loading = ref(true)
const saving = ref(false)
const message = ref('')
const fieldErrors = ref({})

const form = reactive({
  category_id: null,
  title: '',
  slug: '',
  description: '',
  exam_type: 'academic',
  price: '',
  discount_price: '',
  duration_minutes: 0,
  is_published: false,
})

const examTypes = computed(() => [
  { title: t('academic'), value: 'academic' },
  { title: t('general'), value: 'general' },
])

onMounted(async () => {
  try {
    const { data } = await http.get('/admin/courses/form-options', { skipErrorToast: true })
    categories.value = data.data.categories || []
    teachers.value = data.data.teachers || []
    if (editing.value) {
      const course = await http.get(`/admin/courses/${route.params.id}`, { skipErrorToast: true })
      fill(course.data.data)
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
})

function fill(course) {
  form.category_id = course.category?.id ?? null
  form.title = course.title
  form.slug = course.slug
  form.description = course.description || ''
  form.exam_type = course.exam_type
  form.price = course.price
  form.discount_price = course.discount_price || ''
  form.duration_minutes = course.duration_minutes
  form.is_published = course.is_published
  thumbnailUrl.value = course.thumbnail_url || ''
  selectedTeachers.value = (course.teachers || []).map((teacher) => teacher.id)
  contentTeachers.value = (course.teachers || []).filter((teacher) => teacher.can_manage_content).map((teacher) => teacher.id)
}

function payload() {
  return {
    category_id: form.category_id,
    title: form.title,
    slug: form.slug,
    description: form.description || null,
    exam_type: form.exam_type,
    price: form.price,
    discount_price: form.discount_price === '' ? null : form.discount_price,
    duration_minutes: Number(form.duration_minutes),
    is_published: form.is_published,
  }
}

async function save() {
  saving.value = true
  message.value = ''
  fieldErrors.value = {}
  try {
    if (editing.value) {
      const { data } = await http.put(`/admin/courses/${route.params.id}`, payload(), { skipErrorToast: true })
      fill(data.data)
    } else {
      const { data } = await http.post('/admin/courses', payload(), { skipErrorToast: true })
      router.push({ name: 'admin-course-edit', params: { id: data.data.id } })
    }
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors
    message.value = parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

async function uploadThumbnail() {
  if (!file.value) return
  saving.value = true
  message.value = ''
  try {
    const selected = Array.isArray(file.value) ? file.value[0] : file.value
    const body = new FormData()
    body.append('thumbnail', selected)
    const { data } = await http.post(`/admin/courses/${route.params.id}/thumbnail`, body, { skipErrorToast: true })
    thumbnailUrl.value = data.data.thumbnail_url
    file.value = null
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors
    message.value = parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

async function removeThumbnail() {
  saving.value = true
  try {
    await http.delete(`/admin/courses/${route.params.id}/thumbnail`, { skipErrorToast: true })
    thumbnailUrl.value = ''
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

async function saveTeachers() {
  saving.value = true
  message.value = ''
  try {
    const { data } = await http.put(`/admin/courses/${route.params.id}/teachers`, {
      teachers: selectedTeachers.value.map((id) => ({
        user_id: id,
        can_manage_content: contentTeachers.value.includes(id),
      })),
    }, { skipErrorToast: true })
    fill(data.data)
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors
    message.value = parsed.errors.teachers?.[0] || parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="editing ? t('editCourse') : t('newCourse')">
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--ghost" @click="router.push({ name: 'admin-courses' })">
          <v-icon size="18">mdi-arrow-left</v-icon>
          {{ t('backToCourses') }}
        </button>
        <button
          v-if="editing"
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost"
          @click="router.push({ name: 'admin-course-content', params: { id: route.params.id } })"
        >
          <v-icon size="18">mdi-format-list-bulleted</v-icon>
          {{ t('courseContent') }}
        </button>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary"
          :disabled="saving || loading"
          @click="save"
        >
          <v-icon size="18">mdi-content-save</v-icon>
          {{ t('save') }}
        </button>
      </template>
    </AdminPageHero>

    <div v-if="loading" class="admin-ui__panel admin-ui__loading">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <template v-else>
      <v-alert v-if="message" class="mb-4" type="error" variant="tonal">{{ message }}</v-alert>
      <v-row>
        <v-col cols="12" md="7">
          <section class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <h2>{{ editing ? t('editCourse') : t('newCourse') }}</h2>
            </div>
            <v-form @submit.prevent="save">
              <v-text-field v-model="form.title" :label="t('name')" :error-messages="fieldErrors.title || []" />
              <v-text-field v-model="form.slug" :label="t('slug')" :error-messages="fieldErrors.slug || []" />
              <v-select
                v-model="form.category_id"
                :items="categories"
                item-title="name"
                item-value="id"
                :label="t('categories')"
                :error-messages="fieldErrors.category_id || []"
              />
              <v-textarea v-model="form.description" :label="t('description')" :error-messages="fieldErrors.description || []" rows="3" />
              <v-select v-model="form.exam_type" :items="examTypes" :label="t('examType')" :error-messages="fieldErrors.exam_type || []" />
              <div class="admin-ui__form-grid admin-ui__form-grid--2">
                <v-text-field v-model="form.price" :label="t('price')" suffix="BDT" :error-messages="fieldErrors.price || []" />
                <v-text-field v-model="form.discount_price" :label="t('discountPrice')" suffix="BDT" :error-messages="fieldErrors.discount_price || []" />
              </div>
              <v-text-field v-model="form.duration_minutes" :label="t('durationMinutes')" type="number" :error-messages="fieldErrors.duration_minutes || []" />
              <v-switch v-model="form.is_published" :label="t('published')" color="#0f5c66" />
              <div class="admin-ui__form-actions">
                <button
                  type="submit"
                  class="admin-ui__btn admin-ui__btn--solid admin-ui__btn--block admin-ui__btn--block-sm"
                  :disabled="saving"
                >
                  {{ t('save') }}
                </button>
              </div>
            </v-form>
          </section>
        </v-col>

        <v-col v-if="editing" cols="12" md="5">
          <section class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <h2>{{ t('thumbnail') }}</h2>
            </div>
            <v-img v-if="thumbnailUrl" :src="thumbnailUrl" max-height="180" class="mb-3" cover />
            <v-file-input v-model="file" :label="t('uploadThumbnail')" accept="image/png,image/jpeg,image/webp" :error-messages="fieldErrors.thumbnail || []" />
            <div class="admin-ui__row-actions">
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--soft"
                :disabled="!file || saving"
                @click="uploadThumbnail"
              >
                {{ t('uploadThumbnail') }}
              </button>
              <button
                v-if="thumbnailUrl"
                type="button"
                class="admin-ui__btn admin-ui__btn--danger"
                @click="removeThumbnail"
              >
                {{ t('removeThumbnail') }}
              </button>
            </div>
          </section>

          <section class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <h2>{{ t('assignTeachers') }}</h2>
            </div>
            <div v-if="teachers.length === 0" class="admin-ui__empty">
              <p>{{ t('noTeachers') }}</p>
            </div>
            <div v-for="teacher in teachers" :key="teacher.id" class="mb-2">
              <v-checkbox v-model="selectedTeachers" :label="`${teacher.name} (${teacher.email})`" :value="teacher.id" color="#0f5c66" hide-details />
              <v-checkbox
                v-if="selectedTeachers.includes(teacher.id)"
                v-model="contentTeachers"
                :label="t('canManageContent')"
                :value="teacher.id"
                color="#0f5c66"
                hide-details
                class="ms-6"
              />
            </div>
            <div class="admin-ui__form-actions">
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--solid admin-ui__btn--block admin-ui__btn--block-sm"
                :disabled="teachers.length === 0 || saving"
                @click="saveTeachers"
              >
                {{ t('save') }}
              </button>
            </div>
          </section>
        </v-col>
      </v-row>
    </template>
  </div>
</template>
