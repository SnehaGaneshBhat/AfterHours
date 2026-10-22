// REUSABLE CONSTRAINED DIRECTOR PATTERN
// The Decider selects one allowed action; the application validates and applies its own effects.
import { apiUrl } from './api.js'

export const DECIDER_ENDPOINT = apiUrl('/api/director/decide')
export const DECIDER_TIMEOUT_MS = 130_000
export const ALLOWED_DIRECTOR_ACTIONS = Object.freeze(['HINT', 'RAISE_TENSION', 'WAIT'])

/**
 * @typedef {'HINT' | 'RAISE_TENSION' | 'WAIT'} DirectorAction
 * @typedef {{roomName: string, verifiedFacts: string[], recentNarration?: string[]}} DirectorContext
 * @typedef {{trigger: string, misclicks: number, misclicksSinceDecision: number, idleMs: number, timeSinceLastFindMs: number, successfulFinds: number, hasSuccessfulFind?: boolean, remainingDifferences: number}} DirectorTelemetry
 * @typedef {{action: DirectorAction, model: string|null, source: string|null, confidence: number|null, probabilities: Record<string, number>|null, serviceLatencyMs: number|null}} DirectorDecision
 */

function elapsedSince(startedAt) {
  const now = globalThis.performance?.now?.() ?? Date.now()
  return Math.max(0, Math.round(now - startedAt))
}

function makeState(context, telemetry) {
  const facts = (context.verifiedFacts || []).slice(0, 10)
  const recent = (context.recentNarration || []).slice(-3)
  const lines = [
    `Current room: ${String(context.roomName || 'unknown').slice(0, 100)}.`,
    'Verified game facts:',
    ...(facts.length ? facts.map((fact) => `- ${String(fact).slice(0, 240)}`) : ['- No additional facts supplied.']),
    'Recent narration is continuity context only:',
    ...(recent.length ? recent.map((line) => `- ${String(line).slice(0, 240)}`) : ['- No recent narration.']),
    'Player telemetry:',
    `- Trigger: ${String(telemetry.trigger)}.`,
    `- Incorrect clicks total / since last decision: ${telemetry.misclicks} / ${telemetry.misclicksSinceDecision}.`,
    `- Idle time in milliseconds: ${telemetry.idleMs}.`,
    `- Time since last successful find in milliseconds (or since puzzle start if none yet): ${telemetry.timeSinceLastFindMs}.`,
    `- Successful finds / remaining differences: ${telemetry.successfulFinds} / ${telemetry.remainingDifferences}.`,
    'Choose only HINT, RAISE_TENSION, or WAIT. Do not decide correctness, invent evidence, or change game state.',
  ]
  return lines.join('\n').slice(0, 2_950)
}

/** Validate the actual backend response without manufacturing missing metadata. */
export function validateDirectorResponse(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, reason: 'Response was not a JSON object.' }
  }
  if (!ALLOWED_DIRECTOR_ACTIONS.includes(payload.action)) {
    return { valid: false, reason: 'Response action was missing or outside the allowlist.' }
  }

  const rawProbabilities = payload.probabilities
  const probabilities = rawProbabilities && typeof rawProbabilities === 'object' && !Array.isArray(rawProbabilities)
    ? Object.fromEntries(Object.entries(rawProbabilities).filter(([, value]) => Number.isFinite(value)))
    : null

  return {
    valid: true,
    decision: {
      action: payload.action,
      model: typeof payload.model === 'string' ? payload.model : null,
      source: typeof payload.source === 'string' ? payload.source : null,
      confidence: Number.isFinite(payload.confidence) ? payload.confidence : null,
      probabilities: probabilities && Object.keys(probabilities).length ? probabilities : null,
      serviceLatencyMs: Number.isFinite(payload.latency_ms) ? payload.latency_ms : null,
    },
  }
}

