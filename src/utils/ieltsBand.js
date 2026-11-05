/**
 * Snap a numeric IELTS criterion average to the nearest half band (0–9).
 */
export function snapToHalfBand(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const clamped = Math.min(9, Math.max(0, n))
  return Math.round(clamped * 2) / 2
}

/**
 * Mean of criterion bands, snapped to a half band.
 * @param {Array<number|string|null|undefined>} values
 */
export function suggestedOverallFromCriteria(values) {
  const nums = values.map((v) => Number(v)).filter((n) => Number.isFinite(n))
  if (!nums.length) return 0
  const mean = nums.reduce((sum, n) => sum + n, 0) / nums.length
  return snapToHalfBand(mean)
}

export function bandSelectOptions() {
  const options = []
  for (let value = 0; value <= 9; value += 0.5) {
    options.push(value)
  }
  return options
}
