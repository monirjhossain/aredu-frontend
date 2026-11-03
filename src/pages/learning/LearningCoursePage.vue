<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const course = ref(null)
const loading = ref(true)
const message = ref('')

const examLabel = computed(() => {
  if (!course.value) return ''
  return course.value.exam_type === 'general' ? t('general') : t('academic')
})

function lessonTime(seconds) {
  const total = Number(seconds) || 0
  if (total >= 60 && total % 60 === 0) {
    return t('minutesCount', { count: total / 60 })
  }
  return t('secondsCount', { count: total })
}

async function load() {
  loading.value = true
  message.value = ''
  course.value = null
  try {
    const { data } = await http.get(`/student/courses/${route.params.slug}`, { skipErrorToast: true })
    course.value = data.data
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function watchLesson(lesson) {
  router.push({
    name: 'lesson-player',
    params: { slug: route.params.slug, lessonId: lesson.id },
  })
}

function lessonStatus(lesson) {
  if (lesson.is_completed) return t('completed')
  if (lesson.progress?.position_seconds > 0) return t('inProgress')
  return t('pendingLesson')
}

onMounted(load)
watch(() => route.params.slug, load)
</script>

<template>
  <div>
    <v-btn class="mb-4" variant="text" :to="{ name: 'my-courses' }">{{ t('backToMyCourses') }}</v-btn>
    <v-progress-circular v-if="loading" indeterminate color="primary" />
    <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
    <template v-else-if="course">
      <h1 class="text-h5 text-sm-h4 mb-2">{{ course.title }}</h1>
      <div class="text-body-2 text-medium-emphasis mb-2">
        {{ course.category?.name }} · {{ examLabel }} · {{ t('minutesCount', { count: course.duration_minutes }) }}
      </div>
      <div v-if="course.course_progress" class="mb-4">
        <div class="text-body-2 mb-1">
          {{ t('courseProgress') }}:
          {{ course.course_progress.completed_lessons }}/{{ course.course_progress.published_lessons }}
          ({{ course.course_progress.percent }}%)
        </div>
        <v-progress-linear :model-value="course.course_progress.percent" color="primary" height="8" rounded />
        <div v-if="course.certificate" class="text-caption text-success mt-2">
          {{ t('certificateIssued') }}: {{ course.certificate.certificate_number }}
        </div>
      </div>
      <p v-if="course.description" class="mb-6 text-body-1">{{ course.description }}</p>

      <h2 class="text-h6 mb-2">{{ t('curriculum') }}</h2>
      <v-alert v-if="!course.sections?.length" type="info" variant="tonal">{{ t('noPublicLessons') }}</v-alert>
      <v-expansion-panels v-else>
        <v-expansion-panel v-for="section in course.sections" :key="section.id">
          <v-expansion-panel-title>{{ section.position }}. {{ section.title }}</v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-list density="comfortable">
              <v-list-item v-for="lesson in section.lessons" :key="lesson.id">
                <v-list-item-title class="text-wrap">{{ lesson.position }}. {{ lesson.title }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ lessonTime(lesson.duration_seconds) }}
                  <span v-if="lesson.is_free_preview"> · {{ t('freePreview') }}</span>
                  · {{ lessonStatus(lesson) }}
                </v-list-item-subtitle>
                <template #append>
                  <v-icon v-if="lesson.is_completed" color="success" class="me-2">mdi-check-circle</v-icon>
                  <v-btn color="primary" variant="tonal" size="small" @click="watchLesson(lesson)">
                    {{ lesson.is_completed ? t('rewatchLesson') : (lesson.progress?.position_seconds ? t('resumeLesson') : t('watchLesson')) }}
                  </v-btn>
                </template>
              </v-list-item>
            </v-list>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>
  </div>
</template>
