<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
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
const slugTouched = ref(false)

const form = reactive({
  category_id: null,
  title: '',
  slug: '',
  description: '',
  exam_type: 'academic',
  price: '',
  discount_price: '',
  duration_minutes: 0,
  learners_count: '',
  class_starts_on: '',
  batch_number: '',
  seats_left: '',
  offer_ends_on: '',
  is_published: false,
})

const examTypes = [
  { value: 'academic', labelKey: 'academic' },
  { value: 'general', labelKey: 'general' },
]

const categoryName = computed(() => categories.value.find((row) => row.id === form.category_id)?.name || '')

watch(() => form.title, (title) => {
  if (editing.value || slugTouched.value) return
  form.slug = slugify(title)
})

onMounted(async () => {
  try {
    const { data } = await http.get('/admin/courses/form-options', { skipErrorToast: true })
    categories.value = data.data.categories || []
    teachers.value = data.data.teachers || []
    if (editing.value) {
      const course = await http.get(`/admin/courses/${route.params.id}`, { skipErrorToast: true })
      fill(course.data.data)
      slugTouched.value = true
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
})

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function fill(course) {
  form.category_id = course.category?.id ?? null
  form.title = course.title
  form.slug = course.slug
  form.description = course.description || ''
  form.exam_type = course.exam_type
  form.price = course.price
  form.discount_price = course.discount_price || ''
  form.duration_minutes = course.duration_minutes
  form.learners_count = course.learners_count ?? ''
  form.class_starts_on = course.class_starts_on || ''
  form.batch_number = course.batch_number ?? ''
  form.seats_left = course.seats_left ?? ''
  form.offer_ends_on = course.offer_ends_on || ''
  form.is_published = course.is_published
  thumbnailUrl.value = course.thumbnail_url || ''
  selectedTeachers.value = (course.teachers || []).map((teacher) => teacher.id)
  contentTeachers.value = (course.teachers || []).filter((teacher) => teacher.can_manage_content).map((teacher) => teacher.id)
}

function optionalNumber(value) {
  if (value === '' || value == null) return null
  return Number(value)
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
    learners_count: optionalNumber(form.learners_count),
    class_starts_on: form.class_starts_on || null,
    batch_number: optionalNumber(form.batch_number),
    seats_left: optionalNumber(form.seats_left),
    offer_ends_on: form.offer_ends_on || null,
    is_published: form.is_published,
  }
}

function fieldError(key) {
  return fieldErrors.value?.[key]?.[0] || ''
}

async function save() {
  saving.value = true
  message.value = ''
  fieldErrors.value = {}
  try {
    if (editing.value) {
      const { data } = await http.put(`/admin/courses/${route.params.id}`, payload(), {
        skipErrorToast: true,
        skipSuccessToast: true,
      })
      fill(data.data)
      ui.success(t('courseSaved'))
    } else {
      const { data } = await http.post('/admin/courses', payload(), {
        skipErrorToast: true,
        skipSuccessToast: true,
      })
      ui.success(t('courseCreated'))
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
  const selected = Array.isArray(file.value) ? file.value[0] : file.value
  if (!selected) return
  saving.value = true
  message.value = ''
  try {
    const body = new FormData()
    body.append('thumbnail', selected)
    const { data } = await http.post(`/admin/courses/${route.params.id}/thumbnail`, body, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    thumbnailUrl.value = data.data.thumbnail_url
    file.value = null
    ui.success(t('thumbnailUpdated'))
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
    await http.delete(`/admin/courses/${route.params.id}/thumbnail`, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    thumbnailUrl.value = ''
    ui.success(t('thumbnailRemoved'))
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
    }, { skipErrorToast: true, skipSuccessToast: true })
    fill(data.data)
    ui.success(t('teachersSaved'))
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors
    message.value = parsed.errors.teachers?.[0] || parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

function onFileChange(event) {
  file.value = event.target.files?.[0] || null
}
</script>

<template>
  <div class="admin-ui course-form">
    <AdminPageHero
      :title="editing ? t('editCourse') : t('newCourse')"
      :lead="editing ? t('editCourseLead') : t('newCourseLead')"
    >
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
      <v-alert v-if="message" class="mb-3" type="error" variant="tonal">{{ message }}</v-alert>

      <div class="course-form__layout">
        <div class="course-form__main">
          <section class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <div>
                <h2>{{ t('courseBasics') }}</h2>
                <p>{{ t('courseBasicsLead') }}</p>
              </div>
              <label class="admin-ui__switch course-form__publish">
                <input v-model="form.is_published" type="checkbox">
                <span>{{ t('published') }}</span>
              </label>
            </div>

            <div class="admin-ui__form-grid">
              <label class="admin-ui__field">
                <span>{{ t('name') }}</span>
                <input v-model="form.title" type="text" :placeholder="t('courseTitlePlaceholder')">
                <small v-if="fieldError('title')" class="admin-ui__field-error">{{ fieldError('title') }}</small>
              </label>

              <div class="admin-ui__form-grid admin-ui__form-grid--2">
                <label class="admin-ui__field">
                  <span>{{ t('slug') }}</span>
                  <input
                    v-model="form.slug"
                    type="text"
                    placeholder="ielts-speaking-mastery"
                    @input="slugTouched = true"
                  >
                  <small v-if="fieldError('slug')" class="admin-ui__field-error">{{ fieldError('slug') }}</small>
                </label>
                <label class="admin-ui__field">
                  <span>{{ t('categories') }}</span>
                  <select v-model="form.category_id">
                    <option :value="null" disabled>{{ t('selectCategory') }}</option>
                    <option v-for="category in categories" :key="category.id" :value="category.id">
                      {{ category.name }}
                    </option>
                  </select>
                  <small v-if="fieldError('category_id')" class="admin-ui__field-error">{{ fieldError('category_id') }}</small>
                </label>
              </div>

              <label class="admin-ui__field">
                <span>{{ t('description') }}</span>
                <textarea v-model="form.description" rows="4" :placeholder="t('courseDescriptionPlaceholder')" />
                <small v-if="fieldError('description')" class="admin-ui__field-error">{{ fieldError('description') }}</small>
              </label>

              <div class="course-form__exam">
                <span class="course-form__exam-label">{{ t('examType') }}</span>
                <div class="course-form__exam-options">
                  <label
                    v-for="item in examTypes"
                    :key="item.value"
                    class="course-form__exam-option"
                    :class="{ 'is-active': form.exam_type === item.value }"
                  >
                    <input v-model="form.exam_type" type="radio" :value="item.value">
                    <strong>{{ t(item.labelKey) }}</strong>
                  </label>
                </div>
                <small v-if="fieldError('exam_type')" class="admin-ui__field-error">{{ fieldError('exam_type') }}</small>
              </div>
            </div>
          </section>

          <section class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <div>
                <h2>{{ t('pricingDuration') }}</h2>
                <p>{{ t('pricingDurationLead') }}</p>
              </div>
            </div>
            <div class="admin-ui__form-grid admin-ui__form-grid--2">
              <label class="admin-ui__field">
                <span>{{ t('price') }} (BDT)</span>
                <input v-model="form.price" type="number" min="0" step="0.01">
                <small v-if="fieldError('price')" class="admin-ui__field-error">{{ fieldError('price') }}</small>
              </label>
              <label class="admin-ui__field">
                <span>{{ t('discountPrice') }} (BDT)</span>
                <input v-model="form.discount_price" type="number" min="0" step="0.01" :placeholder="t('optional')">
                <small v-if="fieldError('discount_price')" class="admin-ui__field-error">{{ fieldError('discount_price') }}</small>
              </label>
              <label class="admin-ui__field">
                <span>{{ t('durationMinutes') }}</span>
                <input v-model="form.duration_minutes" type="number" min="0">
                <small v-if="fieldError('duration_minutes')" class="admin-ui__field-error">{{ fieldError('duration_minutes') }}</small>
              </label>
            </div>
          </section>

          <section class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <div>
                <h2>{{ t('courseCardMarketing') }}</h2>
                <p>{{ t('courseCardMarketingLead') }}</p>
              </div>
            </div>
            <div class="admin-ui__form-grid admin-ui__form-grid--2">
              <label class="admin-ui__field">
                <span>{{ t('learnersCountField') }}</span>
                <input v-model="form.learners_count" type="number" min="0" :placeholder="t('optional')">
                <small v-if="fieldError('learners_count')" class="admin-ui__field-error">{{ fieldError('learners_count') }}</small>
              </label>
              <label class="admin-ui__field">
                <span>{{ t('classStartsOnField') }}</span>
                <input v-model="form.class_starts_on" type="date">
                <small v-if="fieldError('class_starts_on')" class="admin-ui__field-error">{{ fieldError('class_starts_on') }}</small>
              </label>
              <label class="admin-ui__field">
                <span>{{ t('batchNumberField') }}</span>
                <input v-model="form.batch_number" type="number" min="1" :placeholder="t('optional')">
                <small v-if="fieldError('batch_number')" class="admin-ui__field-error">{{ fieldError('batch_number') }}</small>
              </label>
              <label class="admin-ui__field">
                <span>{{ t('seatsLeftField') }}</span>
                <input v-model="form.seats_left" type="number" min="0" :placeholder="t('optional')">
                <small v-if="fieldError('seats_left')" class="admin-ui__field-error">{{ fieldError('seats_left') }}</small>
              </label>
              <label class="admin-ui__field">
                <span>{{ t('offerEndsOnField') }}</span>
                <input v-model="form.offer_ends_on" type="date">
                <small v-if="fieldError('offer_ends_on')" class="admin-ui__field-error">{{ fieldError('offer_ends_on') }}</small>
              </label>
            </div>
          </section>

          <div class="course-form__footer-actions">
            <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="router.push({ name: 'admin-courses' })">
              {{ t('cancel') }}
            </button>
            <button type="button" class="admin-ui__btn admin-ui__btn--solid" :disabled="saving" @click="save">
              {{ t('save') }}
            </button>
          </div>
        </div>

        <aside class="course-form__side">
          <section class="admin-ui__panel course-form__preview">
            <div class="admin-ui__panel-head">
              <div>
                <h2>{{ t('livePreview') }}</h2>
                <p>{{ t('livePreviewLead') }}</p>
              </div>
            </div>
            <div class="course-form__preview-card">
              <div
                class="course-form__preview-media"
                :style="thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})` } : undefined"
              >
                <span v-if="!thumbnailUrl">{{ form.title || t('courseTitlePlaceholder') }}</span>
              </div>
              <div class="course-form__preview-body">
                <strong>{{ form.title || t('courseTitlePlaceholder') }}</strong>
                <p>{{ categoryName || t('categories') }} · {{ t(form.exam_type) }}</p>
                <div class="course-form__preview-price">
                  <span>{{ form.discount_price || form.price || '0' }} BDT</span>
                  <s v-if="form.discount_price">{{ form.price }} BDT</s>
                </div>
                <div class="course-form__preview-chips">
                  <span v-if="form.batch_number">{{ t('batchNumber', { number: form.batch_number }) }}</span>
                  <span v-if="form.seats_left !== ''">{{ t('seatsLeft', { count: form.seats_left }) }}</span>
                </div>
              </div>
            </div>
          </section>

          <section v-if="editing" class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <div>
                <h2>{{ t('thumbnail') }}</h2>
                <p>{{ t('thumbnailLead') }}</p>
              </div>
            </div>
            <img v-if="thumbnailUrl" :src="thumbnailUrl" class="course-form__thumb" alt="">
            <label class="admin-ui__field">
              <span>{{ t('uploadThumbnail') }}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" @change="onFileChange">
              <small v-if="fieldError('thumbnail')" class="admin-ui__field-error">{{ fieldError('thumbnail') }}</small>
            </label>
            <div class="admin-ui__row-actions">
              <button type="button" class="admin-ui__btn admin-ui__btn--soft" :disabled="!file || saving" @click="uploadThumbnail">
                {{ t('uploadThumbnail') }}
              </button>
              <button
                v-if="thumbnailUrl"
                type="button"
                class="admin-ui__btn admin-ui__btn--danger"
                :disabled="saving"
                @click="removeThumbnail"
              >
                {{ t('removeThumbnail') }}
              </button>
            </div>
          </section>

          <section v-if="editing" class="admin-ui__panel">
            <div class="admin-ui__panel-head">
              <div>
                <h2>{{ t('assignTeachers') }}</h2>
                <p>{{ t('assignTeachersLead') }}</p>
              </div>
            </div>
            <div v-if="teachers.length === 0" class="admin-ui__empty">
              <p>{{ t('noTeachers') }}</p>
            </div>
            <div v-else class="course-form__teachers">
              <article v-for="teacher in teachers" :key="teacher.id" class="course-form__teacher">
                <label class="course-form__teacher-main">
                  <input v-model="selectedTeachers" type="checkbox" :value="teacher.id">
                  <div>
                    <strong>{{ teacher.name }}</strong>
                    <span>{{ teacher.email }}</span>
                  </div>
                </label>
                <label v-if="selectedTeachers.includes(teacher.id)" class="course-form__teacher-content">
                  <input v-model="contentTeachers" type="checkbox" :value="teacher.id">
                  <span>{{ t('canManageContent') }}</span>
                </label>
              </article>
            </div>
            <div class="admin-ui__form-actions">
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--solid admin-ui__btn--block"
                :disabled="teachers.length === 0 || saving"
                @click="saveTeachers"
              >
                {{ t('saveTeachers') }}
              </button>
            </div>
          </section>

          <section v-else class="admin-ui__panel course-form__hint">
            <h2>{{ t('afterCreateTitle') }}</h2>
            <p>{{ t('afterCreateLead') }}</p>
            <ul>
              <li>{{ t('afterCreateThumb') }}</li>
              <li>{{ t('afterCreateTeachers') }}</li>
              <li>{{ t('afterCreateContent') }}</li>
            </ul>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.course-form__layout {
  display: grid;
  gap: 0.85rem;
}

@media (min-width: 980px) {
  .course-form__layout {
    grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.8fr);
    align-items: start;
  }
}

.course-form__main,
.course-form__side {
  display: grid;
  gap: 0.85rem;
  min-width: 0;
}

.course-form__publish {
  padding: 0.15rem 0.75rem 0.15rem 0.45rem;
  border-radius: 999px;
  background: var(--admin-teal-soft);
  color: var(--admin-teal);
}

.course-form__exam {
  display: grid;
  gap: 0.45rem;
}

.course-form__exam-label {
  color: var(--admin-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.course-form__exam-options {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.55rem;
}

@media (min-width: 560px) {
  .course-form__exam-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.course-form__exam-option {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.75rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.7rem;
  background: #fff;
  cursor: pointer;
}

.course-form__exam-option.is-active {
  border-color: rgba(15, 92, 102, 0.45);
  background: var(--admin-teal-soft);
  color: var(--admin-teal);
}

.course-form__exam-option input {
  accent-color: var(--admin-teal);
}

.course-form__footer-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.55rem;
}

.course-form__preview-card {
  overflow: hidden;
  border: 1px solid var(--admin-line);
  border-radius: 0.85rem;
  background: #fff;
}

.course-form__preview-media {
  display: grid;
  place-items: center;
  min-height: 140px;
  padding: 1rem;
  background:
    linear-gradient(145deg, #0b3d36 0%, #145c4f 45%, #0a2a3a 100%) center / cover no-repeat;
  background-size: cover;
  color: #fff;
  text-align: center;
  font-weight: 800;
}

.course-form__preview-body {
  display: grid;
  gap: 0.45rem;
  padding: 0.85rem;
}

.course-form__preview-body strong {
  font-size: 1rem;
  letter-spacing: -0.02em;
}

.course-form__preview-body p {
  margin: 0;
  color: var(--admin-muted);
  font-size: 0.82rem;
}

.course-form__preview-price {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  font-weight: 800;
}

.course-form__preview-price s {
  color: #98a2b3;
  font-weight: 600;
}

.course-form__preview-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.course-form__preview-chips span {
  display: inline-flex;
  min-height: 1.7rem;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 0.4rem;
  background: var(--admin-paper);
  color: var(--admin-muted);
  font-size: 0.75rem;
  font-weight: 700;
}

.course-form__thumb {
  display: block;
  width: 100%;
  max-height: 180px;
  object-fit: cover;
  margin-bottom: 0.75rem;
  border-radius: 0.7rem;
  border: 1px solid var(--admin-line);
}

.course-form__teachers {
  display: grid;
  gap: 0.65rem;
}

.course-form__teacher {
  padding: 0.75rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.75rem;
  background: #fff;
}

.course-form__teacher-main,
.course-form__teacher-content {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
}

.course-form__teacher-main strong,
.course-form__teacher-main span {
  display: block;
}

.course-form__teacher-main span {
  color: var(--admin-muted);
  font-size: 0.8rem;
}

.course-form__teacher-content {
  margin-top: 0.55rem;
  margin-left: 1.45rem;
  color: var(--admin-muted);
  font-size: 0.82rem;
  font-weight: 650;
}

.course-form__hint h2 {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}

.course-form__hint p,
.course-form__hint li {
  color: var(--admin-muted);
  font-size: 0.86rem;
  line-height: 1.45;
}

.course-form__hint ul {
  margin: 0.65rem 0 0;
  padding-left: 1.1rem;
}
</style>
