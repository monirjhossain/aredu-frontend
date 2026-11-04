<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
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
  <div class="wmock">
    <header class="wmock__hero">
      <div>
        <p class="wmock__eyebrow">{{ t('practice') }}</p>
        <h1>{{ t('writingTasks') }}</h1>
        <p>{{ t('writingMocksLead') }}</p>
      </div>
      <router-link class="wmock__hero-link" :to="{ name: 'writing-submissions' }">
        {{ t('myWritingSubmissions') }}
        <span aria-hidden="true">→</span>
      </router-link>
    </header>

    <section class="wmock__panel">
      <form class="wmock__search" @submit.prevent="applySearch">
        <input
          v-model="search"
          type="search"
          class="wmock__input"
          :placeholder="t('search')"
          :aria-label="t('search')"
        >
        <button type="submit" class="wmock__btn">{{ t('search') }}</button>
      </form>

      <div class="wmock__toolbar">
        <div class="wmock__chips" role="tablist" :aria-label="t('examType')">
          <button
            v-for="chip in examFilters"
            :key="`e-${chip.key || 'all'}`"
            type="button"
            class="wmock__chip"
            :class="{ 'is-active': examType === chip.key }"
            role="tab"
            :aria-selected="examType === chip.key"
            @click="setExam(chip.key)"
          >
            {{ chip.label }}
          </button>
        </div>
        <div class="wmock__chips" role="tablist" :aria-label="t('writingTaskType')">
          <button
            v-for="chip in taskFilters"
            :key="`t-${chip.key || 'all'}`"
            type="button"
            class="wmock__chip"
            :class="{ 'is-active': taskType === chip.key }"
            role="tab"
            :aria-selected="taskType === chip.key"
            @click="setTask(chip.key)"
          >
            {{ chip.label }}
          </button>
        </div>
        <p class="wmock__count">{{ t('writingTasksListCount', { count: meta.total || tasks.length }) }}</p>
      </div>

      <div v-if="loading" class="wmock__loader">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="tasks.length === 0" class="wmock__empty">
        <strong>{{ t('noWritingTasksPublic') }}</strong>
        <p>{{ t('writingMocksEmptyLead') }}</p>
      </div>

      <div v-else class="wmock__grid">
        <article v-for="item in tasks" :key="item.id" class="wmock-card">
          <div class="wmock-card__top">
            <span class="wmock-card__badge">{{ examLabel(item.exam_type) }}</span>
            <span class="wmock-card__time">{{ t('minutesCount', { count: item.recommended_minutes }) }}</span>
          </div>
          <h2>{{ item.title }}</h2>
          <p class="wmock-card__type">{{ taskTypeLabel(item.task_type) }} · {{ t('minWordsCount', { count: item.min_words }) }}</p>
          <p>{{ t('writingMockCardLead') }}</p>
          <router-link class="wmock-card__cta" :to="{ name: 'writing-editor', params: { id: item.id } }">
            {{ t('openWritingTask') }}
            <span aria-hidden="true">→</span>
          </router-link>
        </article>
      </div>

      <div v-if="meta.last_page > 1" class="wmock__pager">
        <button type="button" class="wmock__pager-btn" :disabled="page <= 1 || loading" @click="goPage(page - 1)">
          {{ t('previous') }}
        </button>
        <span>{{ page }} / {{ meta.last_page }}</span>
        <button
          type="button"
          class="wmock__pager-btn"
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
.wmock {
  display: grid;
  gap: 1rem;
  min-width: 0;
  width: 100%;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: #102a2e;
}

.wmock__hero {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.2rem 1.25rem;
  border-radius: 1rem;
  background:
    radial-gradient(circle at top right, rgba(245, 197, 24, 0.22), transparent 42%),
    linear-gradient(135deg, #0b3d36 0%, #0f5c66 55%, #0a2a3a 100%);
  color: #fff;
}

@media (min-width: 720px) {
  .wmock__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.wmock__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.wmock__hero h1 {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 1.85rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.wmock__hero p {
  margin: 0.4rem 0 0;
  max-width: 46ch;
  opacity: 0.9;
  font-size: 0.92rem;
  line-height: 1.45;
}

.wmock__hero-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 1rem;
  border-radius: 0.65rem;
  background: #f5c518;
  color: #1a1400;
  text-decoration: none;
  font-size: 0.86rem;
  font-weight: 800;
  width: fit-content;
}

.wmock__panel {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid #d9e6e8;
  background: #fff;
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
}

.wmock__search {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.9rem;
}

.wmock__input {
  flex: 1 1 14rem;
  min-width: 0;
  min-height: 44px;
  padding: 0 0.85rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.65rem;
  background: #fbfcfd;
  font: inherit;
  font-size: 0.9rem;
}

.wmock__btn {
  min-height: 44px;
  padding: 0 1.1rem;
  border: 0;
  border-radius: 0.65rem;
  background: #0f5c66;
  color: #fff;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 800;
  cursor: pointer;
}

.wmock__toolbar {
  display: grid;
  gap: 0.65rem;
  margin-bottom: 1rem;
}

.wmock__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.wmock__chip {
  min-height: 40px;
  padding: 0 0.9rem;
  border: 1px solid #d9e6e8;
  border-radius: 999px;
  background: #f4f8f9;
  color: #5b7378;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 750;
  cursor: pointer;
}

.wmock__chip.is-active {
  background: #0f5c66;
  border-color: #0f5c66;
  color: #fff;
}

.wmock__count {
  margin: 0;
  color: #5b7378;
  font-size: 0.84rem;
}

.wmock__loader {
  display: grid;
  place-items: center;
  min-height: 160px;
}

.wmock__empty {
  display: grid;
  gap: 0.35rem;
  padding: 1rem 0.25rem;
}

.wmock__empty p {
  margin: 0;
  color: #5b7378;
  line-height: 1.45;
}

.wmock__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.9rem;
}

@media (min-width: 720px) {
  .wmock__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .wmock__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.wmock-card {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.9rem;
  background: #fbfcfd;
}

.wmock-card__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.wmock-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.6rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: rgba(15, 92, 102, 0.12);
  color: #0f5c66;
  font-size: 0.72rem;
  font-weight: 800;
}

.wmock-card__time {
  color: #5b7378;
  font-size: 0.78rem;
  font-weight: 700;
}

.wmock-card h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.3;
  word-break: break-word;
}

.wmock-card p {
  margin: 0;
  color: #5b7378;
  font-size: 0.86rem;
  line-height: 1.4;
}

.wmock-card .wmock-card__type {
  color: #0f5c66;
  font-weight: 700;
}

.wmock-card__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 44px;
  margin-top: auto;
  padding: 0 1rem;
  border-radius: 0.65rem;
  background: #0b1b34;
  color: #fff;
  text-decoration: none;
  font-size: 0.86rem;
  font-weight: 800;
}

.wmock__pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.1rem;
}

.wmock__pager-btn {
  min-height: 44px;
  padding: 0 0.9rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.55rem;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.wmock__pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
