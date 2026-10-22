import { useCallback, useEffect, useRef, useState } from 'react'
import LighthouseJourney from './LighthouseJourney'
import SurveillanceSystemScreen from './SurveillanceSystemScreen'
import { apiUrl } from '../game/api.js'

const NARRATION_ENDPOINT = apiUrl('/api/director/narrate')
const NARRATION_TIMEOUT_MS = 45_000

const NARRATION_BEATS = {
  'journey:opening': 'gate-opening',
  'journey:approach': 'lighthouse-approach',
  'journey:stairwell': 'stairwell-entry',
  'journey:ascent': 'stairwell-ascent',
  surveillance: 'surveillance-arrival',
}

const FALLBACKS = {
  'gate-opening': 'The locks release one by one. The gates drag apart against the storm, and the sound follows you through the opening. Beyond it, the lighthouse beam crosses the coast, vanishes, then returns to find the road empty.',
  'lighthouse-approach': 'The facility lights sink behind you as the path rises along the headland. Each turn of the beacon reveals the tower closer, then leaves it to darkness again. The rain has nearly swallowed the way back.',
  'stairwell-entry': 'The stone door closes, and the storm becomes a low vibration inside the walls. A spiral stair coils upward into the dark. From somewhere above comes a measured mechanical click, followed by silence.',
  'stairwell-ascent': 'The landings pass in the same cold light. Your footsteps return from above a moment too late. At the top, the surveillance room waits with its monitors already awake.',
  'surveillance-arrival': 'The surveillance room is powered, though no one answers the open channel. The archive marks a missing interval at 02:17, close to the earlier authentication. The recordings before and after it remain. Something was removed with care.',
  'ambient-surveillance': 'The storm presses against the tower stone. In the archive, one minute is still missing. The indicator keeps blinking as if the system expects it to return.',
  'archive-gap-reviewed': 'The archive has no recording for the interval around 02:17. The neighboring camera records remain available.',
  'camera-selected': 'The selected camera opens on a surviving recording. Its clock and archive label are intact.',
  'footage-before': 'The earlier recording holds steady on the restricted entrance. The archive clock places it before the missing interval.',
  'footage-after': 'The later recording shows the same entrance after the gap. Its camera angle and position remain unchanged.',
  'recording-discrepancy': 'The neighboring recordings do not match perfectly. A small physical trace is visible in the later frame.',
  'hair-collected': 'The trace is a strand of hair caught near the entrance hardware. It is now recorded as physical evidence.',
  hint: 'Compare the surviving recordings from either side of the missing interval. The game record will confirm any evidence you identify.',
  tension: 'A relay clicks in the surveillance rack. The archive remains fixed on the missing minute.',
  'records-comparison-started': 'The records-centre feed opens beneath the surveillance console. Two images settle into place, one archived and one current. Five small details appear where the room should be unchanged.',
  'records-difference-found': 'A small detail breaks the match between the two records-centre images. The room remains silent around the screens.',
  'records-hair-found': 'A strand of hair lies among the altered details. It is fine enough to escape notice in the dark, but the archive has preserved its outline.',
  'records-differences-complete': 'Wait. A strand of hair was left where the record says no one should have been. We cannot identify its owner here. Let us take it to the laboratory; if it does not match your records, we may learn who wore your identity.',
  'laboratory-arrival': 'The laboratory lights come on one bank at a time. The strand is sealed, but its owner is still unknown. The records retain a completed 02:17 session under your identity, twenty-six minutes before your arrival. The earlier session has no exit record.',
  'records-episode-complete': 'The archive has preserved the 02:17 session under your identity. Your recorded arrival is later, at 02:43, and the earlier session has no exit record. The strand is sealed evidence, but its owner remains unidentified. The records agree on one thing: this was not your first recorded presence.',
  'records-comparison-hint': 'Look slowly across the lower image. The new details are scattered far apart, and one is thinner than the rest.',
  'records-comparison-tension': 'The archive monitor dims for a moment. When it steadies, both records-centre images are still waiting.',
}

