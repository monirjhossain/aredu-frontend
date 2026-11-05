import { computed, onBeforeUnmount, onMounted, ref, toValue, watch } from 'vue'

/**
 * Typewriter-style placeholder text for empty search fields.
 * @param {import('vue').MaybeRefOrGetter<string>} fullText
 */
export function useTypedPlaceholder(fullText) {
  const typed = ref('')
  let timer = null
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const full = computed(() => String(toValue(fullText) || ''))

  function clear() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function start() {
    clear()
    const text = full.value
    if (!text) {
      typed.value = ''
      return
    }
    if (prefersReducedMotion) {
      typed.value = text
      return
    }

    let index = 0
    let deleting = false

    const tick = () => {
      if (deleting) {
        index = Math.max(0, index - 1)
        typed.value = text.slice(0, index)
        if (index === 0) {
          deleting = false
          timer = setTimeout(tick, 520)
          return
        }
        timer = setTimeout(tick, 28)
        return
      }

      index = Math.min(text.length, index + 1)
      typed.value = text.slice(0, index)
      if (index === text.length) {
        deleting = true
        timer = setTimeout(tick, 1600)
        return
      }
      timer = setTimeout(tick, 55)
    }

    typed.value = ''
    timer = setTimeout(tick, 280)
  }

  onMounted(start)
  onBeforeUnmount(clear)
  watch(full, start)

  return { typed, restart: start, stop: clear }
}
