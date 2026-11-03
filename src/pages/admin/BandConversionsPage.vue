<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const moduleName = ref('reading')
const examType = ref('academic')
const rows = ref([{ raw_score: '', band_score: '' }])
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const success = ref('')

const examTypes = computed(() => [
  { title: t('academic'), value: 'academic' },
  { title: t('general'), value: 'general' },
])
const modules = computed(() => [
  { title: t('reading'), value: 'reading' },
  { title: t('listening'), value: 'listening' },
])

onMounted(load)
watch([moduleName, examType], load)

async function load() {
  loading.value = true
  message.value = ''
  success.value = ''
  try {
    const { data } = await http.get('/admin/band-conversions', {
      params: { module: moduleName.value, exam_type: examType.value },
      skipErrorToast: true,
    })
    rows.value = (data.data.rows || []).map((row) => ({
      raw_score: row.raw_score,
      band_score: row.band_score,
    }))
    if (rows.value.length === 0) {
      rows.value = [{ raw_score: '', band_score: '' }]
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function addRow() {
  rows.value.push({ raw_score: '', band_score: '' })
}

function removeRow(index) {
  rows.value.splice(index, 1)
  if (rows.value.length === 0) rows.value = [{ raw_score: '', band_score: '' }]
}

async function save() {
  saving.value = true
  message.value = ''
  success.value = ''
  try {
    const payloadRows = rows.value
      .filter((row) => row.raw_score !== '' && row.band_score !== '')
      .map((row) => ({
        raw_score: Number(row.raw_score),
        band_score: Number(row.band_score),
      }))
    const { data } = await http.put('/admin/band-conversions', {
      module: moduleName.value,
      exam_type: examType.value,
      rows: payloadRows,
    }, { skipErrorToast: true })
    rows.value = data.data.rows.map((row) => ({
      raw_score: row.raw_score,
      band_score: row.band_score,
    }))
    if (rows.value.length === 0) rows.value = [{ raw_score: '', band_score: '' }]
    success.value = t('bandTableSaved')
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('bandConversions')" :lead="t('bandConversionsHelp')">
      <template #actions>
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

    <section class="admin-ui__panel">
      <div class="admin-ui__filters admin-ui__filters--3">
        <label class="admin-ui__field">
          <span>{{ t('module') }}</span>
          <select v-model="moduleName">
            <option v-for="item in modules" :key="item.value" :value="item.value">{{ item.title }}</option>
          </select>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('examType') }}</span>
          <select v-model="examType">
            <option v-for="item in examTypes" :key="item.value" :value="item.value">{{ item.title }}</option>
          </select>
        </label>
      </div>
    </section>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('bandConversions') }}</h2>
          <p>{{ t('reportTotal', { count: rows.length }) }}</p>
        </div>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" :disabled="loading" @click="addRow">
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('addRow') }}
        </button>
      </div>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <template v-else>
        <v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
        <v-alert v-if="success" type="success" variant="tonal" class="mb-4">{{ success }}</v-alert>
        <div class="admin-ui__list">
          <article v-for="(row, index) in rows" :key="index" class="admin-ui__row">
            <div class="admin-ui__row-main">
              <div class="admin-ui__form-grid admin-ui__form-grid--2" style="flex: 1; min-width: 0">
                <label class="admin-ui__field">
                  <span>{{ t('rawScore') }}</span>
                  <input v-model="row.raw_score" type="number">
                </label>
                <label class="admin-ui__field">
                  <span>{{ t('bandScore') }}</span>
                  <input v-model="row.band_score" type="number" step="0.5">
                </label>
              </div>
            </div>
            <div class="admin-ui__row-actions">
              <button
                type="button"
                class="admin-ui__icon-btn admin-ui__icon-btn--danger"
                :aria-label="t('delete')"
                @click="removeRow(index)"
              >
                <v-icon size="18">mdi-delete</v-icon>
              </button>
            </div>
          </article>
        </div>
        <div class="admin-ui__form-actions">
          <button
            type="button"
            class="admin-ui__btn admin-ui__btn--solid admin-ui__btn--block admin-ui__btn--block-sm"
            :disabled="saving"
            @click="save"
          >
            {{ t('save') }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>
