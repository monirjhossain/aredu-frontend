<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    default: '',
  },
  backTo: {
    type: [Object, String],
    default: null,
  },
  backLabel: {
    type: String,
    default: '←',
  },
  timerLabel: {
    type: String,
    default: '',
  },
  timerUrgent: {
    type: Boolean,
    default: false,
  },
  showTimer: {
    type: Boolean,
    default: false,
  },
  isSubmitted: {
    type: Boolean,
    default: false,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  submitLabel: {
    type: String,
    default: '',
  },
  resultsTo: {
    type: [Object, String],
    default: null,
  },
  resultsLabel: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['back', 'submit'])
</script>

<template>
  <div class="student-ui__attempt">
    <header class="student-ui__attempt-bar">
      <div class="student-ui__attempt-main">
        <router-link
          v-if="backTo"
          class="student-ui__attempt-back"
          :to="backTo"
          :aria-label="backLabel"
        >
          ←
        </router-link>
        <button
          v-else
          type="button"
          class="student-ui__attempt-back"
          :aria-label="backLabel"
          @click="emit('back')"
        >
          ←
        </button>
        <div class="student-ui__attempt-titles">
          <h1>{{ title }}</h1>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
      </div>
      <div class="student-ui__attempt-actions">
        <span
          v-if="showTimer && !isSubmitted"
          class="student-ui__timer"
          :class="{ 'is-urgent': timerUrgent }"
        >
          {{ timerLabel }}
        </span>
        <button
          v-if="!isSubmitted && submitLabel"
          type="button"
          class="student-ui__attempt-cta"
          :disabled="submitting"
          @click="emit('submit')"
        >
          {{ submitLabel }}
        </button>
        <router-link
          v-else-if="isSubmitted && resultsTo"
          class="student-ui__attempt-cta"
          :to="resultsTo"
        >
          {{ resultsLabel }}
        </router-link>
        <slot name="actions" />
      </div>
    </header>

    <slot name="alerts" />
    <slot name="score" />
    <slot name="nav" />
    <slot />
  </div>
</template>
