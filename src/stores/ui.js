import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

let toastSeq = 0

export const useUiStore = defineStore('ui', () => {
  const pending = ref(0)
  const error = ref('')
  const toasts = ref([])
  const loading = computed(() => pending.value > 0)

  function startLoading() {
    pending.value += 1
  }

  function stopLoading() {
    pending.value = Math.max(0, pending.value - 1)
  }

  function setError(message) {
    error.value = message || ''
    if (message) {
      pushToast('error', message)
    }
  }

  function clearError() {
    error.value = ''
  }

  function pushToast(type, message, timeout = 4000) {
    const text = String(message || '').trim()
    if (!text) return

    const id = ++toastSeq
    toasts.value = [...toasts.value.filter((item) => item.message !== text || item.type !== type), {
      id,
      type,
      message: text,
      timeout,
    }].slice(-4)
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }

  function success(message, timeout) {
    pushToast('success', message, timeout)
  }

  function info(message, timeout) {
    pushToast('info', message, timeout)
  }

  function warning(message, timeout) {
    pushToast('warning', message, timeout)
  }

  function toastError(message, timeout) {
    pushToast('error', message, timeout)
  }

  return {
    loading,
    error,
    toasts,
    startLoading,
    stopLoading,
    setError,
    clearError,
    pushToast,
    removeToast,
    success,
    info,
    warning,
    toastError,
  }
})
