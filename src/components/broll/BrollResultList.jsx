import BrollResultCard from './BrollResultCard'

function BrollResultList({ results, hasSearched }) {
  if (results.length === 0) {
    return (
      <div className="reference-state empty-state">
        <strong>
          {hasSearched
            ? '검색 결과가 없습니다.'
            : '편집에 사용할 B-roll 소스를 검색해 보세요.'}
        </strong>
        <p>
          {hasSearched
            ? '다른 키워드나 소스 타입으로 다시 검색해 보세요.'
            : '영상과 사진을 선택해 Pexels의 무료 소스를 찾을 수 있습니다.'}
        </p>
      </div>
    )
  }

  return (
    <div className="broll-result-grid">
      {results.map((asset) => (
        <BrollResultCard asset={asset} key={asset.id} />
      ))}
    </div>
  )
}

export default BrollResultList
