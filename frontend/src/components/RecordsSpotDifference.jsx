import { useEffect, useRef, useState } from 'react'
import {
  RECORDS_DIFFERENCES,
  RECORDS_DIFFERENCE_COUNT,
  RECORDS_DIRECTOR_THRESHOLDS,
  effectForRecordsAction,
  reachedIdleThreshold,
  reachedMisclickThreshold,
  recordDifferenceFound,
} from '../game/recordsPuzzle.js'
import {
  canStartDirectorRequest,
  isCurrentDirectorResponse,
  requestConstrainedDirectorDecision,
} from '../game/director.js'

const EVIDENCE_NAMES = {
  'hair-strand': 'HAIR STRAND / RESTRICTED ENTRY',
  'future-card': 'THE FUTURE-DATED ACCESS CARD',
  'prior-session': 'THE EARLIER SESSION',
  'security-log': 'THE 02:17 AUTHENTICATION',
  'incident-date': 'SITE INCIDENT / 04·27',
  'restricted-record': 'RESTRICTED OVERRIDE NOTE',
}

function initialTelemetry(foundCount) {
  return {
    status: 'standby',
    trigger: 'No decision requested yet.',
    action: null,
    origin: 'none',
    model: null,
    source: null,
    confidence: null,
    probabilities: null,
    clientLatencyMs: null,
    serviceLatencyMs: null,
    effect: 'No intervention has been applied.',
    message: '',
    signals: {
      misclicks: 0,
      misclicksSinceDecision: 0,
      idleMs: 0,
      timeSinceLastFindMs: 0,
      successfulFinds: foundCount,
      hasSuccessfulFind: foundCount > 0,
      remainingDifferences: Math.max(0, RECORDS_DIFFERENCE_COUNT - foundCount),
    },
  }
}

function formatElapsed(milliseconds) {
  if (!Number.isFinite(milliseconds)) return '—'
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}

function differenceStatus(status) {
  return status.replaceAll('_', ' ').toUpperCase()
}

function nowMilliseconds() {
  return Date.now()
}

