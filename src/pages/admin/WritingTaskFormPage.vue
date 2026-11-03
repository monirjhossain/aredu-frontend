<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const isEdit = computed(() => Boolean(route.params.id))
const form = ref({
  title: '',
  exam_type: 'academic',
  task_type: 'task_2',
  instructions: '',
  prompt: '',
  recommended_minutes: 40,
  min_words: 250,
  is_published: false,
})
const imageUrl = ref('')
const file = ref(null)
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const success = ref('')
const fieldErrors = ref({})

const examTypes = computed(() => [
  { title: t('academic'), value: 'academic' },
  { title: t('general'), value: 'general' },
])
const taskTypes = computed(() => [
  { title: t('writingTaskAcademic1'), value: 'academic_task_1' },
  { title: t('writingTaskGeneral1'), value: 'general_task_1' },
  { title: t('writingTask2'), value: 'task_2' },
])

onMounted(load)
watch(() => route.params.id, load)

watch(() => form.value.task_type, (type) => {
  if (type === 'academic_task_1') {
    form.value.exam_type = 'academic'
    if (!isEdit.value) form.value.min_words = 150
    if (!isEdit.value) form.value.recommended_minutes = 20
  } else if (type === 'general_task_1') {
    form.value.exam_type = 'general'
    if (!isEdit.value) form.value.min_words = 150
    if (!isEdit.value) form.value.recommended_minutes = 20
  } else if (type === 'task_2' && !isEdit.value) {
    form.value.min_words = 250
    form.value.recommended_minutes = 40
  }
})

async function load() {
  message.value = ''
  success.value = ''
  fieldErrors.value = {}
  if (!isEdit.value) return
  loading.value = true
  try {
    const { data } = await http.get(`/admin/writing-tasks/${route.params.id}`, { skipErrorToast: true })
    const item = data.data
    form.value = {
      title: item.title,
      exam_type: item.exam_type,
      task_type: item.task_type,
      instructions: item.instructions || '',
      prompt: item.prompt || '',
      recommended_minutes: item.recommended_minutes,
      min_words: item.min_words,
      is_published: item.is_published,
    }
    imageUrl.value = item.image_url || ''
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  message.value = ''
  success.value = ''
  fieldErrors.value = {}
  const payload = {
    title: form.value.title,
    exam_type: form.value.exam_type,
    task_type: form.value.task_type,
    instructions: form.value.instructions || null,
    prompt: form.value.prompt,
    recommended_minutes: Number(form.value.recommended_minutes),
    min_words: Number(form.value.min_words),
    is_published: form.value.is_published,
  }
  try {
    if (isEdit.value) {
      await http.put(`/admin/writing-tasks/${route.params.id}`, payload, { skipErrorToast: true })
      success.value = t('saved')
    } else {
      const { data } = await http.post('/admin/writing-tasks', payload, { skipErrorToast: true })
      router.push({ name: 'admin-writing-task-edit', params: { id: data.data.id } })
    }
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors || {}
    message.value = parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

async function uploadImage() {
  if (!file.value || !isEdit.value) return
  saving.value = true
  message.value = ''
  try {
    const selected = Array.isArray(file.value) ? file.value[0] : file.value
    const body = new FormData()
    body.append('image', selected)
    const { data } = await http.post(`/admin/writing-tasks/${route.params.id}/image`, body, { skipErrorToast: true })
    imageUrl.value = data.data.image_url
    file.value = null
    success.value = data.message
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors || {}
    message.value = parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

async function removeImage() {
  if (!isEdit.value) return
  saving.value = true
  try {
    await http.delete(`/admin/writing-tasks/${route.params.id}/image`, { skipErrorToast: true })
    imageUrl.value = ''
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="isEdit ? t('editWritingTask') : t('newWritingTask')">
      <template #actions>
        <RouterLink :to="{ name: 'admin-writing-tasks' }" class="admin-ui__btn admin-ui__btn--ghost">
          <v-icon size="18">mdi-arrow-left</v-icon>
          {{ t('backToWritingTasks') }}
        </RouterLink>
        <button type="button" class="admin-ui__btn admin-ui__btn--primary" :disabled="saving || loading" @click="save">
          <v-icon size="18">mdi-content-save</v-icon>
          {{ t('save') }}
        </button>
      </template>
    </AdminPageHero>

    <div v-if="loading" class="admin-ui__panel admin-ui__loading">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <template v-else>
      <v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
      <v-alert v-if="success" type="success" variant="tonal" class="mb-4">{{ success }}</v-alert>

      <section class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <h2>{{ isEdit ? t('editWritingTask') : t('newWritingTask') }}</h2>
        </div>
        <v-form @submit.prevent="save">
          <v-text-field
            v-model="form.title"
            :label="t('title')"
            required
            :error-messages="fieldErrors.title || []"
          />
          <div class="admin-ui__form-grid admin-ui__form-grid--2">
            <v-select
              v-model="form.task_type"
              :items="taskTypes"
              :label="t('writingTaskType')"
              :error-messages="fieldErrors.task_type || []"
            />
            <v-select
              v-model="form.exam_type"
              :items="examTypes"
              :label="t('examType')"
              :disabled="form.task_type === 'academic_task_1' || form.task_type === 'general_task_1'"
              :error-messages="fieldErrors.exam_type || []"
            />
          </div>
          <v-textarea
            v-model="form.instructions"
            :label="t('instructions')"
            rows="3"
            :error-messages="fieldErrors.instructions || []"
          />
          <v-textarea
            v-model="form.prompt"
            :label="t('writingPrompt')"
            rows="5"
            required
            :error-messages="fieldErrors.prompt || []"
          />
          <div class="admin-ui__form-grid admin-ui__form-grid--2">
            <v-text-field
              v-model.number="form.recommended_minutes"
              type="number"
              min="5"
              max="120"
              :label="t('recommendedMinutes')"
              :error-messages="fieldErrors.recommended_minutes || []"
            />
            <v-text-field
              v-model.number="form.min_words"
              type="number"
              min="50"
              max="1000"
              :label="t('minWords')"
              :error-messages="fieldErrors.min_words || []"
            />
          </div>
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

      <section v-if="isEdit" class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <div>
            <h2>{{ t('writingImage') }}</h2>
            <p>{{ t('writingImageHint') }}</p>
          </div>
        </div>
        <v-img v-if="imageUrl" :src="imageUrl" max-height="240" class="mb-3" contain />
        <v-file-input
          v-model="file"
          :label="t('uploadWritingImage')"
          accept="image/png,image/jpeg,image/webp"
          :error-messages="fieldErrors.image || []"
        />
        <div class="admin-ui__row-actions">
          <button
            type="button"
            class="admin-ui__btn admin-ui__btn--soft"
            :disabled="!file || saving"
            @click="uploadImage"
          >
            {{ t('uploadWritingImage') }}
          </button>
          <button
            v-if="imageUrl"
            type="button"
            class="admin-ui__btn admin-ui__btn--danger"
            :disabled="saving"
            @click="removeImage"
          >
            {{ t('removeWritingImage') }}
          </button>
        </div>
      </section>
    </template>
  </div>
</template>
