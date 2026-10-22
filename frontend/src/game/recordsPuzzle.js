export const RECORDS_DIFFERENCES = Object.freeze([
  { id: 'hair-strand', name: 'a strand of hair', kind: 'hair', x: 68.2, y: 84.3, width: 4.2, height: 6.2 },
  { id: 'file-tab', name: 'a loose file tab', kind: 'file', x: 52, y: 64.7, width: 4, height: 4.6 },
  { id: 'access-card', name: 'an access card', kind: 'card', x: 48.9, y: 75.4, width: 5.1, height: 4.4 },
  { id: 'evidence-tag', name: 'a red evidence tag', kind: 'tag', x: 83.1, y: 49, width: 3.3, height: 5.2 },
  { id: 'metal-fastener', name: 'a metal fastener', kind: 'bolt', x: 65.5, y: 87, width: 2.8, height: 4 },
])

export const RECORDS_DIFFERENCE_COUNT = RECORDS_DIFFERENCES.length

export const RECORDS_DIRECTOR_THRESHOLDS = Object.freeze({
  misclicks: 3,
  idleMs: 75_000,
  cooldownMs: 60_000,
})

const DIFFERENCE_BY_ID = new Map(RECORDS_DIFFERENCES.map((item) => [item.id, item]))

/** Record a player-confirmed difference. The model never calls this function. */
export function recordDifferenceFound(game, differenceId) {
  const difference = DIFFERENCE_BY_ID.get(differenceId)
  if (!difference) return game

  const found = Array.isArray(game.recordsDifferencesFound)
    ? game.recordsDifferencesFound
    : []
  if (found.includes(differenceId)) return game

  const next = {
    ...game,
    recordsDifferencesFound: [...found, differenceId],
    recordsLastFoundAt: Date.now(),
  }
  if (differenceId !== 'hair-strand') return next

  return {
    ...next,
    hairStrandFound: true,
    discoveredClues: [...new Set([...(game.discoveredClues || []), 'hair-strand'])],
    inventory: [...new Set([...(game.inventory || []), 'hair-strand'])],
  }
}

export function nextUnfoundDifference(foundIds = []) {
  const found = new Set(foundIds)
  return RECORDS_DIFFERENCES.find((difference) => !found.has(difference.id)) || null
}

/** Map an already validated Decider action to a game-specific effect description. */
export function effectForRecordsAction(action, foundIds = []) {
  if (action === 'HINT') {
    const target = nextUnfoundDifference(foundIds)
    return target
      ? { kind: 'highlight', targetId: target.id }
      : { kind: 'unavailable', reason: 'no-unfound-difference' }
  }
  if (action === 'RAISE_TENSION') {
    return { kind: 'narration', event: 'records-comparison-tension' }
  }
  if (action === 'WAIT') return { kind: 'none' }
  return { kind: 'invalid', reason: 'action-not-allowed' }
}

export function reachedMisclickThreshold(count) {
  return count >= RECORDS_DIRECTOR_THRESHOLDS.misclicks
}

export function reachedIdleThreshold(idleMs) {
  return idleMs >= RECORDS_DIRECTOR_THRESHOLDS.idleMs
}
