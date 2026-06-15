import { Link } from 'react-router-dom'
import { ROUTES } from '../constants/app'

function NotFoundPage() {
  return (
    <main className="not-found-page">
      <section>
        <p className="page-eyebrow">404 NOT FOUND</p>
        <h1>페이지를 찾을 수 없습니다.</h1>
        <p>주소를 확인하거나 메인 화면으로 돌아가세요.</p>
        <Link className="secondary-button link-button" to={ROUTES.home}>
          메인으로 돌아가기
        </Link>
      </section>
    </main>
  )
}

export default NotFoundPage
