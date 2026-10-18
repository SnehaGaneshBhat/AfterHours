
function DirectorPanel({
  recordsUnlocked,
  narration,
  narrationLoading,
  narrationError,
}) {
  const fallbackMessage = recordsUnlocked
    ? 'You found a way into the records. That was not supposed to be possible.'
    : 'Interesting. Your session appears to have started before you arrived.'

  return (
    <div className="director-panel">
      <div className="director-title">
        <span className="director-symbol">D</span>
        <div>
          <strong>THE DIRECTOR</strong>
          <span>SUPERVISION SYSTEM</span>
        </div>
      </div>

      <p aria-live="polite">
        {narrationLoading
          ? 'The Director is reviewing the latest event...'
          : narration || fallbackMessage}
      </p>

      <div className="locked-notice">
        {narrationLoading
          ? 'ANALYSING / BEDROCK REQUEST IN PROGRESS'
          : narrationError
            ? 'NARRATIVE OFFLINE — SCRIPTED FALLBACK ACTIVE'
            : narration
              ? 'NARRATIVE LINK ACTIVE — AMAZON BEDROCK'
              : 'AWAITING FIRST OBSERVATION'}
      </div>
    </div>
  )
}

export default DirectorPanel
