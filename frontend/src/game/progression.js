
export function unlockRestrictedRecords(state) {
  if (state.recordsUnlocked) {
    return state
  }

  return {
    ...state,
    recordsUnlocked: true,
  }
}
