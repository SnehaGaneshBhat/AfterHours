import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '../game/api.js'
import {
  SURVEILLANCE_CAMERAS,
  attemptHairEvidence,
  inspectSurveillanceFootage,
  reviewArchiveGap,
  selectSurveillanceCamera,
} from '../game/game'

const DECIDER_ENDPOINT = apiUrl('/api/director/decide')
const BEFORE_CLIP = 'cam-entry-before'
const AFTER_CLIP = 'cam-entry-after'
const REGION_IDS = ['wall', 'light', 'door-frame', 'floor', 'access-panel', 'door-handle-hair']
const EVIDENCE_NAMES = {
  'prior-session': '02:17 PRIOR AUTHENTICATION',
  'security-log': 'TERMINAL ACCESS LOG',
  'incident-date': 'SITE INCIDENT / 04·27',
  'restricted-record': 'RESTRICTED OVERRIDE NOTE',
  'hair-strand': 'HAIR STRAND / RESTRICTED ENTRY',
}

function verifiedHint(state) {
  if (!state.archiveGapReviewed) return 'Review the archive warning and note the interval with no recording.'
  if (!state.selectedCameraId) return 'Choose a camera whose view covers the restricted entrance.'
  if (state.selectedCameraId !== 'cam-entry') return 'The restricted-entry view is the one nearest the 02:17 access event.'
  if (!state.inspectedFootage.includes(BEFORE_CLIP)) return 'Open the surviving recording before the archive gap.'
  if (!state.inspectedFootage.includes(AFTER_CLIP)) return 'Open the surviving recording after the archive gap.'
  if (!state.hairStrandFound) return 'Compare the matched frames carefully and inspect the region that changed.'
  return 'The physical trace is recorded in the evidence inventory.'
}

