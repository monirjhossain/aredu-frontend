<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { useLocaleStore } from '../../stores/locale'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const localeStore = useLocaleStore()

const dashboard = ref(null)
const message = ref('')
const loading = ref(true)

const summaryCards = computed(() => {
  if (!dashboard.value) return []
  return [
    {
      label: t('enrolledCourses'),
      value: String(dashboard.value.enrolled_courses.length),
      icon: 'mdi-bookshelf',
    },
    {
      label: t('pendingWriting'),
      value: String(dashboard.value.pending_writing.total),
      icon: 'mdi-pencil',
    },
    {
      label: t('pendingSpeaking'),
      value: String(dashboard.value.pending_speaking.total),
      icon: 'mdi-microphone',
    },
    {
      label: t('notifications'),
      value: String(dashboard.value.notifications.length),
      icon: 'mdi-bell',
    },
  ]
})

onMounted(async () => {
  try {
    const { data } = await http.get('/student/dashboard', { skipErrorToast: true })
    dashboard.value = data.data
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
})

function when(value) {
  if (!value) return ''
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(value).toLocaleString(locale)
}

function notificationText(item) {
  if (item?.data?.message) return item.data.message
  if (item?.data?.title) return item.data.title
  return item?.type || t('notification')
}
</script>

<template>
  <div>
    <h1 class="text-h5 mb-4">{{ t('studentDashboard') }}</h1>
          <v-progress-circular v-if="loading" indeterminate color="primary" />
          <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
          <template v-else-if="dashboard">
            <v-row>
              <v-col v-for="card in summaryCards" :key="card.label" cols="12" sm="6" md="3">
                <v-card>
                  <v-card-text class="d-flex align-center">
                    <v-icon class="me-3" color="primary" size="28">{{ card.icon }}</v-icon>
                    <div>
                      <div class="text-caption text-medium-emphasis">{{ card.label }}</div>
                      <div class="text-h6">{{ card.value }}</div>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <v-row class="mt-2">
              <v-col cols="12" lg="6">
                <v-card>
                  <v-card-title>{{ t('enrolledCourses') }}</v-card-title>
                  <v-card-text>
                    <v-alert v-if="dashboard.enrolled_courses.length === 0" type="info" variant="tonal">
                      {{ t('noPurchasedCourses') }}
                    </v-alert>
                    <v-list v-else lines="three">
                      <v-list-item
                        v-for="item in dashboard.enrolled_courses"
                        :key="item.enrollment_id"
                        :title="item.course?.title"
                        :subtitle="`${t('courseProgress')}: ${item.progress.completed_lessons}/${item.progress.published_lessons} (${item.progress.percent}%)`"
                        :to="{ name: 'learning-course', params: { slug: item.course.slug } }"
                      >
                        <template #append>
                          <v-progress-circular
                            :model-value="item.progress.percent"
                            :size="42"
                            :width="4"
                            color="primary"
                          >
                            <span class="text-caption">{{ item.progress.percent }}%</span>
                          </v-progress-circular>
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </v-col>

          <v-col cols="12" lg="6">
            <v-card>
              <v-card-title>{{ t('recentLessons') }}</v-card-title>
              <v-card-text>
                <v-alert v-if="dashboard.recent_lessons.length === 0" type="info" variant="tonal">
                  {{ t('noRecentLessons') }}
                </v-alert>
                <v-list v-else lines="two">
                  <v-list-item
                    v-for="lesson in dashboard.recent_lessons"
                    :key="lesson.lesson_id"
                    :title="lesson.title"
                    :subtitle="`${lesson.course?.title || ''} · ${when(lesson.updated_at)}`"
                    :to="lesson.course?.slug
                      ? { name: 'lesson-player', params: { slug: lesson.course.slug, lessonId: lesson.lesson_id } }
                      : undefined"
                  >
                    <template #append>
                      <v-chip v-if="lesson.completed_at" size="small" variant="tonal" color="success">
                        {{ t('completed') }}
                      </v-chip>

                  </template></v-list-item>
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" lg="6">
            <v-card>
              <v-card-title>{{ t('recentMockResults') }}</v-card-title>
              <v-card-text>
                <v-alert v-if="dashboard.recent_mock_results.length === 0" type="info" variant="tonal">
                  {{ t('noMockResults') }}
                </v-alert>
                <v-list v-else lines="two">
                  <v-list-item
                    v-for="row in dashboard.recent_mock_results"
                    :key="row.attempt_id"
                    :title="row.mock_test?.title"
                    :subtitle="`${row.result?.raw_score}/${row.result?.max_score} · ${t('bandScore')}: ${row.result?.band_score ?? '—'} · ${when(row.submitted_at)}`"
                  />
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" lg="6">
            <v-card>
              <v-card-title>{{ t('notifications') }}</v-card-title>
              <v-card-text>
                <v-alert v-if="dashboard.notifications.length === 0" type="info" variant="tonal">
                  {{ t('noNotifications') }}
                </v-alert>
                <v-list v-else lines="two">
                  <v-list-item
                    v-for="item in dashboard.notifications"
                    :key="item.id"
                    :title="notificationText(item)"
                    :subtitle="when(item.created_at)"
                  >
                    <template #append>
                      <v-chip v-if="!item.read_at" size="small" variant="tonal" color="primary">
                        {{ t('unread') }}
                      </v-chip>

                  </template></v-list-item>
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card>
              <v-card-title>{{ t('pendingWriting') }} ({{ dashboard.pending_writing.total }})</v-card-title>
              <v-card-text>
                <v-alert v-if="dashboard.pending_writing.items.length === 0" type="info" variant="tonal">
                  {{ t('noPendingWriting') }}
                </v-alert>
                <v-list v-else lines="two">
                  <v-list-item
                    v-for="item in dashboard.pending_writing.items"
                    :key="item.id"
                    :title="item.title"
                    :subtitle="when(item.submitted_at)"
                  />
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card>
              <v-card-title>{{ t('pendingSpeaking') }} ({{ dashboard.pending_speaking.total }})</v-card-title>
              <v-card-text>
                <v-alert v-if="dashboard.pending_speaking.items.length === 0" type="info" variant="tonal">
                  {{ t('noPendingSpeaking') }}
                </v-alert>
                <v-list v-else lines="two">
                  <v-list-item
                    v-for="item in dashboard.pending_speaking.items"
                    :key="item.id"
                    :title="item.title"
                    :subtitle="when(item.submitted_at)"
                  />
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </template>
</div>
</template>
