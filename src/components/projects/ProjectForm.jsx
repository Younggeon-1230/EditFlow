import { useState } from 'react'

const statusOptions = ['기획 중', '소스 수집 중', '편집 중', '검토 중', '완료']

function ProjectForm({ initialValue, onSubmit, onCancel }) {
  const [formValues, setFormValues] = useState({
    title: initialValue?.title ?? '',
    description: initialValue?.description ?? '',
    deadline: initialValue?.deadline ?? '',
    status: initialValue?.status ?? statusOptions[0],
  })

  const hasLegacyStatus =
    initialValue?.status && !statusOptions.includes(initialValue.status)

  function handleChange(event) {
    const { name, value } = event.target
    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit({
      title: formValues.title.trim(),
      description: formValues.description.trim(),
      deadline: formValues.deadline,
      status: formValues.status,
    })
  }

  return (
    <form className="project-form" onSubmit={handleSubmit}>
      <label>
        <span>프로젝트명</span>
        <input
          autoFocus
          name="title"
          onChange={handleChange}
          placeholder="프로젝트명을 입력하세요."
          required
          type="text"
          value={formValues.title}
        />
      </label>

      <label>
        <span>설명</span>
        <textarea
          name="description"
          onChange={handleChange}
          placeholder="프로젝트에 대한 간단한 설명을 입력하세요."
          rows="4"
          value={formValues.description}
        />
      </label>

      <div className="project-form-row">
        <label>
          <span>마감일</span>
          <input
            name="deadline"
            onChange={handleChange}
            required
            type="date"
            value={formValues.deadline}
          />
        </label>

        <label>
          <span>상태</span>
          <select name="status" onChange={handleChange} value={formValues.status}>
            {hasLegacyStatus && (
              <option value={initialValue.status}>{initialValue.status}</option>
            )}
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="project-form-actions">
        <button className="secondary-button" onClick={onCancel} type="button">
          취소
        </button>
        <button className="form-submit-button" type="submit">
          {initialValue ? '수정 완료' : '프로젝트 만들기'}
        </button>
      </div>
    </form>
  )
}

export default ProjectForm
