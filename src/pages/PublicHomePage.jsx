import { Link } from 'react-router-dom'
import { ROUTES } from '../constants/app.js'

function PublicHomePage() {
  return (
    <main className="dashboard-page public-home-page">
      <section className="hero-section public-home-hero" aria-labelledby="public-home-title">
        <p className="hero-eyebrow">EDITFLOW</p>
        <h1 id="public-home-title">영상 편집 작업을 한눈에 관리</h1>
        <p className="hero-description">
          콘텐츠 아이디어부터 레퍼런스, B-roll, 프로젝트와 체크리스트까지<br className="public-home-break" />{' '}
          흩어진 영상 편집 작업을 하나의 흐름으로 정리하세요.
        </p>
        <div className="public-home-actions" aria-label="EditFlow 시작하기">
          <Link className="primary-button" to={ROUTES.signup}>시작하기</Link>
          <Link className="public-home-login-link" to={ROUTES.login}>로그인</Link>
        </div>
      </section>
    </main>
  )
}

export default PublicHomePage
