<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const auth = useAuthStore()

const reportTypes = ref([])
const courses = ref([])
const report = ref(null)
const dateFrom = ref('')
const dateTo = ref('')
const courseId = ref('')
const studentId = ref('')
const columns = ref([])
const rows = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const loading = ref(true)
const loadingReport = ref(false)
const exporting = ref(false)
const message = ref('')

const reportIcons = {
  student_registration: 'mdi-account-plus-outline',
  course_sales: 'mdi-cart-outline',
  revenue: 'mdi-cash-multiple',
  enrollment: 'mdi-account-check-outline',
  payment_status: 'mdi-credit-card-outline',
  course_completion: 'mdi-progress-check',
  reading_performance: 'mdi-book-open-page-variant-outline',
  listening_performance: 'mdi-headphones',
  writing_evaluation: 'mdi-pencil-outline',
  speaking_evaluation: 'mdi-microphone-outline',
}

const selectedReport = computed(() => reportTypes.value.find((item) => item.key === report.value) || null)

const courseItems = computed(() => [
  { title: t('allCourses'), value: '' },
  ...courses.value.map((item) => ({
    title: item.title,
    value: String(item.id),
  })),
])

const teacherScoped = computed(
  () => auth.hasPermission('progress.view_assigned') && !auth.hasPermission('reports.view'),
)

const previewColumns = computed(() => columns.value.slice(0, 2))
const detailColumns = computed(() => columns.value.slice(2))

onMounted(loadCatalog)
watch(report, () => {
  page.value = 1
  if (report.value) loadReport()
})

