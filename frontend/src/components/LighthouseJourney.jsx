import { advanceLighthouseJourney } from '../game/game'

const JOURNEY_BEATS = {
  opening: {
    label: 'PERIMETER / GATES RELEASED',
    title: 'THE WAY INSIDE',
    text: 'The gate locks disengage with a sound that carries farther than it should. Beyond the threshold, the lighthouse beacon turns through the rain, then disappears into the dark.',
  },
  approach: {
    label: 'EXTERIOR / NORTH PATH',
    title: 'UP THE COAST',
    text: 'The facility lights fall behind as the path climbs the headland. The beacon returns at measured intervals, revealing the tower a little closer each time.',
  },
  stairwell: {
    label: 'LIGHTHOUSE / STAIRWELL',
    title: 'THE SPIRAL STAIR',
    text: 'A narrow stone stair winds upward through the tower. The storm becomes a dull pressure in the walls, and somewhere above, a mechanism answers with a slow, uneven click.',
  },
  ascent: {
    label: 'LIGHTHOUSE / ASCENT',
    title: 'ABOVE THE WEATHER',
    text: 'One landing, then another. Your footsteps return from above before you take them. The surveillance room waits beyond the next door, its monitors still awake.',
  },
}

function LighthouseJourney({ game, setGame, onReturnToMenu, narrator }) {
  const beat = JOURNEY_BEATS[game.journeyStage] || JOURNEY_BEATS.opening
  const stages = Object.keys(JOURNEY_BEATS)
  const currentIndex = Math.max(0, stages.indexOf(game.journeyStage))

  function continueJourney() {
    setGame((current) => advanceLighthouseJourney(current))
  }

  return (
    <main
      className={`chapter-transition journey-${game.journeyStage}`}
      onClick={(event) => {
        if (!event.target.closest('button, a, input, textarea, select')) continueJourney()
      }}
    >
      <div className="journey-scene-art" aria-hidden="true">
        {game.journeyStage === 'stairwell' || game.journeyStage === 'ascent'
          ? null
          : <div className="journey-gate-shutters" />}
      </div>

      <header className="chapter-header">
        <button type="button" className="chapter-wordmark" onClick={onReturnToMenu}>AFTERHOURS</button>
        <span>SECTOR 07 / LIGHTHOUSE TRANSIT</span>
      </header>

      <section className="journey-copy" aria-live="polite">
        <p className="chapter-eyebrow">// {beat.label}</p>
        <h1>{beat.title}</h1>
        <p>{beat.text}</p>
        <div className="journey-progress" aria-label={`Transit stage ${currentIndex + 1} of ${stages.length}`}>
          {stages.map((stage, index) => <span key={stage} className={index <= currentIndex ? 'is-complete' : ''} />)}
        </div>
        <div className="journey-narration-status" aria-live="polite">
          <span className={narrator.narrationLoading ? 'gates-live-dot is-loading' : 'gates-live-dot'} />
          {narrator.narrationLoading ? 'FIELD NARRATIVE / GENERATING' : narrator.narrationStatus === 'timed_out' ? 'FIELD NARRATIVE / TIMED OUT · LOCAL FALLBACK' : narrator.narrationError ? 'FIELD NARRATIVE / FAILED · LOCAL FALLBACK' : 'FIELD NARRATIVE / LIVE'}
        </div>
        <p className="journey-narration">{narrator.narration}</p>
        <div className="journey-actions">
          <button type="button" onClick={narrator.toggleVoice} aria-pressed={narrator.voiceEnabled}>
            {narrator.voiceEnabled ? 'MUTE BROWSER VOICE' : 'ENABLE BROWSER VOICE'}
          </button>
          <span>{narrator.voiceStatus}</span>
          <button type="button" onClick={continueJourney}>CONTINUE <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <footer className="chapter-footer"><span>ARRIVAL 02:43</span><span>ACCESS LOG 02:17 / UNRESOLVED</span></footer>
    </main>
  )
}

export default LighthouseJourney
