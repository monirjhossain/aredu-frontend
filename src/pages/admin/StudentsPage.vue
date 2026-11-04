<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { useLocaleStore } from '../../stores/locale'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const localeStore = useLocaleStore()
const router = useRouter()

const students = ref([])
const meta = ref({ current_page: 1, last_page: 1, per_page: 20, total: 0 })
const loading = ref(true)
const message = ref('')
const page = ref(1)
const search = ref('')

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/admin/students', {
      params: {
        page: page.value,
        search: search.value || undefined,
      },
      skipErrorToast: true,
    })
    students.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function applySearch() {
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

function openStudent(student) {
  router.push({ name: 'admin-student-detail', params: { id: student.id } })
}

function when(value) {
  if (!value) return '—'
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function initial(name) {
  return (name || '?').charAt(0).toUpperCase()
}

onMounted(load)
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('manageStudents')" :lead="t('studentsLead')" />

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('manageStudents') }}</h2>
          <p>{{ t('studentsListCount', { count: meta.total || students.length }) }}</p>
        </div>
      </div>

      <form class="admin-students__filters" @submit.prevent="applySearch">
        <input
          v-model="search"
          class="admin-students__search"
          type="search"
          :placeholder="t('searchStudents')"
          :aria-label="t('search')"
        >
        <button type="submit" class="admin-ui__btn admin-ui__btn--solid">
          {{ t('search') }}
        </button>
      </form>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="students.length === 0" class="admin-ui__empty">
        <p>{{ t('noStudents') }}</p>
      </div>

      <template v-else>
        <div class="admin-ui__table-wrap admin-students__table-wrap">
          <table class="admin-ui__table">
            <thead>
              <tr>
                <th>{{ t('student') }}</th>
                <th>{{ t('phone') }}</th>
                <th>{{ t('orders') }}</th>
                <th>{{ t('activeEnrollments') }}</th>
                <th>{{ t('joined') }}</th>
                <th>{{ t('actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="student in students" :key="student.id">
                <td>
                  <div class="admin-students__identity">
                    <div class="admin-ui__avatar" aria-hidden="true">{{ initial(student.name) }}</div>
                    <div>
                      <div class="admin-students__name">{{ student.name }}</div>
                      <div class="admin-students__meta">{{ student.email }}</div>
                    </div>
                  </div>
                </td>
                <td>{{ student.phone || '—' }}</td>
                <td>{{ student.orders_count }}</td>
                <td>{{ student.active_enrollments_count }}</td>
                <td>{{ when(student.created_at) }}</td>
                <td>
                  <button
                    type="button"
                    class="admin-ui__btn admin-ui__btn--soft"
                    @click="openStudent(student)"
                  >
                    {{ t('viewDetails') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-ui__list admin-students__cards">
          <article v-for="student in students" :key="`m-${student.id}`" class="admin-ui__row">
            <div class="admin-ui__row-main">
              <div class="admin-ui__avatar" aria-hidden="true">{{ initial(student.name) }}</div>
              <div>
                <h3 class="admin-ui__row-title">{{ student.name }}</h3>
                <p class="admin-ui__row-meta">{{ student.email }}</p>
                <p class="admin-ui__row-meta">
                  {{ student.phone || '—' }} · {{ t('orders') }} {{ student.orders_count }} ·
                  {{ t('activeEnrollments') }} {{ student.active_enrollments_count }}
                </p>
              </div>
            </div>
            <div class="admin-ui__row-actions">
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--soft"
                @click="openStudent(student)"
              >
                {{ t('viewDetails') }}
              </button>
            </div>
          </article>
        </div>
      </template>

      <div v-if="meta.last_page > 1" class="admin-students__pager">
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost"
          :disabled="page <= 1 || loading"
          @click="goPage(page - 1)"
        >
          {{ t('previous') }}
        </button>
        <span>{{ page }} / {{ meta.last_page }} · {{ meta.total }}</span>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost"
          :disabled="page >= meta.last_page || loading"
          @click="goPage(page + 1)"
        >
          {{ t('next') }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-students__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-bottom: 1rem;
}

.admin-students__search {
  flex: 1 1 14rem;
  min-height: 2.5rem;
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.55rem;
  background: #fff;
  font: inherit;
}

.admin-students__table-wrap {
  display: none;
}

.admin-students__cards {
  display: grid;
}

.admin-students__identity {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.admin-students__name {
  font-weight: 750;
  color: var(--admin-ink);
}

.admin-students__meta {
  margin-top: 0.15rem;
  color: var(--admin-muted);
  font-size: 0.8rem;
  word-break: break-word;
}

.admin-students__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

@media (min-width: 900px) {
  .admin-students__table-wrap {
    display: block;
  }

  .admin-students__cards {
    display: none;
  }
}
</style>
