import defaultChecklistTemplate from '../../shared/default-checklist.json'

const initialChecklist = {
  'project-1': defaultChecklistTemplate,
  'project-2': [
    { id: 'task-1', text: '기획 확인', done: true },
    { id: 'task-2', text: '레퍼런스 영상 수집', done: true },
    { id: 'task-3', text: 'B-roll 소스 수집', done: false },
    { id: 'task-4', text: '자막 작업', done: false },
    { id: 'task-5', text: '업로드 전 검수', done: false },
  ],
}

export { defaultChecklistTemplate }

export default initialChecklist
