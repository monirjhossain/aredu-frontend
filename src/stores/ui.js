import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const pending = ref(0)
  const error = ref('')
  const loading = computed(() => pending.value > 0)

  function startLoading() {
    pending.value += 1
  }

  function stopLoading() {
    pending.value = Math.max(0, pending.value - 1)
  }

  function setError(message) {
    error.value = message
  }

  function clearError() {
    error.value = ''
  }

  return { loading, error, startLoading, stopLoading, setError, clearError }
})