/**
 * Make one constrained request to the existing backend endpoint.
 * @param {{gameContext: DirectorContext, telemetry: DirectorTelemetry, signal?: AbortSignal, timeoutMs?: number, fetchImpl?: typeof fetch}} options
 * @returns {Promise<{status: 'completed', origin: 'decider', decision: DirectorDecision, clientLatencyMs: number}|{status: 'timed_out'|'cancelled'|'failed'|'invalid_response', origin: 'none', message: string, clientLatencyMs: number}>}
 */
export async function requestConstrainedDirectorDecision({
  gameContext,
  telemetry,
  signal,
  timeoutMs = DECIDER_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
}) {
  const startedAt = globalThis.performance?.now?.() ?? Date.now()
  if (signal?.aborted) {
    return { status: 'cancelled', origin: 'none', message: 'Request was cancelled before it started.', clientLatencyMs: 0 }
  }

  const controller = new AbortController()
  let timedOut = false
  const abortFromCaller = () => controller.abort()
  signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetchImpl(DECIDER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        state: makeState(gameContext, telemetry),
        allowed_actions: [...ALLOWED_DIRECTOR_ACTIONS],
      }),
    })
    if (timedOut) {
      return { status: 'timed_out', origin: 'none', message: `No decision arrived within ${timeoutMs} ms.`, clientLatencyMs: elapsedSince(startedAt) }
    }
    if (signal?.aborted) {
      return { status: 'cancelled', origin: 'none', message: 'Request was cancelled because the puzzle session changed.', clientLatencyMs: elapsedSince(startedAt) }
    }
    if (!response.ok) {
      return { status: 'failed', origin: 'none', message: `Director API returned HTTP ${response.status}.`, clientLatencyMs: elapsedSince(startedAt) }
    }

    let payload
    try {
      payload = await response.json()
    } catch {
      if (timedOut) {
        return { status: 'timed_out', origin: 'none', message: `No decision arrived within ${timeoutMs} ms.`, clientLatencyMs: elapsedSince(startedAt) }
      }
      return { status: 'invalid_response', origin: 'none', message: 'Director API returned invalid JSON.', clientLatencyMs: elapsedSince(startedAt) }
    }
    if (timedOut) {
      return { status: 'timed_out', origin: 'none', message: `No decision arrived within ${timeoutMs} ms.`, clientLatencyMs: elapsedSince(startedAt) }
    }
    if (signal?.aborted) {
      return { status: 'cancelled', origin: 'none', message: 'Request was cancelled because the puzzle session changed.', clientLatencyMs: elapsedSince(startedAt) }
    }

    const validated = validateDirectorResponse(payload)
    if (!validated.valid) {
      return { status: 'invalid_response', origin: 'none', message: validated.reason, clientLatencyMs: elapsedSince(startedAt) }
    }
    return { status: 'completed', origin: 'decider', decision: validated.decision, clientLatencyMs: elapsedSince(startedAt) }
  } catch (error) {
    if (timedOut) {
      return { status: 'timed_out', origin: 'none', message: `No decision arrived within ${timeoutMs} ms.`, clientLatencyMs: elapsedSince(startedAt) }
    }
    if (signal?.aborted || controller.signal.aborted) {
      return { status: 'cancelled', origin: 'none', message: 'Request was cancelled because the puzzle session changed.', clientLatencyMs: elapsedSince(startedAt) }
    }
    return { status: 'failed', origin: 'none', message: error instanceof Error ? error.message : 'Director request failed.', clientLatencyMs: elapsedSince(startedAt) }
  } finally {
    globalThis.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

/** Guard a response against new requests, sessions, cancellation, or puzzle completion. */
export function isCurrentDirectorResponse({ requestId, currentRequestId, sessionId, currentSessionId, completed, signal }) {
  return requestId === currentRequestId
    && sessionId === currentSessionId
    && !completed
    && !signal?.aborted
}

export function canStartDirectorRequest({ pending, completed, now, lastStartedAt, cooldownMs }) {
  return !pending && !completed && (lastStartedAt === null || now - lastStartedAt >= cooldownMs)
}
