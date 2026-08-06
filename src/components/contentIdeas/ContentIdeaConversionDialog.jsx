import { useState } from 'react'
import { CONTENT_IDEA_PLATFORMS } from '../../constants/contentIdeas.js'

const PROJECT_STATUSES = {
  planning: '기획 중',
  in_progress: '진행 중',
  completed: '완료',
  archived: '보관',
}

function validate(values) {
  const errors = {}
  const title = values.title.trim()
  if (!title) errors.title = '프로젝트 제목을 입력해 주세요.'
  else if (title.length > 200) errors.title = '제목은 200자 이하여야 합니다.'
  if (values.description.length > 5000) errors.description = '설명은 5000자 이하여야 합니다.'
  if (!Object.hasOwn(PROJECT_STATUSES, values.status)) errors.status = '프로젝트 상태를 확인해 주세요.'
  if (values.dueDate) {
    const date = new Date(`${values.dueDate}T00:00:00Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== values.dueDate) {
      errors.dueDate = '유효한 마감일을 입력해 주세요.'
    }
  }
  return errors
}

function ContentIdeaConversionDialog({ idea, error, isSubmitting, onCancel, onSubmit }) {
  const [values, setValues] = useState({
    title: idea.title,
    description: idea.description ?? '',
    status: 'planning',
    dueDate: '',
  })
  const [errors, setErrors] = useState({})

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate(values)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }
    await onSubmit({
      ...values,
      title: values.title.trim(),
      description: values.description.trim(),
    })
  }

  return (
    <div className="form-overlay idea-form-overlay" onMouseDown={() => !isSubmitting && onCancel()} role="presentation">
      <section aria-labelledby="idea-conversion-title" aria-modal="true" className="idea-form-dialog idea-conversion-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <div className="idea-form-heading">
          <div><p className="page-eyebrow">CREATE PROJECT</p><h2 id="idea-conversion-title">프로젝트로 전환</h2></div>
          <button aria-label="전환 창 닫기" className="icon-button" disabled={isSubmitting} onClick={onCancel} type="button">×</button>
        </div>

        <div className="idea-conversion-source" aria-label="원본 소재 요약">
          <strong>{idea.title}</strong>
          <span>{CONTENT_IDEA_PLATFORMS[idea.platform] ?? idea.platform}</span>
          {idea.contentFormat && <span>{idea.contentFormat}</span>}
          {idea.tags.length > 0 && <p>{idea.tags.map((tag) => `#${tag}`).join(' ')}</p>}
        </div>
        <p className="idea-conversion-note">원본 소재 정보는 참고용이며 제목과 설명만 프로젝트에 저장됩니다.</p>
        {error && <p className="idea-form-error" role="alert">{error}</p>}

        <form className="idea-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="conversion-title">프로젝트 제목 *</label>
          <input autoFocus id="conversion-title" maxLength="201" name="title" onChange={handleChange} value={values.title} />
          {errors.title && <small className="idea-field-error" role="alert">{errors.title}</small>}

          <label htmlFor="conversion-description">프로젝트 설명</label>
          <textarea id="conversion-description" maxLength="5001" name="description" onChange={handleChange} rows="5" value={values.description} />
          {errors.description && <small className="idea-field-error" role="alert">{errors.description}</small>}

          <div className="idea-form-grid">
            <div className="idea-connected-field">
              <label htmlFor="conversion-status">프로젝트 상태 *</label>
              <select id="conversion-status" name="status" onChange={handleChange} value={values.status}>
                {Object.entries(PROJECT_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {errors.status && <small className="idea-field-error" role="alert">{errors.status}</small>}
            </div>
            <div className="idea-connected-field">
              <label htmlFor="conversion-due-date">마감일</label>
              <input id="conversion-due-date" name="dueDate" onChange={handleChange} type="date" value={values.dueDate} />
              {errors.dueDate && <small className="idea-field-error" role="alert">{errors.dueDate}</small>}
            </div>
          </div>

          <div className="idea-form-actions">
            <button className="secondary-button" disabled={isSubmitting} onClick={onCancel} type="button">취소</button>
            <button className="primary-button" disabled={isSubmitting} type="submit">{isSubmitting ? '프로젝트 만드는 중…' : '프로젝트 만들기'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default ContentIdeaConversionDialog
