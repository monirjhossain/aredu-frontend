import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { i18n } from './plugins/i18n'
import { vuetify } from './plugins/vuetify'
import router from './router'
import { bindAuth, setupHttp } from './services/http'
import { useAuthStore } from './stores/auth'
import './style.css'
import './styles/admin-ui.css'
import './styles/student-ui.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
setupHttp()

const auth = useAuthStore()
bindAuth({
  token: () => auth.token,
  onUnauthorized: () => {
    auth.clear()
    if (router.currentRoute.value.meta.requiresAuth) {
      router.push({ name: 'login' })
    }
  },
})

app.use(router)
app.use(i18n)
app.use(vuetify)
app.mount('#app')

if (auth.token) {
  auth.fetchMe().catch(() => {})
}
