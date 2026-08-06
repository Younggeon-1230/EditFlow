import useSavedMedia from './useSavedMedia'
import {
  createSavedBroll,
  deleteSavedBroll,
  getSavedBrolls,
  updateSavedBrollNote,
} from '../services/savedBrollsApi'

function useSavedBrolls(backendProjectId, enabled = true) {
  return useSavedMedia({
    backendProjectId,
    listItems: getSavedBrolls,
    createItem: createSavedBroll,
    updateNote: updateSavedBrollNote,
    deleteItem: deleteSavedBroll,
    enabled,
  })
}

export default useSavedBrolls
