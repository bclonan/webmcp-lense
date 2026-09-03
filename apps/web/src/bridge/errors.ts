export class BridgeError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message)
    this.name = 'BridgeError'
  }
}

export function errorMessage(
  value: unknown,
  fallback = 'The connection could not be completed.',
): string {
  if (typeof value === 'string' && value.trim() && value !== '[object Object]')
    return value.slice(0, 1000)
  if (value && typeof value === 'object') {
    const error = value as Record<string, unknown>
    for (const key of ['message', 'error', 'errorDetails']) {
      if (typeof error[key] === 'string' && error[key] !== '[object Object]' && error[key])
        return (error[key] as string).slice(0, 1000)
      if (
        error[key] &&
        typeof error[key] === 'object' &&
        typeof (error[key] as Record<string, unknown>).message === 'string'
      )
        return String((error[key] as Record<string, unknown>).message).slice(0, 1000)
    }
  }
  return fallback
}

export function responseError(value: unknown, status: number): BridgeError {
  const data = value && typeof value === 'object' ? (value as Record<string, any>) : {}
  const code =
    typeof data.error?.code === 'string'
      ? data.error.code
      : typeof data.errorCode === 'string'
        ? data.errorCode
        : `http_${status}`
  if (data.error === 'Expected only a pairing code')
    return new BridgeError(
      'protocol_mismatch',
      'This companion uses an older protocol. Restart the updated Lens Bridge and reload this page, then pair again.',
    )
  return new BridgeError(
    code,
    errorMessage(
      value,
      `The companion returned HTTP ${status}. Keep Lens Bridge open and try the connection again.`,
    ),
    [502, 503, 504].includes(status),
  )
}
