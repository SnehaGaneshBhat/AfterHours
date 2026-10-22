import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ALLOWED_DIRECTOR_ACTIONS,
  canStartDirectorRequest,
  isCurrentDirectorResponse,
  requestConstrainedDirectorDecision,
  validateDirectorResponse,
} from './director.js'
import {
  RECORDS_DIFFERENCES,
  effectForRecordsAction,
  nextUnfoundDifference,
  reachedIdleThreshold,
  reachedMisclickThreshold,
  recordDifferenceFound,
} from './recordsPuzzle.js'
import { effectForGateAction } from './gatesDirector.js'

const context = { roomName: 'records archive', verifiedFacts: ['The player is comparing archived frames.'] }
const telemetry = {
  trigger: 'manual', misclicks: 4, misclicksSinceDecision: 2, idleMs: 0,
  timeSinceLastFindMs: 12_000, successfulFinds: 1, remainingDifferences: 4,
}

test('the exact three allowed actions validate and retain real metadata', () => {
  for (const action of ['HINT', 'RAISE_TENSION', 'WAIT']) {
    const result = validateDirectorResponse({
      action, confidence: 0.73, probabilities: { HINT: 0.73, WAIT: 0.27 },
      latency_ms: 4200, model: 'strands-decider-2B-hobson-v19', source: 'strands-decider-2B',
    })
    assert.equal(result.valid, true)
    assert.equal(result.decision.action, action)
    assert.equal(result.decision.confidence, 0.73)
    assert.equal(result.decision.serviceLatencyMs, 4200)
  }
  assert.deepEqual(ALLOWED_DIRECTOR_ACTIONS, ['HINT', 'RAISE_TENSION', 'WAIT'])
})

test('invalid or malformed actions are rejected; absent metadata stays absent', () => {
  assert.equal(validateDirectorResponse({ action: 'OPEN_SHORTCUT' }).valid, false)
  assert.equal(validateDirectorResponse(null).valid, false)
  const result = validateDirectorResponse({ action: 'WAIT' })
  assert.equal(result.decision.confidence, null)
  assert.equal(result.decision.probabilities, null)
  assert.equal(result.decision.serviceLatencyMs, null)
})

test('request timeout and transport errors remain distinct outcomes', async () => {
  const timeoutResult = await requestConstrainedDirectorDecision({
    gameContext: context, telemetry, timeoutMs: 5,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }),
  })
  assert.equal(timeoutResult.status, 'timed_out')
  const lateResponse = await requestConstrainedDirectorDecision({
    gameContext: context, telemetry, timeoutMs: 5,
    fetchImpl: async () => {
      await new Promise((resolve) => setTimeout(resolve, 15))
      return { ok: true, json: async () => ({ action: 'WAIT' }) }
    },
  })
  assert.equal(lateResponse.status, 'timed_out')
  const failure = await requestConstrainedDirectorDecision({
    gameContext: context, telemetry,
    fetchImpl: async () => { throw new Error('offline') },
  })
  assert.equal(failure.status, 'failed')
  assert.equal(failure.origin, 'none')
})

test('reusable request sends only the allowed action contract and preserves the real response', async () => {
  let sentBody
  const result = await requestConstrainedDirectorDecision({
    gameContext: context,
    telemetry,
    fetchImpl: async (_url, options) => {
      sentBody = JSON.parse(options.body)
      return {
        ok: true,
        json: async () => ({
          action: 'WAIT', confidence: 0.81, probabilities: { HINT: 0.1, RAISE_TENSION: 0.09, WAIT: 0.81 },
          latency_ms: 19, model: 'test-model', source: 'strands-decider-2B',
        }),
      }
    },
  })
  assert.deepEqual(sentBody.allowed_actions, ['HINT', 'RAISE_TENSION', 'WAIT'])
  assert.match(sentBody.state, /Time since last successful find/)
  assert.equal(result.status, 'completed')
  assert.equal(result.origin, 'decider')
  assert.deepEqual(result.decision.probabilities, { HINT: 0.1, RAISE_TENSION: 0.09, WAIT: 0.81 })
})

test('WAIT is inert; HINT targets only an authored, unfound difference; tension uses its own narration event', () => {
  assert.deepEqual(effectForRecordsAction('WAIT'), { kind: 'none' })
  const hint = effectForRecordsAction('HINT', ['hair-strand'])
  assert.equal(hint.kind, 'highlight')
  assert.ok(RECORDS_DIFFERENCES.some((difference) => difference.id === hint.targetId))
  assert.equal(effectForRecordsAction('HINT', RECORDS_DIFFERENCES.map(({ id }) => id)).kind, 'unavailable')
  assert.deepEqual(effectForRecordsAction('RAISE_TENSION'), { kind: 'narration', event: 'records-comparison-tension' })
  assert.equal(effectForRecordsAction('RAISE_TENSION').targetId, undefined)
})

test('gate actions are distinct and WAIT has no narration side effect', () => {
  const game = {
    gatesScanned: true,
    discoveredClues: [],
    inspectedObjects: [],
    recordsUnlocked: false,
  }
  assert.equal(effectForGateAction('HINT', game).kind, 'hint')
  assert.deepEqual(effectForGateAction('RAISE_TENSION', game), { kind: 'narration', event: 'tension' })
  assert.deepEqual(effectForGateAction('WAIT', game), { kind: 'none' })
  assert.deepEqual(effectForGateAction('OPEN_SHORTCUT', game), { kind: 'invalid' })
})

test('difference finds are fixed, unique, authoritative, and hair is recorded once', () => {
  assert.equal(RECORDS_DIFFERENCES.length, 5)
  assert.equal(new Set(RECORDS_DIFFERENCES.map(({ id }) => id)).size, 5)
  assert.ok(RECORDS_DIFFERENCES.every(({ x, y, width, height }) => x > 0 && x < 100 && y > 0 && y < 100 && width > 0 && height > 0))
  const initial = { recordsDifferencesFound: [], discoveredClues: [], inventory: [] }
  const hair = recordDifferenceFound(initial, 'hair-strand')
  assert.equal(hair.hairStrandFound, true)
  assert.deepEqual(hair.discoveredClues, ['hair-strand'])
  assert.deepEqual(hair.inventory, ['hair-strand'])
  assert.equal(recordDifferenceFound(hair, 'hair-strand'), hair)
  assert.equal(nextUnfoundDifference(hair.recordsDifferencesFound).id, 'file-tab')
})

test('automatic triggers and stale-response guards are deterministic', () => {
  assert.equal(reachedMisclickThreshold(2), false)
  assert.equal(reachedMisclickThreshold(3), true)
  assert.equal(reachedIdleThreshold(74_999), false)
  assert.equal(reachedIdleThreshold(75_000), true)
  assert.equal(canStartDirectorRequest({ pending: true, completed: false, now: 10_000, lastStartedAt: 0, cooldownMs: 1_000 }), false)
  assert.equal(canStartDirectorRequest({ pending: false, completed: false, now: 999, lastStartedAt: 0, cooldownMs: 1_000 }), false)
  const valid = { requestId: 2, currentRequestId: 2, sessionId: 'a', currentSessionId: 'a', completed: false }
  assert.equal(isCurrentDirectorResponse(valid), true)
  assert.equal(isCurrentDirectorResponse({ ...valid, completed: true }), false)
  assert.equal(isCurrentDirectorResponse({ ...valid, currentSessionId: 'b' }), false)
  assert.equal(isCurrentDirectorResponse({ ...valid, currentRequestId: 3 }), false)
})
