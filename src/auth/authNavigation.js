import { ROUTES } from '../constants/app.js'

export function getAuthDestination(from, fallback = ROUTES.home) {
  if (!from || typeof from !== 'object') return fallback

  const pathname = typeof from.pathname === 'string' ? from.pathname : ''
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return fallback

  const search = typeof from.search === 'string' && from.search.startsWith('?')
    ? from.search
    : ''
  const hash = typeof from.hash === 'string' && from.hash.startsWith('#')
    ? from.hash
    : ''
  return `${pathname}${search}${hash}`
}