function factsFor(state) {
  const facts = [
    `Current chapter: ${state.currentRoomId}.`,
    `Gate unlocked: ${Boolean(state.doorUnlocked)}.`,
    'An earlier access event is recorded at 02:17; the player arrived at 02:43.',
  ]
  if (state.currentRoomId === 'journey') facts.push(`Journey stage: ${state.journeyStage}.`)
  if (state.archiveGapReviewed) facts.push('The surveillance archive is missing footage around 02:17.')
  if (state.selectedCameraId) facts.push(`Selected camera: ${state.selectedCameraId}.`)
  if (state.inspectedFootage?.length) facts.push(`Inspected recording segments: ${state.inspectedFootage.join(', ')}.`)
  if (state.recordingDiscrepancyFound) facts.push('The matched recordings show a small unexplained physical change in the later frame; the player has not yet identified it.')
  if (state.hairStrandFound) facts.push('A hair strand has been identified and added to the evidence inventory.')
  if (state.recordsDifferencesFound?.length) facts.push(`${state.recordsDifferencesFound.length} of 5 records-centre differences were found by the player.`)
  if (state.episodeComplete) facts.push('The player completed the records investigation and reached the laboratory.')
  if (state.discoveredClues?.length) facts.push(`Verified evidence recorded by the game: ${state.discoveredClues.join(', ')}.`)
  return facts.slice(0, 10)
}

function roomName(state) {
  if (state.currentRoomId === 'journey') return 'LIGHTHOUSE APPROACH / SURVEILLANCE ASCENT'
  return 'LIGHTHOUSE SURVEILLANCE ROOM'
}

