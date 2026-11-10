// Tiny fetch wrapper. Cookies carry the session; errors come back as { error: "..." }.
export async function api(path, { method = 'GET', body, form } = {}) {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })
  if (res.status === 401) throw new ApiError('გთხოვ, შედი სისტემაში', 401)
  if (res.status === 403) throw new ApiError('წვდომა აკრძალულია', 403)
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(data?.error || 'დაფიქსირდა შეცდომა', res.status)
  return data
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}
