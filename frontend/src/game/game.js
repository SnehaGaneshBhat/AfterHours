export const ROOMS = {
  gates: {
    id: 'gates',
    name: 'LIGHTHOUSE GATES',
    sector: 'SECTOR 07',
    description:
      'A storm pounds the perimeter. The security system recognizes your identity before you reach the entrance.',
    objects: [
      {
        id: 'gate-terminal',
        name: 'SECURITY TERMINAL',
        type: 'SYSTEM',
        summary: 'An access log waits behind the terminal lock.',
        detail:
          'The log shows a completed authentication at 02:17. The identity field reads MATCH CONFIRMED; the session is already active.',
        clueId: 'security-log',
        clueName: 'THE 02:17 AUTHENTICATION',
      },
      {
        id: 'gate-structure',
        name: 'GATE MAINTENANCE PLATE',
        type: 'EVIDENCE',
        summary: 'A stamped incident date is partly obscured by salt and rain.',
        detail:
          'Beneath the corrosion, the plate reads SITE INCIDENT: 04/27. The override procedure references the incident date.',
        clueId: 'incident-date',
        clueName: 'THE SITE INCIDENT DATE',
      },
    ],
  },
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
  currentRoomId: 'gates',
  journeyStage: 'opening',
  discoveredClues: [],
  inspectedObjects: [],
  inventory: [],
  narrationHistory: [],
  directorTokens: 3,
  doorUnlocked: false,
  doorCodeUnlocked: false,
  recordsUnlocked: false,
  failedCodeAttempts: 0,
  gatesScanned: false,
  duplicateIdentityRevealed: false,
  selectedCameraId: null,
  inspectedCameraIds: [],
  inspectedFootage: [],
  recordingDiscrepancyFound: false,
  archiveGapReviewed: false,
  hairStrandFound: false,
  wrongFootageSelections: 0,
  recordsDifferencesFound: [],
  recordsLastFoundAt: null,
  episodeComplete: false,
}

export const SURVEILLANCE_CAMERAS = [
  { id: 'cam-perimeter', label: 'PERIMETER WALKWAY', status: 'ONLINE', time: '02:16:11' },
  { id: 'cam-research', label: 'RESEARCH WING', status: 'ONLINE', time: '02:16:42' },
  { id: 'cam-entry', label: 'RESTRICTED ENTRY', status: 'ARCHIVE GAP', time: '02:16:48' },
]

const JOURNEY_STAGES = ['opening', 'approach', 'stairwell', 'ascent']

export function beginLighthouseJourney(state) {
  if (state.currentRoomId !== 'gates' || !state.doorUnlocked) return state
  return { ...state, currentRoomId: 'journey', journeyStage: 'opening' }
}

export function advanceLighthouseJourney(state) {
  if (state.currentRoomId !== 'journey' || !state.doorUnlocked) return state
  const index = JOURNEY_STAGES.indexOf(state.journeyStage)
  if (index < 0) return state
  if (index === JOURNEY_STAGES.length - 1) {
    return { ...state, currentRoomId: 'surveillance', journeyStage: 'surveillance' }
  }
  return { ...state, journeyStage: JOURNEY_STAGES[index + 1] }
}

export function reviewArchiveGap(state) {
  if (state.currentRoomId !== 'surveillance' || !state.doorUnlocked) return state
  return state.archiveGapReviewed ? state : { ...state, archiveGapReviewed: true }
}

export function selectSurveillanceCamera(state, cameraId) {
  if (state.currentRoomId !== 'surveillance' || !state.doorUnlocked || !state.archiveGapReviewed) return state
  if (!SURVEILLANCE_CAMERAS.some((camera) => camera.id === cameraId)) return state
  return {
    ...state,
    selectedCameraId: cameraId,
    inspectedCameraIds: state.inspectedCameraIds.includes(cameraId)
      ? state.inspectedCameraIds
      : [...state.inspectedCameraIds, cameraId],
  }
}

export function inspectSurveillanceFootage(state, interval) {
  if (
    state.currentRoomId !== 'surveillance' ||
    !state.doorUnlocked ||
    state.selectedCameraId !== 'cam-entry' ||
    !['before', 'after'].includes(interval)
  ) return state

  const clipId = `cam-entry-${interval}`
  if (state.inspectedFootage.includes(clipId)) return state
  const inspectedFootage = [...state.inspectedFootage, clipId]
  return {
    ...state,
    inspectedFootage,
    recordingDiscrepancyFound:
      inspectedFootage.includes('cam-entry-before') && inspectedFootage.includes('cam-entry-after'),
  }
}

export function attemptHairEvidence(state, regionId) {
  const hasComparedRecordings =
    state.currentRoomId === 'surveillance' &&
    state.doorUnlocked &&
    state.selectedCameraId === 'cam-entry' &&
    state.inspectedFootage.includes('cam-entry-before') &&
    state.inspectedFootage.includes('cam-entry-after')

  if (!hasComparedRecordings) {
    return { state, correct: false, reason: 'compare-required' }
  }
  if (regionId !== 'door-handle-hair') {
    return {
      state: { ...state, wrongFootageSelections: (state.wrongFootageSelections || 0) + 1 },
      correct: false,
      reason: 'try-again',
    }
  }
  if (state.hairStrandFound) return { state, correct: true, reason: 'already-collected' }

  return {
    state: {
      ...state,
      hairStrandFound: true,
      discoveredClues: state.discoveredClues.includes('hair-strand')
        ? state.discoveredClues
        : [...state.discoveredClues, 'hair-strand'],
      inventory: state.inventory.includes('hair-strand')
        ? state.inventory
        : [...state.inventory, 'hair-strand'],
    },
    correct: true,
    reason: 'collected',
  }
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

export function scanGatesCard(state) {
  if (state.gatesScanned) return state

  return {
    ...state,
    gatesScanned: true,
    duplicateIdentityRevealed: true,
    inspectedObjects: state.inspectedObjects.includes('access-scanner')
      ? state.inspectedObjects
      : [...state.inspectedObjects, 'access-scanner'],
    discoveredClues: state.discoveredClues.includes('prior-session')
      ? state.discoveredClues
      : [...state.discoveredClues, 'prior-session'],
  }
}

export function attemptDoorOverride(state) {
  const requiredClues = ['future-card', 'prior-session']
  const hasRequiredEvidence = requiredClues.every((clueId) =>
    state.discoveredClues.includes(clueId),
  )

  if (!hasRequiredEvidence || state.doorUnlocked) return state

  return { ...state, doorUnlocked: true }
}

export function attemptCodeUnlock(state, code) {
  if (!state.recordsUnlocked || state.doorCodeUnlocked || code !== '0427') {
    return state
  }

  return {
    ...state,
    doorCodeUnlocked: true,
    doorUnlocked: true,
  }
}