function RecordsSpotDifference({ game, setGame, narrator, onNarrate, onBack, onRestartEpisode }) {
  const foundIds = Array.isArray(game.recordsDifferencesFound) ? game.recordsDifferencesFound : []
  const foundSet = new Set(foundIds)
  const foundCount = foundIds.length
  const [hintTarget, setHintTarget] = useState(null)
  const [interactionNotice, setInteractionNotice] = useState('')
  const [telemetry, setTelemetry] = useState(() => initialTelemetry(foundCount))
  const [decisionIsPending, setDecisionIsPending] = useState(false)
  const [puzzleIsComplete, setPuzzleIsComplete] = useState(foundCount >= RECORDS_DIFFERENCE_COUNT || Boolean(game.episodeComplete))
  const [laboratoryEntered, setLaboratoryEntered] = useState(false)
  const [laboratoryInterior, setLaboratoryInterior] = useState(Boolean(game.episodeComplete))
  const [laboratoryShaking, setLaboratoryShaking] = useState(false)

  const gameRef = useRef(game)
  const sessionId = useRef(Symbol('records-puzzle-session'))
  const requestId = useRef(0)
  const activeController = useRef(null)
  const decisionPending = useRef(false)
  const completed = useRef(foundCount >= RECORDS_DIFFERENCE_COUNT || Boolean(game.episodeComplete))
  const mounted = useRef(false)
  const lastDecisionAt = useRef(null)
  const totalMisclicks = useRef(0)
  const misclicksSinceDecision = useRef(0)
  const puzzleStartedAt = useRef(null)
  const lastActivityAt = useRef(null)
  const lastFindAt = useRef(game.recordsLastFoundAt || null)
  const idleTimer = useRef(null)
  const labTransitionTimer = useRef(null)
  const scheduleIdleCheck = useRef(() => {})
  const requestDecisionRef = useRef(null)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    const startedAt = nowMilliseconds()
    puzzleStartedAt.current = startedAt
    lastActivityAt.current = startedAt
    lastFindAt.current ||= startedAt
    mounted.current = true
    return () => {
      mounted.current = false
      requestId.current += 1
      activeController.current?.abort()
      window.clearTimeout(idleTimer.current)
      window.clearTimeout(labTransitionTimer.current)
      decisionPending.current = false
    }
  }, [])

  function liveSignals(now = nowMilliseconds()) {
    const currentFound = gameRef.current.recordsDifferencesFound || []
    return {
      misclicks: totalMisclicks.current,
      misclicksSinceDecision: misclicksSinceDecision.current,
      idleMs: Math.max(0, now - lastActivityAt.current),
      timeSinceLastFindMs: Math.max(0, now - lastFindAt.current),
      successfulFinds: currentFound.length,
      hasSuccessfulFind: currentFound.length > 0,
      remainingDifferences: Math.max(0, RECORDS_DIFFERENCE_COUNT - currentFound.length),
    }
  }

  function refreshSignalTelemetry() {
    const signals = liveSignals()
    setTelemetry((current) => ({ ...current, signals }))
  }

  async function requestDecision(trigger) {
    const now = nowMilliseconds()
    const cooldownMs = RECORDS_DIRECTOR_THRESHOLDS.cooldownMs
    if (!canStartDirectorRequest({
      pending: decisionPending.current,
      completed: completed.current,
      now,
      lastStartedAt: lastDecisionAt.current,
      cooldownMs,
    })) {
      if (!completed.current) {
        const blockedBy = decisionPending.current ? 'A decision is already in progress.' : 'Director cooldown is active.'
        setInteractionNotice(blockedBy)
        scheduleIdleCheck.current()
      }
      return
    }

    const currentGame = gameRef.current
    const currentFound = currentGame.recordsDifferencesFound || []
    const signals = liveSignals(now)
    const id = ++requestId.current
    const thisSession = sessionId.current
    const controller = new AbortController()

    activeController.current?.abort()
    activeController.current = controller
    decisionPending.current = true
    setDecisionIsPending(true)
    lastDecisionAt.current = now
    misclicksSinceDecision.current = 0
    setInteractionNotice('')
    setTelemetry((current) => ({
      ...current,
      status: 'pending',
      trigger,
      action: null,
      origin: 'none',
      model: null,
      source: null,
      confidence: null,
      probabilities: null,
      clientLatencyMs: null,
      serviceLatencyMs: null,
      effect: 'No intervention applied while the decision is pending.',
      message: '',
      signals: { ...signals, misclicksSinceDecision: signals.misclicksSinceDecision },
    }))

    const verifiedFacts = [
      `The player is comparing the archived and current records-centre image.`,
      `${currentFound.length} of ${RECORDS_DIFFERENCE_COUNT} authored differences have been found; ${RECORDS_DIFFERENCE_COUNT - currentFound.length} remain.`,
      `Hair strand recorded in evidence: ${Boolean(currentGame.hairStrandFound)}.`,
      ...(currentGame.discoveredClues || []).map((id) => `Verified clue recorded: ${id}.`),
      ...(currentGame.inventory || []).map((id) => `Verified inventory item: ${id}.`),
    ]
    const result = await requestConstrainedDirectorDecision({
      gameContext: {
        roomName: 'THE RECORDS CENTRE / SPOT-THE-DIFFERENCE REVIEW',
        verifiedFacts,
        recentNarration: (narrator.transcript || []).slice(-3).map((item) => item.text),
      },
      telemetry: { trigger, ...signals },
      signal: controller.signal,
    })

    if (!isCurrentDirectorResponse({
      requestId: id,
      currentRequestId: requestId.current,
      sessionId: thisSession,
      currentSessionId: sessionId.current,
      completed: completed.current,
      signal: controller.signal,
    })) return

    if (result.status !== 'completed') {
      setTelemetry((current) => ({
        ...current,
        status: result.status,
        origin: 'none',
        action: null,
        clientLatencyMs: result.clientLatencyMs,
        effect: 'No intervention applied; continue playing normally.',
        message: result.message,
      }))
      setInteractionNotice(`DIRECTOR ${differenceStatus(result.status)} / NO INTERVENTION APPLIED`)
    } else {
      const decision = result.decision
      const latestGame = gameRef.current
      const latestFound = latestGame.recordsDifferencesFound || []
      const effect = effectForRecordsAction(decision.action, latestFound)
      let effectDescription = 'No intervention was applied.'

      if (effect.kind === 'highlight') {
        setHintTarget(effect.targetId)
        setInteractionNotice('A verified, unfound difference is highlighted in the lower image.')
        effectDescription = 'Applied: highlighted one authored, still-unfound difference.'
      } else if (effect.kind === 'unavailable') {
        setHintTarget(null)
        setInteractionNotice('No valid hint target remains; no highlight was shown.')
        effectDescription = 'Not applied: no unfound difference remained when the response arrived.'
      } else if (effect.kind === 'narration') {
        setHintTarget(null)
        setInteractionNotice('A tension beat was requested from the existing Bedrock narration flow.')
        effectDescription = 'Requested: Bedrock tension narration; no puzzle hint or game-state change.'
        if (typeof onNarrate === 'function') {
          void Promise.resolve(onNarrate(effect.event, latestGame)).catch((error) => {
            console.error('Tension narration request failed:', error)
          })
        } else {
          effectDescription = 'Not applied: the narration flow is unavailable.'
        }
      } else if (effect.kind === 'none') {
        setHintTarget(null)
        setInteractionNotice('The Director selected WAIT. Continue when ready; no intervention was applied.')
        effectDescription = 'No side effect by design (WAIT).'
      }

      setTelemetry((current) => ({
        ...current,
        status: 'completed',
        trigger,
        action: decision.action,
        origin: result.origin,
        model: decision.model,
        source: decision.source,
        confidence: decision.confidence,
        probabilities: decision.probabilities,
        clientLatencyMs: result.clientLatencyMs,
        serviceLatencyMs: decision.serviceLatencyMs,
        effect: effectDescription,
        message: '',
      }))
    }

    decisionPending.current = false
    setDecisionIsPending(false)
    activeController.current = null
    refreshSignalTelemetry()
    scheduleIdleCheck.current()
  }

  useEffect(() => {
    requestDecisionRef.current = requestDecision
  })

  useEffect(() => {
    function schedule() {
      window.clearTimeout(idleTimer.current)
      if (!mounted.current || completed.current || document.hidden || decisionPending.current) return

      const idleDueAt = lastActivityAt.current + RECORDS_DIRECTOR_THRESHOLDS.idleMs
      const cooldownDueAt = lastDecisionAt.current === null
        ? 0
        : lastDecisionAt.current + RECORDS_DIRECTOR_THRESHOLDS.cooldownMs
      const dueAt = Math.max(idleDueAt, cooldownDueAt)
      idleTimer.current = window.setTimeout(() => {
        if (document.hidden) return
        const idleMs = nowMilliseconds() - lastActivityAt.current
        if (reachedIdleThreshold(idleMs)) requestDecisionRef.current?.('screen idle')
        else scheduleIdleCheck.current()
      }, Math.max(100, dueAt - nowMilliseconds()))
    }

    const recordActivity = () => {
      lastActivityAt.current = nowMilliseconds()
      refreshSignalTelemetry()
      schedule()
    }
    const handleVisibility = () => {
      if (document.hidden) window.clearTimeout(idleTimer.current)
      else recordActivity()
    }

    scheduleIdleCheck.current = schedule
    window.addEventListener('pointerdown', recordActivity, { passive: true })
    window.addEventListener('keydown', recordActivity)
    window.addEventListener('touchstart', recordActivity, { passive: true })
    window.addEventListener('wheel', recordActivity, { passive: true })
    document.addEventListener('visibilitychange', handleVisibility)
    schedule()

    return () => {
      window.clearTimeout(idleTimer.current)
      window.removeEventListener('pointerdown', recordActivity)
      window.removeEventListener('keydown', recordActivity)
      window.removeEventListener('touchstart', recordActivity)
      window.removeEventListener('wheel', recordActivity)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  function registerMisclick() {
    totalMisclicks.current += 1
    misclicksSinceDecision.current += 1
    refreshSignalTelemetry()
    if (reachedMisclickThreshold(misclicksSinceDecision.current)) {
      void requestDecisionRef.current?.('repeated incorrect clicks')
    }
  }

  function findDifference(difference, event) {
    event.stopPropagation()
    const current = gameRef.current
    const next = recordDifferenceFound(current, difference.id)
    if (next === current) return

    gameRef.current = next
    setGame(next)
    setHintTarget(null)
    setInteractionNotice('')
    lastFindAt.current = next.recordsLastFoundAt
    lastActivityAt.current = nowMilliseconds()
    refreshSignalTelemetry()

    if (next.recordsDifferencesFound.length >= RECORDS_DIFFERENCE_COUNT) {
      completed.current = true
      setPuzzleIsComplete(true)
      requestId.current += 1
      window.clearTimeout(idleTimer.current)
      if (decisionPending.current) {
        activeController.current?.abort()
        decisionPending.current = false
                setDecisionIsPending(false)
        activeController.current = null
        setTelemetry((currentTelemetry) => ({
          ...currentTelemetry,
          status: 'cancelled',
          action: null,
          origin: 'none',
          effect: 'Pending response cancelled because the puzzle was completed.',
        }))
      }
      onNarrate('records-differences-complete', next)
    } else {
      scheduleIdleCheck.current()
      onNarrate(difference.id === 'hair-strand' ? 'records-hair-found' : 'records-difference-found', next)
    }
  }

  function handleCanvasMisclick(event) {
    if (!event.target.closest('[data-difference-id]')) registerMisclick()
  }

  function beginLaboratoryTransition() {
    if (laboratoryEntered) return
    setLaboratoryEntered(true)
    const snapshot = gameRef.current
    const afterNarration = () => {
      if (!mounted.current) return
      setLaboratoryShaking(true)
      labTransitionTimer.current = window.setTimeout(() => {
        if (!mounted.current) return
        const completedGame = { ...gameRef.current, episodeComplete: true }
        gameRef.current = completedGame
        setGame((current) => ({ ...current, episodeComplete: true }))
        setLaboratoryInterior(true)
        setLaboratoryShaking(false)
        void onNarrate('records-episode-complete', completedGame)
      }, 780)
    }
    try {
      const narrationRequest = onNarrate('laboratory-arrival', snapshot)
      void Promise.resolve(narrationRequest).then(afterNarration, afterNarration)
    } catch {
      afterNarration()
    }
  }

  const collectedEvidence = [...new Set([...(game.discoveredClues || []), ...(game.inventory || [])])]
  const episodeComplete = Boolean(game.episodeComplete || laboratoryInterior)

  if (foundCount >= RECORDS_DIFFERENCE_COUNT) {
    if (laboratoryEntered || episodeComplete) {
      return (
        <main className={'records-laboratory-scene' + (laboratoryShaking ? ' is-shaking' : '')}>
          <img src={laboratoryInterior || episodeComplete ? '/images/laboratory-area.png' : '/images/laboratory-entrance.png'} alt={laboratoryInterior || episodeComplete ? 'Interior of the lighthouse research laboratory' : 'Entrance to laboratory L-01'} />
          <section className="records-laboratory-message" aria-live="polite">
            {laboratoryInterior || episodeComplete ? (
              <>
                <p className="chapter-eyebrow">// INCIDENT 001 / INVESTIGATION COMPLETE</p>
                <h1>THE SESSION BEFORE YOURS</h1>
                <p className="records-ending-summary">The records comparison is complete. Evidence logged by this investigation:</p>
                {collectedEvidence.length ? (
                  <ul className="records-ending-evidence">
                    {collectedEvidence.map((id) => <li key={id}>{EVIDENCE_NAMES[id] || id.replaceAll('-', ' ').toUpperCase()}</li>)}
                  </ul>
                ) : <p className="records-ending-summary">No physical evidence was recorded in the inventory.</p>}
                <p className="records-ending-revelation">The access log marks a completed session under your identity at 02:17. You arrived at 02:43. There is no exit record. The strand is real; its owner remains unknown. Your first recorded presence is still not your first recorded arrival.</p>
                <p className="records-ending-narration">{narrator.narration}</p>
                <span className="records-resolution-status" role="status">
                  {narrator.narrationLoading ? 'FIELD NARRATIVE / GENERATING' : narrator.narrationError ? 'FIELD NARRATIVE / LOCAL FALLBACK' : 'CASE RECORD / VERIFIED FACTS'}
                </span>
              </>
            ) : (
              <>
                <p className="chapter-eyebrow">// LABORATORY L-01 / SPECIMEN RECEIVED</p>
                <h1>THE TRACE IS SEALED</h1>
                <p>{narrator.narration}</p>
                {narrator.narrationLoading && <span className="records-resolution-status">FIELD NARRATIVE / GENERATING</span>}
              </>
            )}
            <div className="records-resolution-voice">
              {!episodeComplete && !laboratoryInterior && <button type="button" onClick={narrator.toggleVoice} aria-pressed={narrator.voiceEnabled}>{narrator.voiceEnabled ? 'MUTE VOICE' : 'ENABLE VOICE'}</button>}
              {(episodeComplete || laboratoryInterior) && <button type="button" onClick={narrator.toggleVoice} aria-pressed={narrator.voiceEnabled}>{narrator.voiceEnabled ? 'MUTE VOICE' : 'ENABLE VOICE'}</button>}
              <button type="button" onClick={() => narrator.setTranscriptOpen((open) => !open)} aria-expanded={narrator.transcriptOpen}>{narrator.transcriptOpen ? 'HIDE LOG' : 'NARRATION LOG'}</button>
              {episodeComplete || laboratoryInterior ? (
                <>
                  <button type="button" onClick={onBack}>RETURN TO SURVEILLANCE</button>
                  <button type="button" onClick={onRestartEpisode}>RESTART EPISODE</button>
                </>
              ) : null}
            </div>
            {narrator.transcriptOpen && <ol className="records-ending-transcript">{narrator.transcript.map((item, index) => <li key={`${index}-${item.source}`}><span>{item.source}</span>{item.text}</li>)}</ol>}
          </section>
        </main>
      )
    }

    return (
      <main className="records-resolution-screen">
        <section className="records-resolution-card" aria-live="polite">
          <p className="chapter-eyebrow">// EVIDENCE ISOLATED / HAIR STRAND</p>
          <div className="records-resolution-strand" aria-hidden="true">
            <svg viewBox="0 0 320 120"><path d="M12 91C58 28 89 111 131 52S205 103 238 37 285 66 308 16" /></svg>
          </div>
          <h1>ONE TRACE REMAINS</h1>
          <p>{narrator.narration}</p>
          {narrator.narrationLoading && <span className="records-resolution-status">FIELD NARRATIVE / GENERATING</span>}
          <button type="button" onClick={beginLaboratoryTransition}>PROCEED TO LABORATORY <span aria-hidden="true">→</span></button>
          <button type="button" onClick={onBack}>RETURN TO SURVEILLANCE</button>
          <div className="records-resolution-voice">
            <button type="button" onClick={narrator.toggleVoice} aria-pressed={narrator.voiceEnabled}>{narrator.voiceEnabled ? 'MUTE VOICE' : 'ENABLE VOICE'}</button>
            <button type="button" onClick={() => narrator.setTranscriptOpen((open) => !open)} aria-expanded={narrator.transcriptOpen}>{narrator.transcriptOpen ? 'HIDE LOG' : 'NARRATION LOG'}</button>
          </div>
        </section>
      </main>
    )
  }

  function drawFrame(label, altered) {
    return (
      <figure className="records-difference-frame">
        <figcaption><span>{label}</span><span>{altered ? `${foundCount} / ${RECORDS_DIFFERENCE_COUNT} CHANGES FOUND` : 'REFERENCE IMAGE'}</span></figcaption>
        <div className="records-difference-image" onClick={altered ? handleCanvasMisclick : undefined}>
          <img
            src="/images/records-centre.png"
            alt={altered ? 'Current records-centre image with five small added details' : 'Original records-centre reference image'}
          />
          {altered && <img className="records-difference-overlay" src="/images/records-centre-altered.svg" alt="" aria-hidden="true" />}
          {altered && RECORDS_DIFFERENCES.map((difference) => {
            const isFound = foundSet.has(difference.id)
            const isHinted = hintTarget === difference.id
            return (
              <button
                key={difference.id}
                type="button"
                data-difference-id={difference.id}
                className={`records-difference-item${isFound ? ' is-found' : ''}${isHinted ? ' is-hinted' : ''}`}
                style={{ left: `${difference.x}%`, top: `${difference.y}%`, width: `${difference.width}%`, height: `${difference.height}%` }}
                onClick={(event) => findDifference(difference, event)}
                aria-label={isFound ? `Found difference: ${difference.name}` : 'Inspect this region for a newly appeared detail'}
                aria-pressed={isFound}
                disabled={isFound}
              >
                {isFound && <span aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>
      </figure>
    )
  }

  function statusLabel() {
    if (telemetry.status === 'standby') return 'STANDBY'
    return differenceStatus(telemetry.status)
  }

  function renderProbabilityRows() {
    if (!telemetry.probabilities) return <p>Per-action probabilities: Not exposed by current API response.</p>
    return <ul className="records-telemetry-probabilities">
      {Object.entries(telemetry.probabilities).map(([action, probability]) => (
        <li key={action}><span>{action}</span><span>{(probability * 100).toFixed(1)}%</span></li>
      ))}
    </ul>
  }

  return (
    <main className="records-difference-screen">
      <header className="records-difference-header">
        <div><p className="chapter-eyebrow">// ARCHIVE ACCESS / LEVEL 04</p><h1>THE RECORDS CENTRE</h1></div>
        <div className="records-difference-controls">
          <div className="records-difference-progress" role="group" aria-label={`${foundCount} of ${RECORDS_DIFFERENCE_COUNT} differences found`}>
            {RECORDS_DIFFERENCES.map((difference) => <span key={difference.id} className={foundSet.has(difference.id) ? 'is-found' : ''} aria-label={foundSet.has(difference.id) ? 'Found' : 'Not found'}>✓</span>)}
          </div>
          <span>{foundCount} / {RECORDS_DIFFERENCE_COUNT} DIFFERENCES</span>
          <button type="button" onClick={() => void requestDecision('manual player request')} disabled={decisionIsPending || puzzleIsComplete}>{decisionIsPending ? 'CONSULTING…' : 'ASK THE DECIDER'}</button>
          <button type="button" onClick={onBack}>← SURVEILLANCE</button>
        </div>
      </header>
      <div className="records-difference-scroll">
        <p className="records-difference-instructions">Five details have appeared in the lower image. Find each one. One may explain who entered before you.</p>
        {drawFrame('01 / ARCHIVED RECORDS', false)}
        {drawFrame('02 / CURRENT RECORDS', true)}
        {(interactionNotice || hintTarget) && <p className="records-difference-hint" role="status">{interactionNotice || 'One verified difference is highlighted in the lower image.'}</p>}
        <p className="records-difference-decider" aria-live="polite">STRANDS DECIDER 2B / {statusLabel()}{telemetry.action ? ` / ${telemetry.action}` : ''}</p>
      </div>
      <aside className="records-difference-narrator" aria-live="polite">
        <p>{narrator.narration}</p>
        <span className="records-narration-status">{narrator.narrationLoading ? 'NARRATION PENDING' : narrator.narrationStatus === 'timed_out' ? 'NARRATION TIMED OUT / LOCAL FALLBACK' : narrator.narrationError ? 'NARRATION FAILED / LOCAL FALLBACK' : 'FIELD NARRATIVE'}</span>
        <button type="button" onClick={narrator.toggleVoice} aria-pressed={narrator.voiceEnabled}>{narrator.voiceEnabled ? 'MUTE VOICE' : 'ENABLE VOICE'}</button>
        <button type="button" onClick={() => narrator.setTranscriptOpen((open) => !open)} aria-expanded={narrator.transcriptOpen}>{narrator.transcriptOpen ? 'HIDE LOG' : 'NARRATION LOG'}</button>
        <details className="records-director-telemetry">
          <summary>OBSERVER / {statusLabel()}{telemetry.action ? ` / ${telemetry.action}` : ''}</summary>
          <div className="records-director-telemetry-content" aria-live="polite">
            <p><strong>Result:</strong> {telemetry.origin === 'decider' ? `Real Decider API result${telemetry.model ? ` / ${telemetry.model}` : ''}` : 'No model action returned; no fallback is presented as a Decider result.'}</p>
            <p><strong>Trigger:</strong> {telemetry.trigger}</p>
            <p><strong>Action:</strong> {telemetry.action || '—'}</p>
            <p><strong>Intervention:</strong> {telemetry.effect}</p>
            <p><strong>Client round-trip:</strong> {telemetry.clientLatencyMs === null ? '—' : `${telemetry.clientLatencyMs} ms`}</p>
            <p><strong>Decider service latency:</strong> {telemetry.serviceLatencyMs === null ? 'Not exposed by current API response' : `${telemetry.serviceLatencyMs} ms (server-reported evaluate time)`}</p>
            <p><strong>Confidence:</strong> {telemetry.confidence === null ? 'Not exposed by current API response' : `${(telemetry.confidence * 100).toFixed(1)}%`}</p>
            <p><strong>Signals:</strong> {telemetry.signals.misclicks} misclicks total ({telemetry.signals.misclicksSinceDecision} since decision); {formatElapsed(telemetry.signals.idleMs)} idle; {formatElapsed(telemetry.signals.timeSinceLastFindMs)} since {telemetry.signals.hasSuccessfulFind ? 'last successful find' : 'puzzle start'}; {telemetry.signals.successfulFinds} found / {telemetry.signals.remainingDifferences} remaining.</p>
            {renderProbabilityRows()}
            {telemetry.message && <p className="records-telemetry-error">{telemetry.message}</p>}
          </div>
        </details>
        {narrator.transcriptOpen && <ol className="records-narration-transcript">{narrator.transcript.map((item, index) => <li key={`${index}-${item.source}`}><span>{item.source}</span>{item.text}</li>)}</ol>}
      </aside>
    </main>
  )
}

export default RecordsSpotDifference
