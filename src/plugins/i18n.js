import { createI18n } from 'vue-i18n'
import bn from '../locales/bn'
import en from '../locales/en'

const saved = localStorage.getItem('locale')

export const i18n = createI18n({
  legacy: false,
  locale: saved === 'bn' ? 'bn' : 'en',
  fallbackLocale: 'en',
  messages: { en, bn },
})
