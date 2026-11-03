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
  part: 1,
  instructions: '',
  preparation_seconds: 0,
  response_seconds: 60,
  is_published: false,
})
const questions = ref([])
const questionForm = ref({ prompt: '', cue_card: '', position: null })
const editingQuestionId = ref(null)
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const success = ref('')
const fieldErrors = ref({})

const parts = computed(() => [
  { title: t('speakingPart1'), value: 1 },
  { title: t('speakingPart2'), value: 2 },
  { title: t('speakingPart3'), value: 3 },
])

onMounted(load)
watch(() => route.params.id, load)

watch(() => form.value.part, (part) => {
  if (isEdit.value) return
  if (Number(part) === 2) {
    form.value.preparation_seconds = 60
    form.value.response_seconds = 120
  } else if (Number(part) === 3) {
    form.value.preparation_seconds = 0
    form.value.response_seconds = 60
  } else {
    form.value.preparation_seconds = 0
    form.value.response_seconds = 60
  }
})

async function load() {
  message.value = ''
  success.value = ''
  fieldErrors.value = {}
  if (!isEdit.value) return
  loading.value = true
  try {
    const { data } = await http.get(`/admin/speaking-tasks/${route.params.id}`, { skipErrorToast: true })
    const item = data.data
    form.value = {
      title: item.title,
      part: item.part,
      instructions: item.instructions || '',
      preparation_seconds: item.preparation_seconds,
      response_seconds: item.response_seconds,
      is_published: item.is_published,
    }
    questions.value = item.questions || []
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
    part: Number(form.value.part),
    instructions: form.value.instructions || null,
    preparation_seconds: Number(form.value.preparation_seconds),
    response_seconds: Number(form.value.response_seconds),
    is_published: form.value.is_published,
  }
  try {
    if (isEdit.value) {
      const { data } = await http.put(`/admin/speaking-tasks/${route.params.id}`, payload, { skipErrorToast: true })
      questions.value = data.data.questions || questions.value
      success.value = t('saved')
    } else {
      const { data } = await http.post('/admin/speaking-tasks', payload, { skipErrorToast: true })
      router.push({ name: 'admin-speaking-task-edit', params: { id: data.data.id } })
    }
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors || {}
    message.value = parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

function startEditQuestion(item) {
  editingQuestionId.value = item.id
  questionForm.value = {
    prompt: item.prompt,
    cue_card: item.cue_card || '',
    position: item.position,
  }
}

function resetQuestionForm() {
  editingQuestionId.value = null
  questionForm.value = { prompt: '', cue_card: '', position: null }
}

async function saveQuestion() {
  if (!isEdit.value) return
  saving.value = true
  message.value = ''
  fieldErrors.value = {}
  const payload = {
    prompt: questionForm.value.prompt,
    cue_card: questionForm.value.cue_card || null,
    position: questionForm.value.position || undefined,
  }
  try {
    if (editingQuestionId.value) {
      await http.put(
        `/admin/speaking-tasks/${route.params.id}/questions/${editingQuestionId.value}`,
        payload,
        { skipErrorToast: true },
      )
    } else {
      await http.post(`/admin/speaking-tasks/${route.params.id}/questions`, payload, { skipErrorToast: true })
    }
    resetQuestionForm()
    await load()
    success.value = t('saved')
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors || {}
    message.value = parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

async function removeQuestion(item) {
  saving.value = true
  try {
    await http.delete(`/admin/speaking-tasks/${route.params.id}/questions/${item.id}`, { skipErrorToast: true })
    if (editingQuestionId.value === item.id) resetQuestionForm()
    await load()
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="isEdit ? t('editSpeakingTask') : t('newSpeakingTask')">
      <template #actions>
        <RouterLink :to="{ name: 'admin-speaking-tasks' }" class="admin-ui__btn admin-ui__btn--ghost">
          <v-icon size="18">mdi-arrow-left</v-icon>
          {{ t('backToSpeakingTasks') }}
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
          <h2>{{ isEdit ? t('editSpeakingTask') : t('newSpeakingTask') }}</h2>
        </div>
        <v-form @submit.prevent="save">
          <div class="admin-ui__form-grid admin-ui__form-grid--2">
            <v-text-field v-model="form.title" :label="t('title')" :error-messages="fieldErrors.title || []" />
            <v-select v-model="form.part" :items="parts" :label="t('speakingPart')" :error-messages="fieldErrors.part || []" />
          </div>
          <v-textarea v-model="form.instructions" :label="t('instructions')" rows="3" :error-messages="fieldErrors.instructions || []" />
          <div class="admin-ui__form-grid admin-ui__form-grid--2">
            <v-text-field
              v-model.number="form.preparation_seconds"
              type="number"
              min="0"
              :label="t('preparationSeconds')"
              :error-messages="fieldErrors.preparation_seconds || []"
            />
            <v-text-field
              v-model.number="form.response_seconds"
              type="number"
              min="1"
              :label="t('responseSeconds')"
              :error-messages="fieldErrors.response_seconds || []"
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

      <template v-if="isEdit">
        <section class="admin-ui__panel">
          <div class="admin-ui__panel-head">
            <div>
              <h2>{{ editingQuestionId ? t('editQuestion') : t('addQuestion') }}</h2>
              <p>{{ t('speakingQuestionsHint') }}</p>
            </div>
          </div>
          <v-textarea
            v-model="questionForm.prompt"
            :label="t('questionPrompt')"
            rows="3"
            :error-messages="fieldErrors.prompt || []"
          />
          <v-textarea
            v-model="questionForm.cue_card"
            :label="t('cueCard')"
            rows="4"
            :hint="t('cueCardHint')"
            persistent-hint
            :error-messages="fieldErrors.cue_card || []"
          />
          <v-text-field
            v-model.number="questionForm.position"
            type="number"
            min="1"
            :label="t('position')"
            class="mt-2"
            :error-messages="fieldErrors.position || []"
          />
          <div class="admin-ui__form-actions">
            <button
              type="button"
              class="admin-ui__btn admin-ui__btn--solid admin-ui__btn--block admin-ui__btn--block-sm"
              :disabled="saving"
              @click="saveQuestion"
            >
              {{ editingQuestionId ? t('save') : t('addQuestion') }}
            </button>
            <button
              v-if="editingQuestionId"
              type="button"
              class="admin-ui__btn admin-ui__btn--soft admin-ui__btn--block admin-ui__btn--block-sm"
              @click="resetQuestionForm"
            >
              {{ t('cancel') }}
            </button>
          </div>
        </section>

        <section class="admin-ui__panel">
          <div class="admin-ui__panel-head">
            <div>
              <h2>{{ t('speakingQuestions') }}</h2>
              <p>{{ t('reportTotal', { count: questions.length }) }}</p>
            </div>
          </div>
          <div v-if="questions.length === 0" class="admin-ui__empty">
            <p>{{ t('noSpeakingQuestions') }}</p>
          </div>
          <div v-else class="admin-ui__list">
            <article v-for="item in questions" :key="item.id" class="admin-ui__row">
              <div class="admin-ui__row-main">
                <div>
                  <h3 class="admin-ui__row-title">{{ item.position }}. {{ item.prompt }}</h3>
                  <p v-if="item.cue_card" class="admin-ui__row-meta" style="white-space: pre-wrap">{{ item.cue_card }}</p>
                </div>
              </div>
              <div class="admin-ui__row-actions">
                <button
                  type="button"
                  class="admin-ui__icon-btn"
                  :aria-label="t('edit')"
                  @click="startEditQuestion(item)"
                >
                  <v-icon size="18">mdi-pencil</v-icon>
                </button>
                <button
                  type="button"
                  class="admin-ui__icon-btn admin-ui__icon-btn--danger"
                  :aria-label="t('delete')"
                  @click="removeQuestion(item)"
                >
                  <v-icon size="18">mdi-delete</v-icon>
                </button>
              </div>
            </article>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
