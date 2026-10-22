import { useState } from 'react'
import './App.css'

import LandingPage from './components/LandingPage'
import FacilityScreen from './components/FacilityScreen'
import LighthouseGates from './components/LighthouseGates'
import { INITIAL_STATE, beginLighthouseJourney } from './game/game'
import LighthouseArrival from './components/LightHouseArrival'
import LighthouseChapter from './components/LighthouseChapter'

function App() {
  const [entered, setEntered] = useState(false)
  const [game, setGame] = useState(INITIAL_STATE)
  const [showArrival, setShowArrival] = useState(false)

  function returnToMenu() {
    setEntered(false)
  }

  function restartEpisode() {
    setGame(INITIAL_STATE)
    setShowArrival(false)
    setEntered(false)
  }

  if (!entered) {
    return (
      <>
        {!showArrival ? (
          <LandingPage onEnter={() => setShowArrival(true)} />
        ) : (
          <LighthouseArrival onEnter={() => setEntered(true)} />
        )}
      </>
    )
  }

  if (game.currentRoomId === 'gates') {
    return (
      <LighthouseGates
        game={game}
        setGame={setGame}
        onReturnToMenu={returnToMenu}
        onEnterFacility={() => setGame((current) => beginLighthouseJourney(current))}
      />
    )
  }

  if (game.currentRoomId === 'journey' || game.currentRoomId === 'surveillance') {
    return (
      <LighthouseChapter
        game={game}
        setGame={setGame}
        onReturnToMenu={returnToMenu}
        onRestartEpisode={restartEpisode}
      />
    )
  }

  return (
    <FacilityScreen
      game={game}
      setGame={setGame}
      onReturnToMenu={returnToMenu}
    />
  )
}

export default App
