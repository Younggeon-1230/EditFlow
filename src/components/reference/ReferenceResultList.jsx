import ReferenceResultCard from './ReferenceResultCard'

function ReferenceResultList({ results, hasSearched }) {
  if (results.length === 0) {
    return (
      <div className="reference-state empty-state">
        <strong>
          {hasSearched
            ? '검색 결과가 없습니다.'
            : '참고할 유튜브 영상을 검색해 보세요.'}
        </strong>
        <p>
          {hasSearched
            ? '다른 키워드나 정렬 방식으로 다시 검색해 보세요.'
            : '검색 결과에서 영상 통계와 업로드 정보를 확인할 수 있습니다.'}
        </p>
      </div>
    )
  }

  return (
    <div className="reference-result-list">
      {results.map((video) => (
        <ReferenceResultCard key={video.id} video={video} />
      ))}
    </div>
  )
}

export default ReferenceResultList
