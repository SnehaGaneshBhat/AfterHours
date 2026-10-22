import { useState } from 'react'

const SECRET_CODE = '0427'
const MAX_ATTEMPTS = 6

function scoreGuess(guess, secret) {
  let correctPosition = 0
  const remainingGuess = []
  const remainingSecret = []

  for (let index = 0; index < secret.length; index++) {
    if (guess[index] === secret[index]) correctPosition++
    else {
      remainingGuess.push(guess[index])
      remainingSecret.push(secret[index])
    }
  }
  let correctDigitWrongPosition = 0
  for (const digit of remainingGuess) {
    const matchIndex = remainingSecret.indexOf(digit)
    if (matchIndex !== -1) {
      correctDigitWrongPosition++
      remainingSecret.splice(matchIndex, 1)
    }
  }
  return { correctPosition, correctDigitWrongPosition }
}

function CodeLock({ onUnlocked, onAttempt }) {
  const [input, setInput] = useState('')
  const [attempts, setAttempts] = useState([])
  const [unlocked, setUnlocked] = useState(false)
  const [lockedOut, setLockedOut] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  function enterDigit(digit) {
    if (unlocked || lockedOut || input.length >= 4) return
    setInput((current) => current + digit)
  }
  function clearInput() {
    if (unlocked || lockedOut) return
    setInput('')
  }
  function submitGuess(event) {
    event.preventDefault()
    if (input.length !== 4 || unlocked || lockedOut) return
    const result = scoreGuess(input, SECRET_CODE)
    const nextAttempts = [...attempts, { guess: input, ...result }]
    setAttempts(nextAttempts)
    setInput('')
    if (input === SECRET_CODE) {
      setUnlocked(true)
      onUnlocked?.(input)
      return
    }
    onAttempt?.(input, false)
    if (nextAttempts.length >= MAX_ATTEMPTS) setLockedOut(true)
  }

  return (
    <section className={'code-lock' + (showInstructions ? ' instructions-visible' : '')}>
      <button
        type="button"
        className="puzzle-info-button"
        onClick={() => setShowInstructions((visible) => !visible)}
        aria-label={showInstructions ? 'Return to code entry' : 'Show override instructions'}
        aria-expanded={showInstructions}
        title={showInstructions ? 'Return to code entry' : 'How to use the override'}
      >
        {showInstructions ? '↩' : 'i'}
      </button>
      <div className="puzzle-flip-stage code-flip-stage">
        <div className={'puzzle-flip-inner' + (showInstructions ? ' is-flipped' : '')}>
          <div className="puzzle-face puzzle-front code-lock-front" aria-hidden={showInstructions} inert={showInstructions}>
            <div className="puzzle-heading">
              <span className="puzzle-eyebrow">ACCESS CONTROL / 02</span>
              <h3>RESEARCH-4 OVERRIDE</h3>
              <p>Enter the four-digit access code. You have {MAX_ATTEMPTS - attempts.length} attempts remaining.</p>
            </div>
            <div className="code-display" aria-live="polite">
              {Array.from({ length: 4 }, (_, index) => (
                <span className="code-digit" key={index}>{input[index] ?? '—'}</span>
              ))}
            </div>
            <div className="code-keypad">
              {'1234567890'.split('').map((digit) => (
                <button key={digit} type="button" className="code-key" onClick={() => enterDigit(digit)} disabled={unlocked || lockedOut}>{digit}</button>
              ))}
              <button type="button" className="code-key code-clear" onClick={clearInput} disabled={unlocked || lockedOut}>CLEAR</button>
              <button type="button" className="code-key code-submit" onClick={submitGuess} disabled={input.length !== 4 || unlocked || lockedOut}>ENTER</button>
            </div>
            <div className="code-attempts">
              {attempts.map((attempt, index) => (
                <div className="code-attempt" key={index}>
                  <span>ATTEMPT {index + 1}</span>
                  <strong>{attempt.guess}</strong>
                  <span>{attempt.correctPosition} IN POSITION / {attempt.correctDigitWrongPosition} MISPLACED</span>
                </div>
              ))}
            </div>
            {unlocked && (
              <div className="evidence-confirmation">
                <span>ACCESS CODE ACCEPTED</span>
                <p>The Research-4 lock disengages.</p>
              </div>
            )}
            {lockedOut && (
              <div className="locked-notice">
                ACCESS DENIED — ATTEMPTS EXHAUSTED
                <button type="button" className="puzzle-reset" onClick={() => {
                  setAttempts([])
                  setInput('')
                  setLockedOut(false)
                }}>RESET CODE ENTRY</button>
              </div>
            )}
          </div>
          <div className="puzzle-face puzzle-back code-lock-instructions" aria-hidden={!showInstructions} inert={!showInstructions}>
            <div className="puzzle-heading">
              <span className="puzzle-eyebrow">SYSTEM MANUAL / 02</span>
              <h3>HOW TO USE THE OVERRIDE</h3>
              <p>Use the evidence recovered at the gates to determine the four-digit incident-date override.</p>
            </div>
            <div className="puzzle-instructions">
              <div className="puzzle-instruction">
                <span className="instruction-number">01</span>
                <div><strong>CHECK THE MAINTENANCE PLATE</strong><p>The plate gives the month and day of the site incident.</p></div>
              </div>
              <div className="puzzle-instruction">
                <span className="instruction-number">02</span>
                <div><strong>COMPARE THE RESTRICTED NOTE</strong><p>It says the override follows that incident date. Enter the month and day as four digits.</p></div>
              </div>
              <div className="puzzle-instruction">
                <span className="instruction-number">03</span>
                <div><strong>READ THE ENTRY FEEDBACK</strong><p>Each attempt reports digits in the correct position and digits that belong elsewhere.</p></div>
              </div>
            </div>
            <div className="puzzle-manual-note">
              <span>OBJECTIVE</span>
              <p>Recover the valid override and release the gate locks. The code itself is not printed in the records.</p>
            </div>
            <p className="puzzle-back-hint">USE THE TOP-RIGHT ICON TO RETURN</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CodeLock
