<script setup>
defineProps({
  size: { type: [Number, String], default: 20 },
})
</script>

<template>
  <span class="spark-search" :style="{ '--spark-size': `${size}px` }" aria-hidden="true">
    <svg class="spark-search__glass" viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="10.5" r="6.25" stroke="currentColor" stroke-width="1.9" />
      <path d="M15.4 15.4L20 20" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
    </svg>
    <i class="spark-search__star spark-search__star--a" />
    <i class="spark-search__star spark-search__star--b" />
    <i class="spark-search__star spark-search__star--c" />
  </span>
</template>

<style scoped>
.spark-search {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: var(--spark-size);
  height: var(--spark-size);
  color: #111827;
  flex: 0 0 auto;
}

.spark-search__glass {
  width: 78%;
  height: 78%;
  display: block;
}

.spark-search__star {
  position: absolute;
  background: #f5a524;
  clip-path: polygon(
    50% 0%,
    62% 38%,
    100% 50%,
    62% 62%,
    50% 100%,
    38% 62%,
    0% 50%,
    38% 38%
  );
  animation: spark-twinkle 1.8s ease-in-out infinite;
}

.spark-search__star--a {
  width: 28%;
  height: 28%;
  top: -2%;
  left: 2%;
  animation-delay: 0s;
}

.spark-search__star--b {
  width: 20%;
  height: 20%;
  top: 8%;
  right: -2%;
  animation-delay: 0.45s;
}

.spark-search__star--c {
  width: 18%;
  height: 18%;
  bottom: 8%;
  left: 4%;
  animation-delay: 0.9s;
}

@keyframes spark-twinkle {
  0%, 100% { opacity: 0.55; transform: scale(0.85) rotate(0deg); }
  50% { opacity: 1; transform: scale(1.12) rotate(12deg); }
}

@media (prefers-reduced-motion: reduce) {
  .spark-search__star {
    animation: none;
    opacity: 0.9;
  }
}
</style>
