<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { useLocaleStore } from '../../stores/locale'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const localeStore = useLocaleStore()

const logs = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const action = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const loading = ref(true)
const message = ref('')

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/activity-logs', {
      params: {
        page: page.value,
        action: action.value.trim() || undefined,
        date_from: dateFrom.value || undefined,
        date_to: dateTo.value || undefined,
      },
      skipErrorToast: true,
    })
    logs.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  page.value = 1
  load()
}

function clearFilter() {
  action.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
  load()
}

function formatWhen(value) {
  if (!value) return '—'
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function subjectLabel(row) {
  if (!row?.subject_type && !row?.subject_id) return '—'
  const type = String(row.subject_type || '')
    .split('\\')
    .pop()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
  if (!row.subject_id) return type || '—'
  return `${type || t('subject')} #${row.subject_id}`
}

function userInitial(name) {
  return String(name || '?').charAt(0).toUpperCase()
}

function actionTone(actionName) {
  const value = String(actionName || '').toLowerCase()
  if (value.includes('delete') || value.includes('remove') || value.includes('fail')) return 'danger'
  if (value.includes('create') || value.includes('store') || value.includes('updated') || value.includes('confirm')) return 'ok'
  if (value.includes('warning') || value.includes('cancel') || value.includes('refund')) return 'warn'
  return ''
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('activityLogs')" :lead="t('activityLogsLead')" />

    <section class="admin-ui__panel">
      <form @submit.prevent="applyFilter">
        <div class="admin-ui__filters admin-ui__filters--3">
          <label class="admin-ui__field">
            <span>{{ t('actionFilter') }}</span>
            <input v-model="action" type="search" :placeholder="t('actionFilterHint')">
          </label>
          <label class="admin-ui__field">
            <span>{{ t('dateFrom') }}</span>
            <input v-model="dateFrom" type="date">
          </label>
          <label class="admin-ui__field">
            <span>{{ t('dateTo') }}</span>
            <input v-model="dateTo" type="date">
          </label>
        </div>
        <div class="admin-ui__filter-actions">
          <button type="submit" class="admin-ui__btn admin-ui__btn--solid">{{ t('filter') }}</button>
          <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="clearFilter">{{ t('clearFilters') }}</button>
        </div>
      </form>
    </section>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('activityLogs') }}</h2>
          <p>{{ t('reportTotal', { count: meta.total || logs.length }) }}</p>
        </div>
      </div>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="!logs.length" class="admin-ui__empty">
        <p>{{ t('noActivityLogs') }}</p>
      </div>
      <template v-else>
        <div class="admin-ui__table-wrap activity-logs__table-wrap">
          <table class="admin-ui__table activity-logs__table">
            <thead>
              <tr>
                <th>{{ t('id') }}</th>
                <th>{{ t('when') }}</th>
                <th>{{ t('actionFilter') }}</th>
                <th>{{ t('description') }}</th>
                <th>{{ t('user') }}</th>
                <th>{{ t('subject') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in logs" :key="row.id">
                <td class="activity-logs__id">#{{ row.id }}</td>
                <td>{{ formatWhen(row.created_at) }}</td>
                <td>
                  <span
                    class="admin-ui__chip"
                    :class="{
                      'admin-ui__chip--ok': actionTone(row.action) === 'ok',
                      'admin-ui__chip--warn': actionTone(row.action) === 'warn',
                      'admin-ui__chip--danger': actionTone(row.action) === 'danger',
                    }"
                  >
                    {{ row.action }}
                  </span>
                </td>
                <td class="activity-logs__desc">{{ row.description || '—' }}</td>
                <td>
                  <div class="activity-logs__user">
                    <strong>{{ row.user?.name || '—' }}</strong>
                    <small v-if="row.user?.email">{{ row.user.email }}</small>
                  </div>
                </td>
                <td>{{ subjectLabel(row) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-ui__list activity-logs__mobile">
          <article v-for="row in logs" :key="`m-${row.id}`" class="admin-ui__row activity-logs__card">
            <div class="admin-ui__row-main">
              <div class="admin-ui__avatar" aria-hidden="true">{{ userInitial(row.user?.name) }}</div>
              <div class="activity-logs__card-body">
                <div class="activity-logs__card-top">
                  <span
                    class="admin-ui__chip"
                    :class="{
                      'admin-ui__chip--ok': actionTone(row.action) === 'ok',
                      'admin-ui__chip--warn': actionTone(row.action) === 'warn',
                      'admin-ui__chip--danger': actionTone(row.action) === 'danger',
                    }"
                  >
                    {{ row.action }}
                  </span>
                  <span class="activity-logs__id-tag">#{{ row.id }}</span>
                </div>
                <h3 class="admin-ui__row-title">{{ row.description || row.action }}</h3>
                <dl class="activity-logs__meta-grid">
                  <div>
                    <dt>{{ t('when') }}</dt>
                    <dd>{{ formatWhen(row.created_at) }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('user') }}</dt>
                    <dd>
                      {{ row.user?.name || '—' }}
                      <template v-if="row.user?.email">
                        <br>
                        <span class="activity-logs__email">{{ row.user.email }}</span>
                      </template>
                    </dd>
                  </div>
                  <div>
                    <dt>{{ t('subject') }}</dt>
                    <dd>{{ subjectLabel(row) }}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </article>
        </div>
      </template>

      <div v-if="meta.last_page > 1" class="admin-ui__pager">
        <v-pagination
          v-model="page"
          :length="meta.last_page"
          active-color="#0f5c66"
          total-visible="5"
          density="comfortable"
          @update:model-value="load"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.activity-logs__table {
  min-width: 920px;
}

.activity-logs__table th,
.activity-logs__table td {
  white-space: normal;
  vertical-align: top;
}

.activity-logs__id {
  color: var(--admin-muted);
  font-weight: 700;
  white-space: nowrap;
}

.activity-logs__desc {
  min-width: 14rem;
  max-width: 28rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.activity-logs__user {
  display: grid;
  gap: 0.15rem;
  min-width: 10rem;
}

.activity-logs__user strong {
  font-weight: 750;
}

.activity-logs__user small,
.activity-logs__email {
  color: var(--admin-muted);
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.activity-logs__mobile {
  display: grid;
}

.activity-logs__table-wrap {
  display: none;
}

.activity-logs__card-body {
  min-width: 0;
  flex: 1;
}

.activity-logs__card-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  margin-bottom: 0.35rem;
}

.activity-logs__id-tag {
  color: var(--admin-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.activity-logs__meta-grid {
  display: grid;
  gap: 0.55rem;
  margin: 0.65rem 0 0;
}

.activity-logs__meta-grid > div {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.activity-logs__meta-grid dt {
  color: var(--admin-muted);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.activity-logs__meta-grid dd {
  margin: 0;
  color: var(--admin-ink);
  font-size: 0.88rem;
  font-weight: 650;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

@media (min-width: 900px) {
  .activity-logs__table-wrap {
    display: block;
  }

  .activity-logs__mobile {
    display: none;
  }
}
</style>
