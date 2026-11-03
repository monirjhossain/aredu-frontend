export function sellingPrice(course) {
  return course?.discount_price ?? course?.price
}

export function hasDiscount(course) {
  return course?.discount_price != null
    && Number(course.discount_price) < Number(course.price)
}

export function discountPct(course) {
  if (!hasDiscount(course) || !Number(course?.price)) return null
  return Math.round((1 - Number(course.discount_price) / Number(course.price)) * 100)
}

export function money(amount, currency = 'BDT') {
  const value = Number(amount)
  if (Number.isNaN(value)) return String(amount ?? '')
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2)
  return currency === 'BDT' ? `৳${formatted}` : `${formatted} ${currency}`
}

export function durationLabel(course, t) {
  const minutes = Number(course?.duration_minutes || 0)
  if (!minutes) return null
  if (minutes >= 60) {
    return t('hoursCount', { count: Math.round(minutes / 60) })
  }
  return t('minutesCount', { count: minutes })
}

export function examLabel(course, t) {
  return course?.exam_type === 'general' ? t('general') : t('academic')
}
