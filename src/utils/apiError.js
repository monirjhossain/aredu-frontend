export function apiError(error) {
  const data = error?.response?.data
  const errors = data?.errors && typeof data.errors === 'object' ? data.errors : {}

  return {
    message: data?.message || '',
    errors,
  }
}
