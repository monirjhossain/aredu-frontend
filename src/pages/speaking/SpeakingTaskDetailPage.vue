<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PracticeAudioPlayer from '../../components/examination/PracticeAudioPlayer.vue'
import { http } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'
import { useFullMockContext } from '../../composables/useFullMockContext'

const { t } = useI18n()
const ui = useUiStore()
const route = useRoute()
const auth = useAuthStore()
const { contextKey, contextParams, inSession, hubRoute, completeAndReturn } = useFullMockContext()

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
const prepRemaining = ref(0)
const prepActive = ref(false)
let prepTimer = null

const locked = computed(() => recording.value?.status === 'submitted')
const evaluation = computed(() => recording.value?.evaluation || null)
const canSubmit = computed(() => recording.value?.status === 'uploaded' && !locked.value)
const previewSrc = computed(() => serverAudioUrl.value || localPreviewUrl.value)

onMounted(load)
watch(() => route.params.id, () => {
  if (isRecording.value) stopRecording()
  stopTimer()
  stopPrep()
  stopTracks()
  revokeLocal()
  revokeServer()
  load()
})
onBeforeUnmount(() => {
  stopTimer()
  stopPrep()
  stopTracks()
  revokeLocal()
  revokeServer()
})

async function load() {
  loading.value = true
  message.value = ''
  task.value = null
  recording.value = null
  elapsed.value = 0
  audioError.value = ''
  stopPrep()
  try {
    const [taskRes, recordingRes] = await Promise.all([
      http.get(`/speaking-tasks/${route.params.id}`, { skipErrorToast: true }),
      http.get(`/speaking-tasks/${route.params.id}/recording`, {
        params: contextParams.value,
        skipErrorToast: true,
      }),
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

function stopPrep() {
  if (prepTimer) {
    clearInterval(prepTimer)
    prepTimer = null
  }
  prepActive.value = false
  prepRemaining.value = 0
}

function startPrep() {
  if (locked.value || isRecording.value || uploading.value) return
  stopPrep()
  const seconds = Number(task.value?.preparation_seconds || 0)
  if (seconds <= 0) {
    startRecording()
    return
  }
  prepActive.value = true
  prepRemaining.value = seconds
  prepTimer = setInterval(() => {
    prepRemaining.value -= 1
    if (prepRemaining.value <= 0) {
      stopPrep()
      startRecording()
    }
  }, 1000)
}

function skipPrep() {
  stopPrep()
  startRecording()
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
    if (contextKey.value) body.append('context_key', contextKey.value)
    const { data } = await http.post(`/speaking-tasks/${route.params.id}/recording`, body, {
      params: contextParams.value,
      skipErrorToast: true,
      skipSuccessToast: true,
    })
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
    const { data } = await http.post(
      `/speaking-tasks/${route.params.id}/recording/submit`,
      { ...contextParams.value },
      { params: contextParams.value, skipErrorToast: true, skipSuccessToast: true },
    )
    recording.value = data.data
    ui.success(t('recordingSubmitted'))
    if (inSession.value) {
      await completeAndReturn((section) => section.skill === 'speaking'
        && (!contextKey.value || section.context_key === contextKey.value))
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="student-ui">
    <router-link
      class="student-ui__unlock-cta"
      style="background: transparent; color: var(--student-teal); padding-left: 0"
      :to="hubRoute || { name: 'speaking-tasks' }"
    >
      <span aria-hidden="true">←</span>
      {{ hubRoute ? t('backToExamHub') : t('backToSpeakingTasksPublic') }}
    </router-link>

    <div v-if="loading" class="student-ui__loader">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <v-alert v-else-if="message && !task" type="error" variant="tonal">{{ message }}</v-alert>

    <template v-else-if="task">
      <header class="student-ui__hero">
        <div>
          <p class="student-ui__eyebrow">{{ partLabel(task.part) }}</p>
          <h1>{{ task.title }}</h1>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.7rem">
            <span class="student-ui__badge" style="background: rgba(255,255,255,0.16); color: #fff">
              {{ t('prepSecondsShort', { count: task.preparation_seconds }) }}
            </span>
            <span class="student-ui__badge" style="background: rgba(255,255,255,0.16); color: #fff">
              {{ t('responseSecondsShort', { count: task.response_seconds }) }}
            </span>
            <span class="student-ui__badge" style="background: rgba(255,255,255,0.16); color: #fff">
              {{ t('questionsCount', { count: (task.questions || []).length }) }}
            </span>
          </div>
        </div>
        <router-link class="student-ui__hero-link" :to="{ name: 'speaking-recordings' }">
          {{ t('mySpeakingRecordings') }}
          <span aria-hidden="true">→</span>
        </router-link>
      </header>

      <v-alert v-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <v-alert v-if="locked" type="info" variant="tonal">{{ t('speakingLocked') }}</v-alert>
      <v-alert v-if="locked && hubRoute" type="success" variant="tonal">
        <router-link :to="hubRoute">{{ t('returnToExamHub') }} →</router-link>
      </v-alert>

      <section class="student-ui__pane">
        <h2>{{ t('speakingQuestions') }}</h2>
        <p v-if="task.instructions" class="student-ui__hint" style="white-space: pre-wrap">{{ task.instructions }}</p>
        <ol style="margin: 0; padding: 0; list-style: none; display: grid; gap: 0.75rem">
          <li
            v-for="(item, index) in task.questions || []"
            :key="item.id"
            class="student-ui__card"
            style="display: grid; grid-template-columns: auto 1fr; gap: 0.75rem; align-items: start"
          >
            <span class="student-ui__badge">{{ index + 1 }}</span>
            <div>
              <p style="margin: 0; font-weight: 750; line-height: 1.45">{{ item.prompt }}</p>
              <div v-if="item.cue_card" class="student-ui__hint" style="margin-top: 0.55rem; padding: 0.65rem; border-radius: 0.55rem; background: var(--student-paper)">
                <strong>{{ t('speakingCueCardTitle') }}</strong>
                <p style="margin: 0.35rem 0 0; white-space: pre-wrap">{{ item.cue_card }}</p>
              </div>
            </div>
          </li>
        </ol>
      </section>

      <section class="student-ui__pane">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.55rem; margin-bottom: 0.75rem">
          <h2 style="margin: 0">{{ t('yourRecording') }}</h2>
          <span v-if="recording" class="student-ui__badge" :class="{ 'student-ui__badge--free': recording.status !== 'submitted' }">
            {{ recording.status === 'submitted' ? t('statusSubmitted') : (recording.status === 'uploaded' ? t('statusUploaded') : recording.status) }}
          </span>
        </div>

        <v-alert v-if="!recorderSupported" type="warning" variant="tonal" class="mb-3">
          {{ t('mediaRecorderUnsupported') }}
        </v-alert>

        <div class="student-ui__recorder">
          <div class="student-ui__recorder-ring" :class="{ 'is-live': isRecording }">
            <button
              v-if="recorderSupported && !isRecording && !prepActive"
              type="button"
              class="student-ui__recorder-mic"
              :disabled="locked || uploading"
              :aria-label="t('startRecording')"
              @click="startPrep"
            >
              <v-icon size="28">mdi-microphone</v-icon>
            </button>
            <button
              v-else-if="isRecording"
              type="button"
              class="student-ui__recorder-mic is-live"
              :aria-label="t('stopRecording')"
              @click="stopRecording"
            >
              <v-icon size="28">mdi-stop</v-icon>
            </button>
            <div v-else-if="prepActive" class="student-ui__recorder-time">{{ prepRemaining }}</div>
          </div>

          <div v-if="prepActive" class="student-ui__recorder-time">
            {{ t('prepCountdown', { count: prepRemaining }) }}
          </div>
          <div v-else class="student-ui__recorder-time">
            {{ t('recordingElapsed', { count: elapsed }) }}
            <span v-if="task.response_seconds" style="opacity: 0.65; font-size: 0.9rem"> / {{ task.response_seconds }}s</span>
          </div>
          <p v-if="!isRecording && !prepActive && !locked" class="student-ui__hint" style="margin: 0">
            {{ t('startWhenReady') }}
          </p>

          <div class="student-ui__recorder-actions">
            <button
              v-if="prepActive"
              type="button"
              class="student-ui__btn student-ui__btn--yellow"
              @click="skipPrep"
            >
              {{ t('skipPrep') }}
            </button>
            <button
              type="button"
              class="student-ui__btn student-ui__btn--soft"
              :disabled="locked || uploading || isRecording || prepActive"
              @click="fileInput?.click()"
            >
              <v-icon size="18">mdi-upload</v-icon>
              {{ t('uploadRecordingFile') }}
            </button>
            <button
              type="button"
              class="student-ui__btn student-ui__btn--dark"
              :disabled="!canSubmit || submitting"
              @click="submitRecording"
            >
              <v-icon size="18">mdi-send</v-icon>
              {{ t('submitRecording') }}
            </button>
          </div>
        </div>

        <input ref="fileInput" type="file" class="d-none" accept="audio/*,video/webm" @change="onFileSelected">
        <v-progress-linear v-if="uploading || submitting" indeterminate color="#0f5c66" class="mb-3" />
        <PracticeAudioPlayer
          v-if="previewSrc || audioError"
          :src="previewSrc"
          :error="audioError"
          :loading-label="t('loadingAudio')"
        />

        <ul class="student-ui__tips" style="margin-top: 1rem">
          <li>{{ t('speakingTipRecord') }}</li>
          <li>{{ t('speakingTipPrep') }}</li>
          <li>{{ t('speakingTipSubmit') }}</li>
        </ul>
      </section>

      <section v-if="evaluation" class="student-ui__pane">
        <h2>{{ t('yourEvaluation') }}</h2>
        <p class="student-ui__hint">{{ t('evaluationReturned') }}</p>
        <div class="student-ui__card" style="align-items: center; text-align: center; margin-bottom: 0.75rem">
          <span class="student-ui__card-meta">{{ t('overallBand') }}</span>
          <strong style="font-size: 1.6rem; color: var(--student-teal)">{{ evaluation.overall_band }}</strong>
        </div>
        <div class="student-ui__grid" style="grid-template-columns: repeat(2, minmax(0, 1fr))">
          <div class="student-ui__card"><span class="student-ui__card-meta">{{ t('fluency') }}</span><strong>{{ evaluation.fluency }}</strong></div>
          <div class="student-ui__card"><span class="student-ui__card-meta">{{ t('lexical') }}</span><strong>{{ evaluation.lexical }}</strong></div>
          <div class="student-ui__card"><span class="student-ui__card-meta">{{ t('grammar') }}</span><strong>{{ evaluation.grammar }}</strong></div>
          <div class="student-ui__card"><span class="student-ui__card-meta">{{ t('pronunciation') }}</span><strong>{{ evaluation.pronunciation }}</strong></div>
        </div>
        <p v-if="evaluation.feedback" class="student-ui__hint" style="white-space: pre-wrap; margin-top: 0.75rem">{{ evaluation.feedback }}</p>
        <p v-else class="student-ui__hint">{{ t('noTeacherFeedback') }}</p>
      </section>
      <v-alert v-else-if="locked" type="info" variant="tonal">{{ t('waitingForEvaluation') }}</v-alert>
    </template>
  </div>
</template>
