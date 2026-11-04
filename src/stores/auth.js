import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { http } from '../services/http'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

function readUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(sessionStorage.getItem(TOKEN_KEY) || '')
  const user = ref(readUser())

  const isAuthenticated = computed(() => token.value !== '')
  const roles = computed(() => user.value?.roles ?? [])
  const permissions = computed(() => user.value?.permissions ?? [])

  function hasRole(slug) {
    return roles.value.includes(slug)
  }

  function hasPermission(slug) {
    return permissions.value.includes(slug)
  }

  const isAdmin = computed(() => hasRole('super_admin') || hasPermission('reports.view'))
  const isTeacher = computed(() => hasRole('teacher') || hasPermission('writing.evaluate') || hasPermission('speaking.evaluate'))
  const isStudent = computed(() => hasRole('student') && !isAdmin.value && !isTeacher.value)
  const isStaff = computed(() => isAdmin.value || isTeacher.value)

  function postLoginRoute() {
    if (isAdmin.value) {
      return { name: 'admin-dashboard' }
    }
    if (hasPermission('writing.evaluate')) {
      return { name: 'teacher-writing-queue' }
    }
    if (hasPermission('speaking.evaluate')) {
      return { name: 'teacher-speaking-queue' }
    }
    if (isStudent.value || hasRole('student')) {
      return { name: 'student-dashboard' }
    }
    return { name: 'home' }
  }

  function persist() {
    if (token.value) {
      sessionStorage.setItem(TOKEN_KEY, token.value)
      sessionStorage.setItem(USER_KEY, JSON.stringify(user.value))
      return
    }

    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
  }

  function setSession(payload) {
    token.value = payload.token
    user.value = payload.user
    persist()
  }

  function clear() {
    token.value = ''
    user.value = null
    persist()
  }

  async function login(email, password) {
    const { data } = await http.post(
      '/login',
      { email, password },
      { skipErrorToast: true, skipAuthRedirect: true },
    )
    setSession(data.data)
  }

  async function register(payload) {
    const { data } = await http.post('/register', payload, {
      skipErrorToast: true,
      skipAuthRedirect: true,
    })
    setSession(data.data)
  }

  async function logout() {
    try {
      await http.post('/logout', null, { skipErrorToast: true, skipAuthRedirect: true })
    } finally {
      clear()
    }
  }

  async function fetchMe() {
    const { data } = await http.get('/me', { skipErrorToast: true })
    user.value = data.data
    persist()
  }

  async function updateProfile(payload) {
    const { data } = await http.put('/profile', payload, { skipErrorToast: true })
    user.value = data.data
    persist()
    return data.message
  }

  async function updateAvatar(file) {
    const form = new FormData()
    form.append('avatar', file)
    const { data } = await http.post('/profile/avatar', form, {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    user.value = data.data
    persist()
    return data.message
  }

  async function deleteAvatar() {
    const { data } = await http.delete('/profile/avatar', {
      skipErrorToast: true,
      skipSuccessToast: true,
    })
    user.value = data.data
    persist()
    return data.message
  }

  async function changePassword(payload) {
    const { data } = await http.put('/password', payload, { skipErrorToast: true })
    return data.message
  }

  async function forgotPassword(email) {
    const { data } = await http.post(
      '/forgot-password',
      { email },
      { skipErrorToast: true, skipAuthRedirect: true },
    )
    return data.message
  }

  async function resetPassword(payload) {
    const { data } = await http.post('/reset-password', payload, {
      skipErrorToast: true,
      skipAuthRedirect: true,
    })
    return data.message
  }

  return {
    token,
    user,
    isAuthenticated,
    roles,
    permissions,
    isAdmin,
    isTeacher,
    isStudent,
    isStaff,
    hasRole,
    hasPermission,
    postLoginRoute,
    clear,
    login,
    register,
    logout,
    fetchMe,
    updateProfile,
    updateAvatar,
    deleteAvatar,
    changePassword,
    forgotPassword,
    resetPassword,
  }
})
