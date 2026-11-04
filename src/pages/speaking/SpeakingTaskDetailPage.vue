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
  <div class="smock">
    <router-link class="smock__back" :to="{ name: 'speaking-tasks' }">
      <span aria-hidden="true">←</span>
      {{ t('backToSpeakingTasksPublic') }}
    </router-link>

    <div v-if="loading" class="smock__panel smock__loader">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <v-alert v-else-if="message && !task" type="error" variant="tonal">{{ message }}</v-alert>

    <template v-else-if="task">
      <header class="smock__hero">
        <div>
          <p class="smock__eyebrow">{{ partLabel(task.part) }}</p>
          <h1>{{ task.title }}</h1>
          <div class="smock__pills">
            <span>{{ t('prepSecondsShort', { count: task.preparation_seconds }) }}</span>
            <span>{{ t('responseSecondsShort', { count: task.response_seconds }) }}</span>
            <span>{{ t('questionsCount', { count: (task.questions || []).length }) }}</span>
          </div>
        </div>
        <router-link class="smock__hero-link" :to="{ name: 'speaking-recordings' }">
          {{ t('mySpeakingRecordings') }}
          <span aria-hidden="true">→</span>
        </router-link>
      </header>

      <v-alert v-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <v-alert v-if="locked" type="info" variant="tonal">{{ t('speakingLocked') }}</v-alert>

      <section class="smock__panel">
        <h2 class="smock__h2">{{ t('speakingQuestions') }}</h2>
        <p v-if="task.instructions" class="smock__instructions">{{ task.instructions }}</p>
        <ol class="smock__questions">
          <li v-for="item in task.questions || []" :key="item.id" class="smock-q">
            <span class="smock-q__num">{{ item.position }}</span>
            <div class="smock-q__body">
              <p class="smock-q__prompt">{{ item.prompt }}</p>
              <div v-if="item.cue_card" class="smock-q__cue">
                <strong>{{ t('speakingCueCardTitle') }}</strong>
                <p>{{ item.cue_card }}</p>
              </div>
            </div>
          </li>
        </ol>
      </section>

      <section class="smock__panel">
        <div class="smock__panel-head">
          <h2 class="smock__h2">{{ t('yourRecording') }}</h2>
          <span v-if="recording" class="smock__status" :class="`is-${recording.status}`">
            {{ recording.status === 'submitted' ? t('statusSubmitted') : (recording.status === 'uploaded' ? t('statusUploaded') : recording.status) }}
          </span>
        </div>

        <v-alert v-if="!recorderSupported" type="warning" variant="tonal" class="mb-3">
          {{ t('mediaRecorderUnsupported') }}
        </v-alert>

        <div class="smock__timer" :class="{ 'is-live': isRecording }">
          <span v-if="isRecording" class="smock__dot" aria-hidden="true" />
          <strong>{{ t('recordingElapsed', { count: elapsed }) }}</strong>
          <span v-if="task.response_seconds">/ {{ task.response_seconds }}s</span>
        </div>

        <div class="smock__actions">
          <button
            v-if="recorderSupported"
            type="button"
            class="smock__btn smock__btn--primary"
            :disabled="locked || isRecording || uploading"
            @click="startRecording"
          >
            <v-icon size="18">mdi-microphone</v-icon>
            {{ t('startRecording') }}
          </button>
          <button
            v-if="isRecording"
            type="button"
            class="smock__btn smock__btn--danger"
            @click="stopRecording"
          >
            <v-icon size="18">mdi-stop</v-icon>
            {{ t('stopRecording') }}
          </button>
          <button
            type="button"
            class="smock__btn smock__btn--soft"
            :disabled="locked || uploading || isRecording"
            @click="fileInput?.click()"
          >
            <v-icon size="18">mdi-upload</v-icon>
            {{ t('uploadRecordingFile') }}
          </button>
          <button
            type="button"
            class="smock__btn smock__btn--dark"
            :disabled="!canSubmit || submitting"
            @click="submitRecording"
          >
            <v-icon size="18">mdi-send</v-icon>
            {{ t('submitRecording') }}
          </button>
        </div>

        <input ref="fileInput" type="file" class="d-none" accept="audio/*,video/webm" @change="onFileSelected">
        <v-progress-linear v-if="uploading || submitting" indeterminate color="#0f5c66" class="mb-3" />
        <v-alert v-if="audioError" type="warning" variant="tonal">{{ audioError }}</v-alert>
        <audio v-else-if="serverAudioUrl || localPreviewUrl" :src="serverAudioUrl || localPreviewUrl" controls class="smock__audio" />

        <ul class="smock__tips">
          <li>{{ t('speakingTipRecord') }}</li>
          <li>{{ t('speakingTipPrep') }}</li>
          <li>{{ t('speakingTipSubmit') }}</li>
        </ul>
      </section>

      <section v-if="evaluation" class="smock__panel">
        <h2 class="smock__h2">{{ t('yourEvaluation') }}</h2>
        <p class="smock__muted">{{ t('evaluationReturned') }}</p>
        <div class="smock__band">
          <span>{{ t('overallBand') }}</span>
          <strong>{{ evaluation.overall_band }}</strong>
        </div>
        <div class="smock__scores">
          <div><span>{{ t('fluency') }}</span><strong>{{ evaluation.fluency }}</strong></div>
          <div><span>{{ t('lexical') }}</span><strong>{{ evaluation.lexical }}</strong></div>
          <div><span>{{ t('grammar') }}</span><strong>{{ evaluation.grammar }}</strong></div>
          <div><span>{{ t('pronunciation') }}</span><strong>{{ evaluation.pronunciation }}</strong></div>
        </div>
        <p v-if="evaluation.feedback" class="smock__feedback">{{ evaluation.feedback }}</p>
        <p v-else class="smock__muted">{{ t('noTeacherFeedback') }}</p>
      </section>
      <v-alert v-else-if="locked" type="info" variant="tonal">{{ t('waitingForEvaluation') }}</v-alert>
    </template>
  </div>
