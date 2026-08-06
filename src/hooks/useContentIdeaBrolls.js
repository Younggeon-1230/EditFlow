import useSavedMedia from './useSavedMedia.js'
import {
  createContentIdeaBroll,
  deleteContentIdeaBroll,
  getContentIdeaBrolls,
  updateContentIdeaBroll,
} from '../services/contentIdeaBrollsApi.js'

function useContentIdeaBrolls(ideaId, enabled = true) {
  return useSavedMedia({
    backendProjectId: ideaId,
    enabled,
    listItems: getContentIdeaBrolls,
    createItem: createContentIdeaBroll,
    updateNote: (id, note, signal) => updateContentIdeaBroll(id, { note }, signal),
    deleteItem: deleteContentIdeaBroll,
    duplicateMessage: '이미 이 콘텐츠 소재에 저장된 B-roll입니다.',
  })
}

export default useContentIdeaBrolls
