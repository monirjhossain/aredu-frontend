<script setup>
import { computed, toRef } from 'vue'
import { useTypedPlaceholder } from '../composables/useTypedPlaceholder'

const props = defineProps({
  text: { type: String, required: true },
  visible: { type: Boolean, default: true },
  showCaret: { type: Boolean, default: true },
  /** left inset so text clears a leading icon */
  padLeft: { type: String, default: '0px' },
  padRight: { type: String, default: '0px' },
})

const { typed } = useTypedPlaceholder(toRef(props, 'text'))

const styleVars = computed(() => ({
  '--typed-pad-left': props.padLeft,
  '--typed-pad-right': props.padRight,
}))
</script>

<template>
  <span
    class="typed-ph"
    :class="{ 'is-hidden': !visible }"
    :style="styleVars"
    aria-hidden="true"
  >
    <span class="typed-ph__text">{{ typed }}</span>
    <i v-if="showCaret && visible" class="typed-ph__caret" />
  </span>
</template>

<style scoped>
.typed-ph {
  position: absolute;
  left: var(--typed-pad-left);
  right: var(--typed-pad-right);
  top: 0;
  bottom: 0;
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  white-space: nowrap;
  color: #9aa6ae;
  font: inherit;
  font-weight: 550;
  line-height: 1;
  pointer-events: none;
  z-index: 1;
}

.typed-ph.is-hidden {
  opacity: 0;
  visibility: hidden;
}

.typed-ph__text {
  overflow: hidden;
  text-overflow: clip;
}

.typed-ph__caret {
  flex: 0 0 auto;
  display: inline-block;
  width: 1.5px;
  height: 1em;
  margin-left: 1px;
  background: #7b8a92;
  animation: typed-caret 1s steps(1) infinite;
}

@keyframes typed-caret {
  0%, 45% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .typed-ph__caret {
    animation: none;
    opacity: 1;
  }
}
</style>
