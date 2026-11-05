<script setup>
defineProps({
  message: {
    type: String,
    required: true,
  },
  ctaLabel: {
    type: String,
    required: true,
  },
  ctaTo: {
    type: Object,
    default: () => ({ name: 'courses' }),
  },
})
</script>

<template>
  <aside class="student-ui__unlock">
    <p>{{ message }}</p>
    <router-link class="student-ui__unlock-cta" :to="ctaTo">
      {{ ctaLabel }}
      <span aria-hidden="true">→</span>
    </router-link>
  </aside>
</template>
