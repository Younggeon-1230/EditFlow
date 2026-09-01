import { useState } from 'react'
import {
  CONTENT_IDEA_PLATFORMS,
  CONTENT_IDEA_RECOMMENDATION_LIMITS as LIMITS,
  CONTENT_IDEA_RECOMMENDATION_TONES,
} from '../../constants/contentIdeas.js'
import { composeRecommendationReferenceContext } from '../../services/contentIdeaRecommendationsApi.js'

const INITIAL_VALUES = {
  topic: '',
  platform: '',
  targetAudience: '',
  contentFormat: '',
  tone: 'informative',
  keywords: '',
  referenceContext: '',
  recommendationCount: 5,
}

function parseKeywords(value) {
  const seen = new Set()
  return value.split(',').reduce((result, keyword) => {
    const normalized = keyword.trim()
    const key = normalized.toLocaleLowerCase()
    if (normalized && !seen.has(key)) {
      seen.add(key)
      result.push(normalized)
    }
    return result
  }, [])
}

function validate(values, genreLabel) {
  const errors = {}
  const topic = values.topic.trim()
  const keywords = parseKeywords(values.keywords)
  const count = Number(values.recommendationCount)
  if (!topic) errors.topic = '추천받고 싶은 주제를 입력해 주세요.'
  else if (topic.length < LIMITS.topicMin) errors.topic = '주제는 2자 이상 입력해 주세요.'
  else if (topic.length > LIMITS.topic) errors.topic = '주제는 200자 이하여야 합니다.'
  if (values.targetAudience.trim().length > LIMITS.targetAudience) errors.targetAudience = '대상 시청자는 500자 이하여야 합니다.'
  if (values.contentFormat.trim().length > LIMITS.contentFormat) errors.contentFormat = '콘텐츠 형식은 100자 이하여야 합니다.'
  if (keywords.length > LIMITS.keywords) errors.keywords = '키워드는 최대 10개까지 입력할 수 있습니다.'
  else if (keywords.some((keyword) => keyword.length > LIMITS.keyword)) errors.keywords = '키워드는 각각 50자 이하여야 합니다.'
  const combinedReferenceContext = composeRecommendationReferenceContext(
    values.referenceContext,
    genreLabel,
  )
  if (combinedReferenceContext.length > LIMITS.referenceContext) {
    errors.referenceContext = '장르 안내를 포함한 참고 내용은 1500자 이하여야 합니다.'
  }
  if (!Number.isInteger(count) || count < LIMITS.recommendationCountMin || count > LIMITS.recommendationCountMax) {
    errors.recommendationCount = '추천 개수는 1~8 사이의 정수여야 합니다.'
  }
  return { errors, keywords }
}

function FieldError({ id, children }) {
  return children ? <small className="idea-field-error" id={id} role="alert">{children}</small> : null
}