</template>

<style scoped>
.smock {
  display: grid;
  gap: 1rem;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
  color: #102a2e;
}

.smock__back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  width: fit-content;
  color: #0f5c66;
  font-weight: 800;
  font-size: 0.88rem;
  text-decoration: none;
}

.smock__hero {
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
  .smock__hero {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.smock__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.smock__hero h1 {
  margin: 0;
  font-size: clamp(1.35rem, 3vw, 1.8rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  word-break: break-word;
}

.smock__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.7rem;
}

.smock__pills span {
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 0.78rem;
  font-weight: 750;
}

.smock__hero-link {
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

.smock__panel {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid #d9e6e8;
  background: #fff;
  box-shadow: 0 8px 20px rgba(11, 27, 52, 0.04);
  min-width: 0;
}

.smock__loader {
  display: grid;
  place-items: center;
  min-height: 160px;
}

.smock__panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.smock__h2 {
  margin: 0 0 0.6rem;
  font-size: 1.05rem;
  font-weight: 800;
}

.smock__panel-head .smock__h2 {
  margin: 0;
}

.smock__status {
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  background: rgba(15, 92, 102, 0.12);
  color: #0f5c66;
  font-size: 0.74rem;
  font-weight: 800;
}

.smock__status.is-submitted {
  background: rgba(22, 130, 73, 0.14);
  color: #167a46;
}

.smock__instructions {
  margin: 0 0 0.9rem;
  color: #3c5a60;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.smock__questions {
  display: grid;
  gap: 0.65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.smock-q {
  display: flex;
  gap: 0.7rem;
  padding: 0.8rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.8rem;
  background: #fbfcfd;
}

.smock-q__num {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 50%;
  background: #0f5c66;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 800;
}

.smock-q__body {
  min-width: 0;
  flex: 1;
}

.smock-q__prompt {
  margin: 0.25rem 0 0;
  font-weight: 700;
  line-height: 1.45;
  word-break: break-word;
}

.smock-q__cue {
  margin-top: 0.6rem;
  padding: 0.7rem 0.8rem;
  border-left: 4px solid #f5c518;
  border-radius: 0.5rem;
  background: #fffbe8;
  font-size: 0.9rem;
}

.smock-q__cue p {
  margin: 0.25rem 0 0;
  line-height: 1.5;
  white-space: pre-wrap;
}

.smock__timer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.8rem;
  font-size: 1.5rem;
  color: #0f5c66;
}

.smock__timer > span:last-child {
  color: #5b7378;
  font-size: 0.9rem;
}

.smock__timer.is-live strong {
  color: #c0392b;
}

.smock__dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: #c0392b;
  animation: smock-pulse 1s ease-in-out infinite;
}

@keyframes smock-pulse {
  50% {
    opacity: 0.25;
  }
}

.smock__actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.9rem;
}

@media (min-width: 640px) {
  .smock__actions {
    display: flex;
    flex-wrap: wrap;
  }
}

.smock__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0 1.1rem;
  border: 0;
  border-radius: 0.65rem;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 800;
  cursor: pointer;
}

.smock__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.smock__btn--primary {
  background: #0f5c66;
  color: #fff;
}

.smock__btn--danger {
  background: #c0392b;
  color: #fff;
}

.smock__btn--soft {
  background: rgba(15, 92, 102, 0.12);
  color: #0f5c66;
}

.smock__btn--dark {
  background: #0b1b34;
  color: #fff;
}

.smock__audio {
  display: block;
  width: 100%;
  margin-top: 0.4rem;
}

.smock__tips {
  display: grid;
  gap: 0.3rem;
  margin: 1rem 0 0;
  padding: 0.75rem 0.9rem 0.75rem 1.8rem;
  border-radius: 0.75rem;
  background: rgba(15, 92, 102, 0.06);
  color: #3c5a60;
  font-size: 0.84rem;
  line-height: 1.4;
}

.smock__muted {
  margin: 0;
  color: #5b7378;
  font-size: 0.88rem;
}

.smock__band {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  margin: 0.75rem 0;
  color: #5b7378;
  font-weight: 750;
}

.smock__band strong {
  color: #0f5c66;
  font-size: 2rem;
  line-height: 1;
}

.smock__scores {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  margin-bottom: 0.9rem;
}

@media (min-width: 720px) {
  .smock__scores {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.smock__scores div {
  display: grid;
  gap: 0.15rem;
  padding: 0.7rem;
  border: 1px solid #d9e6e8;
  border-radius: 0.7rem;
  background: #fbfcfd;
}

.smock__scores span {
  color: #5b7378;
  font-size: 0.76rem;
  font-weight: 700;
}

.smock__scores strong {
  font-size: 1.15rem;
}

.smock__feedback {
  margin: 0;
  line-height: 1.55;
  white-space: pre-wrap;
}
</style>
