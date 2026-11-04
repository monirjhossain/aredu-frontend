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
  slug: '',
  exam_type: 'academic',
  instructions: '',
  duration_minutes: 60,
  is_published: false,
})
const loading = ref(false)
const saving = ref(false)
const message = ref('')

onMounted(load)
watch(() => route.params.id, load)

async function load() {
  message.value = ''
  if (!isEdit.value) return
  loading.value = true
  try {
    const { data } = await http.get(`/admin/reading-tests/${route.params.id}`, { skipErrorToast: true })
    const item = data.data
    form.value = {
      title: item.title,
      slug: item.slug,
      exam_type: item.exam_type,
      instructions: item.instructions || '',
      duration_minutes: Math.round((item.duration_seconds || 3600) / 60),
      is_published: item.is_published,
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  message.value = ''
  const payload = {
    title: form.value.title,
    slug: form.value.slug || undefined,
    exam_type: form.value.exam_type,
    instructions: form.value.instructions || null,
    duration_seconds: Math.max(1, Number(form.value.duration_minutes) || 60) * 60,
    is_published: form.value.is_published,
  }
  try {
    if (isEdit.value) {
      await http.put(`/admin/reading-tests/${route.params.id}`, payload, { skipErrorToast: true })
      router.push({ name: 'admin-reading-test-builder', params: { id: route.params.id } })
    } else {
      const { data } = await http.post('/admin/reading-tests', payload, { skipErrorToast: true })
      router.push({ name: 'admin-reading-test-builder', params: { id: data.data.id } })
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero
      :title="isEdit ? t('editReadingTest') : t('newReadingTest')"
      :lead="t('readingFormLead')"
    >
      <template #actions>
        <RouterLink
          :to="{ name: 'admin-reading-tests' }"
          class="admin-ui__btn admin-ui__btn--ghost admin-ui__btn--block admin-ui__btn--block-sm"
        >
          <v-icon size="18">mdi-arrow-left</v-icon>
          {{ t('backToReadingTests') }}
        </RouterLink>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          :disabled="saving || loading"
          @click="save"
        >
          <v-icon size="18">mdi-content-save</v-icon>
          {{ t('save') }}
        </button>
      </template>
    </AdminPageHero>

    <v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>

    <div v-if="loading" class="admin-ui__panel admin-ui__loading">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <section v-else class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ isEdit ? t('editReadingTest') : t('newReadingTest') }}</h2>
          <p>{{ t('readingFormLead') }}</p>
        </div>
      </div>

      <form class="reading-form" @submit.prevent="save">
        <div class="admin-ui__form-grid admin-ui__form-grid--2">
          <label class="admin-ui__field">
            <span>{{ t('title') }}</span>
            <input v-model="form.title" type="text" required>
          </label>
          <label class="admin-ui__field">
            <span>{{ t('slug') }}</span>
            <input v-model="form.slug" type="text" :placeholder="t('slugHint')">
            <small>{{ t('slugHint') }}</small>
          </label>
          <label class="admin-ui__field">
            <span>{{ t('examType') }}</span>
            <select v-model="form.exam_type">
              <option value="academic">{{ t('academic') }}</option>
              <option value="general">{{ t('general') }}</option>
            </select>
          </label>
          <label class="admin-ui__field">
            <span>{{ t('durationMinutes') }}</span>
            <input v-model.number="form.duration_minutes" type="number" min="1" required>
          </label>
        </div>

        <label class="admin-ui__field">
          <span>{{ t('instructions') }}</span>
          <textarea v-model="form.instructions" rows="4" />
        </label>

        <label class="admin-ui__switch">
          <input v-model="form.is_published" type="checkbox">
          {{ t('published') }}
        </label>

        <div class="admin-ui__form-actions">
          <button
            type="submit"
            class="admin-ui__btn admin-ui__btn--solid admin-ui__btn--block admin-ui__btn--block-sm"
            :disabled="saving"
          >
            {{ t('save') }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.reading-form {
  display: grid;
  gap: 1rem;
}
</style>
