import useSavedMedia from './useSavedMedia'
import {
  createSavedReference,
  deleteSavedReference,
  getSavedReferences,
  updateSavedReferenceNote,
} from '../services/savedReferencesApi'

function useSavedReferences(projectTarget, enabled = true) {
  return useSavedMedia({
    resourceId: projectTarget?.kind === 'server' ? projectTarget.id : null,
    listItems: getSavedReferences,
    createItem: createSavedReference,
    updateNote: updateSavedReferenceNote,
    deleteItem: deleteSavedReference,
    enabled,
  })
}

export default useSavedReferences
