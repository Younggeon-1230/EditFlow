import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../../constants/app'

function HeroSection() {
  const navigate = useNavigate()

  return (
    <section className="hero-section" aria-labelledby="dashboard-title">
      <p className="hero-eyebrow">EDITFLOW DASHBOARD</p>
      <h1 id="dashboard-title">영상 편집 작업을 한눈에 관리</h1>
      <p className="hero-description">
        진행 중인 프로젝트와 해야 할 일을 빠르게 확인하세요.
      </p>
      <button
        className="primary-button"
        type="button"
        onClick={() => navigate(ROUTES.projects)}
      >
        <span aria-hidden="true">+</span> 새 프로젝트 만들기
      </button>
    </section>
  )
}

export default HeroSection
