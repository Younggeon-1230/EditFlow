import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useContentIdeaSelection from './useContentIdeaSelection.js'
import useProjectSelection from './useProjectSelection.js'
import { resolveInitialMediaDestination } from '../utils/mediaDestination.js'

function useMediaDestination() {
  const [searchParams] = useSearchParams()
  const initialDestination = useMemo(
    () => resolveInitialMediaDestination(searchParams),
    [searchParams],
  )
  const initialIdeaId = initialDestination.ideaId
  const requestedIdeaDestination = searchParams.get('destination') === 'idea'
  const [destinationType, setDestinationType] = useState(
    initialDestination.destinationType,
  )
  const projectSelection = useProjectSelection()
  const ideaSelection = useContentIdeaSelection(initialIdeaId)

  useEffect(() => {
    if (
      requestedIdeaDestination &&
      initialIdeaId &&
      !ideaSelection.isLoading &&
      !ideaSelection.error &&
      !ideaSelection.ideas.some((idea) => idea.id === initialIdeaId)
    ) {
      setDestinationType('project')
    }
  }, [ideaSelection.error, ideaSelection.ideas, ideaSelection.isLoading, initialIdeaId, requestedIdeaDestination])

  return { destinationType, setDestinationType, ...projectSelection, ...ideaSelection }
}

export default useMediaDestination
