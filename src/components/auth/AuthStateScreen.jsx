function AuthStateScreen({ error, isLoading = false, onRetry }) {
  return (
    <main className="auth-state-screen">
      <section aria-live="polite" role={error ? 'alert' : 'status'}>
        <span aria-hidden="true" className={isLoading ? 'auth-spinner' : 'auth-state-icon'}>
          {isLoading ? '' : '!'}
        </span>
        <h1>{isLoading ? '로그인 상태를 확인하는 중입니다' : '서버에 연결할 수 없습니다'}</h1>
        {error && <p>잠시 후 다시 시도해 주세요.</p>}
        {error && onRetry && (
          <button className="auth-submit-button" onClick={() => onRetry().catch(() => {})} type="button">
            다시 시도
          </button>
        )}
      </section>
    </main>
  )
}

export default AuthStateScreen
