import axios from 'axios'
import { i18n } from '../plugins/i18n'
import { useUiStore } from '../stores/ui'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    Accept: 'application/json',
  },
})

let readToken = () => ''
let handleUnauthorized = () => {}

export function bindAuth(handlers) {
  readToken = handlers.token
  handleUnauthorized = handlers.onUnauthorized
}

function isMutating(method) {
  return ['post', 'put', 'patch', 'delete'].includes(String(method || '').toLowerCase())
}

export function setupHttp() {
  http.interceptors.request.use((config) => {
    useUiStore().startLoading()
    const token = readToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  http.interceptors.response.use(
    (response) => {
      useUiStore().stopLoading()

      const config = response.config || {}
      if (isMutating(config.method) && !config.skipSuccessToast) {
        const message = response.data?.message
        if (typeof message === 'string' && message.trim()) {
          useUiStore().success(message)
        }
      }

      return response
    },
    (error) => {
      useUiStore().stopLoading()

      if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
        handleUnauthorized()
      }

      if (!error.config?.skipErrorToast) {
        const message = error.response?.data?.message || i18n.global.t('requestFailed')
        useUiStore().setError(message)
      }

      return Promise.reject(error)
    },
  )
}
