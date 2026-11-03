<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const router = useRouter()
const items = ref([])
const loading = ref(true)
const message = ref('')

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get('/student/enrollments', { skipErrorToast: true })
    items.value = data.data || []
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function openCourse(item) {
  if (!item.course?.slug) return
  router.push({ name: 'learning-course', params: { slug: item.course.slug } })
}

onMounted(load)
</script>

<template>
<div>
      <h1 class="text-h5 mb-4">{{ t('myCourses') }}</h1>
      <v-progress-circular v-if="loading" indeterminate color="primary" />
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <v-alert v-else-if="items.length === 0" type="info" variant="tonal">{{ t('noPurchasedCourses') }}</v-alert>
      <v-row v-else>
        <v-col v-for="item in items" :key="item.id" cols="12" md="6" lg="4">
          <v-card class="h-100" @click="openCourse(item)">
            <v-img v-if="item.course?.thumbnail_url" :src="item.course.thumbnail_url" height="140" cover />
            <v-card-title class="text-wrap">{{ item.course?.title }}</v-card-title>
            <v-card-subtitle>
              {{ item.course?.category?.name }}
              <span v-if="item.course?.exam_type"> · {{ item.course.exam_type === 'general' ? t('general') : t('academic') }}</span>
            </v-card-subtitle>
            <v-card-text>
              {{ t('enrolledOn') }}: {{ item.enrolled_at ? new Date(item.enrolled_at).toLocaleDateString() : '—' }}
            </v-card-text>
            <v-card-actions>
              <v-btn color="primary" variant="tonal" @click.stop="openCourse(item)">{{ t('openCourse') }}</v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
  </div>
</template>
