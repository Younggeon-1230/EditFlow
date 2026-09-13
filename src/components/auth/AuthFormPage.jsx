import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getAuthDestination } from '../../auth/authNavigation.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import { ROUTES } from '../../constants/app.js'
import { ApiError } from '../../services/apiClient.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ERROR_MESSAGES = {
  invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다.',
  email_already_registered: '이미 가입된 이메일입니다.',
  invalid_email: '올바른 이메일 형식을 입력해 주세요.',
  invalid_password: '비밀번호 조건을 확인해 주세요.',
  rate_limited: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  csrf_required: '보안 정보를 확인하지 못했습니다. 다시 시도해 주세요.',
  csrf_invalid: '보안 정보가 만료됐습니다. 다시 시도해 주세요.',
  csrf_origin_invalid: '현재 접속 경로에서는 요청을 완료할 수 없습니다.',
}

function getErrorMessage(error) {
  if (error instanceof ApiError) {
    if (ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code]
    if (error.status >= 500) return '일시적인 서버 오류가 발생했습니다.'
    return '요청을 완료하지 못했습니다.'
  }
  return '서버에 연결할 수 없습니다.'
}

function validate(values, isSignup) {
  const errors = {}
  const email = values.email.trim()
  if (!email) errors.email = '이메일을 입력해 주세요.'
  else if (!EMAIL_PATTERN.test(email)) errors.email = '올바른 이메일 형식을 입력해 주세요.'

  if (!values.password) errors.password = '비밀번호를 입력해 주세요.'
  else if (isSignup) {
    const passwordLength = Array.from(values.password).length
    if (passwordLength < 12 || passwordLength > 128) {
      errors.password = '비밀번호는 12자 이상 128자 이하로 입력해 주세요.'
    }
  }
  if (isSignup && values.confirmPassword !== values.password) {
    errors.confirmPassword = '비밀번호가 일치하지 않습니다.'
  }
  return errors
}

function AuthFormPage({ mode }) {
  const isSignup = mode === 'signup'
  const { authError, login, signup } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const mountedRef = useRef(true)
  const submittingRef = useRef(false)
  const [values, setValues] = useState({ email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setSubmitError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submittingRef.current) return

    const validationErrors = validate(values, isSignup)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    submittingRef.current = true
    setIsSubmitting(true)
    setSubmitError('')
    try {
      const credentials = { email: values.email.trim(), password: values.password }
      await (isSignup ? signup(credentials) : login(credentials))
      navigate(getAuthDestination(location.state?.from), { replace: true })
    } catch (error) {
      if (mountedRef.current) setSubmitError(getErrorMessage(error))
    } finally {
      submittingRef.current = false
      if (mountedRef.current) setIsSubmitting(false)
    }
  }

  const alternateRoute = isSignup ? ROUTES.login : ROUTES.signup
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-logo" to={ROUTES.home}>EditFlow</Link>
        <div className="auth-heading">
          <p className="page-eyebrow">{isSignup ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</p>
          <h1>{isSignup ? '회원가입' : '로그인'}</h1>
          <p>{isSignup ? '새 계정으로 영상 제작 흐름을 시작하세요.' : '작업을 이어가려면 계정에 로그인하세요.'}</p>
        </div>

        {authError && <p className="auth-notice" role="status">이전에 로그인 상태를 확인하지 못했습니다. 계속 시도할 수 있습니다.</p>}
        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <label>
            <span>이메일</span>
            <input aria-describedby={errors.email ? 'email-error' : undefined} aria-invalid={Boolean(errors.email)} autoComplete="email" autoFocus name="email" onChange={handleChange} type="email" value={values.email} />
            {errors.email && <small id="email-error">{errors.email}</small>}
          </label>
          <label>
            <span>비밀번호</span>
            <input aria-describedby={errors.password ? 'password-error' : isSignup ? 'password-hint' : undefined} aria-invalid={Boolean(errors.password)} autoComplete={isSignup ? 'new-password' : 'current-password'} name="password" onChange={handleChange} type="password" value={values.password} />
            {isSignup && !errors.password && <small className="auth-field-hint" id="password-hint">비밀번호는 12자 이상 128자 이하로 입력해 주세요.</small>}
            {errors.password && <small id="password-error">{errors.password}</small>}
          </label>
          {isSignup && (
            <label>
              <span>비밀번호 확인</span>
              <input aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined} aria-invalid={Boolean(errors.confirmPassword)} autoComplete="new-password" name="confirmPassword" onChange={handleChange} type="password" value={values.confirmPassword} />
              {errors.confirmPassword && <small id="confirm-password-error">{errors.confirmPassword}</small>}
            </label>
          )}
          {submitError && <p className="auth-form-error" role="alert">{submitError}</p>}
          <button className="auth-submit-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? (isSignup ? '가입 중…' : '로그인 중…') : isSignup ? '회원가입' : '로그인'}
          </button>
        </form>
        <p className="auth-switch">
          {isSignup ? '이미 계정이 있나요?' : '아직 계정이 없나요?'}{' '}
          <Link state={{ from: location.state?.from }} to={alternateRoute}>
            {isSignup ? '로그인' : '회원가입'}
          </Link>
        </p>
      </section>
    </main>
  )
}

export default AuthFormPage
