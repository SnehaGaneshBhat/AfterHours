
function LandingPage({ onEnter }) {
  return (
    <main className="game-shell">
      <header className="topbar">
        <a className="wordmark" href="#home">
          <span className="wordmark-symbol">A</span>
          AFTERHOURS
        </a>

        <div className="system-status">
          <span className="status-dot" />
          FACILITY STATUS: UNVERIFIED
        </div>

        <span className="chapter-label">A NARRATIVE EXPERIMENT</span>
      </header>

      <section className="hero" id="home">
        <div className="hero-content">
          <p className="eyebrow">
            <span className="eyebrow-line" />
            INCIDENT 001 / ACCESS RESTRICTED
          </p>

          <h1>
            THE NIGHT
            <br />
            <span>REMEMBERS.</span>
          </h1>

          <p className="hero-description">
            You are an agent of AFTERHOURS, a covert organization that identifies people with extraordinary abilities, records them, and studies their powers. Someone is trying to access the organization’s most sensitive information—and the breach may already be inside.
          </p>

          <button className="enter-button" onClick={onEnter}>
            <span>ENTER THE GAME</span>
            <span className="button-arrow">&gt;</span>
          </button>

          <p className="button-caption">
            PROCEED WITH CAUTION - NOTHING IS AS IT APPEARS
          </p>
        </div>

        <div className="hero-coordinate">
          <span>LOCATION</span>
          <strong>SECTOR 07</strong>
          <span>TIME OF ARRIVAL: UNKNOWN</span>
        </div>

        <div className="hero-index" aria-hidden="true">
          <span>AH-001</span>
          <span>01 / 03</span>
        </div>
      </section>

      <footer className="bottom-bar">
        <span>AN EXPERIMENT IN TRUST</span>
        <span>EVERY CHOICE LEAVES EVIDENCE</span>
        <span>BUILD 0.1.0 - PROTOTYPE</span>
      </footer>
    </main>
  )
}

export default LandingPage
