import { useState } from 'react'
import RecordsSpotDifference from './RecordsSpotDifference'

function SurveillanceSystemScreen({ game, setGame, onReturnToMenu, onRestartEpisode, narrator, onNarrate }) {
  const [comparisonOpen, setComparisonOpen] = useState(false)

  if (comparisonOpen) {
    return (
      <RecordsSpotDifference game={game} setGame={setGame} narrator={narrator} onNarrate={onNarrate} onBack={() => setComparisonOpen(false)} onRestartEpisode={onRestartEpisode} />
    )
  }

  return (
    <main className="surveillance-image-screen">
      <div className="surveillance-image-stage">
        <img src="/images/surveillance-system.png" alt="Lighthouse facility surveillance system with multiple camera feeds" />
        <button
          type="button"
          className="surveillance-image-hotspot"
          aria-label="Open the entrance-hall footage comparison"
          title="Open entrance-hall footage comparison"
          onClick={() => {
            setComparisonOpen(true)
            onNarrate('records-comparison-started', game)
          }}
        >
          <span className="sr-only">Open footage comparison</span>
        </button>
        <button type="button" className="surveillance-image-exit" onClick={onReturnToMenu}>EXIT</button>
        <section className="surveillance-image-narrator" aria-live="polite">
          <p>{narrator.narration}</p>
          <div className="surveillance-image-narrator-actions">
            <button type="button" onClick={narrator.toggleVoice} aria-pressed={narrator.voiceEnabled}>
              {narrator.voiceEnabled ? 'MUTE VOICE' : 'ENABLE VOICE'}
            </button>
            <button type="button" onClick={() => narrator.setTranscriptOpen((open) => !open)} aria-expanded={narrator.transcriptOpen}>
              {narrator.transcriptOpen ? 'HIDE LOG' : 'NARRATION LOG'}
            </button>
          </div>
          {narrator.transcriptOpen && <ol>{narrator.transcript.map((item, index) => <li key={`${index}-${item.source}`}>{item.text}</li>)}</ol>}
        </section>
      </div>
    </main>
  )
}

export default SurveillanceSystemScreen
