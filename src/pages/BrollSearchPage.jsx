import { useState } from 'react'
import BrollCategoryBar from '../components/broll/BrollCategoryBar'
import BrollResultList from '../components/broll/BrollResultList'
import BrollSearchBar from '../components/broll/BrollSearchBar'
import BrollTypeToggle from '../components/broll/BrollTypeToggle'
import MediaDestinationSelector from '../components/media/MediaDestinationSelector.jsx'
import useContentIdeaBrolls from '../hooks/useContentIdeaBrolls.js'
import usePexelsSearch from '../hooks/usePexelsSearch'
import useMediaDestination from '../hooks/useMediaDestination.js'
import useSavedBrolls from '../hooks/useSavedBrolls'

function BrollSearchPage() {
  const [searchInput, setSearchInput] = useState('')
  const {
    destinationType, setDestinationType,
    projects, selectedProject, selectedProjectId, setSelectedProjectId,
    ideas, selectedIdea, selectedIdeaId, setSelectedIdeaId,
    isLoading: isLoadingIdeas, error: ideaSelectionError,
  } = useMediaDestination()
  const savedBrolls = useSavedBrolls(
    selectedProject?.backendProjectId ?? null,
    destinationType === 'project',
  )
  const savedIdeaBrolls = useContentIdeaBrolls(
    selectedIdea?.id ?? null,
    destinationType === 'idea',
  )
  const {
    query,
    type,
    results,
    isLoading,
    error,
    searchAssets,
    changeType,
  } = usePexelsSearch()

  function handleSearch() {
    searchAssets(searchInput)
  }

  function handleCategorySearch(categoryQuery) {
    setSearchInput(categoryQuery)
    searchAssets(categoryQuery)
  }

  return (
    <main className="broll-page">
      <section className="broll-heading">
        <p className="page-eyebrow">PEXELS B-ROLL</p>
        <h1>B-roll 소스 검색</h1>
        <p>Pexels에서 무료 영상과 이미지를 검색하고 프로젝트에 저장하세요.</p>
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

      <section className="broll-search-panel" aria-label="Pexels 소스 검색">
        <BrollSearchBar
          isLoading={isLoading}
          onChange={setSearchInput}
          onSearch={handleSearch}
          value={searchInput}
        />

        <div className="broll-search-options">
          <BrollTypeToggle
            activeType={type}
            disabled={isLoading}
            onChange={changeType}
          />
          <BrollCategoryBar
            disabled={isLoading}
            onSelect={handleCategorySearch}
          />
        </div>
      </section>

      <section className="broll-results" aria-live="polite">
        <div className="broll-results-heading">
          <div>
            <p className="page-eyebrow">SEARCH RESULTS</p>
            <h2>{query ? `"${query}" 검색 결과` : '검색 결과'}</h2>
          </div>
          {!isLoading && results.length > 0 && (
            <span>{results.length}개의 소스</span>
          )}
        </div>

        {isLoading && (
          <div className="reference-state">
            <span className="loading-indicator" aria-hidden="true" />
            <p>Pexels에서 {type === 'videos' ? '영상' : '이미지'}을 검색하고 있습니다.</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="reference-state error-state" role="alert">
            <strong>검색 결과를 불러오지 못했습니다.</strong>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && (
          <BrollResultList
            destinationType={destinationType}
            hasSearched={Boolean(query)}
            idea={selectedIdea}
            project={selectedProject}
            results={results}
            savedIdeaBrolls={savedIdeaBrolls}
            savedBrolls={savedBrolls}
          />
        )}

        {destinationType === 'project' && savedBrolls.error && (
          <div className="reference-state error-state" role="alert">
            <p>{savedBrolls.error}</p>
          </div>
        )}
        {destinationType === 'idea' && savedIdeaBrolls.error && (
          <div className="reference-state error-state" role="alert">
            <p>{savedIdeaBrolls.error}</p>
          </div>
        )}
      </section>
    </main>
  )
}

export default BrollSearchPage
