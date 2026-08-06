import useSavedMedia from './useSavedMedia'
import {
  createSavedReference,
  deleteSavedReference,
  getSavedReferences,
  updateSavedReferenceNote,
} from '../services/savedReferencesApi'

function useSavedReferences(backendProjectId, enabled = true) {
  return useSavedMedia({
    backendProjectId,
    listItems: getSavedReferences,
    createItem: createSavedReference,
    updateNote: updateSavedReferenceNote,
    deleteItem: deleteSavedReference,
    enabled,
  })
}

export default useSavedReferences
