
import { useState } from 'react'
import './App.css'

import LandingPage from './components/LandingPage'
import FacilityScreen from './components/FacilityScreen'
import { INITIAL_STATE } from './game/game'

function App() {
  const [entered, setEntered] = useState(false)
  const [game, setGame] = useState(INITIAL_STATE)

  function returnToMenu() {
    setEntered(false)
  }

  if (!entered) {
    return <LandingPage onEnter={() => setEntered(true)} />
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
