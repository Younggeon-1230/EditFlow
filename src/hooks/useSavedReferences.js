import useSavedMedia from './useSavedMedia'
import {
  createSavedReference,
  deleteSavedReference,
  getSavedReferences,
  updateSavedReferenceNote,
} from '../services/savedReferencesApi'

function useSavedReferences(backendProjectId) {
  return useSavedMedia({
    backendProjectId,
    listItems: getSavedReferences,
    createItem: createSavedReference,
    updateNote: updateSavedReferenceNote,
    deleteItem: deleteSavedReference,
  })
}

export default useSavedReferences