function LighthouseChapter({ game, setGame, onReturnToMenu, onRestartEpisode }) {
  const [narration, setNarration] = useState('The field recorder is connecting to the surveillance network.')
  const [narrationLoading, setNarrationLoading] = useState(false)
  const [narrationError, setNarrationError] = useState(false)
  const [narrationStatus, setNarrationStatus] = useState('idle')
  const [transcript, setTranscript] = useState([])
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('VOICE OFF')
  const gameRef = useRef(game)
  const historyRef = useRef(game.narrationHistory || [])
  const requestId = useRef(0)
  const narrationQueue = useRef(Promise.resolve())
  const narrationRequestRef = useRef(null)
  const activeController = useRef(null)
  const mounted = useRef(false)
  const voiceEnabledRef = useRef(false)
  const startedBeats = useRef(new Set())
  const ambientNarrationUsed = useRef(false)
  const ambientTimer = useRef(null)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      activeController.current?.abort()
      window.clearTimeout(ambientTimer.current)
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  const rememberNarration = useCallback((line) => {
    const recent = [...historyRef.current, line].slice(-4)
    historyRef.current = recent
    setGame((current) => {
      const next = { ...current, narrationHistory: recent }
      gameRef.current = next
      return next
    })
  }, [setGame])

  const requestNarration = useCallback((event, snapshot = gameRef.current) => {
    if (event !== 'ambient-surveillance') {
      window.clearTimeout(ambientTimer.current)
      ambientTimer.current = window.setTimeout(() => {
        if (!ambientNarrationUsed.current && gameRef.current.currentRoomId === 'surveillance') {
          ambientNarrationUsed.current = true
          void narrationRequestRef.current?.('ambient-surveillance', gameRef.current)
        }
      }, 60000)
    }
    const id = ++requestId.current
    activeController.current?.abort()
    const fallback = FALLBACKS[event] || FALLBACKS['surveillance-arrival']
    setNarration(fallback)
    setNarrationLoading(true)
    setNarrationError(false)
    setNarrationStatus('pending')

    const run = async () => {
      if (!mounted.current) return
      const controller = new AbortController()
      activeController.current = controller
      let timedOut = false
      const timeout = window.setTimeout(() => {
        timedOut = true
        controller.abort()
      }, NARRATION_TIMEOUT_MS)
      try {
        const response = await fetch(NARRATION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            room_name: roomName(snapshot),
            event: `${event}: ${fallback} Narrate in three measured, ominous sentences, with deliberate pauses. Keep every detail consistent with the verified facts.${event === 'records-comparison-tension' ? ' This is a tension beat only: do not hint at, name, locate, or imply any unfound difference.' : ''}${event === 'records-episode-complete' ? ' Do not add a forensic result or identity match; the supplied facts are the complete evidence record.' : ''}`,
            verified_facts: factsFor(snapshot),
            recent_narration: historyRef.current.slice(-4),
          }),
        })
        if (!response.ok) throw new Error(`Narration HTTP ${response.status}`)
        const result = await response.json()
        if (!result.narration || !mounted.current) throw new Error('Narration was empty')
        const line = result.narration.trim()
        if (id === requestId.current) {
          rememberNarration(line)
          setTranscript((current) => [...current, { text: line, source: result.source || 'amazon-bedrock' }].slice(-8))
          setNarration(line)
          setNarrationError(false)
          setNarrationStatus('completed')
          if (voiceEnabledRef.current && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance(line)
            utterance.rate = 0.76
            utterance.pitch = 0.82
            window.speechSynthesis.speak(utterance)
          }
        }
      } catch {
        if (!mounted.current || id !== requestId.current || (controller.signal.aborted && !timedOut)) return
        rememberNarration(fallback)
        setTranscript((current) => [...current, { text: fallback, source: timedOut ? 'timeout fallback' : 'local fallback' }].slice(-8))
        if (id === requestId.current) {
          setNarration(fallback)
          setNarrationError(true)
          setNarrationStatus(timedOut ? 'timed_out' : 'failed')
        }
      } finally {
        window.clearTimeout(timeout)
        if (id === requestId.current && mounted.current) setNarrationLoading(false)
      }
    }

    const pending = narrationQueue.current.catch(() => {}).then(run)
    narrationQueue.current = pending
    return pending
  }, [rememberNarration])

  useEffect(() => {
    narrationRequestRef.current = requestNarration
  }, [requestNarration])

  useEffect(() => {
    const key = game.currentRoomId === 'journey'
      ? `journey:${game.journeyStage}`
      : game.currentRoomId
    const event = NARRATION_BEATS[key]
    if (!event || startedBeats.current.has(key)) return undefined
    const timer = window.setTimeout(() => {
      startedBeats.current.add(key)
      void narrationRequestRef.current?.(event, gameRef.current)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [game.currentRoomId, game.journeyStage])

  function toggleVoice() {
    if (!('speechSynthesis' in window)) {
      setVoiceStatus('VOICE UNAVAILABLE')
      return
    }
    const enabled = !voiceEnabledRef.current
    voiceEnabledRef.current = enabled
    setVoiceEnabled(enabled)
    setVoiceStatus(enabled ? 'VOICE READY' : 'VOICE OFF')
    if (enabled && narration) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(narration)
      utterance.rate = 0.76
      utterance.pitch = 0.82
      window.speechSynthesis.speak(utterance)
    } else if (!enabled) {
      window.speechSynthesis.cancel()
    }
  }

  const narratorProps = {
    narration,
    narrationLoading,
    narrationError,
    narrationStatus,
    transcript,
    transcriptOpen,
    setTranscriptOpen,
    voiceEnabled,
    voiceStatus,
    toggleVoice,
  }

  if (game.currentRoomId === 'journey') {
    return (
      <LighthouseJourney
        game={game}
        setGame={setGame}
        onReturnToMenu={onReturnToMenu}
        narrator={narratorProps}
      />
    )
  }

  return <SurveillanceSystemScreen game={game} setGame={setGame} onReturnToMenu={onReturnToMenu} onRestartEpisode={onRestartEpisode} narrator={narratorProps} onNarrate={requestNarration} />
}

export default LighthouseChapter
