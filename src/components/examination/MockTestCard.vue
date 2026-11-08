<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  lead: {
    type: String,
    default: '',
  },
  meta: {
    type: String,
    default: '',
  },
  badges: {
    type: Array,
    default: () => [],
  },
  freeSample: {
    type: Boolean,
    default: false,
  },
  freeSampleLabel: {
    type: String,
    default: '',
  },
  premiumLabel: {
    type: String,
    default: '',
  },
  ctaLabel: {
    type: String,
    required: true,
  },
  to: {
    type: [Object, String],
    required: true,
  },
})
</script>

<template>
  <article class="student-ui__card">
    <div class="student-ui__card-top">
      <div class="student-ui__card-badges">
        <span
          class="student-ui__badge"
          :class="freeSample ? 'student-ui__badge--free' : 'student-ui__badge--premium'"
        >
          {{ freeSample ? (freeSampleLabel || 'Free') : (premiumLabel || 'Premium') }}
        </span>
        <span v-for="(badge, index) in badges" :key="`${badge}-${index}`" class="student-ui__badge">
          {{ badge }}
        </span>
      </div>
      <span v-if="meta" class="student-ui__card-meta">{{ meta }}</span>
    </div>
    <h2 class="student-ui__card-title">{{ title }}</h2>
    <slot name="subtitle" />
    <p v-if="lead" class="student-ui__card-lead">{{ lead }}</p>
    <slot />
    <router-link class="student-ui__card-cta" :to="to">
      {{ ctaLabel }}
      <span aria-hidden="true">→</span>
    </router-link>
  </article>
</template>
