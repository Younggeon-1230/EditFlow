import useSavedMedia from './useSavedMedia'
import {
  createSavedBroll,
  deleteSavedBroll,
  getSavedBrolls,
  updateSavedBrollNote,
} from '../services/savedBrollsApi'

function useSavedBrolls(projectTarget, enabled = true) {
  return useSavedMedia({
    resourceId: projectTarget?.kind === 'server' ? projectTarget.id : null,
    listItems: getSavedBrolls,
    createItem: createSavedBroll,
    updateNote: updateSavedBrollNote,
    deleteItem: deleteSavedBroll,
    enabled,
  })
}

export default useSavedBrolls
