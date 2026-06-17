import { useEffect, useState } from 'react'

const dashboardSummaryUrl = `${import.meta.env.BASE_URL}data/dashboard-summary.json`

function useDashboardSummary() {
  const [stats, setStats] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchDashboardSummary() {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(dashboardSummaryUrl, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('대시보드 요약 정보를 불러오지 못했습니다.')
        }

        const data = await response.json()
        setStats(Array.isArray(data.stats) ? data.stats : [])
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setError('대시보드 요약 정보를 불러오지 못했습니다.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchDashboardSummary()

    return () => {
      controller.abort()
    }
  }, [])

  return { stats, isLoading, error }
}

export default useDashboardSummary
