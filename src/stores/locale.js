import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref(localStorage.getItem('locale') === 'bn' ? 'bn' : 'en')

  function setLocale(next) {
    locale.value = next === 'bn' ? 'bn' : 'en'
    localStorage.setItem('locale', locale.value)
  }

  return { locale, setLocale }
})
