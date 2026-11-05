<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MockTestCard from '../../components/examination/MockTestCard.vue'
import PracticeState from '../../components/examination/PracticeState.vue'
import PracticeUnlockBanner from '../../components/examination/PracticeUnlockBanner.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const tasks = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const examType = ref('')
const taskType = ref('')
const search = ref('')
const loading = ref(true)
const message = ref('')

const examFilters = computed(() => [
  { key: '', label: t('allTypes') },
  { key: 'academic', label: t('academic') },
  { key: 'general', label: t('general') },
])

const taskFilters = computed(() => [
  { key: '', label: t('allTaskTypes') },
  { key: 'academic_task_1', label: t('writingTaskAcademic1') },
  { key: 'general_task_1', label: t('writingTaskGeneral1') },
  { key: 'task_2', label: t('writingTask2') },
])
const fullUnlocked = computed(() => meta.value?.practice_access?.full_unlocked === true)

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/writing-tasks', {
      params: {
        page: page.value,
        search: search.value.trim() || undefined,
        exam_type: examType.value || undefined,
        task_type: taskType.value || undefined,
      },
      skipErrorToast: true,
    })
    tasks.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function taskTypeLabel(value) {
  if (value === 'academic_task_1') return t('writingTaskAcademic1')
  if (value === 'general_task_1') return t('writingTaskGeneral1')
  if (value === 'task_2') return t('writingTask2')
  return value
}

function examLabel(type) {
  return type === 'general' ? t('general') : t('academic')
}

function setExam(key) {
  examType.value = key
  page.value = 1
  load()
}

function setTask(key) {
  taskType.value = key
  page.value = 1
  load()
}

function applySearch() {
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}
</script>

<template>
  <div class="student-ui">
    <header class="student-ui__hero">
      <div>
        <p class="student-ui__eyebrow">{{ t('practice') }}</p>
        <h1>{{ t('writingTasks') }}</h1>
        <p class="student-ui__hero-lead">{{ t('writingMocksLead') }}</p>
      </div>
      <router-link class="student-ui__hero-link" :to="{ name: 'writing-submissions' }">
        {{ t('myWritingSubmissions') }}
        <span aria-hidden="true">→</span>
      </router-link>
    </header>

    <PracticeUnlockBanner
      v-if="!loading && !fullUnlocked"
      :message="t('practiceRequiresEnrollment')"
      :cta-label="t('practiceUnlockCta')"
    />

    <section class="student-ui__panel">
      <form class="student-ui__search" @submit.prevent="applySearch">
        <input
          v-model="search"
          type="search"
          class="student-ui__input"
          :placeholder="t('search')"
          :aria-label="t('search')"
        >
        <button type="submit" class="student-ui__btn student-ui__btn--primary">{{ t('search') }}</button>
      </form>

      <div class="student-ui__toolbar">
        <div class="student-ui__chips" role="tablist" :aria-label="t('examType')">
          <button
            v-for="chip in examFilters"
            :key="`e-${chip.key || 'all'}`"
            type="button"
            class="student-ui__chip"
            :class="{ 'is-active': examType === chip.key }"
            role="tab"
            :aria-selected="examType === chip.key"
            @click="setExam(chip.key)"
          >
            {{ chip.label }}
          </button>
        </div>
        <div class="student-ui__chips" role="tablist" :aria-label="t('writingTaskType')">
          <button
            v-for="chip in taskFilters"
            :key="`t-${chip.key || 'all'}`"
            type="button"
            class="student-ui__chip"
            :class="{ 'is-active': taskType === chip.key }"
            role="tab"
            :aria-selected="taskType === chip.key"
            @click="setTask(chip.key)"
          >
            {{ chip.label }}
          </button>
        </div>
        <p class="student-ui__count">{{ t('writingTasksListCount', { count: meta.total || tasks.length }) }}</p>
      </div>

      <PracticeState
        :loading="loading"
        :error="message"
        :empty="!loading && !message && tasks.length === 0"
        :empty-title="fullUnlocked ? t('noWritingTasksPublic') : t('practiceRequiresEnrollment')"
        :empty-lead="fullUnlocked ? t('writingMocksEmptyLead') : t('practiceFreeSamplesOnlyLead')"
      >
        <template #empty-action>
          <router-link v-if="!fullUnlocked" class="student-ui__unlock-cta" :to="{ name: 'courses' }">
            {{ t('practiceUnlockCta') }}
            <span aria-hidden="true">→</span>
          </router-link>
        </template>
        <div class="student-ui__grid">
          <MockTestCard
            v-for="item in tasks"
            :key="item.id"
            :title="item.title"
            :lead="t('writingMockCardLead')"
            :meta="t('minutesCount', { count: item.recommended_minutes })"
            :badges="[examLabel(item.exam_type)]"
            :cta-label="t('openWritingTask')"
            :to="{ name: 'writing-editor', params: { id: item.id } }"
          >
            <template #subtitle>
              <p class="student-ui__card-lead">
                {{ taskTypeLabel(item.task_type) }} · {{ t('minWordsCount', { count: item.min_words }) }}
              </p>
            </template>
          </MockTestCard>
        </div>
      </PracticeState>

      <div v-if="meta.last_page > 1" class="student-ui__pager">
        <button type="button" class="student-ui__pager-btn" :disabled="page <= 1 || loading" @click="goPage(page - 1)">
          {{ t('previous') }}
        </button>
        <span>{{ page }} / {{ meta.last_page }}</span>
        <button
          type="button"
          class="student-ui__pager-btn"
          :disabled="page >= meta.last_page || loading"
          @click="goPage(page + 1)"
        >
          {{ t('next') }}
        </button>
      </div>
    </section>
  </div>
</template>
