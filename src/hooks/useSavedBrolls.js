import useSavedMedia from './useSavedMedia'
import {
  createSavedBroll,
  deleteSavedBroll,
  getSavedBrolls,
  updateSavedBrollNote,
} from '../services/savedBrollsApi'

function useSavedBrolls(backendProjectId) {
  return useSavedMedia({
    backendProjectId,
    listItems: getSavedBrolls,
    createItem: createSavedBroll,
    updateNote: updateSavedBrollNote,
    deleteItem: deleteSavedBroll,
  })
}

export default useSavedBrolls