function AIContentIdeaRecommendationForm({
  genreLabel,
  isGenerating,
  onBack,
  onGenerate,
  topicInputRef,
  topicPlaceholder,
}) {
  const [values, setValues] = useState(INITIAL_VALUES)
  const [errors, setErrors] = useState({})

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined, form: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const result = validate(values, genreLabel)
    if (Object.keys(result.errors).length) {
      setErrors(result.errors)
      return
    }
    const generated = await onGenerate({
      ...values,
      topic: values.topic.trim(),
      targetAudience: values.targetAudience.trim(),
      contentFormat: values.contentFormat.trim(),
      keywords: result.keywords,
      referenceContext: values.referenceContext.trim(),
      recommendationCount: Number(values.recommendationCount),
      genreLabel,
    })
    if (!generated) setErrors((current) => ({ ...current, form: '추천을 생성하지 못했습니다. 입력한 조건은 유지됩니다.' }))
  }

  return (
    <form aria-labelledby="ai-recommendation-form-heading" className="idea-form ai-recommendation-form" noValidate onSubmit={handleSubmit}>
      <div className="ai-recommendation-step-heading">
        <p className="ai-recommendation-step-label">2 / 2 · 추천 조건</p>
        <h3 id="ai-recommendation-form-heading">{genreLabel} 콘텐츠의 구체적인 주제를 알려주세요.</h3>
        <p>선택한 장르는 추천 맥락에 자동으로 포함되며 저장되는 소재 정보에는 추가되지 않습니다.</p>
      </div>
      {errors.form && <p className="idea-form-error" role="alert">{errors.form}</p>}
      <label htmlFor="ai-recommendation-topic">
        <span>추천 주제 *</span>
        <input
          aria-describedby={errors.topic ? 'ai-recommendation-topic-error' : undefined}
          aria-invalid={Boolean(errors.topic)}
          id="ai-recommendation-topic"
          maxLength={LIMITS.topic + 1}
          name="topic"
          onChange={handleChange}
          placeholder={topicPlaceholder || '예: 초보자를 위한 스마트폰 영상 편집'}
          ref={topicInputRef}
          value={values.topic}
        />
        <FieldError id="ai-recommendation-topic-error">{errors.topic}</FieldError>
      </label>

      <div className="idea-form-grid ai-recommendation-form-grid">
        <label htmlFor="ai-recommendation-platform">
          <span>플랫폼</span>
          <select id="ai-recommendation-platform" name="platform" onChange={handleChange} value={values.platform}>
            <option value="">AI가 선택</option>
            {Object.entries(CONTENT_IDEA_PLATFORMS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label htmlFor="ai-recommendation-tone">
          <span>톤</span>
          <select id="ai-recommendation-tone" name="tone" onChange={handleChange} value={values.tone}>
            {Object.entries(CONTENT_IDEA_RECOMMENDATION_TONES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label htmlFor="ai-recommendation-audience">
          <span>대상 시청자</span>
          <input aria-invalid={Boolean(errors.targetAudience)} id="ai-recommendation-audience" maxLength={LIMITS.targetAudience + 1} name="targetAudience" onChange={handleChange} value={values.targetAudience} />
          <FieldError>{errors.targetAudience}</FieldError>
        </label>
        <label htmlFor="ai-recommendation-format">
          <span>콘텐츠 형식</span>
          <input aria-invalid={Boolean(errors.contentFormat)} id="ai-recommendation-format" maxLength={LIMITS.contentFormat + 1} name="contentFormat" onChange={handleChange} placeholder="예: 튜토리얼, 브이로그" value={values.contentFormat} />
          <FieldError>{errors.contentFormat}</FieldError>
        </label>
      </div>

      <label htmlFor="ai-recommendation-keywords">
        <span>키워드</span>
        <input aria-invalid={Boolean(errors.keywords)} id="ai-recommendation-keywords" name="keywords" onChange={handleChange} placeholder="편집, 초보자, 스마트폰" value={values.keywords} />
        <small className="idea-field-help">쉼표로 구분해 최대 10개까지 입력할 수 있습니다.</small>
        <FieldError>{errors.keywords}</FieldError>
      </label>

      <label htmlFor="ai-recommendation-context">
        <span>참고 내용</span>
        <textarea aria-invalid={Boolean(errors.referenceContext)} id="ai-recommendation-context" maxLength={LIMITS.referenceContext + 1} name="referenceContext" onChange={handleChange} placeholder="반드시 반영할 방향이나 피하고 싶은 내용을 적어 주세요." rows="4" value={values.referenceContext} />
        <FieldError>{errors.referenceContext}</FieldError>
      </label>

      <label className="ai-recommendation-count" htmlFor="ai-recommendation-count">
        <span>추천 개수</span>
        <input aria-invalid={Boolean(errors.recommendationCount)} id="ai-recommendation-count" max={LIMITS.recommendationCountMax} min={LIMITS.recommendationCountMin} name="recommendationCount" onChange={handleChange} type="number" value={values.recommendationCount} />
        <FieldError>{errors.recommendationCount}</FieldError>
      </label>

      <div className="idea-form-actions">
        <button className="secondary-button" disabled={isGenerating} onClick={onBack} type="button">이전</button>
        <button className="primary-button ai-generate-button" disabled={isGenerating} type="submit">
          {isGenerating ? 'AI가 소재를 만드는 중…' : 'AI 소재 추천받기'}
        </button>
      </div>
    </form>
  )
}

export default AIContentIdeaRecommendationForm
