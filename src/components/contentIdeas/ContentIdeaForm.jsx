import { useState } from 'react'
import {
  CONTENT_IDEA_LIMITS,
  CONTENT_IDEA_PLATFORMS,
  CONTENT_IDEA_PRIORITIES,
  CONTENT_IDEA_STATUSES,
} from '../../constants/contentIdeas.js'

function initialValues(idea) {
  return {
    title: idea?.title ?? '',
    description: idea?.description ?? '',
    platform: idea?.platform ?? 'youtube',
    status: idea?.status ?? 'idea',
    priority: idea?.priority ?? 'medium',
    tags: idea?.tags?.join(', ') ?? '',
    targetAudience: idea?.targetAudience ?? '',
    contentFormat: idea?.contentFormat ?? '',
  }
}

function validate(values) {
  const errors = {}
  const tags = values.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
  if (!values.title.trim()) errors.title = '소재 제목을 입력해 주세요.'
  else if (values.title.trim().length > CONTENT_IDEA_LIMITS.title) errors.title = '제목은 200자 이하여야 합니다.'
  if (values.description.length > CONTENT_IDEA_LIMITS.description) errors.description = '설명은 5000자 이하여야 합니다.'
  if (values.targetAudience.length > CONTENT_IDEA_LIMITS.targetAudience) errors.targetAudience = '타깃 시청자는 500자 이하여야 합니다.'
  if (values.contentFormat.length > CONTENT_IDEA_LIMITS.contentFormat) errors.contentFormat = '콘텐츠 형식은 100자 이하여야 합니다.'
  if (tags.length > CONTENT_IDEA_LIMITS.tags) errors.tags = '태그는 최대 20개까지 입력할 수 있습니다.'
  else if (tags.some((tag) => tag.length > CONTENT_IDEA_LIMITS.tag)) errors.tags = '태그는 각각 50자 이하여야 합니다.'
  return { errors, tags: [...new Set(tags)] }
}

function FieldError({ children }) {
  return children ? <small className="idea-field-error" role="alert">{children}</small> : null
}

function ContentIdeaForm({ initialValue, onSubmit, onCancel, isSubmitting }) {
  const [values, setValues] = useState(() => initialValues(initialValue))
  const [errors, setErrors] = useState({})
  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined, form: undefined }))
  }
  async function handleSubmit(event) {
    event.preventDefault()
    const result = validate(values)
    if (Object.keys(result.errors).length) {
      setErrors(result.errors)
      return
    }
    const saved = await onSubmit({
      ...values,
      title: values.title.trim(),
      description: values.description.trim(),
      targetAudience: values.targetAudience.trim(),
      contentFormat: values.contentFormat.trim(),
      tags: result.tags,
    })
    if (!saved) setErrors({ form: initialValue ? '수정하지 못했습니다. 입력한 내용은 유지됩니다.' : '등록하지 못했습니다. 입력한 내용은 유지됩니다.' })
  }

  return (
    <form className="idea-form" onSubmit={handleSubmit} noValidate>
      {errors.form && <p className="idea-form-error" role="alert">{errors.form}</p>}
      <label><span>제목 *</span><input autoFocus maxLength={201} name="title" onChange={handleChange} value={values.title} required /><FieldError>{errors.title}</FieldError></label>
      <label><span>설명</span><textarea maxLength={5001} name="description" onChange={handleChange} rows="5" value={values.description} /><FieldError>{errors.description}</FieldError></label>
      <div className="idea-form-grid">
        <label><span>플랫폼 *</span><select name="platform" onChange={handleChange} value={values.platform}>{Object.entries(CONTENT_IDEA_PLATFORMS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>상태 *</span><select name="status" onChange={handleChange} value={values.status}>{Object.entries(CONTENT_IDEA_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>우선순위 *</span><select name="priority" onChange={handleChange} value={values.priority}>{Object.entries(CONTENT_IDEA_PRIORITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>콘텐츠 형식</span><input maxLength={101} name="contentFormat" onChange={handleChange} placeholder="예: vlog" value={values.contentFormat} /><FieldError>{errors.contentFormat}</FieldError></label>
      </div>
      <label><span>타깃 시청자</span><input maxLength={501} name="targetAudience" onChange={handleChange} value={values.targetAudience} /><FieldError>{errors.targetAudience}</FieldError></label>
      <label><span>태그</span><input name="tags" onChange={handleChange} placeholder="여행, 브이로그, 부산" value={values.tags} /><small className="idea-field-help">쉼표로 구분해 최대 20개까지 입력할 수 있습니다.</small><FieldError>{errors.tags}</FieldError></label>
      <div className="idea-form-actions">
        <button className="secondary-button" disabled={isSubmitting} onClick={onCancel} type="button">취소</button>
        <button className="primary-button" disabled={isSubmitting} type="submit">{isSubmitting ? '저장 중…' : initialValue ? '수정 완료' : '소재 등록'}</button>
      </div>
    </form>
  )
}

export default ContentIdeaForm
