
import { useState } from 'react'

const SECRET_CODE = '0427'
const MAX_ATTEMPTS = 6

function scoreGuess(guess, secret) {
  let correctPosition = 0
  let remainingGuess = []
  let remainingSecret = []

  for (let index = 0; index < secret.length; index++) {
    if (guess[index] === secret[index]) {
      correctPosition++
    } else {
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

function CodeLock({ onUnlocked }) {
  const [input, setInput] = useState('')
  const [attempts, setAttempts] = useState([])
  const [unlocked, setUnlocked] = useState(false)
  const [lockedOut, setLockedOut] = useState(false)

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
    const nextAttempts = [
      ...attempts,
      { guess: input, ...result },
    ]

    setAttempts(nextAttempts)
    setInput('')

    if (input === SECRET_CODE) {
  setUnlocked(true)
  onUnlocked?.(input)
  return
}
    if (nextAttempts.length >= MAX_ATTEMPTS) {
      setLockedOut(true)
    }
  }

  return (
    <section className="code-lock">
      <div className="puzzle-heading">
        <span className="puzzle-eyebrow">ACCESS CONTROL / 02</span>
        <h3>RESEARCH-4 OVERRIDE</h3>
        <p>
          Enter the four-digit access code. You have{' '}
          {MAX_ATTEMPTS - attempts.length} attempts remaining.
        </p>
      </div>

      <div className="code-display" aria-live="polite">
        {Array.from({ length: 4 }, (_, index) => (
          <span className="code-digit" key={index}>
            {input[index] ?? '—'}
          </span>
        ))}
      </div>

      <div className="code-keypad">
        {'1234567890'.split('').map((digit) => (
          <button
            key={digit}
            type="button"
            className="code-key"
            onClick={() => enterDigit(digit)}
            disabled={unlocked || lockedOut}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className="code-key code-clear"
          onClick={clearInput}
          disabled={unlocked || lockedOut}
        >
          CLEAR
        </button>
        <button
          type="button"
          className="code-key code-submit"
          onClick={submitGuess}
          disabled={input.length !== 4 || unlocked || lockedOut}
        >
          ENTER
        </button>
      </div>

      <div className="code-attempts">
        {attempts.map((attempt, index) => (
          <div className="code-attempt" key={`${attempt.guess}-${index}`}>
            <span>ATTEMPT {index + 1}</span>
            <strong>{attempt.guess}</strong>
            <span>
              {attempt.correctPosition} IN POSITION /{' '}
              {attempt.correctDigitWrongPosition} MISPLACED
            </span>
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
        </div>
      )}
    </section>
  )
}

export default CodeLock
