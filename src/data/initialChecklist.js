const initialChecklist = {
  'project-1': [
    { id: 'task-1', text: '기획 확인', done: true },
    { id: 'task-2', text: '레퍼런스 영상 수집', done: true },
    { id: 'task-3', text: '썸네일 참고 자료 수집', done: true },
    { id: 'task-4', text: 'B-roll 소스 수집', done: true },
    { id: 'task-5', text: '컷 편집', done: false },
    { id: 'task-6', text: '자막 작업', done: false },
    { id: 'task-7', text: '효과음 / BGM', done: false },
    { id: 'task-8', text: '색보정', done: false },
    { id: 'task-9', text: '썸네일 제작', done: false },
    { id: 'task-10', text: '업로드 전 검수', done: false },
  ],
  'project-2': [
    { id: 'task-1', text: '기획 확인', done: true },
    { id: 'task-2', text: '레퍼런스 영상 수집', done: true },
    { id: 'task-3', text: 'B-roll 소스 수집', done: false },
    { id: 'task-4', text: '자막 작업', done: false },
    { id: 'task-5', text: '업로드 전 검수', done: false },
  ],
}

export const defaultChecklistTemplate = initialChecklist['project-1']

export default initialChecklist
