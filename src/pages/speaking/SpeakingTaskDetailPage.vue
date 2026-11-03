<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const ui = useUiStore()
const route = useRoute()
const auth = useAuthStore()

const task = ref(null)
const recording = ref(null)
const loading = ref(true)
const uploading = ref(false)
const submitting = ref(false)
const message = ref('')
const recorderSupported = ref(typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia)
const mediaRecorder = ref(null)
const mediaStream = ref(null)
const chunks = ref([])
const isRecording = ref(false)
const elapsed = ref(0)
const timerId = ref(null)
const localPreviewUrl = ref('')
const serverAudioUrl = ref('')
const audioError = ref('')
const fileInput = ref(null)

const locked = computed(() => recording.value?.status === 'submitted')
const evaluation = computed(() => recording.value?.evaluation || null)
const canSubmit = computed(() => recording.value?.status === 'uploaded' && !locked.value)

onMounted(load)
onBeforeUnmount(() => {
  stopTimer()
  stopTracks()
  revokeLocal()
  revokeServer()
})

async function load() {
  loading.value = true
  message.value = ''
  try {
    const [taskRes, recordingRes] = await Promise.all([
      http.get(`/speaking-tasks/${route.params.id}`, { skipErrorToast: true }),
      http.get(`/speaking-tasks/${route.params.id}/recording`, { skipErrorToast: true }),
    ])
    task.value = taskRes.data.data
    recording.value = recordingRes.data.data
    if (recording.value?.audio_url) {
      await loadServerAudio(recording.value.audio_url)
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function partLabel(value) {
  if (Number(value) === 1) return t('speakingPart1')
  if (Number(value) === 2) return t('speakingPart2')
  if (Number(value) === 3) return t('speakingPart3')
  return value
}

function stopTimer() {
  if (timerId.value) {
    clearInterval(timerId.value)
    timerId.value = null
  }
}

function startTimer() {
  stopTimer()
  elapsed.value = 0
  timerId.value = setInterval(() => {
    elapsed.value += 1
    const max = Number(task.value?.response_seconds || 0)
    if (max > 0 && elapsed.value >= max && isRecording.value) {
      stopRecording()
    }
  }, 1000)
}

function stopTracks() {
  mediaStream.value?.getTracks()?.forEach((track) => track.stop())
  mediaStream.value = null
}

function revokeLocal() {
  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value)
    localPreviewUrl.value = ''
  }
}

function revokeServer() {
  if (serverAudioUrl.value) {
    URL.revokeObjectURL(serverAudioUrl.value)
    serverAudioUrl.value = ''
  }
}

async function loadServerAudio(url) {
  revokeServer()
  audioError.value = ''
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${auth.token}` } })
    if (!response.ok) {
      audioError.value = t('audioLoadFailed')
      return
    }
    const blob = await response.blob()
    serverAudioUrl.value = URL.createObjectURL(blob)
  } catch {
    audioError.value = t('audioLoadFailed')
  }
}

async function startRecording() {
  if (!recorderSupported.value || locked.value || isRecording.value) return
  message.value = ''
  chunks.value = []
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaStream.value = stream
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '')
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    mediaRecorder.value = recorder
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.value.push(event.data)
    }
    recorder.onstop = async () => {
      stopTracks()
      const blob = new Blob(chunks.value, { type: recorder.mimeType || 'audio/webm' })
      revokeLocal()
      localPreviewUrl.value = URL.createObjectURL(blob)
      await uploadBlob(blob, elapsed.value || undefined)
    }
    recorder.start(250)
    isRecording.value = true
    startTimer()
  } catch {
    message.value = t('microphoneDenied')
    stopTracks()
  }
}

function stopRecording() {
  if (!isRecording.value) return
  isRecording.value = false
  stopTimer()
  mediaRecorder.value?.stop()
}

async function uploadBlob(blob, durationSeconds) {
  uploading.value = true
  message.value = ''
  try {
    const body = new FormData()
    const ext = (blob.type || '').includes('ogg') ? 'ogg' : 'webm'
    body.append('recording', blob, `speaking.${ext}`)
    if (durationSeconds) body.append('duration_seconds', String(durationSeconds))
    const { data } = await http.post(`/speaking-tasks/${route.params.id}/recording`, body, { skipErrorToast: true, skipSuccessToast: true })
    recording.value = data.data
    ui.success(t('recordingUploaded'))
    if (data.data.audio_url) await loadServerAudio(data.data.audio_url)
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    uploading.value = false
  }
}

async function onFileSelected(event) {
  const file = event.target?.files?.[0]
  if (!file || locked.value) return
  await uploadBlob(file)
  if (fileInput.value) fileInput.value.value = ''
}

async function submitRecording() {
  if (!canSubmit.value) return
  submitting.value = true
  message.value = ''
  try {
    const { data } = await http.post(`/speaking-tasks/${route.params.id}/recording/submit`, {}, { skipErrorToast: true, skipSuccessToast: true })
    recording.value = data.data
    ui.success(t('recordingSubmitted'))
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <v-btn class="mb-4" variant="text" :to="{ name: 'speaking-tasks' }">{{ t('backToSpeakingTasksPublic') }}</v-btn>
          <v-progress-circular v-if="loading" indeterminate color="primary" />
          <v-alert v-else-if="message && !task" type="error" variant="tonal">{{ message }}</v-alert>
          <template v-else-if="task">
            <h1 class="text-h5 mb-2">{{ task.title }}</h1>
            <p class="text-medium-emphasis mb-4">
              {{ partLabel(task.part) }}
              · {{ t('prepSecondsShort', { count: task.preparation_seconds }) }}
              · {{ t('responseSecondsShort', { count: task.response_seconds }) }}
            </p>

            <v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
            <v-alert v-if="locked" type="info" variant="tonal" class="mb-4">{{ t('speakingLocked') }}</v-alert>

            <p v-if="task.instructions" class="mb-4" style="white-space: pre-wrap">{{ task.instructions }}</p>
            <v-list lines="three" class="mb-4">
              <v-list-item v-for="item in task.questions || []" :key="item.id">
                <v-list-item-title>{{ item.position }}. {{ item.prompt }}</v-list-item-title>
                <v-list-item-subtitle v-if="item.cue_card" style="white-space: pre-wrap">{{ item.cue_card }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <v-card variant="outlined" class="mb-4">
              <v-card-title>{{ t('yourRecording') }}</v-card-title>
              <v-card-text>
                <v-alert v-if="!recorderSupported" type="warning" variant="tonal" class="mb-3">
                  {{ t('mediaRecorderUnsupported') }}
                </v-alert>
                <p class="mb-3">
                  {{ t('recordingElapsed', { count: elapsed }) }}
                  <v-chip v-if="recording" size="small" class="ms-2" variant="tonal">
                    {{ recording.status === 'submitted' ? t('statusSubmitted') : (recording.status === 'uploaded' ? t('statusUploaded') : recording.status) }}
                  </v-chip>
                </p>
                <div class="d-flex flex-wrap ga-2 mb-3">
                  <v-btn
                    v-if="recorderSupported"
                    color="primary"
                    :disabled="locked || isRecording || uploading"
                    @click="startRecording"
                  >
                    {{ t('startRecording') }}
                  </v-btn>
                  <v-btn
                    v-if="isRecording"
                    color="error"
                    @click="stopRecording"
                  >
                    {{ t('stopRecording') }}
                  </v-btn>
                  <v-btn variant="tonal" :disabled="locked || uploading || isRecording" @click="fileInput?.click()">
                    {{ t('uploadRecordingFile') }}
                  </v-btn>
                  <v-btn color="primary" :loading="submitting" :disabled="!canSubmit" @click="submitRecording">
                    {{ t('submitRecording') }}
                  </v-btn>
                </div>
                <input ref="fileInput" type="file" class="d-none" accept="audio/*,video/webm" @change="onFileSelected" />
                <v-progress-linear v-if="uploading" indeterminate class="mb-3" />
                <v-alert v-if="audioError" type="warning" variant="tonal">{{ audioError }}</v-alert>
                <audio v-else-if="serverAudioUrl || localPreviewUrl" :src="serverAudioUrl || localPreviewUrl" controls class="w-100" />
              </v-card-text>
            </v-card>

            <v-card v-if="evaluation" variant="outlined">
              <v-card-title>{{ t('yourEvaluation') }}</v-card-title>
              <v-card-subtitle>
                {{ t('evaluationReturned') }} · {{ t('overallBand') }}: {{ evaluation.overall_band }}
              </v-card-subtitle>
              <v-card-text>
                <v-row dense class="mb-2">
                  <v-col cols="6" md="3">{{ t('fluency') }}: {{ evaluation.fluency }}</v-col>
                  <v-col cols="6" md="3">{{ t('lexical') }}: {{ evaluation.lexical }}</v-col>
                  <v-col cols="6" md="3">{{ t('grammar') }}: {{ evaluation.grammar }}</v-col>
                  <v-col cols="6" md="3">{{ t('pronunciation') }}: {{ evaluation.pronunciation }}</v-col>
                </v-row>
                <p v-if="evaluation.feedback" style="white-space: pre-wrap">{{ evaluation.feedback }}</p>
                <p v-else class="text-medium-emphasis">{{ t('noTeacherFeedback') }}</p>
              </v-card-text>
            </v-card>
            <v-alert v-else-if="locked" type="info" variant="tonal">{{ t('waitingForEvaluation') }}</v-alert>

          </template>
  </div>
</template>
