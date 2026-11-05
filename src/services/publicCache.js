const memory = new Map()

function now() {
  return Date.now()
}

export function cacheGet(key) {
  const row = memory.get(key)
  if (!row) {
    try {
      const raw = sessionStorage.getItem(`pc:${key}`)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || parsed.exp < now()) {
        sessionStorage.removeItem(`pc:${key}`)
        return null
      }
      memory.set(key, parsed)
      return parsed.value
    } catch {
      return null
    }
  }
  if (row.exp < now()) {
    memory.delete(key)
    try { sessionStorage.removeItem(`pc:${key}`) } catch { /* ignore */ }
    return null
  }
  return row.value
}

export function cacheSet(key, value, ttlMs = 60_000) {
  const row = { value, exp: now() + ttlMs }
  memory.set(key, row)
  try {
    sessionStorage.setItem(`pc:${key}`, JSON.stringify(row))
  } catch {
    // quota / private mode — memory cache still works
  }
}

export function cacheKey(parts) {
  return parts.filter((part) => part !== undefined && part !== null && part !== '').join('|')
}
