import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ROOMS, inspectObject, scanGatesCard, attemptCodeUnlock } from '../game/game'
import { unlockRestrictedRecords } from '../game/progression'
import { apiUrl } from '../game/api.js'
import { effectForGateAction } from '../game/gatesDirector.js'
import SecurityPuzzle from './SecurityPuzzle'
import CodeLock from './CodeLock'

const NARRATION_ENDPOINT = apiUrl('/api/director/narrate')
const DECIDER_ENDPOINT = apiUrl('/api/director/decide')
const NARRATION_TIMEOUT_MS = 45_000
const DECIDER_TIMEOUT_MS = 130_000

function fallbackFor(event) {
  if (event === 'ambient') {
    return 'Rain rattles against the fence. Somewhere beyond it, a relay answers with a single click.'
  }
  if (event === 'arrival') {
    return 'The iron perimeter rises out of the rain. A single card reader waits beside the sealed gates.'
  }
  if (event === 'card-scan') {
    return 'The scanner accepts your identity, then refuses entry. Its log places your active session at 02:17—twenty-six minutes before you arrived.'
  }
  if (event === 'terminal-inspected') {
    return 'The terminal preserves the earlier authentication as a completed event. It names you, and offers no explanation for the time.'
  }
  if (event === 'gate-inspected') {
    return 'A maintenance plate gives the site incident date as 04/27. Rain has erased the rest of the engraving.'
  }
  if (event === 'records-unlocked') {
    return 'The archive yields a restricted access note. The override follows the incident date, but the record does not explain the impossible session.'
  }
  if (event === 'wrong-code') {
    return 'The terminal rejects the entry. The gates remain sealed, and the access log does not change.'
  }
  if (event === 'gates-open') {
    return 'The lock releases with a heavy metallic shudder. Beyond the gate, the facility is still lit.'
  }
  if (event === 'hint') {
    return 'The Director studies the evidence already recovered. The incident date and the restricted access note may belong to the same procedure.'
  }
  if (event === 'tension') {
    return 'A relay clicks somewhere inside the gate mechanism. The security display stays fixed on your identity.'
  }
  return 'The storm presses against the fence. The terminal remains active.'
}

function verifiedFacts(state) {
  const facts = [
    'The player is at the Lighthouse Gates, Sector 07.',
    'The player arrived at 02:43.',
    `The gates are ${state.doorUnlocked ? 'unlocked' : 'locked'}.`,
  ]
  if (state.gatesScanned) {
    facts.push('The card scan returned IDENTITY VERIFIED and ACCESS DENIED.')
    facts.push('The system lists a previous authentication at 02:17.')
    facts.push('The identity match is confirmed and the session is already active.')
    facts.push('No cause for the earlier authentication has been established.')
  }
  if (state.inspectedObjects.includes('gate-terminal')) {
    facts.push('The player inspected the security terminal and its 02:17 log.')
  }
  if (state.discoveredClues.includes('incident-date')) {
    facts.push('The gate maintenance plate shows the site incident date 04/27.')
  }
  if (state.recordsUnlocked) {
    facts.push('The player solved the terminal sequence and unlocked restricted records.')
    facts.push('The recovered note says the override follows the incident date.')
  }
  if (state.failedCodeAttempts) {
    facts.push(`The player has made ${state.failedCodeAttempts} incorrect override attempt(s).`)
  }
  if (state.doorUnlocked) facts.push('The security gates are unlocked.')
  return facts.slice(0, 10)
}

