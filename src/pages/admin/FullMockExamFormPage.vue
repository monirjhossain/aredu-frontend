<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { firstApiMessage } from '../../composables/useFullMockContext'
import { useUiStore } from '../../stores/ui'

const SKILLS = ['listening', 'reading', 'writing', 'speaking']
const SOURCE_ENDPOINTS = {
  listening: '/admin/listening-tests',
  reading: '/admin/reading-tests',
  // Read-only pickers under mock_tests.manage — do not require writing.manage / speaking.manage
  writing: '/admin/full-mocks/options/writing-tasks',
  speaking: '/admin/full-mocks/options/speaking-tasks',
}
const SOURCE_FIELDS = {
  listening: 'mock_test_id',
  reading: 'mock_test_id',
  writing: 'writing_task_id',
  speaking: 'speaking_task_id',
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const ui = useUiStore()

const isEdit = computed(() => Boolean(route.params.id))
const form = ref({
  title: '',
  slug: '',
  exam_type: 'academic',
  instructions: '',
  is_free: false,
  allow_resume: true,
  is_published: false,
})
const rows = ref([])
const warnings = ref([])
const loading = ref(false)
const saving = ref(false)
const savingSections = ref(false)
const publishing = ref(false)
const message = ref('')
const sectionMessage = ref('')

let rowSeq = 0
const optionCache = new Map()

onMounted(load)
watch(() => route.params.id, load)
watch(() => form.value.exam_type, () => {
  optionCache.clear()
  rows.value.forEach((row) => loadOptions(row))
})

function skillLabel(skill) {
  return t(`skill${skill.charAt(0).toUpperCase()}${skill.slice(1)}`)
}

function sourceField(skill) {
  return SOURCE_FIELDS[skill]
}

function makeRow(partial = {}) {
  rowSeq += 1
  return {
    key: `row-${rowSeq}`,
    id: partial.id ?? null,
    skill: partial.skill || 'listening',
    title: partial.title || '',
    duration_minutes: partial.duration_seconds ? Math.round(partial.duration_seconds / 60) : '',
    instructions: partial.instructions || '',
    mock_test_id: partial.mock_test_id ?? null,
    writing_task_id: partial.writing_task_id ?? null,
    speaking_task_id: partial.speaking_task_id ?? null,
    sourceTitle: partial.source?.title || '',
    options: [],
    search: '',
    optionsLoading: false,
    optionsError: '',
    autoTitle: '',
  }
}

function applyShow(data) {
  const exam = data.exam
  form.value = {
    title: exam.title,
    slug: exam.slug || '',
    exam_type: exam.exam_type,
    instructions: exam.instructions || '',
    is_free: !!exam.is_free,
    allow_resume: exam.allow_resume !== false,
    is_published: !!exam.is_published,
  }
  rows.value = (data.sections || []).map((section) => makeRow(section))
  warnings.value = data.warnings || []
  rows.value.forEach((row) => loadOptions(row))
}

async function load() {
  message.value = ''
  sectionMessage.value = ''
  if (!isEdit.value) {
    rows.value = []
    warnings.value = []
    return
  }
  loading.value = true
  try {
    const { data } = await http.get(`/admin/full-mocks/${route.params.id}`, { skipErrorToast: true })
    applyShow(data.data)
  } catch (error) {
    message.value = firstApiMessage(error, t('requestFailed'))
  } finally {
    loading.value = false
  }
}

async function loadOptions(row) {
  const search = row.search.trim()
  const params = { search: search || undefined }
  if (row.skill !== 'speaking') params.exam_type = form.value.exam_type
  const cacheKey = `${row.skill}|${params.exam_type || ''}|${search}`

  if (optionCache.has(cacheKey)) {
    row.options = optionCache.get(cacheKey)
    return
  }

  row.optionsLoading = true
  row.optionsError = ''
  try {
    const { data } = await http.get(SOURCE_ENDPOINTS[row.skill], { params, skipErrorToast: true })
    const items = (data.data || []).map((item) => ({
      id: item.id,
      title: item.title,
      is_published: item.is_published !== false,
    }))
    optionCache.set(cacheKey, items)
    row.options = items
  } catch (error) {
    row.options = []
    row.optionsError = firstApiMessage(error, t('fullMockSourceLoadFailed'))
  } finally {
    row.optionsLoading = false
  }
}

function optionsFor(row) {
  const field = sourceField(row.skill)
  const selected = row[field]
  if (selected && !row.options.some((item) => item.id === selected)) {
    return [{ id: selected, title: row.sourceTitle || `#${selected}`, is_published: true }, ...row.options]
  }
  return row.options
}

function optionLabel(item) {
  return item.is_published ? item.title : `${item.title} (${t('unpublished')})`
}

function addRow() {
  rows.value.push(makeRow({ skill: SKILLS[rows.value.length % SKILLS.length] }))
  loadOptions(rows.value[rows.value.length - 1])
}

function removeRow(index) {
  rows.value.splice(index, 1)
}

function moveRow(index, delta) {
  const target = index + delta
  if (target < 0 || target >= rows.value.length) return
  const copy = [...rows.value]
  const [item] = copy.splice(index, 1)
  copy.splice(target, 0, item)
  rows.value = copy
}

function onSkillChange(row) {
  row.mock_test_id = null
  row.writing_task_id = null
  row.speaking_task_id = null
  row.sourceTitle = ''
  row.search = ''
  loadOptions(row)
}

function onSourceChange(row) {
  const item = row.options.find((option) => option.id === row[sourceField(row.skill)])
  if (!item) return
  row.sourceTitle = item.title
  if (!row.title.trim() || row.title === row.autoTitle) {
    row.title = item.title
    row.autoTitle = item.title
  }
}

function examPayload() {
  return {
    title: form.value.title,
    slug: form.value.slug || null,
    exam_type: form.value.exam_type,
    instructions: form.value.instructions || null,
    is_free: form.value.is_free,
    allow_resume: form.value.allow_resume,
  }
}

async function save() {
  saving.value = true
  message.value = ''
  try {
    if (isEdit.value) {
      const { data } = await http.put(`/admin/full-mocks/${route.params.id}`, examPayload(), { skipErrorToast: true, skipSuccessToast: true })
      form.value.slug = data.data.exam.slug || ''
      warnings.value = data.data.warnings || []
      ui.success(t('fullMockSaved'))
    } else {
      const { data } = await http.post('/admin/full-mocks', examPayload(), { skipErrorToast: true, skipSuccessToast: true })
      ui.success(t('fullMockSaved'))
      router.replace({ name: 'admin-full-mock-edit', params: { id: data.data.exam.id } })
    }
  } catch (error) {
    message.value = firstApiMessage(error, t('requestFailed'))
  } finally {
    saving.value = false
  }
}

async function saveSections() {
  sectionMessage.value = ''
  if (rows.value.length === 0) {
    sectionMessage.value = t('fullMockNoSections')
    return
  }
  if (rows.value.some((row) => !row[sourceField(row.skill)])) {
    sectionMessage.value = t('fullMockSourceMissing')
    return
  }

  const sections = rows.value.map((row) => {
    const minutes = Number(row.duration_minutes)
    const field = sourceField(row.skill)
    return {
      id: row.id || undefined,
      skill: row.skill,
      title: row.title.trim() || skillLabel(row.skill),
      duration_seconds: minutes > 0 ? Math.max(60, Math.round(minutes * 60)) : null,
      instructions: row.instructions.trim() || null,
      [field]: row[field],
    }
  })

  savingSections.value = true
  try {
    const { data } = await http.put(`/admin/full-mocks/${route.params.id}/sections`, { sections }, { skipErrorToast: true, skipSuccessToast: true })
    applyShow(data.data)
    ui.success(t('fullMockSectionsSaved'))
  } catch (error) {
    sectionMessage.value = firstApiMessage(error, t('requestFailed'))
  } finally {
    savingSections.value = false
  }
}

async function togglePublished(event) {
  const value = event.target.checked
  publishing.value = true
  message.value = ''
  try {
    const { data } = await http.put(`/admin/full-mocks/${route.params.id}/publication`, { is_published: value }, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    form.value.is_published = !!data.data.exam.is_published
    warnings.value = data.data.warnings || []
    ui.success(value ? t('published') : t('unpublished'))
  } catch (error) {
    event.target.checked = !value
    form.value.is_published = !value
    message.value = firstApiMessage(error, t('requestFailed'))
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero
      :title="isEdit ? t('editFullMock') : t('newFullMock')"
      :lead="t('fullMockFormLead')"
    >
      <template #actions>
        <RouterLink
          :to="{ name: 'admin-full-mocks' }"
          class="admin-ui__btn admin-ui__btn--ghost admin-ui__btn--block admin-ui__btn--block-sm"
        >
          <v-icon size="18">mdi-arrow-left</v-icon>
          {{ t('backToFullMocksAdmin') }}
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

    <template v-else>
      <section class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <div>
            <h2>{{ isEdit ? t('editFullMock') : t('newFullMock') }}</h2>
            <p>{{ t('fullMockFormLead') }}</p>
          </div>
        </div>

        <form class="fm-form" @submit.prevent="save">
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
          </div>

          <label class="admin-ui__field">
            <span>{{ t('instructions') }}</span>
            <textarea v-model="form.instructions" rows="3" />
          </label>

          <div class="fm-form__switches">
            <label class="admin-ui__switch">
              <input v-model="form.is_free" type="checkbox">
              {{ t('fullMockIsFree') }}
            </label>
            <label class="admin-ui__switch">
              <input v-model="form.allow_resume" type="checkbox">
              {{ t('fullMockAllowResume') }}
            </label>
            <label v-if="isEdit" class="admin-ui__switch">
              <input
                type="checkbox"
                :checked="form.is_published"
                :disabled="publishing"
                @change="togglePublished"
              >
              {{ form.is_published ? t('published') : t('unpublished') }}
            </label>
          </div>

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

      <section class="admin-ui__panel">
        <div class="admin-ui__panel-head">
          <div>
            <h2>{{ t('fullMockSections') }}</h2>
            <p>{{ isEdit ? t('fullMockSectionsCount', { count: rows.length }) : t('fullMockSaveFirst') }}</p>
          </div>
        </div>

        <template v-if="isEdit">
          <v-alert v-if="warnings.length" type="warning" variant="tonal" class="mb-3">
            <strong>{{ t('fullMockWarnings') }}</strong>
            <ul class="fm-form__warnings">
              <li v-for="(warning, i) in warnings" :key="i">{{ warning }}</li>
            </ul>
          </v-alert>
          <v-alert v-if="sectionMessage" type="error" variant="tonal" class="mb-3">{{ sectionMessage }}</v-alert>

          <div v-if="rows.length === 0" class="admin-ui__empty">
            <p>{{ t('fullMockNoSections') }}</p>
          </div>

          <div class="admin-ui__list">
            <article v-for="(row, index) in rows" :key="row.key" class="admin-ui__row fm-row">
              <div class="fm-row__head">
                <span class="admin-ui__avatar" aria-hidden="true">{{ index + 1 }}</span>
                <div class="fm-row__tools">
                  <button
                    type="button"
                    class="admin-ui__icon-btn"
                    :disabled="index === 0"
                    :aria-label="t('moveUp')"
                    @click="moveRow(index, -1)"
                  >
                    <v-icon size="18">mdi-arrow-up</v-icon>
                  </button>
                  <button
                    type="button"
                    class="admin-ui__icon-btn"
                    :disabled="index === rows.length - 1"
                    :aria-label="t('moveDown')"
                    @click="moveRow(index, 1)"
                  >
                    <v-icon size="18">mdi-arrow-down</v-icon>
                  </button>
                  <button
                    type="button"
                    class="admin-ui__icon-btn admin-ui__icon-btn--danger"
                    :aria-label="t('remove')"
                    @click="removeRow(index)"
                  >
                    <v-icon size="18">mdi-delete-outline</v-icon>
                  </button>
                </div>
              </div>

              <div class="admin-ui__form-grid admin-ui__form-grid--2 fm-row__grid">
                <label class="admin-ui__field">
                  <span>{{ t('fullMockSkill') }}</span>
                  <select v-model="row.skill" @change="onSkillChange(row)">
                    <option v-for="skill in SKILLS" :key="skill" :value="skill">{{ skillLabel(skill) }}</option>
                  </select>
                </label>
                <label class="admin-ui__field">
                  <span>{{ t('fullMockSectionTitle') }}</span>
                  <input v-model="row.title" type="text" maxlength="200">
                </label>

                <label class="admin-ui__field">
                  <span>{{ t('fullMockSearchSource') }}</span>
                  <input
                    v-model="row.search"
                    type="search"
                    :placeholder="t('search')"
                    @keydown.enter.prevent="loadOptions(row)"
                    @change="loadOptions(row)"
                  >
                </label>
                <label class="admin-ui__field">
                  <span>{{ t('fullMockSource') }}</span>
                  <select v-model.number="row[sourceField(row.skill)]" :disabled="row.optionsLoading" @change="onSourceChange(row)">
                    <option :value="null">{{ row.optionsLoading ? t('loading') : t('fullMockPickSource') }}</option>
                    <option v-for="item in optionsFor(row)" :key="item.id" :value="item.id">{{ optionLabel(item) }}</option>
                  </select>
                  <small v-if="row.optionsError" class="admin-ui__field-error">{{ row.optionsError }}</small>
                </label>

                <label class="admin-ui__field">
                  <span>{{ t('fullMockSectionDuration') }}</span>
                  <input v-model.number="row.duration_minutes" type="number" min="1" max="360">
                </label>
                <label class="admin-ui__field">
                  <span>{{ t('fullMockSectionInstructions') }}</span>
                  <input v-model="row.instructions" type="text">
                </label>
              </div>
            </article>
          </div>

          <div class="admin-ui__form-actions">
            <button type="button" class="admin-ui__btn admin-ui__btn--soft admin-ui__btn--block admin-ui__btn--block-sm" @click="addRow">
              <v-icon size="18">mdi-plus</v-icon>
              {{ t('fullMockAddSection') }}
            </button>
            <button
              type="button"
              class="admin-ui__btn admin-ui__btn--solid admin-ui__btn--block admin-ui__btn--block-sm"
              :disabled="savingSections"
              @click="saveSections"
            >
              {{ t('fullMockSaveSections') }}
            </button>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
.fm-form {
  display: grid;
  gap: 1rem;
}

.fm-form__switches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.25rem;
}

.fm-form__warnings {
  margin: 0.35rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.85rem;
}

.fm-row {
  flex-direction: column !important;
  align-items: stretch !important;
  gap: 0.75rem;
  padding: 0.85rem;
}

.fm-row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.fm-row__tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.fm-row__grid {
  width: 100%;
}
</style>
