
import { useState } from 'react'
import { apiUrl } from '../game/api.js'
import { ROOMS, inspectObject, attemptCodeUnlock } from '../game/game'
import { unlockRestrictedRecords } from '../game/progression'
import SecurityPuzzle from './SecurityPuzzle'
import DirectorPanel from './DirectorPanel'
import CodeLock from './CodeLock'

function FacilityScreen({ game, setGame, onReturnToMenu }) {
  const [selectedObjectId, setSelectedObjectId] = useState(null)
  const [narration, setNarration] = useState('')
  const [narrationLoading, setNarrationLoading] = useState(false)
  const [narrationError, setNarrationError] = useState(false)
  const [directorDecision, setDirectorDecision] = useState(null)
  const [decisionLoading, setDecisionLoading] = useState(false)
  const [decisionError, setDecisionError] = useState(false)
  const room = ROOMS[game.currentRoomId]
  const selectedObject =
    room.objects.find((object) => object.id === selectedObjectId) ?? null

 
async function examineObject(object) {
  const nextState = inspectObject(game, object)

  setGame(nextState)
  setSelectedObjectId(object.id)
  setNarrationLoading(true)
  setNarrationError(false)

  const allObjects = Object.values(ROOMS).flatMap(
    (roomData) => roomData.objects
  )

  const verifiedFacts = [
    ...nextState.discoveredClues
      .map((clueId) =>
        allObjects.find((item) => item.clueId === clueId)
      )
      .filter(Boolean)
      .map((item) => `${item.clueName}: ${item.detail}`),
    `Current room: ${room.name}.`,
    `Inspected object: ${object.name}. ${object.detail}`,
    `Restricted records unlocked: ${nextState.recordsUnlocked}.`,
    `Security door unlocked: ${nextState.doorUnlocked}.`,
  ].slice(0, 10)

  try {
    const response = await fetch(
      apiUrl('/api/director/narrate'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_name: room.name,
          event: `The player inspected ${object.name}. ${object.detail}`,
          verified_facts: verifiedFacts,
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Narration request failed: HTTP ${response.status}`)
    }

    const data = await response.json()
    setNarration(data.narration)
  } catch (error) {
    console.error('Director narration failed:', error)
    setNarrationError(true)
    setNarration('')
  } finally {
    setNarrationLoading(false)
  }
}

async function requestDirectorDecision(stateDescription) {
  setDecisionLoading(true)
  setDecisionError(false)
  setDirectorDecision(null)

  try {
    const response = await fetch(
      apiUrl('/api/director/decide'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: stateDescription,
          allowed_actions: ['HINT', 'RAISE_TENSION', 'WAIT'],
        }),
      }
    )

    if (!response.ok) {
      throw new Error(
        `Director decision failed: HTTP ${response.status}`
      )
    }

    const data = await response.json()
    setDirectorDecision(data)
  } catch (error) {
    console.error('Director decision failed:', error)
    setDecisionError(true)
  } finally {
    setDecisionLoading(false)
  }
}

  function handlePuzzleSolved() {
  setGame((current) => unlockRestrictedRecords(current))

  void requestDirectorDecision(
    [
      'The player has solved the archive security puzzle.',
      'Restricted records are now unlocked.',
      'The recovered access note refers to the incident date.',
      'The security door has not necessarily been unlocked.',
      'Choose a permitted Director intervention.',
    ].join(' ')
  )
}

 function solveDoor(code) {
  setGame((current) => attemptCodeUnlock(current, code))
}

  return (
    <main className="game-shell game-screen">
      <header className="topbar">
        <button
          type="button"
          className="wordmark menu-button"
          onClick={onReturnToMenu}
          aria-label="Return to AFTERHOURS home"
        >
          <span className="wordmark-symbol">A</span>
          AFTERHOURS
        </button>

        <div className="system-status">
          <span className="status-dot" />
          LIVE SESSION / LOCAL MODE
        </div>

        <span className="chapter-label">INCIDENT 001</span>
      </header>

      <section className="room-layout">
        <div className="room-heading">
          <p className="eyebrow">
            <span className="eyebrow-line" />
            {room.sector} / UNAUTHORIZED ENTRY
          </p>

          <h1>{room.name}</h1>
          <p className="room-description">{room.description}</p>
        </div>

        <div className="room-columns">
          <section className="evidence-panel">
            <div className="panel-heading">
              <span>01 / ENVIRONMENT SCAN</span>
              <span>{room.objects.length} OBJECTS DETECTED</span>
            </div>

            <div className="object-list">
              {room.objects.map((object, index) => {
                const inspected = game.inspectedObjects.includes(object.id)
                const discovered =
                  object.clueId &&
                  game.discoveredClues.includes(object.clueId)

                return (
                  <button
                    type="button"
                    className={`object-card ${
                      selectedObjectId === object.id ? 'selected' : ''
                    }`}
                    key={object.id}
                    onClick={() => examineObject(object)}
                  >
                    <span className="object-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <span className="object-copy">
                      <span className="object-type">{object.type}</span>
                      <strong>{object.name}</strong>
                      <span className="object-summary">{object.summary}</span>
                    </span>

                    <span className="object-status">
                      {discovered
                        ? 'EVIDENCE'
                        : inspected
                          ? 'SCANNED'
                          : 'INSPECT >'}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="panel-heading inventory-heading">
              <span>02 / EVIDENCE LOG</span>
              <span>
                {String(game.discoveredClues.length).padStart(2, '0')} FOUND
              </span>
            </div>

            {game.discoveredClues.length === 0 ? (
              <p className="empty-log">
                No evidence recorded. Inspect objects in the chamber.
              </p>
            ) : (
              <div className="clue-list">
                {game.discoveredClues.map((clueId) => {
                  const clue = Object.values(ROOMS)
                    .flatMap((roomData) => roomData.objects)
                    .find((object) => object.clueId === clueId)

                  return (
                    <div className="clue-item" key={clueId}>
                      <span className="clue-marker">+</span>
                      <span>{clue?.clueName ?? 'UNKNOWN EVIDENCE'}</span>
                      <span className="clue-tag">RECORDED</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <aside className="detail-panel">
            <div className="panel-heading">
              <span>03 / INSPECTION FEED</span>
              <span className="feed-indicator">● ACTIVE</span>
            </div>

            {selectedObject ? (
              <div className="inspection-content" key={selectedObject.id}>
                <span className="inspection-type">
                  {selectedObject.type} / OBJECT{' '}
                  {selectedObject.id.toUpperCase()}
                </span>

                <h2>{selectedObject.name}</h2>
                <p>{selectedObject.detail}</p>

                {selectedObject.id === 'terminal' && (
                  <>
                    {game.recordsUnlocked ? (
                      <section className="restricted-records">
                        <span className="puzzle-eyebrow">
                          RESTRICTED ARCHIVE / RECORD 001
                        </span>
                        <h3>ACCESS LOG DISCREPANCY</h3>
                        <p>
                          An authenticated session using your credentials
                          accessed RESEARCH-4 at 02:17. Your recorded arrival
                          time is 02:43.
                        </p>
                        <p>
                        The system lists the session as completed.
                        No exit record exists.
                        </p>

                        <p>
                        RECOVERED ACCESS NOTE: “The override follows the month and day
                        of the incident. Check the facility's original incident date.”
                        </p>
                        <div className="evidence-confirmation">
                          <span>RESTRICTED RECORDS UNLOCKED</span>
                        </div>
                      </section>
                    ) : (
                      <SecurityPuzzle onSolved={handlePuzzleSolved} />
                    )}
                  </>
                )}

                {selectedObject.id === 'sealed-door' && (
                game.doorUnlocked ? (
                    <div className="evidence-confirmation">
                    <span>SECURITY OVERRIDE ACCEPTED</span>
                    <p>
                        The lock disengages. The eastern corridor is now accessible.
                    </p>
                    </div>
                ) : !game.recordsUnlocked ? (
                    <div className="locked-notice">
                    ACCESS DENIED — RESTRICTED ARCHIVE CLEARANCE REQUIRED
                    </div>
                ) : (
                    <CodeLock onUnlocked={solveDoor} />
                )
                )}

                {selectedObject.clueId &&
                  game.discoveredClues.includes(selectedObject.clueId) &&
                  selectedObject.id !== 'terminal' && (
                    <div className="evidence-confirmation">
                      <span>+ EVIDENCE ADDED TO LOG</span>
                      {selectedObject.clueName}
                    </div>
                  )}
              </div>
            ) : (
              <div className="inspection-empty">
                <span className="scan-symbol">+</span>
                <p>AWAITING INPUT</p>
                <span>Select an object to inspect its details.</span>
              </div>
            )}

            <DirectorPanel
                recordsUnlocked={game.recordsUnlocked}
                narration={narration}
                narrationLoading={narrationLoading}
                narrationError={narrationError}
            />

            <section className="director-decision" aria-live="polite">
            <div className="panel-heading">
                <span>04 / DIRECTOR DECISION</span>
                <span>
                {decisionLoading
                    ? 'PROCESSING'
                    : directorDecision
                    ? 'DECISION RECEIVED'
                    : decisionError
                        ? 'OFFLINE'
                        : 'STANDBY'}
                </span>
            </div>

            {decisionLoading && (
                <p>
                The Director is evaluating the incident.
                Local inference may take some time.
                </p>
            )}

            {decisionError && (
                <p>
                The Director could not respond. The game remains playable.
                </p>
            )}

            {directorDecision && (
                <>
                <h3>{directorDecision.action.replaceAll('_', ' ')}</h3>
                <p>
                    Decision selected by the Strands Decider 2B model.
                </p>
                {typeof directorDecision.confidence === 'number' && (
                    <p>
                    Reported confidence: {directorDecision.confidence.toFixed(4)}
                    </p>
                )}
                {typeof directorDecision.latency_ms === 'number' && (
                    <p>
                    Inference time: {(directorDecision.latency_ms / 1000).toFixed(1)} seconds
                    </p>
                )}
                </>
            )}
            </section>

          </aside>
        </div>
      </section>

      <footer className="bottom-bar">
        <span>SECTOR 07 / ARRIVAL CHAMBER</span>
        <span>{game.discoveredClues.length} CLUES RECOVERED</span>
        <span>BUILD 0.2.0 - PROTOTYPE</span>
      </footer>
    </main>
  )
}

export default FacilityScreen
