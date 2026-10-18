
export const ROOMS = {
  arrival: {
    id: 'arrival',
    name: 'ARRIVAL CHAMBER',
    sector: 'SECTOR 07',
    description:
      'Cold air. A locked door. A terminal that insists you have already checked in.',
    objects: [
      {
        id: 'access-card',
        name: 'ACCESS CARD',
        type: 'EVIDENCE',
        summary: 'A card lies abandoned beside the terminal.',
        detail:
           'The card bears your name. Its issue date is tomorrow. Its access level is marked RESEARCH-4. A handwritten note on the reverse reads: INCIDENT DATE — 04/27.',
        clueId: 'future-card',
        clueName: 'THE FUTURE-DATED CARD',
      },
      {
        id: 'terminal',
        name: 'CHECK-IN TERMINAL',
        type: 'SYSTEM',
        summary: 'The screen flickers beneath a layer of dust.',
        detail:
          'The terminal displays: CHECK-IN COMPLETE. USER SESSION ACTIVE. Last login: 02:17. You arrived at 02:43.',
        clueId: 'prior-session',
        clueName: 'THE EARLIER SESSION',
      },
      {
        id: 'sealed-door',
        name: 'SEALED SECURITY DOOR',
        type: 'LOCKED',
        summary: 'A reinforced door blocks the eastern corridor.',
        detail:
          'A red light pulses above the lock. The panel requests a valid security override.',
        clueId: null,
        clueName: null,
      },
    ],
  },
}

export const INITIAL_STATE = {
  currentRoomId: 'arrival',
  discoveredClues: [],
  inspectedObjects: [],
  inventory: [],
  directorTokens: 3,
  doorUnlocked: false,
  doorCodeUnlocked: false,
  recordsUnlocked: false,
}

export function inspectObject(state, object) {
  const inspectedObjects = state.inspectedObjects.includes(object.id)
    ? state.inspectedObjects
    : [...state.inspectedObjects, object.id]

  const discoveredClues =
    object.clueId && !state.discoveredClues.includes(object.clueId)
      ? [...state.discoveredClues, object.clueId]
      : state.discoveredClues

  return {
    ...state,
    inspectedObjects,
    discoveredClues,
  }
}

export function attemptDoorOverride(state) {
  const requiredClues = ['future-card', 'prior-session']

  const hasRequiredEvidence = requiredClues.every((clueId) =>
    state.discoveredClues.includes(clueId),
  )

  if (!hasRequiredEvidence || state.doorUnlocked) {
    return state
  }

  return {
    ...state,
    doorUnlocked: true,
  }
}

export function attemptCodeUnlock(state, code) {
  if (!state.recordsUnlocked || state.doorCodeUnlocked) {
    return state
  }

  if (code !== '0427') {
    return state
  }

  return {
    ...state,
    doorCodeUnlocked: true,
    doorUnlocked: true,
  }
}
