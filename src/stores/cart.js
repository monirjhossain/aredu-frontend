import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { sellingPrice } from '../utils/courseDisplay'

const CART_KEY = 'course_cart_v1'

function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && Number.isFinite(Number(item.id)))
      .map((item) => ({
        id: Number(item.id),
        title: String(item.title || ''),
        slug: String(item.slug || ''),
        price: item.price ?? null,
        discount_price: item.discount_price ?? null,
        thumbnail_url: item.thumbnail_url || null,
        exam_type: item.exam_type || null,
      }))
  } catch {
    return []
  }
}

function toCartItem(course) {
  return {
    id: Number(course.id),
    title: String(course.title || ''),
    slug: String(course.slug || ''),
    price: course.price ?? null,
    discount_price: course.discount_price ?? null,
    thumbnail_url: course.thumbnail_url || null,
    exam_type: course.exam_type || null,
  }
}

export const useCartStore = defineStore('cart', () => {
  const items = ref(readCart())

  watch(items, (value) => {
    localStorage.setItem(CART_KEY, JSON.stringify(value))
  }, { deep: true })

  const count = computed(() => items.value.length)
  const courseIds = computed(() => items.value.map((item) => item.id))
  const estimatedSubtotal = computed(() => items.value.reduce((sum, item) => {
    const amount = Number(sellingPrice(item))
    return sum + (Number.isFinite(amount) ? amount : 0)
  }, 0))

  function has(courseId) {
    return items.value.some((item) => item.id === Number(courseId))
  }

  function add(course) {
    if (!course?.id) return false
    if (course.is_enrolled) return false
    if (has(course.id)) return false
    items.value = [...items.value, toCartItem(course)]
    return true
  }

  function remove(courseId) {
    const id = Number(courseId)
    items.value = items.value.filter((item) => item.id !== id)
  }

  function clear() {
    items.value = []
  }

  function removeMany(ids) {
    const set = new Set((ids || []).map(Number))
    items.value = items.value.filter((item) => !set.has(item.id))
  }

  return {
    items,
    count,
    courseIds,
    estimatedSubtotal,
    has,
    add,
    remove,
    clear,
    removeMany,
  }
})
