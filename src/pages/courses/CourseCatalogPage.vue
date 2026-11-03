<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CourseCard from '../../components/marketing/CourseCard.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()

const courses = ref([])
const categories = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const search = ref('')
const examType = ref('all')
const categoryId = ref('')
const loading = ref(true)
const message = ref('')

const examFilters = computed(() => [
  { key: 'all', label: t('landingFilterAll') },
  { key: 'academic', label: t('academic') },
  { key: 'general', label: t('general') },
])

async function loadCategories() {
  const { data } = await http.get('/categories', { skipErrorToast: true })
  categories.value = data.data || []
}

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/courses', {
      params: {
        search: search.value || undefined,
        page: page.value,
        exam_type: examType.value === 'all' ? undefined : examType.value,
        category_id: categoryId.value ? categoryId.value : undefined,
      },
      skipErrorToast: true,
    })
    courses.value = data.data || []
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

function setExam(key) {
  examType.value = key
  applyFilters()
}

onMounted(async () => {
  try {
    await loadCategories()
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  }
  await load()
})
</script>

<template>
  <div class="site">
    <section class="site-hero">
      <div class="site-wrap">
        <p class="site-kicker">{{ t('appName') }}</p>
        <h1>{{ t('landingCourses') }}</h1>
        <p class="site-lead">{{ t('landingCoursesLead') }}</p>

        <form class="site-search" @submit.prevent="applyFilters">
          <input
            v-model="search"
            type="search"
            :placeholder="t('search')"
            aria-label="Search courses"
          >
          <select v-model="categoryId" @change="applyFilters">
            <option value="">{{ t('categories') }}</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
          <button type="submit" class="site-btn">{{ t('search') }}</button>
        </form>

        <div class="site-chips" role="tablist">
          <button
            v-for="chip in examFilters"
            :key="chip.key"
            type="button"
            class="site-chip"
            :class="{ 'is-active': examType === chip.key }"
            @click="setExam(chip.key)"
          >
            {{ chip.label }}
          </button>
        </div>
      </div>
    </section>

    <section class="site-section">
      <div class="site-wrap">
        <v-progress-linear v-if="loading" indeterminate color="#f5c518" class="mb-4" />
        <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
        <p v-else-if="!courses.length" class="site-empty">{{ t('noPublicCourses') }}</p>
        <div v-else class="site-grid">
          <CourseCard v-for="course in courses" :key="course.id" :course="course" />
        </div>

        <div v-if="!loading && meta.last_page > 1" class="site-pager">
          <v-pagination
            v-model="page"
            :length="meta.last_page"
            density="comfortable"
            @update:model-value="load"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.site {
  --ink: #0b1b34;
  --muted: #5b6b7c;
  --yellow: #f5c518;
  --line: #e6ebf2;
  color: var(--ink);
  background: #fff;
  min-height: 100%;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.site-wrap {
  width: min(960px, calc(100% - 2rem));
  margin: 0 auto;
}

.site-hero {
  padding: 2rem 0 1.5rem;
  background: linear-gradient(180deg, #eaf2ff 0%, #ffffff 80%);
}

.site-kicker {
  margin: 0 0 0.45rem;
  color: #e85d4c;
  font-weight: 750;
}

.site-hero h1 {
  margin: 0 0 0.55rem;
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.site-lead {
  margin: 0 0 1.25rem;
  color: var(--muted);
  max-width: 46ch;
  line-height: 1.55;
}

.site-search {
  display: grid;
  gap: 0.65rem;
  margin-bottom: 1rem;
}

@media (min-width: 800px) {
  .site-search {
    grid-template-columns: 1.4fr 1fr auto;
  }
}

.site-search input,
.site-search select {
  min-height: 3rem;
  padding: 0 0.95rem;
  border-radius: 0.65rem;
  border: 1px solid var(--line);
  background: #fff;
  font: inherit;
  color: var(--ink);
}

.site-btn {
  min-height: 3rem;
  padding: 0 1.2rem;
  border: 0;
  border-radius: 0.65rem;
  background: var(--yellow);
  color: #1a1400;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.site-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.site-chip {
  min-height: 2.4rem;
  padding: 0 0.95rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}

.site-chip.is-active {
  background: #0b1b34;
  border-color: #0b1b34;
  color: #fff;
}

.site-section {
  padding: 0.5rem 0 3.5rem;
}

.site-grid {
  display: grid;
  gap: 1.1rem;
}

@media (min-width: 760px) {
  .site-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1080px) {
  .site-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.site-empty {
  margin: 0;
  color: var(--muted);
}

.site-pager {
  display: flex;
  justify-content: center;
  margin-top: 1.75rem;
}
</style>