async function loadCatalog() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/reports', { skipErrorToast: true })
    reportTypes.value = data.data || []
    courses.value = data.meta?.courses || []
    if (!report.value && reportTypes.value[0]) {
      report.value = reportTypes.value[0].key
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function params() {
  return {
    page: page.value,
    date_from: dateFrom.value || undefined,
    date_to: dateTo.value || undefined,
    course_id: courseId.value ? Number(courseId.value) : undefined,
    student_id: studentId.value ? Number(studentId.value) : undefined,
  }
}

async function loadReport() {
  if (!report.value) return
  loadingReport.value = true
  message.value = ''
  try {
    const { data } = await http.get(`/reports/${report.value}`, {
      params: params(),
      skipErrorToast: true,
    })
    columns.value = data.data?.columns || []
    rows.value = data.data?.rows || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
    columns.value = []
    rows.value = []
  } finally {
    loadingReport.value = false
  }
}

function applyFilters() {
  page.value = 1
  loadReport()
}

function clearFilters() {
  dateFrom.value = ''
  dateTo.value = ''
  courseId.value = ''
  studentId.value = ''
  page.value = 1
  loadReport()
}

function selectReport(key) {
  if (report.value === key) return
  report.value = key
}

async function exportCsv() {
  if (!report.value) return
  exporting.value = true
  message.value = ''
  try {
    const response = await http.get(`/reports/${report.value}/export`, {
      params: {
        date_from: dateFrom.value || undefined,
        date_to: dateTo.value || undefined,
        course_id: courseId.value ? Number(courseId.value) : undefined,
        student_id: studentId.value ? Number(studentId.value) : undefined,
      },
      responseType: 'blob',
      skipErrorToast: true,
    })
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${report.value}.csv`
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    exporting.value = false
  }
}

function cellValue(row, key) {
  const value = row[key]
  return value == null || value === '' ? '—' : value
}

function reportIcon(key) {
  return reportIcons[key] || 'mdi-chart-box-outline'
}
</script>

<template>
  <div class="admin-ui reports">
    <AdminPageHero :title="t('reports')" :lead="t('reportsLead')">
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          :disabled="!report || exporting || loadingReport"
          @click="exportCsv"
        >
          <v-icon size="18">mdi-download</v-icon>
          <span>{{ exporting ? t('exporting') : t('exportCsv') }}</span>
        </button>
      </template>
    </AdminPageHero>

    <div v-if="loading" class="reports__loading">
      <v-progress-circular indeterminate color="#0f5c66" size="42" />
    </div>

    <template v-else>
      <v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>

      <section class="reports__types" aria-label="Report types">
        <div class="reports__types-head">
          <h2>{{ t('reportType') }}</h2>
          <p v-if="teacherScoped">{{ t('teacherReportScope') }}</p>
        </div>
        <div class="reports__type-scroller">
          <button
            v-for="item in reportTypes"
            :key="item.key"
            type="button"
            class="reports__type"
            :class="{ 'is-active': report === item.key }"
            @click="selectReport(item.key)"
          >
            <span class="reports__type-icon" aria-hidden="true">
              <v-icon size="20">{{ reportIcon(item.key) }}</v-icon>
            </span>
            <span class="reports__type-label">{{ item.label }}</span>
          </button>
        </div>
      </section>

      <section class="reports__filters">
        <div class="reports__filters-head">
          <div>
            <h2>{{ t('filters') }}</h2>
            <p>{{ selectedReport?.label || t('reportType') }}</p>
          </div>
          <button type="button" class="reports__text-btn" @click="clearFilters">
            {{ t('clearFilters') }}
          </button>
        </div>

        <div class="reports__filter-grid">
          <label class="reports__field">
            <span>{{ t('dateFrom') }}</span>
            <input v-model="dateFrom" type="date">
          </label>
          <label class="reports__field">
            <span>{{ t('dateTo') }}</span>
            <input v-model="dateTo" type="date">
          </label>
          <label class="reports__field">
            <span>{{ t('course') }}</span>
            <select v-model="courseId">
              <option
                v-for="item in courseItems"
                :key="String(item.value)"
                :value="item.value"
              >
                {{ item.title }}
              </option>
            </select>
          </label>
          <label class="reports__field">
            <span>{{ t('studentId') }}</span>
            <input v-model="studentId" type="number" min="1" :placeholder="t('optional')">
          </label>
        </div>

        <div class="reports__filter-actions">
          <button type="button" class="reports__primary" :disabled="loadingReport" @click="applyFilters">
            <v-icon size="18">mdi-filter-variant</v-icon>
            {{ t('filter') }}
          </button>
        </div>
      </section>

      <section class="reports__results">
        <div class="reports__results-head">
          <div>
            <h2>{{ selectedReport?.label || t('reports') }}</h2>
            <p v-if="meta.total != null">
              {{ t('reportTotal', { count: meta.total }) }}
              <span v-if="teacherScoped"> · {{ t('teacherReportScope') }}</span>
            </p>
          </div>
        </div>

        <div v-if="loadingReport" class="reports__loading reports__loading--panel">
          <v-progress-circular indeterminate color="#0f5c66" size="36" />
        </div>

        <div v-else-if="rows.length === 0" class="reports__empty">
          <v-icon size="36" color="#0f5c66">mdi-file-search-outline</v-icon>
          <p>{{ t('noReportRows') }}</p>
        </div>

        <template v-else>
          <div class="reports__table-wrap" aria-hidden="false">
            <table class="reports__table">
              <thead>
                <tr>
                  <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in rows" :key="row.id || index">
                  <td v-for="column in columns" :key="column.key">{{ cellValue(row, column.key) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="reports__cards">
            <article
              v-for="(row, index) in rows"
              :key="`card-${row.id || index}`"
              class="reports__card"
            >
              <header class="reports__card-head">
                <div v-for="column in previewColumns" :key="`preview-${column.key}`">
                  <span>{{ column.label }}</span>
                  <strong>{{ cellValue(row, column.key) }}</strong>
                </div>
              </header>
              <dl v-if="detailColumns.length" class="reports__card-details">
                <div v-for="column in detailColumns" :key="`detail-${column.key}`">
                  <dt>{{ column.label }}</dt>
                  <dd>{{ cellValue(row, column.key) }}</dd>
                </div>
              </dl>
            </article>
          </div>

          <div v-if="meta.last_page > 1" class="reports__pager">
            <button
              type="button"
              class="admin-ui__btn admin-ui__btn--ghost"
              :disabled="page <= 1 || loadingReport"
              @click="page -= 1; loadReport()"
            >
              {{ t('previous') }}
            </button>
            <span>{{ page }} / {{ meta.last_page }} · {{ meta.total }}</span>
            <button
              type="button"
              class="admin-ui__btn admin-ui__btn--ghost"
              :disabled="page >= meta.last_page || loadingReport"
              @click="page += 1; loadReport()"
            >
              {{ t('next') }}
            </button>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
.reports {
  --teal: #0f5c66;
  --teal-soft: #e7f4f5;
  --ink: #102a2e;
  --muted: #5b7378;
  --line: #d9e6e8;
  --paper: #f4f8f9;
  color: var(--ink);
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.reports__hero {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1.15rem 1.2rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at 100% 0%, rgba(245, 197, 24, 0.16), transparent 42%),
    linear-gradient(135deg, #0f5c66 0%, #14919b 55%, #0a3d44 100%);
  color: #f7fbfb;
  box-shadow: 0 16px 40px rgba(15, 92, 102, 0.2);
}

@media (min-width: 720px) {
  .reports__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.reports__eyebrow {
  margin: 0 0 0.3rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.8;
}

.reports__hero h1 {
  margin: 0;
  font-size: clamp(1.35rem, 4vw, 1.7rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.reports__hero-copy p:last-child {
  margin: 0.35rem 0 0;
  opacity: 0.88;
  font-size: 0.92rem;
  line-height: 1.45;
  max-width: 42ch;
}

.reports__export,
.reports__primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 2.75rem;
  padding: 0 1rem;
  border: 0;
  border-radius: 0.7rem;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform 160ms ease, opacity 160ms ease, background 160ms ease;
}

.reports__export {
  width: 100%;
  background: #f5c518;
  color: #1a1400;
}

@media (min-width: 720px) {
  .reports__export {
    width: auto;
  }
}

.reports__export:hover:not(:disabled),
.reports__primary:hover:not(:disabled) {
  transform: translateY(-1px);
}

.reports__export:disabled,
.reports__primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.reports__primary {
  width: 100%;
  background: var(--teal);
  color: #fff;
}

@media (min-width: 640px) {
  .reports__primary {
    width: auto;
    min-width: 9rem;
  }
}

.reports__loading {
  display: grid;
  place-items: center;
  min-height: 220px;
}

.reports__loading--panel {
  min-height: 160px;
}

.reports__types,
.reports__filters,
.reports__results {
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 1rem;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 10px 28px rgba(16, 42, 46, 0.04);
}

.reports__types-head,
.reports__filters-head,
.reports__results-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
  margin-bottom: 0.85rem;
}

.reports__types-head h2,
.reports__filters-head h2,
.reports__results-head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.reports__types-head p,
.reports__filters-head p,
.reports__results-head p {
  margin: 0.2rem 0 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.reports__text-btn {
  border: 0;
  background: transparent;
  color: var(--teal);
  font: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
  min-height: 2.5rem;
  padding: 0 0.25rem;
}

.reports__type-scroller {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(148px, 170px);
  gap: 0.65rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

@media (min-width: 960px) {
  .reports__type-scroller {
    grid-auto-flow: dense;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    grid-auto-columns: unset;
    overflow: visible;
  }
}

.reports__type {
  scroll-snap-align: start;
  display: grid;
  gap: 0.55rem;
  min-height: 5.5rem;
  padding: 0.85rem;
  border-radius: 0.85rem;
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink);
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.reports__type:hover {
  transform: translateY(-1px);
  border-color: rgba(15, 92, 102, 0.35);
}

.reports__type.is-active {
  background: var(--teal-soft);
  border-color: var(--teal);
  box-shadow: inset 0 0 0 1px rgba(15, 92, 102, 0.18);
}

.reports__type-icon {
  display: grid;
  place-items: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 0.65rem;
  background: #fff;
  color: var(--teal);
}

.reports__type.is-active .reports__type-icon {
  background: var(--teal);
  color: #fff;
}

.reports__type-label {
  font-size: 0.86rem;
  font-weight: 750;
  line-height: 1.3;
}

.reports__filter-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .reports__filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .reports__filter-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.reports__field {
  display: grid;
  gap: 0.35rem;
}

.reports__field span {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.reports__field input,
.reports__field select {
  width: 100%;
  min-height: 2.75rem;
  padding: 0 0.8rem;
  border: 1px solid var(--line);
  border-radius: 0.7rem;
  background: #fff;
  color: var(--ink);
  font: inherit;
}

.reports__field input:focus,
.reports__field select:focus {
  outline: 2px solid rgba(15, 92, 102, 0.25);
  border-color: var(--teal);
}

.reports__filter-actions {
  margin-top: 0.9rem;
}

.reports__empty {
  display: grid;
  place-items: center;
  gap: 0.55rem;
  min-height: 160px;
  padding: 1.5rem 1rem;
  text-align: center;
  color: var(--muted);
  background: var(--paper);
  border-radius: 0.85rem;
}

.reports__empty p {
  margin: 0;
  font-size: 0.95rem;
}

.reports__table-wrap {
  display: none;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 0.85rem;
  -webkit-overflow-scrolling: touch;
}

.reports__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 640px;
}

.reports__table th,
.reports__table td {
  padding: 0.8rem 0.9rem;
  text-align: left;
  border-bottom: 1px solid var(--line);
  font-size: 0.9rem;
  white-space: nowrap;
}

.reports__table th {
  background: var(--paper);
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 750;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  position: sticky;
  top: 0;
}

.reports__table tbody tr:hover {
  background: rgba(15, 92, 102, 0.04);
}

.reports__table tbody tr:last-child td {
  border-bottom: 0;
}

.reports__cards {
  display: grid;
  gap: 0.75rem;
}

.reports__card {
  padding: 0.9rem;
  border-radius: 0.85rem;
  background: var(--paper);
  border: 1px solid var(--line);
}

.reports__card-head {
  display: grid;
  gap: 0.65rem;
}

.reports__card-head span {
  display: block;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.reports__card-head strong {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.95rem;
  font-weight: 780;
  word-break: break-word;
}

.reports__card-details {
  display: grid;
  gap: 0.55rem;
  margin: 0.85rem 0 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--line);
}

.reports__card-details > div {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 0.5rem;
  align-items: start;
}

.reports__card-details dt {
  margin: 0;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.reports__card-details dd {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 650;
  word-break: break-word;
  text-align: right;
}

.reports__pager {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
  overflow-x: auto;
}

@media (min-width: 900px) {
  .reports__table-wrap {
    display: block;
  }

  .reports__cards {
    display: none;
  }
}
</style>
