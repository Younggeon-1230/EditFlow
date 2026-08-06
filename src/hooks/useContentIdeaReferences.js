import useSavedMedia from './useSavedMedia.js'
import {
  createContentIdeaReference,
  deleteContentIdeaReference,
  getContentIdeaReferences,
  updateContentIdeaReference,
} from '../services/contentIdeaReferencesApi.js'

function useContentIdeaReferences(ideaId, enabled = true) {
  return useSavedMedia({
    backendProjectId: ideaId,
    enabled,
    listItems: getContentIdeaReferences,
    createItem: createContentIdeaReference,
    updateNote: (id, note, signal) => updateContentIdeaReference(id, { note }, signal),
    deleteItem: deleteContentIdeaReference,
    duplicateMessage: '이미 이 콘텐츠 소재에 저장된 레퍼런스입니다.',
  })
}

export default useContentIdeaReferences
