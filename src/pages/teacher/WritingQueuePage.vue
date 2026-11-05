<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const router = useRouter()

const items = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const search = ref('')
const evaluationStatus = ref('pending')
const contextFilter = ref('all')
const loading = ref(true)
const message = ref('')

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/teacher/writing-submissions', {
      params: {
        page: page.value,
        search: search.value || undefined,
        evaluation_status: evaluationStatus.value || undefined,
        context: contextFilter.value && contextFilter.value !== 'all' ? contextFilter.value : undefined,
      },
      skipErrorToast: true,
    })
    items.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

function taskTypeLabel(value) {
  if (value === 'academic_task_1') return t('writingTaskAcademic1')
  if (value === 'general_task_1') return t('writingTaskGeneral1')
  if (value === 'task_2') return t('writingTask2')
  return value || '—'
}

function contextLabel(item) {
  return item?.context_label === 'full_mock' ? t('contextFullMock') : t('contextPractice')
}

function openEvaluate(item) {
  router.push({ name: 'teacher-writing-evaluate', params: { id: item.id } })
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero
      :title="t('teacherWritingQueue')"
      :lead="t('teacherWritingQueueLead')"
      :eyebrow="t('teacherTools')"
    />

    <section class="admin-ui__panel">
      <div class="admin-ui__filters admin-ui__filters--3">
        <label class="admin-ui__field">
          <span>{{ t('search') }}</span>
          <input v-model="search" type="search" @keyup.enter="applyFilters">
        </label>
        <label class="admin-ui__field">
          <span>{{ t('evaluationStatus') }}</span>
          <select v-model="evaluationStatus">
            <option value="">{{ t('contextAll') }}</option>
            <option value="pending">{{ t('evaluationPending') }}</option>
            <option value="evaluated">{{ t('evaluationReturned') }}</option>
          </select>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('contextFilter') }}</span>
          <select v-model="contextFilter">
            <option value="all">{{ t('contextAll') }}</option>
            <option value="practice">{{ t('contextPractice') }}</option>
            <option value="full_mock">{{ t('contextFullMock') }}</option>
          </select>
        </label>
      </div>
      <div class="admin-ui__form-actions">
        <button type="button" class="admin-ui__btn admin-ui__btn--solid" @click="applyFilters">
          {{ t('filter') }}
        </button>
      </div>
    </section>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('teacherWritingQueue') }}</h2>
          <p>{{ meta.total || items.length }} {{ t('results') }}</p>
        </div>
      </div>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="items.length === 0" class="admin-ui__empty">
        <p>{{ t('noTeacherWritingQueue') }}</p>
      </div>
      <template v-else>
        <div class="admin-ui__table-wrap teacher-queue__desktop">
          <table class="admin-ui__table">
            <thead>
              <tr>
                <th>{{ t('title') }}</th>
                <th>{{ t('contextFilter') }}</th>
                <th>{{ t('student') }}</th>
                <th>{{ t('writingTaskType') }}</th>
                <th>{{ t('evaluationStatus') }}</th>
                <th>{{ t('wordCount') }}</th>
                <th>{{ t('actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.id">
                <td>{{ item.task?.title || '—' }}</td>
                <td>
                  <span
                    class="admin-ui__chip"
                    :class="item.context_label === 'full_mock' ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'"
                  >
                    {{ contextLabel(item) }}
                  </span>
                </td>
                <td>{{ item.student?.name || '—' }}</td>
                <td>{{ taskTypeLabel(item.task?.task_type) }}</td>
                <td>
                  {{ item.evaluation_status === 'evaluated' ? t('evaluationReturned') : t('evaluationPending') }}
                </td>
                <td>{{ item.word_count }}</td>
                <td>
                  <button type="button" class="admin-ui__btn admin-ui__btn--ghost" @click="openEvaluate(item)">
                    {{ item.evaluation_status === 'evaluated' ? t('viewEvaluation') : t('evaluateWriting') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-ui__list teacher-queue__mobile">
          <article v-for="item in items" :key="`m-${item.id}`" class="admin-ui__row">
            <div class="admin-ui__row-main">
              <div class="teacher-queue__title-row">
                <h3 class="admin-ui__row-title">{{ item.task?.title || '—' }}</h3>
                <span
                  class="admin-ui__chip"
                  :class="item.context_label === 'full_mock' ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'"
                >
                  {{ contextLabel(item) }}
                </span>
              </div>
              <p class="admin-ui__row-meta">
                {{ item.student?.name || '—' }}
                · {{ taskTypeLabel(item.task?.task_type) }}
                · {{ item.evaluation_status === 'evaluated' ? t('evaluationReturned') : t('evaluationPending') }}
                · {{ t('wordCountLabel', { count: item.word_count }) }}
              </p>
            </div>
            <div class="admin-ui__row-actions">
              <button type="button" class="admin-ui__btn admin-ui__btn--primary" @click="openEvaluate(item)">
                {{ item.evaluation_status === 'evaluated' ? t('viewEvaluation') : t('evaluateWriting') }}
              </button>
            </div>
          </article>
        </div>
      </template>

      <div v-if="meta.last_page > 1" class="teacher-queue__pager">
        <button type="button" class="admin-ui__btn admin-ui__btn--ghost" :disabled="page <= 1 || loading" @click="goPage(page - 1)">
          {{ t('previous') }}
        </button>
        <span>{{ page }} / {{ meta.last_page }}</span>
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
.teacher-queue__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  justify-content: space-between;
}

.teacher-queue__desktop {
  display: none;
}

.teacher-queue__mobile {
  display: grid;
}

.teacher-queue__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.85rem;
}

@media (min-width: 960px) {
  .teacher-queue__desktop {
    display: block;
  }

  .teacher-queue__mobile {
    display: none;
  }
}
</style>
