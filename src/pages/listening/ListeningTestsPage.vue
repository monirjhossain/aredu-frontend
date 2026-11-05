<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MockTestCard from '../../components/examination/MockTestCard.vue'
import PracticeState from '../../components/examination/PracticeState.vue'
import PracticeUnlockBanner from '../../components/examination/PracticeUnlockBanner.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const tests = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const examType = ref('')
const loading = ref(true)
const message = ref('')

const filters = computed(() => [
  { key: '', label: t('allTypes') },
  { key: 'academic', label: t('academic') },
  { key: 'general', label: t('general') },
])
const fullUnlocked = computed(() => meta.value?.practice_access?.full_unlocked === true)

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/listening-tests', {
      params: {
        page: page.value,
        exam_type: examType.value || undefined,
      },
      skipErrorToast: true,
    })
    tests.value = data.data || []
    meta.value = data.meta || meta.value
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function setFilter(key) {
  examType.value = key
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

function minutes(seconds) {
  return t('minutesCount', { count: Math.round(Number(seconds || 0) / 60) })
}

function examLabel(type) {
  return type === 'general' ? t('general') : t('academic')
}
</script>

<template>
  <div class="student-ui">
    <header class="student-ui__hero">
      <div>
        <p class="student-ui__eyebrow">{{ t('practice') }}</p>
        <h1>{{ t('listeningTests') }}</h1>
        <p class="student-ui__hero-lead">{{ t('listeningMocksLead') }}</p>
      </div>
      <router-link class="student-ui__hero-link" :to="{ name: 'listening-results' }">
        {{ t('listeningResults') }}
        <span aria-hidden="true">→</span>
      </router-link>
    </header>

    <PracticeUnlockBanner
      v-if="!loading && !fullUnlocked"
      :message="t('practiceUnlockBanner')"
      :cta-label="t('practiceUnlockCta')"
    />

    <section class="student-ui__panel">
      <div class="student-ui__toolbar">
        <div class="student-ui__chips" role="tablist">
          <button
            v-for="chip in filters"
            :key="chip.key || 'all'"
            type="button"
            class="student-ui__chip"
            :class="{ 'is-active': examType === chip.key }"
            role="tab"
            :aria-selected="examType === chip.key"
            @click="setFilter(chip.key)"
          >
            {{ chip.label }}
          </button>
        </div>
        <p class="student-ui__count">{{ meta.total || tests.length }} {{ t('listeningTests') }}</p>
      </div>

      <PracticeState
        :loading="loading"
        :error="message"
        :empty="!loading && !message && tests.length === 0"
        :empty-title="t('noListeningTestsPublic')"
        :empty-lead="fullUnlocked ? t('listeningMocksEmptyLead') : t('practiceFreeSamplesOnlyLead')"
      >
        <div class="student-ui__grid">
          <MockTestCard
            v-for="item in tests"
            :key="item.id"
            :title="item.title"
            :lead="t('listeningMockCardLead')"
            :meta="minutes(item.duration_seconds)"
            :badges="[examLabel(item.exam_type)]"
            :free-sample="Boolean(item.is_free_sample)"
            :free-sample-label="t('freeSampleBadge')"
            :cta-label="t('openListeningTest')"
            :to="{ name: 'listening-test-intro', params: { slug: item.slug } }"
          />
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
