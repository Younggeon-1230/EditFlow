import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/app.js'

function ContentIdeaDashboardCard({ summary, isLoading, error, onRetry }) {
  return (
    <section className="content-idea-dashboard-card" aria-labelledby="content-idea-dashboard-title">
      <div className="content-idea-dashboard-heading">
        <div><p className="page-eyebrow">CONTENT IDEAS</p><h2 id="content-idea-dashboard-title">콘텐츠 소재 현황</h2></div>
        <Link className="secondary-button link-button" to={ROUTES.ideas}>콘텐츠 소재 관리</Link>
      </div>
      {isLoading && !summary ? (
        <p className="content-idea-dashboard-state" role="status">콘텐츠 소재 현황을 불러오는 중입니다.</p>
      ) : error && !summary ? (
        <div className="content-idea-dashboard-state" role="alert"><p>콘텐츠 소재 현황을 불러오지 못했습니다.</p><button className="secondary-button" onClick={onRetry} type="button">다시 시도</button></div>
      ) : summary?.total === 0 ? (
        <div className="content-idea-dashboard-state"><p>아직 등록된 콘텐츠 소재가 없습니다.</p><Link to={ROUTES.ideas}>첫 소재 등록</Link></div>
      ) : (
        <dl className="content-idea-dashboard-stats">
          <div><dt>전체 소재</dt><dd>{summary?.total ?? '–'}</dd></div>
          <div><dt>제작 준비</dt><dd>{summary?.readyCount ?? '–'}</dd></div>
          <div><dt>프로젝트 전환</dt><dd>{summary?.convertedCount ?? '–'}</dd></div>
          <div><dt>미디어 연결</dt><dd>{summary?.withAnyMediaCount ?? '–'}</dd></div>
        </dl>
      )}
      {error && summary && <p className="content-idea-dashboard-warning" role="alert">최신 현황을 불러오지 못했습니다. <button onClick={onRetry} type="button">다시 시도</button></p>}
    </section>
  )
}

export default ContentIdeaDashboardCard