function LighthouseGates({ game, setGame, onEnterFacility, onReturnToMenu }) {
  const [scanning, setScanning] = useState(false)
  const [actionNote, setActionNote] = useState('')
  const [narration, setNarration] = useState('')
  const [narrationLoading, setNarrationLoading] = useState(false)
  const [narrationError, setNarrationError] = useState(false)
  const [narrationStatus, setNarrationStatus] = useState('idle')
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [transcript, setTranscript] = useState([])
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('VOICE OFF')
  const [activePuzzle, setActivePuzzle] = useState(null)
  const [scannerPrompt, setScannerPrompt] = useState('marker')
  const voiceEnabledRef = useRef(false)
  const [decisionLoading, setDecisionLoading] = useState(false)
  const [directorDecision, setDirectorDecision] = useState('')
  const [directorHint, setDirectorHint] = useState('')
  const gameRef = useRef(game)
  const requestId = useRef(0)
  const narrationController = useRef(null)
  const narrationRequestRef = useRef(null)
  const decisionController = useRef(null)
  const narrationHistory = useRef(game.narrationHistory || [])
  const scanTimer = useRef(null)
  const ambientTimer = useRef(null)
  const ambientPlayed = useRef(false)
  const room = ROOMS.gates
  const terminalInspected = game.inspectedObjects.includes('gate-terminal')
  const plateInspected = game.discoveredClues.includes('incident-date')

  useEffect(() => {
    gameRef.current = game
    narrationRequestRef.current = requestNarration
  })

  function commitGame(next) {
    gameRef.current = next
    setGame(next)
  }

  function rememberNarration(line) {
    const recent = [...narrationHistory.current, line].slice(-4)
    narrationHistory.current = recent
    commitGame({ ...gameRef.current, narrationHistory: recent })
  }

  function scheduleAmbientBeat() {
    if (ambientPlayed.current) return
    window.clearTimeout(ambientTimer.current)
    ambientTimer.current = window.setTimeout(() => {
      if (ambientPlayed.current) return
      ambientPlayed.current = true
      void narrationRequestRef.current?.('ambient', gameRef.current)
    }, 45000)
  }
  function speakNarration(text) {
    if (!voiceEnabledRef.current || !text || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onstart = () => setVoiceStatus('VOICE PLAYING')
    utterance.onend = () => setVoiceStatus(voiceEnabledRef.current ? 'VOICE READY' : 'VOICE OFF')
    utterance.onerror = () => setVoiceStatus('VOICE UNAVAILABLE')
    window.speechSynthesis.speak(utterance)
  }

  function toggleVoice() {
    if (!('speechSynthesis' in window)) {
      setVoiceStatus('VOICE UNAVAILABLE')
      return
    }
    const enabled = !voiceEnabledRef.current
    voiceEnabledRef.current = enabled
    setVoiceEnabled(enabled)
    if (enabled) {
      setVoiceStatus('VOICE READY')
      // Run during the click gesture so the browser can unlock speech output.
      speakNarration(narration || 'Field narrative voice enabled.')
    } else {
      window.speechSynthesis.cancel()
      setVoiceStatus('VOICE OFF')
    }
  }
  async function requestNarration(event, state = gameRef.current) {
    if (event !== 'ambient') scheduleAmbientBeat()
    const id = ++requestId.current
    narrationController.current?.abort()
    const controller = new AbortController()
    narrationController.current = controller
    const fallback = fallbackFor(event)
    setNarration(fallback)
    setNarrationLoading(true)
    setNarrationError(false)
    setNarrationStatus('pending')

    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, NARRATION_TIMEOUT_MS)
    try {
      const response = await fetch(NARRATION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          room_name: room.name,
          event: `${event}: ${fallback}`,
          verified_facts: verifiedFacts(state),
          recent_narration: narrationHistory.current.slice(-4),
        }),
      })
      if (!response.ok) throw new Error(`Narration HTTP ${response.status}`)
      const result = await response.json()
      if (id !== requestId.current || !result.narration) return

      const line = result.narration.trim()
      rememberNarration(line)
      setNarration(line)
      setNarrationStatus('completed')
      setTranscript((current) => [...current, { text: line, source: result.source || 'amazon-bedrock' }].slice(-8))
      speakNarration(line)
    } catch {
      if (id !== requestId.current) return
      setNarration(fallback)
      setNarrationError(true)
      setNarrationStatus(timedOut ? 'timed_out' : 'failed')
      rememberNarration(fallback)
      setTranscript((current) => [...current, { text: fallback, source: timedOut ? 'timeout fallback' : 'local fallback' }].slice(-8))
      speakNarration(fallback)
    } finally {
      window.clearTimeout(timeout)
      if (id === requestId.current) setNarrationLoading(false)
    }
  }


  useEffect(() => {
    // Deferring one tick avoids duplicate Bedrock calls from StrictMode's
    // development-only effect replay; cleanup cancels the first scheduled call.
    const openingTimer = window.setTimeout(() => {
      void narrationRequestRef.current?.('arrival', gameRef.current)
    }, 0)
    return () => {
      window.clearTimeout(openingTimer)
      requestId.current += 1
      window.clearTimeout(scanTimer.current)
      window.clearTimeout(ambientTimer.current)
      narrationController.current?.abort()
      decisionController.current?.abort()
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  function beginCardScan() {
    if (scanning || game.gatesScanned) return
    setActionNote('CARD AUTHENTICATION / PROCESSING')
    setScanning(true)
    scanTimer.current = window.setTimeout(() => {
      const next = scanGatesCard(gameRef.current)
      commitGame(next)
      setScanning(false)
      setScannerPrompt('failure')
      setActionNote('ACCESS DENIED / REVIEW THE TERMINAL LOG')
      void requestNarration('card-scan', next)
    }, 850)
  }

  function advanceScannerPrompt() {
    if (!gameRef.current.gatesScanned) {
      setScannerPrompt('scan-card')
      return
    }
    if (!gameRef.current.inspectedObjects.includes('gate-terminal')) {
      setScannerPrompt('terminal')
    }
  }
  function inspect(id) {
    if (id === 'gate-structure' && !gameRef.current.recordsUnlocked) return
    if (id === 'scanner') {
      beginCardScan()
      return
    }
    const object = room.objects.find((item) => item.id === id)
    if (!object) return
    if (id === 'gate-terminal' && !game.gatesScanned) {
      setActionNote('SCAN YOUR ACCESS CARD BEFORE OPENING THE SECURITY LOG')
      return
    }

    const alreadyInspected = game.inspectedObjects.includes(object.id)
    const next = inspectObject(game, object)
    commitGame(next)
    setActionNote(`${object.name} / INSPECTION RECORDED`)
    if (!alreadyInspected) {
      void requestNarration(id === 'gate-terminal' ? 'terminal-inspected' : 'gate-inspected', next)
    }
  }

  function solveArchive() {
    const unlocked = unlockRestrictedRecords(game)
    const next = unlocked.discoveredClues.includes('restricted-record')
      ? unlocked
      : { ...unlocked, discoveredClues: [...unlocked.discoveredClues, 'restricted-record'] }
    commitGame(next)
    setActionNote('RESTRICTED RECORDS / ACCESS GRANTED')
    void requestNarration('records-unlocked', next)
  }

  function recordWrongCode() {
    const next = { ...game, failedCodeAttempts: (game.failedCodeAttempts || 0) + 1 }
    commitGame(next)
    setActionNote('CODE REJECTED / GATES STILL LOCKED')
    void requestNarration('wrong-code', next)
  }

  function unlockGates(code) {
    const next = attemptCodeUnlock(game, code)
    commitGame(next)
    if (next.doorUnlocked) {
      setActionNote('ACCESS GRANTED / GATE LOCKS RELEASED')
      void requestNarration('gates-open', next)
    }
  }

  async function requestDirectorHint() {
    if (decisionLoading) return
    decisionController.current?.abort()
    const controller = new AbortController()
    decisionController.current = controller
    setDecisionLoading(true)
    setDirectorDecision('')
    setDirectorHint('')
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, DECIDER_TIMEOUT_MS)
    try {
      const response = await fetch(DECIDER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          state: [
            `Current room: ${room.name}.`,
            `Verified clues: ${game.discoveredClues.join(', ') || 'none'}.`,
            `Archive unlocked: ${Boolean(game.recordsUnlocked)}.`,
            `Gates unlocked: ${Boolean(game.doorUnlocked)}.`,
            'The player explicitly requested a hint. Select whether a verified-evidence hint is appropriate.',
          ].join(' '),
          allowed_actions: ['HINT', 'RAISE_TENSION', 'WAIT'],
        }),
      })
      if (!response.ok) throw new Error(`Director HTTP ${response.status}`)
      const decision = await response.json()
      if (decisionController.current !== controller || controller.signal.aborted) return
      if (timedOut) {
        setDirectorDecision('TIMED OUT')
        setDirectorHint('The Decider did not respond in time. No intervention was applied; the game remains playable.')
        return
      }
      if (!['HINT', 'RAISE_TENSION', 'WAIT'].includes(decision.action)) {
        throw new Error('Director action was outside the permitted set')
      }
      setDirectorDecision(decision.action)
      const effect = effectForGateAction(decision.action, gameRef.current)
      if (effect.kind === 'hint') {
        const currentGame = gameRef.current
        setDirectorHint(effect.text)
        void requestNarration('hint', currentGame)
      } else if (effect.kind === 'narration') {
        void requestNarration(effect.event, gameRef.current)
      } else if (effect.kind === 'none') {
        setDirectorHint('No intervention applied. Continue investigating when you are ready.')
      }
    } catch {
      if (decisionController.current !== controller) return
      if (timedOut) {
        setDirectorDecision('TIMED OUT')
        setDirectorHint('The Decider did not respond in time. No intervention was applied; the game remains playable.')
      } else if (!controller.signal.aborted) {
        setDirectorDecision('OFFLINE')
        setDirectorHint('The Decider is unavailable. No intervention was applied; the game remains playable.')
      }
    } finally {
      window.clearTimeout(timeout)
      if (decisionController.current === controller) setDecisionLoading(false)
    }
  }

  const evidenceNames = {
    'prior-session': '02:17 PRIOR AUTHENTICATION',
    'security-log': 'TERMINAL ACCESS LOG',
    'incident-date': 'SITE INCIDENT / 04·27',
    'restricted-record': 'RESTRICTED OVERRIDE NOTE',
  }

  return (
    <main className="gates-scene">
      <header className="gates-header">
        <div>
          <button type="button" className="gates-wordmark gates-menu-button" onClick={onReturnToMenu}>AFTERHOURS</button>
          <span className="gates-sector">SECTOR 07 / ARRIVAL CHAMBER</span>
        </div>
        <span className="gates-signal"><i /> COASTAL SITE / SIGNAL UNSTABLE</span>
      </header>

      <section className="gates-environment" aria-label="Interactive lighthouse gate scene">
        <div className="gates-fallback-iron" aria-hidden="true" />
        {!game.gatesScanned && scannerPrompt === 'marker' && (
          <button
            type="button"
            className="gates-scanner-marker"
            onClick={advanceScannerPrompt}
            aria-label="Reveal the access card scan"
            title="Scanner"
          >
            <span aria-hidden="true" />
          </button>
        )}
        <div className="gates-timecode"><span>LOCAL ARRIVAL</span><strong>02:43</strong><span>AUTH LOG / {game.gatesScanned ? '02:17' : '— — : — —'}</span></div>
      </section>

      <section className="gates-workspace" aria-label="Lighthouse gates investigation">
        <article className="gates-story-panel">
          <div className="gates-eyebrow">// LOCATION / SECTOR 07</div>
          <h1>LIGHTHOUSE GATES</h1>
          <p>The storm batters the perimeter. A card reader and security terminal guard the entrance to the coastal facility.</p>

          <section className="gates-narrator" aria-live="polite">
            <div className="gates-panel-title"><span>FIELD NARRATIVE / LIVE</span><span className={narrationLoading ? 'gates-live-dot is-loading' : 'gates-live-dot'}>{narrationLoading ? 'GENERATING' : narrationStatus === 'timed_out' ? 'TIMED OUT / FALLBACK' : narrationError ? 'FAILED / FALLBACK' : narration ? 'AMAZON BEDROCK' : 'CONNECTING'}</span></div>
            <p>{narration || 'The narrator is connecting to the field record.'}</p>
            <div className="gates-narrator-controls">
              <button type="button" onClick={toggleVoice} aria-pressed={voiceEnabled}>{voiceEnabled ? 'MUTE BROWSER VOICE' : 'ENABLE BROWSER VOICE'}</button>
              <span className="gates-voice-status" aria-live="polite">{voiceStatus}</span>
              <button type="button" onClick={() => setTranscriptOpen((open) => !open)} aria-expanded={transcriptOpen}>{transcriptOpen ? 'HIDE TRANSCRIPT' : 'VIEW TRANSCRIPT'}</button>
            </div>
            {transcriptOpen && <ol className="gates-transcript">{transcript.map((entry, index) => <li key={`${index}-${entry.source}`}><span>{entry.source}</span>{entry.text}</li>)}</ol>}
          </section>
          <section className="gates-director">
            <div className="gates-panel-title"><span>DIRECTOR ASSISTANCE</span><span>{decisionLoading ? 'PROCESSING' : directorDecision || 'STANDBY'}</span></div>
            <button type="button" onClick={requestDirectorHint} disabled={decisionLoading}>{decisionLoading ? 'EVALUATING…' : 'REQUEST FIELD HINT'}</button>
            {directorHint && <p>{directorHint}</p>}
          </section>
          {!game.gatesScanned && scannerPrompt === 'marker' && (
            <p className="gates-prompt"><span className="gates-prompt-dot" /> Select the scanner marker in the scene to begin.</p>
          )}
          {!game.gatesScanned && scannerPrompt === 'scan-card' && (
            <section className="gates-stage-card" aria-labelledby="gates-stage-title">
              <div className="gates-panel-title"><span id="gates-stage-title">ACCESS CARD SCANNER</span><span>READY</span></div>
              <p className="gates-muted">Present your access card to verify your identity at the perimeter.</p>
              <button type="button" className="gates-stage-button" onClick={beginCardScan} disabled={scanning}>
                {scanning ? 'VERIFYING…' : 'SCAN ACCESS CARD'}
              </button>
            </section>
          )}
          {game.gatesScanned && scannerPrompt === 'failure' && (
            <section className="gates-stage-card" role="status" aria-live="polite" aria-labelledby="gates-stage-title">
              <div className="gates-panel-title"><span id="gates-stage-title">CARD AUTHENTICATION</span><span className="gates-alert-status">ACCESS DENIED</span></div>
              <div className="gates-denial-log">
                <strong>IDENTITY VERIFIED</strong>
                <strong>ACCESS DENIED</strong>
                <span>PREVIOUS AUTHENTICATION: 02:17</span>
                <span>IDENTITY: MATCH CONFIRMED</span>
                <span>SESSION STATUS: ALREADY ACTIVE</span>
                <small>Your arrival at 02:43 is 26 minutes after this recorded authentication.</small>
              </div>
              <button type="button" className="gates-stage-button" onClick={advanceScannerPrompt}>NEXT: SECURITY TERMINAL <span>→</span></button>
            </section>
          )}
          {game.gatesScanned && scannerPrompt === 'terminal' && !terminalInspected && (
            <section className="gates-stage-card" aria-labelledby="gates-stage-title">
              <div className="gates-panel-title"><span id="gates-stage-title">SECURITY TERMINAL</span><span className="gates-alert-status">LOG AVAILABLE</span></div>
              <p className="gates-muted">The terminal records a completed authentication under your identity before your arrival.</p>
              <div className="gates-log-lines" aria-label="Security log">
                <span><time>02:17:04</time> AUTHENTICATION ACCEPTED</span>
                <span><time>02:17:05</time> IDENTITY MATCH CONFIRMED</span>
                <span><time>02:17:05</time> SESSION STATUS: ALREADY ACTIVE</span>
                <span><time>02:43:00</time> ARRIVAL / ACCESS DENIED</span>
              </div>
              <button type="button" className="gates-stage-button" onClick={() => inspect('gate-terminal')}>INSPECT SECURITY TERMINAL</button>
            </section>
          )}
          {terminalInspected && !game.recordsUnlocked && activePuzzle !== 'sequence' && (
            <section className="gates-stage-card" aria-labelledby="gates-stage-title">
              <div className="gates-panel-title"><span id="gates-stage-title">SECURITY TERMINAL</span><span>INSPECTION RECORDED</span></div>
              <p className="gates-muted">The access log has been added to the field record. Restore the terminal sequence to recover the restricted archive.</p>
              <button type="button" className="gates-stage-button" onClick={() => setActivePuzzle('sequence')}>OPEN SECURITY SEQUENCE <span>→</span></button>
            </section>
          )}
          {game.recordsUnlocked && !plateInspected && !game.doorUnlocked && (
            <section className="gates-stage-card" aria-labelledby="gates-stage-title">
              <div className="gates-panel-title"><span id="gates-stage-title">GATE MAINTENANCE</span><span>PLATE FOUND</span></div>
              <p className="gates-muted">The restored records point to a date stamped on the gate maintenance plate.</p>
              <button type="button" className="gates-stage-button" onClick={() => inspect('gate-structure')}>INSPECT MAINTENANCE PLATE</button>
            </section>
          )}
          {plateInspected && !game.doorUnlocked && activePuzzle !== 'code' && (
            <section className="gates-stage-card" aria-labelledby="gates-stage-title">
              <div className="gates-panel-title"><span id="gates-stage-title">RESTRICTED RECORD / RECOVERED</span><span>OVERRIDE REQUIRED</span></div>
              <p className="gates-muted">The override follows the month and day of the site incident. Compare this note with the date on the gate maintenance plate.</p>
              <button type="button" className="gates-stage-button" onClick={() => setActivePuzzle('code')}>OPEN OVERRIDE CONSOLE <span>→</span></button>
            </section>
          )}
          {game.doorUnlocked && <div className="gates-open-notice">GATE LOCKS RELEASED</div>}
          {actionNote && <div className="gates-action-note" aria-live="polite">{actionNote}</div>}

          {game.discoveredClues.length > 0 && (
            <section className="gates-evidence-panel">
              <div className="gates-panel-title"><span>EVIDENCE / {String(game.discoveredClues.length).padStart(2, '0')}</span><span>FIELD LOG</span></div>
              <ul>{game.discoveredClues.map((clue) => <li key={clue}>{evidenceNames[clue] || clue.toUpperCase()}</li>)}</ul>
            </section>
          )}
          {game.doorUnlocked && <button type="button" className="gates-enter-button" onClick={onEnterFacility}>ENTER THE FACILITY <span>→</span></button>}
        </article>
      </section>
      <footer className="gates-footer"><span>INCIDENT 001</span><span>LOCATION: SECTOR 07 / ARRIVAL 02:43</span><span>DO NOT TRUST THE LOGS</span></footer>
      {activePuzzle && createPortal(
        <div className="gates-modal-backdrop">
          <section className={'gates-puzzle-modal' + (activePuzzle === 'code' ? ' gates-puzzle-modal--code' : '')} role="dialog" aria-modal="true" aria-labelledby="gates-modal-title">
            <div className="gates-modal-heading">
              <div>
                <span className="gates-eyebrow">// SECURE INTERFACE</span>
                <h2 id="gates-modal-title">{activePuzzle === 'sequence' ? 'RESTORE TERMINAL SEQUENCE' : 'RESEARCH-4 OVERRIDE'}</h2>
              </div>
              <span className="gates-modal-lock">SOLVE TO CLOSE</span>
            </div>
            {activePuzzle === 'sequence' ? (
              <SecurityPuzzle onSolved={() => {
                solveArchive()
                setActivePuzzle(null)
              }} />
            ) : (
              <CodeLock onUnlocked={(code) => {
                unlockGates(code)
                setActivePuzzle(null)
              }} onAttempt={recordWrongCode} />
            )}
          </section>
        </div>,
        document.body,
      )}
    </main>
  )
}

export default LighthouseGates
