<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  src: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  loadingLabel: {
    type: String,
    default: 'Loading…',
  },
})

const audioEl = ref(null)
const playing = ref(false)
const current = ref(0)
const duration = ref(0)
const rate = ref(1)
const rates = [0.75, 1, 1.25, 1.5]

const currentLabel = computed(() => formatTime(current.value))
const durationLabel = computed(() => formatTime(duration.value))

watch(() => props.src, () => {
  playing.value = false
  current.value = 0
  duration.value = 0
})

onBeforeUnmount(() => {
  if (audioEl.value) {
    audioEl.value.pause()
  }
})

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

function onLoaded() {
  duration.value = audioEl.value?.duration || 0
}

function onTime() {
  current.value = audioEl.value?.currentTime || 0
}

function onEnded() {
  playing.value = false
}

async function toggle() {
  if (!audioEl.value || props.disabled || !props.src) return
  if (playing.value) {
    audioEl.value.pause()
    playing.value = false
    return
  }
  try {
    await audioEl.value.play()
    playing.value = true
  } catch {
    playing.value = false
  }
}

function seek(event) {
  if (!audioEl.value) return
  const next = Number(event.target.value || 0)
  audioEl.value.currentTime = next
  current.value = next
}

function setRate(next) {
  rate.value = next
  if (audioEl.value) audioEl.value.playbackRate = next
}
</script>

<template>
  <div class="student-ui__audio">
    <v-alert v-if="error" type="warning" variant="tonal">{{ error }}</v-alert>
    <template v-else-if="src">
      <audio
        ref="audioEl"
        :src="src"
        preload="metadata"
        class="d-none"
        @loadedmetadata="onLoaded"
        @timeupdate="onTime"
        @ended="onEnded"
        @pause="playing = false"
        @play="playing = true"
      />
      <div class="student-ui__audio-row">
        <button
          type="button"
          class="student-ui__audio-play"
          :disabled="disabled"
          :aria-label="playing ? 'Pause' : 'Play'"
          @click="toggle"
        >
          <v-icon size="22">{{ playing ? 'mdi-pause' : 'mdi-play' }}</v-icon>
        </button>
        <div class="student-ui__audio-meta">
          <input
            class="student-ui__audio-seek"
            type="range"
            min="0"
            :max="duration || 0"
            step="0.1"
            :value="current"
            :disabled="disabled || !duration"
            @input="seek"
          >
          <div class="student-ui__audio-times">
            <span>{{ currentLabel }}</span>
            <span>{{ durationLabel }}</span>
          </div>
        </div>
      </div>
      <div class="student-ui__audio-rates" role="group" aria-label="Playback speed">
        <button
          v-for="item in rates"
          :key="item"
          type="button"
          class="student-ui__audio-rate"
          :class="{ 'is-active': rate === item }"
          :disabled="disabled"
          @click="setRate(item)"
        >
          {{ item }}×
        </button>
      </div>
    </template>
    <div v-else class="student-ui__hint">{{ loadingLabel }}</div>
  </div>
</template>
