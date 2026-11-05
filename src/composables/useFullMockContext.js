import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { http } from '../services/http'

/**
 * Shared helper for skill pages opened from the Full Mock exam hub.
 * Reads `context_key` + `session` from the route query.
 */
export function useFullMockContext() {
  const route = useRoute()
  const router = useRouter()

  const contextKey = computed(() => (typeof route.query.context_key === 'string' ? route.query.context_key : ''))
  const sessionUuid = computed(() => (typeof route.query.session === 'string' ? route.query.session : ''))
  const inSession = computed(() => Boolean(sessionUuid.value))
  const contextParams = computed(() => (contextKey.value ? { context_key: contextKey.value } : {}))
  const hubRoute = computed(() => (
    sessionUuid.value ? { name: 'full-mock-session', params: { uuid: sessionUuid.value } } : null
  ))

  /**
   * Confirm the matching in-progress section as complete (the API reconciles submitted
   * artifacts) and go back to the exam hub. Always redirects, even if completion fails,
   * because the hub shows the authoritative state.
   *
   * @param {(section: object) => boolean} matcher
   */
  async function completeAndReturn(matcher) {
    if (!sessionUuid.value) return
    const uuid = sessionUuid.value
    try {
      const { data } = await http.get(`/full-mock-sessions/${uuid}`, { skipErrorToast: true })
      const sections = data?.data?.sections || []
      const section = sections.find(matcher)
      if (section && section.status === 'in_progress') {
        await http.post(`/full-mock-sessions/${uuid}/sections/${section.id}/complete`, {}, {
          skipErrorToast: true,
          skipSuccessToast: true,
        })
      }
    } catch {
      // Hub reconciles on load.
    }
    router.replace({ name: 'full-mock-session', params: { uuid } })
  }

  return { contextKey, sessionUuid, inSession, contextParams, hubRoute, completeAndReturn }
}

export function firstApiMessage(error, fallback = '') {
  const data = error?.response?.data
  const errors = data?.errors
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat()[0]
    if (first) return String(first)
  }
  return data?.message || fallback
}
