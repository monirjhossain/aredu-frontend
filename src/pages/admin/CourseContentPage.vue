<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminDialog from '../../components/admin/AdminDialog.vue'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { useAuthStore } from '../../stores/auth'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const courseTitle = ref('')
const sections = ref([])
const loading = ref(true)
const saving = ref(false)
const message = ref('')
const dialogError = ref('')
const fieldErrors = ref({})

const sectionDialog = ref(false)
const sectionForm = reactive({ id: null, title: '' })

const lessonDialog = ref(false)
const lessonForm = reactive({
  id: null,
  sectionId: null,
  title: '',
  duration_seconds: 0,
  is_free_preview: false,
  is_published: false,
})

const pendingDelete = ref(null)
const videoDialog = ref(false)
const videoTarget = ref(null)
const videoFile = ref(null)
const coverFile = ref(null)
const videoBusy = ref(false)
const videoMessage = ref('')
const pollTimer = ref(null)

function coursePath() {
  return `/admin/courses/${route.params.id}`
}

function canManageVideos() {
  return auth.hasPermission('videos.manage')
}

function videoLabel(status) {
  if (status === 'ready') return t('videoReady')
  if (status === 'failed') return t('videoFailed')
  if (status === 'processing') return t('videoProcessing')
  if (status === 'uploading') return t('videoUploading')
  if (status === 'pending') return t('videoPending')
  return t('videoNone')
}

function canReplace(video) {
  return !video || video.status === 'failed'
}

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get(`${coursePath()}/sections`, { skipErrorToast: true })
    courseTitle.value = data.data.course?.title || ''
    sections.value = data.data.sections || []
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function openSection(section = null) {
  dialogError.value = ''
  fieldErrors.value = {}
  sectionForm.id = section?.id || null
  sectionForm.title = section?.title || ''
  sectionDialog.value = true
}

