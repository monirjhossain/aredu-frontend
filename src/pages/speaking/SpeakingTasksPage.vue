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
const part = ref(null)
const loading = ref(true)
const message = ref('')

const filters = computed(() => [
  { key: null, label: t('allTypes') },
  { key: 1, label: t('speakingPart1') },
  { key: 2, label: t('speakingPart2') },
  { key: 3, label: t('speakingPart3') },
])
const fullUnlocked = computed(() => meta.value?.practice_access?.full_unlocked === true)

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/speaking-tasks', {
      params: {
        page: page.value,
        part: part.value || undefined,
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

function setFilter(key) {
  part.value = key
  page.value = 1
  load()
}

function goPage(next) {
  page.value = next
  load()
}

function partLabel(value) {
  if (Number(value) === 1) return t('speakingPart1')
  if (Number(value) === 2) return t('speakingPart2')
  if (Number(value) === 3) return t('speakingPart3')
  return value
}
</script>

<template>
  <div class="student-ui">
    <header class="student-ui__hero">
      <div>
        <p class="student-ui__eyebrow">{{ t('practice') }}</p>
        <h1>{{ t('speakingTasks') }}</h1>
        <p class="student-ui__hero-lead">{{ t('speakingMocksLead') }}</p>
      </div>
      <router-link class="student-ui__hero-link" :to="{ name: 'speaking-recordings' }">
        {{ t('mySpeakingRecordings') }}
        <span aria-hidden="true">→</span>
      </router-link>
    </header>

    <PracticeUnlockBanner
      v-if="!loading && !fullUnlocked"
      :message="t('practiceRequiresEnrollment')"
      :cta-label="t('practiceUnlockCta')"
    />

    <section class="student-ui__panel">
      <div class="student-ui__toolbar">
        <div class="student-ui__chips" role="tablist">
          <button
            v-for="chip in filters"
            :key="chip.key ?? 'all'"
            type="button"
            class="student-ui__chip"
            :class="{ 'is-active': part === chip.key }"
            role="tab"
            :aria-selected="part === chip.key"
            @click="setFilter(chip.key)"
          >
            {{ chip.label }}
          </button>
        </div>
        <p class="student-ui__count">{{ t('speakingTasksListCount', { count: meta.total || tasks.length }) }}</p>
      </div>

      <ul class="student-ui__tips">
        <li>{{ t('speakingTipRecord') }}</li>
        <li>{{ t('speakingTipPrep') }}</li>
        <li>{{ t('speakingTipSubmit') }}</li>
      </ul>

      <PracticeState
        :loading="loading"
        :error="message"
        :empty="!loading && !message && tasks.length === 0"
        :empty-title="fullUnlocked ? t('noSpeakingTasksPublic') : t('practiceRequiresEnrollment')"
        :empty-lead="fullUnlocked ? t('speakingMocksEmptyLead') : t('practiceFreeSamplesOnlyLead')"
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
            :lead="t('speakingMockCardLead')"
            :meta="t('questionsCount', { count: item.questions_count ?? 0 })"
            :badges="[partLabel(item.part)]"
            :cta-label="t('openSpeakingTask')"
            :to="{ name: 'speaking-task-detail', params: { id: item.id } }"
          >
            <div class="student-ui__card-meta" style="display: flex; flex-wrap: wrap; gap: 0.55rem">
              <span>{{ t('prepSecondsShort', { count: item.preparation_seconds }) }}</span>
              <span>{{ t('responseSecondsShort', { count: item.response_seconds }) }}</span>
            </div>
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
