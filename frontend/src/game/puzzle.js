
export const PUZZLE_SOLUTION = [
  1, 2, 3,
  4, 5, 6,
  7, 8, 0,
]

export function createPuzzleBoard(shuffleMoves = 40) {
  const board = [...PUZZLE_SOLUTION]
  let emptyIndex = 8
  let previousEmptyIndex = -1

  for (let move = 0; move < shuffleMoves; move++) {
    const row = Math.floor(emptyIndex / 3)
    const col = emptyIndex % 3
    const possibleMoves = []

    if (row > 0) possibleMoves.push(emptyIndex - 3)
    if (row < 2) possibleMoves.push(emptyIndex + 3)
    if (col > 0) possibleMoves.push(emptyIndex - 1)
    if (col < 2) possibleMoves.push(emptyIndex + 1)

    const choices = possibleMoves.filter(
      (index) => index !== previousEmptyIndex,
    )

    const nextIndex =
      choices[Math.floor(Math.random() * choices.length)]

    ;[board[emptyIndex], board[nextIndex]] = [
      board[nextIndex],
      board[emptyIndex],
    ]

    previousEmptyIndex = emptyIndex
    emptyIndex = nextIndex
  }

  return board
}

export function canMoveTile(board, tileIndex) {
  if (
    !Array.isArray(board) ||
    board.length !== 9 ||
    tileIndex < 0 ||
    tileIndex >= 9 ||
    board[tileIndex] === 0
  ) {
    return false
  }

  const emptyIndex = board.indexOf(0)

  if (emptyIndex === -1) return false

  const tileRow = Math.floor(tileIndex / 3)
  const tileCol = tileIndex % 3
  const emptyRow = Math.floor(emptyIndex / 3)
  const emptyCol = emptyIndex % 3

  return (
    Math.abs(tileRow - emptyRow) +
      Math.abs(tileCol - emptyCol) ===
    1
  )
}

export function movePuzzleTile(board, tileIndex) {
  if (!canMoveTile(board, tileIndex)) {
    return board
  }

  const nextBoard = [...board]
  const emptyIndex = nextBoard.indexOf(0)

  ;[nextBoard[emptyIndex], nextBoard[tileIndex]] = [
    nextBoard[tileIndex],
    nextBoard[emptyIndex],
  ]

  return nextBoard
}

export function isPuzzleSolved(board) {
  return (
    Array.isArray(board) &&
    board.length === PUZZLE_SOLUTION.length &&
    board.every((tile, index) => tile === PUZZLE_SOLUTION[index])
  )
}