async function saveSection() {
  saving.value = true
  dialogError.value = ''
  fieldErrors.value = {}
  try {
    const body = { title: sectionForm.title }
    if (sectionForm.id) {
      await http.put(`${coursePath()}/sections/${sectionForm.id}`, body, { skipErrorToast: true })
    } else {
      await http.post(`${coursePath()}/sections`, body, { skipErrorToast: true })
    }
    sectionDialog.value = false
    await load()
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors
    dialogError.value = parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

function openLesson(section, lesson = null) {
  dialogError.value = ''
  fieldErrors.value = {}
  lessonForm.id = lesson?.id || null
  lessonForm.sectionId = section.id
  lessonForm.title = lesson?.title || ''
  lessonForm.duration_seconds = lesson?.duration_seconds ?? 0
  lessonForm.is_free_preview = lesson?.is_free_preview ?? false
  lessonForm.is_published = lesson?.is_published ?? false
  lessonDialog.value = true
}

async function saveLesson() {
  saving.value = true
  dialogError.value = ''
  fieldErrors.value = {}
  const path = `${coursePath()}/sections/${lessonForm.sectionId}/lessons`
  const body = {
    title: lessonForm.title,
    duration_seconds: lessonForm.duration_seconds === '' ? '' : Number(lessonForm.duration_seconds),
    is_free_preview: lessonForm.is_free_preview,
    is_published: lessonForm.is_published,
  }
  try {
    if (lessonForm.id) {
      await http.put(`${path}/${lessonForm.id}`, body, { skipErrorToast: true })
    } else {
      await http.post(path, body, { skipErrorToast: true })
    }
    lessonDialog.value = false
    await load()
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors
    dialogError.value = parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

function askDelete(kind, item, section = null) {
  message.value = ''
  pendingDelete.value = {
    kind,
    id: item.id,
    title: item.title,
    sectionId: section?.id || item.id,
  }
}

async function confirmDelete() {
  const target = pendingDelete.value
  if (!target) return
  saving.value = true
  message.value = ''
  const url = target.kind === 'section'
    ? `${coursePath()}/sections/${target.id}`
    : `${coursePath()}/sections/${target.sectionId}/lessons/${target.id}`
  try {
    await http.delete(url, { skipErrorToast: true })
    pendingDelete.value = null
    await load()
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

async function moveSection(index, direction) {
  const ids = swap(sections.value, index, direction)
  if (!ids) return
  await sendOrder(`${coursePath()}/sections/order`, { section_ids: ids })
}

async function moveLesson(section, index, direction) {
  const ids = swap(section.lessons, index, direction)
  if (!ids) return
  await sendOrder(`${coursePath()}/sections/${section.id}/lessons/order`, { lesson_ids: ids })
}

function swap(list, index, direction) {
  const target = index + direction
  if (target < 0 || target >= list.length) return null
  const ids = list.map((item) => item.id)
  const current = ids[index]
  ids[index] = ids[target]
  ids[target] = current
  return ids
}

async function sendOrder(url, body) {
  saving.value = true
  message.value = ''
  try {
    await http.put(url, body, { skipErrorToast: true })
    await load()
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

function openVideo(lesson) {
  stopPolling()
  videoTarget.value = lesson
  videoFile.value = null
  coverFile.value = null
  videoMessage.value = ''
  videoDialog.value = true
  if (lesson.video && (lesson.video.status === 'uploading' || lesson.video.status === 'processing')) {
    startPolling(lesson.id)
  }
}

function closeVideo() {
  videoDialog.value = false
  videoTarget.value = null
  videoFile.value = null
  coverFile.value = null
  stopPolling()
}

function selectedFile(model) {
  const value = model
  return Array.isArray(value) ? value[0] : value
}

async function uploadCover(lessonId) {
  const file = selectedFile(coverFile.value)
  if (!file) return null
  const body = new FormData()
  body.append('cover', file)
  const { data } = await http.post(`/admin/lessons/${lessonId}/video/cover`, body, {
    skipErrorToast: true,
    skipSuccessToast: true,
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  coverFile.value = null
  return data.data
}

async function uploadVideo() {
  const lesson = videoTarget.value
  const file = selectedFile(videoFile.value)
  const cover = selectedFile(coverFile.value)
  if (!lesson) return
  if (!file && !lesson.video) {
    videoMessage.value = t('noVideoSelected')
    return
  }
  if (!file && cover && lesson.video) {
    videoBusy.value = true
    videoMessage.value = ''
    try {
      const video = await uploadCover(lesson.id)
      lesson.video = video
      ui.success(t('videoCoverSaved'))
      await load()
    } catch (error) {
      videoMessage.value = apiError(error).message || t('videoCoverFailed')
    } finally {
      videoBusy.value = false
    }
    return
  }
  if (!file) {
    videoMessage.value = t('noVideoSelected')
    return
  }

  videoBusy.value = true
  videoMessage.value = ''
  try {
    const { data } = await http.post(`/admin/lessons/${lesson.id}/video`, {}, { skipErrorToast: true, skipSuccessToast: true })
    const uploadUrl = data.data.upload_url
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
    })
    if (!response.ok) {
      throw new Error(t('videoUploadFailed'))
    }
    let video = {
      id: data.data.id,
      status: data.data.status,
      duration_seconds: data.data.duration_seconds,
      error_message: data.data.error_message,
      cover_url: data.data.cover_url,
    }
    if (cover) {
      video = await uploadCover(lesson.id)
    }
    lesson.video = video
    ui.success(cover ? t('videoUploadStartedWithCover') : t('videoUploadStarted'))
    videoFile.value = null
    startPolling(lesson.id)
    await load()
  } catch (error) {
    videoMessage.value = error?.message && !error.response
      ? error.message
      : (apiError(error).message || t('videoUploadFailed'))
  } finally {
    videoBusy.value = false
  }
}

async function removeCover() {
  const lesson = videoTarget.value
  if (!lesson?.video) return
  videoBusy.value = true
  videoMessage.value = ''
  try {
    const { data } = await http.delete(`/admin/lessons/${lesson.id}/video/cover`, { skipErrorToast: true, skipSuccessToast: true })
    lesson.video = data.data
    ui.success(t('videoCoverRemoved'))
    await load()
  } catch (error) {
    videoMessage.value = apiError(error).message || t('videoCoverFailed')
  } finally {
    videoBusy.value = false
  }
}

function startPolling(lessonId) {
  stopPolling()
  let waitingNotified = false
  pollTimer.value = window.setInterval(async () => {
    try {
      const { data } = await http.get(`/admin/lessons/${lessonId}/video`, { skipErrorToast: true, skipAuthRedirect: true })
      const video = data.data
      if (videoTarget.value?.id === lessonId) {
        videoTarget.value.video = video
      }
      for (const section of sections.value) {
        const lesson = section.lessons.find((item) => item.id === lessonId)
        if (lesson) {
          lesson.video = video
        }
      }
      if (!video || video.status === 'ready' || video.status === 'failed') {
        stopPolling()
        if (video?.status === 'ready') {
          ui.success(t('videoReady'))
        }
        if (video?.status === 'failed') {
          videoMessage.value = video.error_message || t('videoFailed')
        }
      } else if (!waitingNotified) {
        waitingNotified = true
        ui.info(t('videoWaiting'))
      }
    } catch {
      stopPolling()
    }
  }, 4000)
}

function stopPolling() {
  if (pollTimer.value) {
    window.clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

onMounted(load)
onBeforeUnmount(stopPolling)
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('courseContent')" :lead="courseTitle">
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--ghost"
          @click="router.push({ name: 'admin-course-edit', params: { id: route.params.id } })"
        >
          <v-icon size="18">mdi-arrow-left</v-icon>
          {{ t('backToCourse') }}
        </button>
        <button type="button" class="admin-ui__btn admin-ui__btn--primary" :disabled="loading" @click="openSection()">
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newSection') }}
        </button>
      </template>
    </AdminPageHero>

    <div v-if="loading" class="admin-ui__panel admin-ui__loading">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <v-alert v-else-if="message" class="mb-4" type="error" variant="tonal">{{ message }}</v-alert>
    <div v-if="!loading && sections.length === 0 && !message" class="admin-ui__panel">
      <div class="admin-ui__empty">
        <p>{{ t('noSections') }}</p>
      </div>
    </div>

    <section v-for="(section, sectionIndex) in sections" :key="section.id" class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ section.position }}. {{ section.title }}</h2>
        </div>
        <div class="admin-ui__row-actions">
          <button type="button" class="admin-ui__icon-btn" :aria-label="t('moveUp')" :disabled="sectionIndex === 0 || saving" @click="moveSection(sectionIndex, -1)">
            <v-icon size="18">mdi-arrow-up</v-icon>
          </button>
          <button type="button" class="admin-ui__icon-btn" :aria-label="t('moveDown')" :disabled="sectionIndex === sections.length - 1 || saving" @click="moveSection(sectionIndex, 1)">
            <v-icon size="18">mdi-arrow-down</v-icon>
          </button>
          <button type="button" class="admin-ui__icon-btn" :aria-label="t('edit')" @click="openSection(section)">
            <v-icon size="18">mdi-pencil</v-icon>
          </button>
          <button type="button" class="admin-ui__icon-btn admin-ui__icon-btn--danger" :aria-label="t('delete')" @click="askDelete('section', section)">
            <v-icon size="18">mdi-delete</v-icon>
          </button>
        </div>
      </div>

      <div v-if="section.lessons.length === 0" class="admin-ui__empty">
        <p>{{ t('noLessons') }}</p>
      </div>
      <div v-else class="admin-ui__list">
        <article v-for="(lesson, lessonIndex) in section.lessons" :key="lesson.id" class="admin-ui__row">
          <div class="admin-ui__row-main">
            <div>
              <h3 class="admin-ui__row-title">{{ lesson.position }}. {{ lesson.title }}</h3>
              <p class="admin-ui__row-meta">
                {{ lesson.duration_seconds }}s
                <span v-if="canManageVideos()"> · {{ t('videoStatus') }}: {{ videoLabel(lesson.video?.status) }}</span>
              </p>
              <div class="admin-ui__chips">
                <span v-if="lesson.is_free_preview" class="admin-ui__chip">{{ t('freePreview') }}</span>
                <span class="admin-ui__chip" :class="lesson.is_published ? 'admin-ui__chip--ok' : 'admin-ui__chip--warn'">
                  {{ lesson.is_published ? t('published') : t('unpublished') }}
                </span>
              </div>
            </div>
          </div>
          <div class="admin-ui__row-actions">
            <button v-if="canManageVideos()" type="button" class="admin-ui__icon-btn" :aria-label="t('uploadVideo')" @click="openVideo(lesson)">
              <v-icon size="18">mdi-video</v-icon>
            </button>
            <button type="button" class="admin-ui__icon-btn" :aria-label="t('moveUp')" :disabled="lessonIndex === 0 || saving" @click="moveLesson(section, lessonIndex, -1)">
              <v-icon size="18">mdi-arrow-up</v-icon>
            </button>
            <button type="button" class="admin-ui__icon-btn" :aria-label="t('moveDown')" :disabled="lessonIndex === section.lessons.length - 1 || saving" @click="moveLesson(section, lessonIndex, 1)">
              <v-icon size="18">mdi-arrow-down</v-icon>
            </button>
            <button type="button" class="admin-ui__icon-btn" :aria-label="t('edit')" @click="openLesson(section, lesson)">
              <v-icon size="18">mdi-pencil</v-icon>
            </button>
            <button type="button" class="admin-ui__icon-btn admin-ui__icon-btn--danger" :aria-label="t('delete')" @click="askDelete('lesson', lesson, section)">
              <v-icon size="18">mdi-delete</v-icon>
            </button>
          </div>
        </article>
      </div>
      <div class="admin-ui__form-actions">
        <button type="button" class="admin-ui__btn admin-ui__btn--soft admin-ui__btn--block admin-ui__btn--block-sm" @click="openLesson(section)">
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newLesson') }}
        </button>
      </div>
    </section>

    <AdminDialog
      v-model="sectionDialog"
      :title="sectionForm.id ? t('editSection') : t('newSection')"
      :max-width="480"
    >
      <v-alert v-if="dialogError" class="mb-3" type="error" variant="tonal">{{ dialogError }}</v-alert>
      <label class="admin-ui__field">
        <span>{{ t('name') }}</span>
        <input v-model="sectionForm.title" type="text">
        <small v-if="fieldErrors.title?.length" style="color:#e85d4c">{{ fieldErrors.title[0] }}</small>
      </label>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="sectionDialog = false">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--solid" :disabled="saving" @click="saveSection">{{ t('save') }}</button>
      </template>
    </AdminDialog>

    <AdminDialog
      v-model="lessonDialog"
      :title="lessonForm.id ? t('editLesson') : t('newLesson')"
      :max-width="520"
    >
      <v-alert v-if="dialogError" class="mb-3" type="error" variant="tonal">{{ dialogError }}</v-alert>
      <div class="admin-ui__form-grid">
        <label class="admin-ui__field">
          <span>{{ t('name') }}</span>
          <input v-model="lessonForm.title" type="text">
          <small v-if="fieldErrors.title?.length" style="color:#e85d4c">{{ fieldErrors.title[0] }}</small>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('durationSeconds') }}</span>
          <input v-model="lessonForm.duration_seconds" type="number">
          <small v-if="fieldErrors.duration_seconds?.length" style="color:#e85d4c">{{ fieldErrors.duration_seconds[0] }}</small>
        </label>
        <label class="admin-ui__switch">
          <input v-model="lessonForm.is_free_preview" type="checkbox">
          {{ t('freePreview') }}
        </label>
        <label class="admin-ui__switch">
          <input v-model="lessonForm.is_published" type="checkbox">
          {{ t('published') }}
        </label>
      </div>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="lessonDialog = false">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--solid" :disabled="saving" @click="saveLesson">{{ t('save') }}</button>
      </template>
    </AdminDialog>

    <AdminDialog
      :model-value="videoDialog"
      :title="canReplace(videoTarget?.video) ? t('uploadVideo') : t('videoStatus')"
      :max-width="560"
      @update:model-value="(open) => !open && closeVideo()"
    >
      <div class="mb-3 text-body-2">{{ videoTarget?.title }}</div>
      <v-alert v-if="videoTarget?.video" class="mb-3" :type="videoTarget.video.status === 'failed' ? 'error' : 'info'" variant="tonal">
        {{ t('videoStatus') }}: {{ videoLabel(videoTarget.video.status) }}
        <span v-if="videoTarget.video.duration_seconds != null"> · {{ videoTarget.video.duration_seconds }}s</span>
        <div v-if="videoTarget.video.error_message">{{ videoTarget.video.error_message }}</div>
      </v-alert>
      <v-img
        v-if="videoTarget?.video?.cover_url"
        :src="videoTarget.video.cover_url"
        max-height="180"
        class="mb-3 rounded"
        cover
      />
      <v-alert v-if="videoMessage" class="mb-3" type="error" variant="tonal">{{ videoMessage }}</v-alert>
      <v-file-input
        v-if="canReplace(videoTarget?.video)"
        v-model="videoFile"
        :label="t('chooseVideo')"
        accept="video/*"
        show-size
        :disabled="videoBusy"
        class="mb-2"
      />
      <v-file-input
        v-if="canReplace(videoTarget?.video) || videoTarget?.video"
        v-model="coverFile"
        :label="t('chooseVideoCover')"
        accept="image/jpeg,image/png,image/webp"
        show-size
        :disabled="videoBusy"
        class="mb-2"
      />
      <div class="d-flex flex-wrap ga-2 mb-2">
        <button
          v-if="canReplace(videoTarget?.video) || (videoTarget?.video && coverFile)"
          type="button"
          class="admin-ui__btn admin-ui__btn--solid"
          :disabled="videoBusy"
          @click="uploadVideo"
        >
          {{ videoTarget?.video?.status === 'failed' ? t('replaceVideo') : (canReplace(videoTarget?.video) ? t('uploadVideo') : t('saveVideoCover')) }}
        </button>
        <button
          v-if="videoTarget?.video?.cover_url"
          type="button"
          class="admin-ui__btn admin-ui__btn--danger"
          :disabled="videoBusy"
          @click="removeCover"
        >
          {{ t('removeVideoCover') }}
        </button>
      </div>
      <v-alert
        v-if="videoTarget?.video && (videoTarget.video.status === 'uploading' || videoTarget.video.status === 'processing')"
        type="info"
        variant="tonal"
      >
        {{ t('videoWaiting') }}
      </v-alert>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="closeVideo">{{ t('cancel') }}</button>
      </template>
    </AdminDialog>

    <AdminDialog
      :model-value="pendingDelete !== null"
      :title="pendingDelete?.kind === 'section' ? t('deleteSection') : t('deleteLesson')"
      :max-width="460"
      danger
      @update:model-value="(open) => { if (!open) pendingDelete = null }"
    >
      <p class="admin-dialog__text">
        {{ pendingDelete?.kind === 'section'
          ? t('confirmDeleteSection', { name: pendingDelete?.title || '' })
          : t('confirmDeleteLesson', { name: pendingDelete?.title || '' }) }}
      </p>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="pendingDelete = null">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--danger" :disabled="saving" @click="confirmDelete">{{ t('delete') }}</button>
      </template>
    </AdminDialog>
</div>
</template>
