import { useState } from 'react'
import MediaDestinationSelector from '../components/media/MediaDestinationSelector.jsx'
import ReferenceFilterBar from '../components/reference/ReferenceFilterBar'
import ReferenceResultList from '../components/reference/ReferenceResultList'
import ReferenceSearchBar from '../components/reference/ReferenceSearchBar'
import useMediaDestination from '../hooks/useMediaDestination.js'
import useContentIdeaReferences from '../hooks/useContentIdeaReferences.js'
import useSavedReferences from '../hooks/useSavedReferences'
import useYoutubeSearch from '../hooks/useYoutubeSearch'

function ReferenceSearchPage() {
  const [searchInput, setSearchInput] = useState('')
  const {
    destinationType, setDestinationType,
    projects, selectedProject, selectedProjectId, setSelectedProjectId,
    ideas, selectedIdea, selectedIdeaId, setSelectedIdeaId,
    isLoading: isLoadingIdeas, error: ideaSelectionError,
  } = useMediaDestination()
  const savedReferences = useSavedReferences(
    selectedProject?.backendProjectId ?? null,
    destinationType === 'project',
  )
  const savedIdeaReferences = useContentIdeaReferences(
    selectedIdea?.id ?? null,
    destinationType === 'idea',
  )
  const {
    query,
    order,
    results,
    isLoading,
    error,
    searchVideos,
    changeOrder,
  } = useYoutubeSearch()

  function handleSearch() {
    searchVideos(searchInput)
  }

  return (
    <main className="reference-page">
      <section className="reference-heading">
        <p className="page-eyebrow">YOUTUBE REFERENCE</p>
        <h1>유튜브 레퍼런스 검색</h1>
        <p>키워드로 참고 영상을 검색하고 프로젝트에 저장하세요.</p>
      </section>

      <MediaDestinationSelector
        destinationType={destinationType}
        ideaError={ideaSelectionError}
        ideas={ideas}
        isLoadingIdeas={isLoadingIdeas}
        onDestinationTypeChange={setDestinationType}
        onIdeaChange={setSelectedIdeaId}
        onProjectChange={setSelectedProjectId}
        projects={projects}
        selectedIdeaId={selectedIdeaId}
        selectedProjectId={selectedProjectId}
      />

      <section className="reference-search-panel" aria-label="유튜브 영상 검색">
        <ReferenceSearchBar
          isLoading={isLoading}
          onChange={setSearchInput}
          onSearch={handleSearch}
          value={searchInput}
        />
        <ReferenceFilterBar
          activeOrder={order}
          disabled={isLoading}
          onChange={changeOrder}
        />
      </section>

      <section className="reference-results" aria-live="polite">
        <div className="reference-results-heading">
          <div>
            <p className="page-eyebrow">SEARCH RESULTS</p>
            <h2>{query ? `"${query}" 검색 결과` : '검색 결과'}</h2>
          </div>
          {!isLoading && results.length > 0 && (
            <span>{results.length}개의 영상</span>
          )}
        </div>

        {isLoading && (
          <div className="reference-state">
            <span className="loading-indicator" aria-hidden="true" />
            <p>유튜브 영상을 검색하고 있습니다.</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="reference-state error-state" role="alert">
            <strong>검색 결과를 불러오지 못했습니다.</strong>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && (
          <ReferenceResultList
            destinationType={destinationType}
            hasSearched={Boolean(query)}
            idea={selectedIdea}
            project={selectedProject}
            results={results}
            savedIdeaReferences={savedIdeaReferences}
            savedReferences={savedReferences}
          />
        )}

        {destinationType === 'project' && savedReferences.error && (
          <div className="reference-state error-state" role="alert">
            <p>{savedReferences.error}</p>
          </div>
        )}
        {destinationType === 'idea' && savedIdeaReferences.error && (
          <div className="reference-state error-state" role="alert">
            <p>{savedIdeaReferences.error}</p>
          </div>
        )}
      </section>
    </main>
  )
}

export default ReferenceSearchPage
