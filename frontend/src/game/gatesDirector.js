export function verifiedGateHint(state) {
  if (!state.gatesScanned) return 'Begin with the card scanner beside the terminal.'
  if (!state.discoveredClues.includes('incident-date')) return 'Inspect the gate maintenance plate; its date may matter later.'
  if (!state.inspectedObjects.includes('gate-terminal')) return 'Inspect the terminal and its 02:17 access log.'
  if (!state.recordsUnlocked) return 'Restore the terminal sequence to reach restricted records.'
  return 'Compare the maintenance plate date with the override procedure in the restricted record.'
}

/** Map a validated gates action to a game-owned effect; WAIT is deliberately inert. */
export function effectForGateAction(action, state) {
  if (action === 'HINT') return { kind: 'hint', text: verifiedGateHint(state) }
  if (action === 'RAISE_TENSION') return { kind: 'narration', event: 'tension' }
  if (action === 'WAIT') return { kind: 'none' }
  return { kind: 'invalid' }
}
