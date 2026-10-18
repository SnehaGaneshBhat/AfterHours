
import { useState } from 'react'
import {
  createPuzzleBoard,
  movePuzzleTile,
  isPuzzleSolved,
} from '../game/puzzle'

function SecurityPuzzle({ onSolved }) {
  const [board, setBoard] = useState(() => createPuzzleBoard())
  const [moves, setMoves] = useState(0)
  const [solved, setSolved] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  function handleTileClick(index) {
    if (solved) return

    const nextBoard = movePuzzleTile(board, index)

    if (nextBoard === board) return

    setBoard(nextBoard)
    setMoves((count) => count + 1)

    if (isPuzzleSolved(nextBoard)) {
      setSolved(true)
      onSolved?.()
    }
  }

  function resetPuzzle() {
    setBoard(createPuzzleBoard())
    setMoves(0)
    setSolved(false)
  }

  return (
    <section
      className={`security-puzzle ${
        showInstructions ? 'instructions-visible' : ''
      }`}
    >
      <button
        type="button"
        className="puzzle-info-button"
        onClick={() => setShowInstructions((visible) => !visible)}
        aria-label={
          showInstructions
            ? 'Return to puzzle'
            : 'Show puzzle instructions'
        }
        aria-expanded={showInstructions}
        title={showInstructions ? 'Return to puzzle' : 'How to play'}
      >
        {showInstructions ? '↩' : 'i'}
      </button>

      <div className="puzzle-flip-stage">
        <div
          className={`puzzle-flip-inner ${
            showInstructions ? 'is-flipped' : ''
          }`}
        >
          {/* FRONT: THE PUZZLE */}
          <div
            className="puzzle-face puzzle-front"
            aria-hidden={showInstructions}
            inert={showInstructions}
          >
            <div className="puzzle-heading">
              <span className="puzzle-eyebrow">
                SECURITY PROTOCOL / 01
              </span>

              <h3>RESTORE THE SEQUENCE</h3>

              <p>
                Restore the numbered sequence to access restricted
                facility records. Only tiles next to the empty space
                can move.
              </p>
            </div>

            <div
              className="puzzle-grid"
              aria-label="Sliding number puzzle"
            >
              {board.map((tile, index) => (
                <button
                  key={index}
                  type="button"
                  className={`puzzle-tile ${
                    tile === 0 ? 'puzzle-empty' : ''
                  }`}
                  onClick={() => handleTileClick(index)}
                  disabled={tile === 0 || solved}
                  aria-label={
                    tile === 0
                      ? 'Empty space'
                      : `Move tile ${tile}`
                  }
                >
                  {tile === 0 ? '' : tile}
                </button>
              ))}
            </div>

            <div className="puzzle-status">
              <span>MOVES: {moves}</span>
              <span>
                {solved ? 'SEQUENCE RESTORED' : 'SYSTEM LOCKED'}
              </span>
            </div>

            {solved && (
              <div className="evidence-confirmation">
                <span>SECURITY SEQUENCE ACCEPTED</span>
                <p>
                  The terminal accepts the restored sequence.
                  Restricted records are now available.
                </p>
              </div>
            )}

            <button
              type="button"
              className="puzzle-reset"
              onClick={resetPuzzle}
            >
              RESET PUZZLE
            </button>
          </div>

          {/* BACK: HOW TO PLAY */}
          <div
            className="puzzle-face puzzle-back"
            aria-hidden={!showInstructions}
            inert={!showInstructions}
          >
            <div className="puzzle-heading">
              <span className="puzzle-eyebrow">
                SYSTEM MANUAL / 01
              </span>

              <h3>HOW TO PLAY</h3>

              <p>
                Restore the sequence to gain access to the
                restricted incident records.
              </p>
            </div>

            <div className="puzzle-instructions">
              <div className="puzzle-instruction">
                <span className="instruction-number">01</span>
                <div>
                  <strong>MOVE A TILE</strong>
                  <p>
                    Select a numbered tile directly beside the
                    empty space to slide it.
                  </p>
                </div>
              </div>

              <div className="puzzle-instruction">
                <span className="instruction-number">02</span>
                <div>
                  <strong>RESTORE THE ORDER</strong>
                  <p>
                    Arrange the numbers from smallest to largest,
                    reading left to right and then top to bottom.
                  </p>
                </div>
              </div>

              <div className="puzzle-instruction">
                <span className="instruction-number">03</span>
                <div>
                  <strong>UNLOCK THE RECORDS</strong>
                  <p>
                    Place every tile correctly. The empty space
                    belongs in the bottom-right corner.
                  </p>
                </div>
              </div>
            </div>

            <div className="puzzle-manual-note">
              <span>OBJECTIVE</span>
              <p>
                The incident records may explain why the facility
                logged your session before you arrived.
              </p>
            </div>

            <p className="puzzle-back-hint">
              USE THE TOP-RIGHT ICON TO RETURN
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default SecurityPuzzle
