
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiUrl } from '../game/api.js'

const INTRO_FALLBACKS = [
  '23:41. The coastal warning system has gone silent.',
  'The lighthouse ahead is not listed on any public map.',
  'It belongs to an organization that studies people who should not exist.',
  'Tonight, its security system has logged your identity twice.',
  'The second arrival was recorded twenty-six minutes before yours.',
]
const NARRATION_ENDPOINT = apiUrl('/api/director/narrate')
const NARRATION_TIMEOUT_MS = 45_000
const ARRIVAL_FACTS = [
  'AFTERHOURS is a covert organization that identifies, records, and studies people with extraordinary abilities.',
  'Someone is attempting to access sensitive AFTERHOURS information.',
  'The player is an AFTERHOURS agent arriving at a coastal lighthouse facility.',
]

function LighthouseArrival({ onEnter }) {
  const [lineIndex, setLineIndex] = useState(0)
  const [narration, setNarration] = useState('')
  const [narrationLoading, setNarrationLoading] = useState(true)
  const [narrationError, setNarrationError] = useState(false)
  const [narrationStatus, setNarrationStatus] = useState('pending')
  const [showContinue, setShowContinue] = useState(false)
  const [muted, setMuted] = useState(false)
  const narrationHistory = useRef([])
  const requestId = useRef(0)

  useEffect(() => {
    const currentRequest = ++requestId.current
    const controller = new AbortController()
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, NARRATION_TIMEOUT_MS)

    async function fetchNarration() {
      try {
        const response = await fetch(NARRATION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            room_name: 'Lighthouse arrival',
            event: `Opening narration, beat ${lineIndex + 1} of ${INTRO_FALLBACKS.length}. Write the next ominous arrival beat for the agent. Keep it faithful to the verified facts and continuity; do not invent clues or actions.`,
            verified_facts: ARRIVAL_FACTS,
            recent_narration: narrationHistory.current.slice(-4),
          }),
        })
        if (!response.ok) throw new Error(`Narration HTTP ${response.status}`)
        const result = await response.json()
        if (!result.narration) throw new Error('Narration was empty')
        if (currentRequest !== requestId.current) return
        const line = result.narration.trim()
        narrationHistory.current = [...narrationHistory.current, line].slice(-4)
        setNarration(line)
        setNarrationStatus('completed')
      } catch {
        if (currentRequest !== requestId.current || (controller.signal.aborted && !timedOut)) return
        const fallback = INTRO_FALLBACKS[lineIndex]
        narrationHistory.current = [...narrationHistory.current, fallback].slice(-4)
        setNarration(fallback)
        setNarrationError(true)
        setNarrationStatus(timedOut ? 'timed_out' : 'failed')
      } finally {
        window.clearTimeout(timeout)
        if (currentRequest === requestId.current) {
          setNarrationLoading(false)
          setShowContinue(true)
        }
      }
    }

    void fetchNarration()
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
      requestId.current += 1
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [lineIndex])

  const narrate = useCallback(() => {
    if (muted || narrationLoading || !narration || !('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()

    const speech = new SpeechSynthesisUtterance(narration)
    speech.rate = 0.88
    speech.pitch = 0.82
    speech.volume = 0.9

    window.speechSynthesis.speak(speech)
  }, [muted, narration, narrationLoading])

  function continueStory() {
    if (lineIndex < INTRO_FALLBACKS.length - 1) {
      setNarrationLoading(true)
      setNarrationError(false)
      setNarrationStatus('pending')
      setShowContinue(false)
      setLineIndex((current) => current + 1)
      return
    }
    window.speechSynthesis?.cancel()
    onEnter()
  }

  useEffect(() => {
    narrate()
  }, [narrate])

  return (
    <main className="game-shell lighthouse-arrival">
      <div className="arrival-grain" aria-hidden="true" />
      <div className="arrival-vignette" aria-hidden="true" />

      <header className="arrival-header">
        <span className="arrival-wordmark">AFTERHOURS</span>
        <span className="arrival-status">
          <span className="status-dot" />
          COASTAL SITE / SIGNAL UNSTABLE
        </span>
      </header>

      <section className="arrival-content">
        <p className="eyebrow">
          <span className="eyebrow-line" />
          FIELD RECORDING 001
        </p>

        <p className="arrival-time">23:41 — NORTH ATLANTIC COAST</p>

        <h1>
          THE LIGHT
          <br />
          <span>IS STILL ON.</span>
        </h1>

        <div className={`arrival-narration-frame${narrationLoading ? ' is-generating' : ''}`}>
          <div className="arrival-narration-inner">
            <div className="arrival-narration-heading">
              <span>FIELD NARRATIVE / {narrationLoading ? 'GENERATING' : narrationStatus === 'timed_out' ? 'TIMED OUT / LOCAL FALLBACK' : narrationError ? 'FAILED / LOCAL FALLBACK' : 'AMAZON BEDROCK'}</span>
              <span className="arrival-narration-indicator" aria-hidden="true" />
            </div>
            <p className="arrival-narration" aria-live="polite">
              {narrationLoading ? 'Establishing secure connection to the field record…' : narration}
            </p>
          </div>
        </div>

        <div className="arrival-progress">
          {INTRO_FALLBACKS.map((_, index) => (
            <span
              key={index}
              className={index <= lineIndex ? 'active' : ''}
            />
          ))}
        </div>

        <div className="arrival-actions">
          <button
            className="enter-button"
            onClick={continueStory}
            disabled={!showContinue}
          >
            <span>
                {lineIndex === INTRO_FALLBACKS.length - 1
                ? 'APPROACH THE LIGHTHOUSE'
                : 'CONTINUE'}
            </span>
            <span className="button-arrow">&gt;</span>
          </button>

          <button
            className="arrival-audio"
            onClick={() => setMuted((current) => !current)}
          >
            {muted ? 'ENABLE VOICE' : 'MUTE VOICE'}
          </button>

          <button
            className="arrival-skip"
            onClick={() => {
              window.speechSynthesis?.cancel()
              onEnter()
            }}
          >
            SKIP INTRO
          </button>
        </div>
      </section>

      <footer className="arrival-footer">
        <span>INCIDENT 001</span>
        <span>UNAUTHORIZED IDENTITY DETECTED</span>
        <span>DO NOT TRUST THE LOGS</span>
      </footer>
    </main>
  )
}

export default LighthouseArrival