function ReferenceFrame({ interval, timestamp, interactive = false, onInspectRegion }) {
  const after = interval === 'after'

  return (
    <figure className="archive-frame">
      <figcaption><span>CAM-03 / {after ? 'AFTER GAP' : 'BEFORE GAP'}</span><span>DESIGNED FEED PLACEHOLDER</span></figcaption>
      <div className="archive-frame-canvas">
        <svg viewBox="0 0 960 540" role="img" aria-label={`Simulated grayscale camera reference frame, ${interval} the missing interval`}>
          <defs>
            <linearGradient id={`wall-${interval}`} x2="0" y2="1">
              <stop stopColor="#26343b" />
              <stop offset="1" stopColor="#101a20" />
            </linearGradient>
            <linearGradient id={`floor-${interval}`} x2="0" y2="1">
              <stop stopColor="#18242a" />
              <stop offset="1" stopColor="#050a0d" />
            </linearGradient>
            <linearGradient id={`door-${interval}`} x2="1" y2="1">
              <stop stopColor="#323c40" />
              <stop offset="0.5" stopColor="#1b252a" />
              <stop offset="1" stopColor="#11191d" />
            </linearGradient>
          </defs>
          <rect width="960" height="540" fill={`url(#wall-${interval})`} />
          <path d="M0 365 L960 365 L960 540 L0 540Z" fill={`url(#floor-${interval})`} />
          <path d="M0 365H960M0 430L960 430M0 480L960 480" stroke="#718087" strokeOpacity=".13" strokeWidth="2" />
          <path d="M70 0V365M170 0V365M885 0V365" stroke="#a5b2b4" strokeOpacity=".12" strokeWidth="4" />
          <rect x="500" y="68" width="333" height="342" fill="#0b1114" stroke="#7e8d91" strokeOpacity=".45" strokeWidth="12" />
          <rect x="520" y="83" width="293" height="315" rx="2" fill={`url(#door-${interval})`} stroke="#859399" strokeOpacity=".33" strokeWidth="3" />
          <path d="M553 110H780M553 360H780" stroke="#a8b4b7" strokeOpacity=".14" strokeWidth="3" />
          <rect x="605" y="133" width="138" height="95" fill="#202c31" stroke="#8e9da0" strokeOpacity=".36" strokeWidth="3" />
          <rect x="620" y="148" width="108" height="65" fill="#0c1418" />
          <path d="M674 164V195M650 178H699" stroke="#52737b" strokeOpacity=".35" strokeWidth="3" />
          <rect x="764" y="286" width="26" height="57" rx="11" fill="#879398" stroke="#c5cdce" strokeOpacity=".45" strokeWidth="3" />
          <circle cx="777" cy="315" r="5" fill="#dae0df" fillOpacity=".65" />
          <rect x="394" y="304" width="40" height="75" fill="#171f23" stroke="#647176" strokeOpacity=".25" strokeWidth="3" />
          <circle cx="414" cy="324" r="5" fill="#87d6d0" fillOpacity=".6" />
          <path d="M0 38H960M0 75H960M0 112H960" stroke="#b8c5c8" strokeOpacity=".035" strokeWidth="1" />
          {after && <path d="M758 293 C765 300 761 308 770 314 C777 319 778 326 786 331" fill="none" stroke="#d8d1bd" strokeOpacity=".9" strokeWidth="2.4" strokeLinecap="round" />}
          <rect width="960" height="540" fill="#9bd2d2" opacity=".035" />
        </svg>
        {interactive && (
          <div className="archive-inspection-grid" aria-label="Choose a region to inspect">
            {REGION_IDS.map((regionId, index) => (
              <button
                key={regionId}
                type="button"
                aria-label={`Inspect comparison region ${String.fromCharCode(65 + index)}`}
                onClick={() => onInspectRegion(regionId)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="archive-frame-footer"><span>REFERENCE ART PLACEHOLDER / CAM-03</span><time>{timestamp}</time></div>
    </figure>
  )
}

function AlternateFeed({ camera }) {
  return (
    <div className="camera-placeholder" role="img" aria-label={`${camera.label} simulated camera feed placeholder`}>
      <span className="camera-placeholder-id">{camera.id} / LIVE CHANNEL</span>
      <div className="camera-placeholder-view" aria-hidden="true">
        <i /><i /><i /><i />
      </div>
      <strong>{camera.label}</strong>
      <span>REFERENCE FEED ART PLACEHOLDER</span>
      <time>{camera.time} / LOCAL</time>
    </div>
  )
}

function NarratorPanel({ narrator }) {
  return (
    <section className="surveillance-panel surveillance-narrator" aria-live="polite">
      <div className="surveillance-panel-heading"><span>FIELD NARRATIVE / LIVE</span><span className={narrator.narrationLoading ? 'is-generating' : narrator.narrationError ? 'is-fallback' : ''}>{narrator.narrationLoading ? 'GENERATING' : narrator.narrationError ? 'LOCAL FALLBACK' : 'BEDROCK'}</span></div>
      <p>{narrator.narration}</p>
      <div className="surveillance-narrator-actions">
        <button type="button" onClick={narrator.toggleVoice} aria-pressed={narrator.voiceEnabled}>{narrator.voiceEnabled ? 'MUTE VOICE' : 'ENABLE VOICE'}</button>
        <span>{narrator.voiceStatus}</span>
        <button type="button" onClick={() => narrator.setTranscriptOpen((open) => !open)} aria-expanded={narrator.transcriptOpen}>{narrator.transcriptOpen ? 'HIDE TRANSCRIPT' : 'TRANSCRIPT'}</button>
      </div>
      {narrator.transcriptOpen && <ol className="surveillance-transcript">{narrator.transcript.map((item, index) => <li key={`${index}-${item.source}`}><span>{item.source}</span>{item.text}</li>)}</ol>}
    </section>
  )
}

function SurveillanceRoom({ game, setGame, onReturnToMenu, onNarrate, narrator, tensionRaised, setTensionRaised }) {
  const [archiveFeedback, setArchiveFeedback] = useState('')
  const [puzzleFeedback, setPuzzleFeedback] = useState('')
  const [hint, setHint] = useState('')
  const [decisionStatus, setDecisionStatus] = useState('STANDBY')
  const [decisionLoading, setDecisionLoading] = useState(false)
  const decisionController = useRef(null)
  const selectedCamera = SURVEILLANCE_CAMERAS.find((camera) => camera.id === game.selectedCameraId)
  const beforeInspected = game.inspectedFootage.includes(BEFORE_CLIP)
  const afterInspected = game.inspectedFootage.includes(AFTER_CLIP)
  const comparisonReady = beforeInspected && afterInspected

  useEffect(() => () => decisionController.current?.abort(), [])

  function inspectClip(interval) {
    const clipId = `cam-entry-${interval}`
    if (game.inspectedFootage.includes(clipId)) return
    const next = inspectSurveillanceFootage(game, interval)
    if (next === game) return
    setGame(next)
    setArchiveFeedback(`${interval === 'before' ? '02:16:48' : '02:18:12'} RECORDING OPENED / CAM-03`)
    onNarrate(interval === 'before' ? 'footage-before' : 'footage-after', next)
    if (next.inspectedFootage.includes(BEFORE_CLIP) && next.inspectedFootage.includes(AFTER_CLIP) && !comparisonReady) {
      onNarrate('recording-discrepancy', next)
    }
  }

  function openArchiveGap() {
    const next = reviewArchiveGap(game)
    if (next === game) return
    setGame(next)
    setArchiveFeedback('ARCHIVE GAP REVIEWED / RECORDING UNAVAILABLE')
    onNarrate('archive-gap-reviewed', next)
  }

  function chooseCamera(cameraId) {
    if (!game.archiveGapReviewed || game.selectedCameraId === cameraId) return
    const next = selectSurveillanceCamera(game, cameraId)
    if (next === game) return
    setGame(next)
    setPuzzleFeedback('')
    setArchiveFeedback(`${cameraId.toUpperCase()} FEED OPENED`)
    onNarrate('camera-selected', next)
  }

  function inspectRegion(regionId) {
    const result = attemptHairEvidence(game, regionId)
    if (result.reason === 'compare-required') {
      setPuzzleFeedback('INSPECT BOTH SURVIVING RECORDINGS BEFORE COMPARING THE FRAME.')
      return
    }
    setGame(result.state)
    if (result.correct) {
      setPuzzleFeedback('PHYSICAL TRACE RECOVERED / HAIR STRAND ADDED TO EVIDENCE')
      if (result.reason === 'collected') onNarrate('hair-collected', result.state)
    } else {
      setPuzzleFeedback('NO CHANGE IDENTIFIED IN THAT REGION. COMPARE THE MATCHED FRAMES AND TRY AGAIN.')
    }
  }

  async function requestDirectorHint() {
    if (decisionLoading) return
    decisionController.current?.abort()
    const controller = new AbortController()
    decisionController.current = controller
    setDecisionLoading(true)
    setDecisionStatus('PROCESSING')
    setHint('')
    const timeout = window.setTimeout(() => controller.abort(), 125000)
    try {
      const response = await fetch(DECIDER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          state: [
            `Current room: LIGHTHOUSE SURVEILLANCE.`,
            `Archive gap reviewed: ${Boolean(game.archiveGapReviewed)}.`,
            `Selected camera: ${game.selectedCameraId || 'none'}.`,
            `Inspected footage: ${game.inspectedFootage.join(', ') || 'none'}.`,
            `Hair strand identified: ${Boolean(game.hairStrandFound)}.`,
            'The player explicitly requested a hint. Choose a permitted pacing or hint action. Do not determine puzzle correctness.',
          ].join(' '),
          allowed_actions: ['HINT', 'RAISE_TENSION', 'WAIT'],
        }),
      })
      if (!response.ok) throw new Error(`Director HTTP ${response.status}`)
      const result = await response.json()
      if (!['HINT', 'RAISE_TENSION', 'WAIT'].includes(result.action)) throw new Error('Invalid Director action')
      setDecisionStatus(result.action)
      if (result.action === 'HINT') {
        setHint(verifiedHint(game))
        onNarrate('hint', game)
      } else if (result.action === 'RAISE_TENSION') {
        setTensionRaised(true)
        setHint('A relay clicks in the surveillance rack. The archived interval remains missing.')
        onNarrate('tension', game)
      } else {
        setHint('The Director recommends another observation before offering a hint.')
      }
    } catch {
      if (!controller.signal.aborted) {
        setDecisionStatus('LOCAL')
        setHint(verifiedHint(game))
        onNarrate('hint', game)
      }
    } finally {
      window.clearTimeout(timeout)
      if (!controller.signal.aborted) setDecisionLoading(false)
    }
  }

  const evidence = [...new Set([...(game.discoveredClues || []), ...(game.inventory || [])])]

  return (
    <main className={`surveillance-scene${tensionRaised ? ' surveillance-scene--tense' : ''}`}>
      <header className="chapter-header surveillance-header">
        <button type="button" className="chapter-wordmark" onClick={onReturnToMenu}>AFTERHOURS</button>
        <span>SECTOR 07 / SURVEILLANCE ROOM</span>
        <span className="surveillance-system-status">ARCHIVE SYSTEM / DEGRADED</span>
      </header>

      <div className="surveillance-page-heading">
        <p className="chapter-eyebrow">// INCIDENT 001 / RESEARCH FACILITY</p>
        <h1>THE MISSING MINUTE</h1>
        <p>Authentication at 02:17 precedes your recorded arrival by twenty-six minutes. The camera archive may show what the terminal cannot.</p>
      </div>

      <section className="archive-alert" aria-label="Missing recording alert">
        <div><span className="archive-alert-indicator" /><span>RECORDING GAP / CAM-03 / 02:17:00—02:18:00</span></div>
        <p>No footage is indexed for the authentication interval. Neighboring recordings remain available.</p>
        <button type="button" onClick={openArchiveGap} disabled={game.archiveGapReviewed}>
          {game.archiveGapReviewed ? 'ARCHIVE GAP REVIEWED' : 'REVIEW ARCHIVE ALERT'}
        </button>
      </section>

      <section className="surveillance-layout">
        <aside className="surveillance-panel camera-directory">
          <div className="surveillance-panel-heading"><span>CAMERA DIRECTORY</span><span>{String(SURVEILLANCE_CAMERAS.length).padStart(2, '0')} CHANNELS</span></div>
          <div className="camera-list">
            {SURVEILLANCE_CAMERAS.map((camera) => (
              <button key={camera.id} type="button" className={`camera-select${game.selectedCameraId === camera.id ? ' is-selected' : ''}`} onClick={() => chooseCamera(camera.id)} disabled={!game.archiveGapReviewed}>
                <span className="camera-select-top"><strong>{camera.id.toUpperCase()}</strong><i className={camera.status === 'ONLINE' ? 'camera-online' : 'camera-alert'} /></span>
                <span>{camera.label}</span>
                <small>{camera.time} / {camera.status}</small>
              </button>
            ))}
          </div>
          {!game.archiveGapReviewed && <p className="surveillance-help-text">Review the archive warning to open the camera index.</p>}
        </aside>

        <section className="surveillance-panel camera-workbench" aria-live="polite">
          <div className="surveillance-panel-heading"><span>{selectedCamera ? `${selectedCamera.id.toUpperCase()} / ${selectedCamera.label}` : 'CAMERA WORKBENCH'}</span><span>{selectedCamera ? selectedCamera.status : 'NO CHANNEL SELECTED'}</span></div>
          {!selectedCamera ? (
            <div className="camera-empty-state"><span className="camera-empty-crosshair">+</span><p>Select a camera channel to inspect its surviving feed.</p></div>
          ) : selectedCamera.id !== 'cam-entry' ? (
            <div className="camera-feed-single">
              <AlternateFeed camera={selectedCamera} />
              <p className="surveillance-help-text">This channel remains available. The 02:17 archive gap is associated with another camera.</p>
            </div>
          ) : (
            <>
              <div className="recording-selector">
                <button type="button" className={beforeInspected ? 'is-inspected' : ''} onClick={() => inspectClip('before')}>
                  <span>01 / BEFORE ARCHIVE GAP</span><strong>02:16:48</strong><small>{beforeInspected ? 'RECORDING OPENED' : 'OPEN RECORDING'}</small>
                </button>
                <button type="button" className={afterInspected ? 'is-inspected' : ''} onClick={() => inspectClip('after')}>
                  <span>02 / AFTER ARCHIVE GAP</span><strong>02:18:12</strong><small>{afterInspected ? 'RECORDING OPENED' : 'OPEN RECORDING'}</small>
                </button>
              </div>
              <p className="surveillance-help-text">Compare the adjacent surviving recordings. Select the unexplained change in the later frame.</p>
              {comparisonReady ? (
                <div className="archive-comparison">
                  <ReferenceFrame interval="before" timestamp="02:16:48" />
                  <ReferenceFrame interval="after" timestamp="02:18:12" interactive={!game.hairStrandFound} onInspectRegion={inspectRegion} />
                </div>
              ) : (beforeInspected || afterInspected) ? (
                <div className="archive-single-frame">
                  <ReferenceFrame interval={beforeInspected ? 'before' : 'after'} timestamp={beforeInspected ? '02:16:48' : '02:18:12'} />
                </div>
              ) : <div className="archive-feed-waiting"><span>CAM-03 / RESTRICTED ENTRY</span><strong>SELECT A SURVIVING RECORDING</strong><span>REC 02:16:48 ── GAP ── 02:18:12</span></div>}
              {archiveFeedback && <p className="archive-feedback" role="status">{archiveFeedback}</p>}
              {puzzleFeedback && <p className={`puzzle-feedback${game.hairStrandFound ? ' is-success' : ''}`} role="status" aria-live="polite">{puzzleFeedback}</p>}
            </>
          )}
        </section>

        <aside className="surveillance-side-column">
          <section className="surveillance-panel archive-status-panel">
            <div className="surveillance-panel-heading"><span>ARCHIVE STATUS</span><span className="archive-status-missing">MISSING</span></div>
            <div className="archive-status-time"><strong>02:17</strong><span>AUTHENTICATION WINDOW</span></div>
            <p>CAM-03 recording unavailable / adjacent segments preserved.</p>
          </section>
          <section className="surveillance-panel evidence-inventory">
            <div className="surveillance-panel-heading"><span>EVIDENCE INVENTORY</span><span>{String(evidence.length).padStart(2, '0')} LOGGED</span></div>
            {evidence.length ? <ul>{evidence.map((item) => <li key={item}>{EVIDENCE_NAMES[item] || item.toUpperCase()}</li>)}</ul> : <p className="surveillance-help-text">No physical evidence recovered from this room yet.</p>}
          </section>
          <NarratorPanel narrator={narrator} />
          <section className="surveillance-panel director-assistance">
            <div className="surveillance-panel-heading"><span>DIRECTOR ASSISTANCE</span><span>{decisionStatus}</span></div>
            <button type="button" onClick={requestDirectorHint} disabled={decisionLoading}>{decisionLoading ? 'EVALUATING…' : 'REQUEST FIELD HINT'}</button>
            {hint && <p>{hint}</p>}
          </section>
        </aside>
      </section>

      <footer className="chapter-footer"><span>LOCAL ARRIVAL 02:43</span><span>RECORDING GAP 02:17 / UNRESOLVED</span><span>LOCATION: LIGHTHOUSE / LEVEL 04</span></footer>
    </main>
  )
}

export default SurveillanceRoom
