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
  duration_minutes: 40,
  is_published: false,
})
const loading = ref(false)
const saving = ref(false)
const message = ref('')

const examTypes = computed(() => [
  { title: t('academic'), value: 'academic' },
  { title: t('general'), value: 'general' },
])

onMounted(load)
watch(() => route.params.id, load)

async function load() {
  message.value = ''
  if (!isEdit.value) return
  loading.value = true
  try {
    const { data } = await http.get(`/admin/listening-tests/${route.params.id}`, { skipErrorToast: true })
    const item = data.data
    form.value = {
      title: item.title,
      slug: item.slug,
      exam_type: item.exam_type,
      instructions: item.instructions || '',
      duration_minutes: Math.round((item.duration_seconds || 2400) / 60),
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
    duration_seconds: Math.max(1, Number(form.value.duration_minutes) || 40) * 60,
    is_published: form.value.is_published,
  }
  try {
    if (isEdit.value) {
      await http.put(`/admin/listening-tests/${route.params.id}`, payload, { skipErrorToast: true })
      router.push({ name: 'admin-listening-test-builder', params: { id: route.params.id } })
    } else {
      const { data } = await http.post('/admin/listening-tests', payload, { skipErrorToast: true })
      router.push({ name: 'admin-listening-test-builder', params: { id: data.data.id } })
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
    <AdminPageHero :title="isEdit ? t('editListeningTest') : t('newListeningTest')">
      <template #actions>
        <RouterLink :to="{ name: 'admin-listening-tests' }" class="admin-ui__btn admin-ui__btn--ghost">
          <v-icon size="18">mdi-arrow-left</v-icon>
          {{ t('backToListeningTests') }}
        </RouterLink>
        <button type="button" class="admin-ui__btn admin-ui__btn--primary" :disabled="saving || loading" @click="save">
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
        <h2>{{ isEdit ? t('editListeningTest') : t('newListeningTest') }}</h2>
      </div>
      <v-form @submit.prevent="save">
        <div class="admin-ui__form-grid admin-ui__form-grid--2">
          <v-text-field v-model="form.title" :label="t('title')" required />
          <v-text-field v-model="form.slug" :label="t('slug')" :hint="t('slugHint')" persistent-hint />
          <v-select v-model="form.exam_type" :items="examTypes" :label="t('examType')" />
          <v-text-field v-model.number="form.duration_minutes" type="number" min="1" :label="t('durationMinutes')" />
        </div>
        <v-textarea v-model="form.instructions" :label="t('instructions')" rows="4" />
        <v-alert type="info" variant="tonal" class="mb-4">{{ t('listeningFourSectionsNote') }}</v-alert>
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
  </div>
</template>
