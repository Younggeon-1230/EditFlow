export function parseIdeaId(value) {
  if (!/^\d+$/.test(value ?? '')) return null
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function resolveInitialMediaDestination(searchParams) {
  const ideaId = parseIdeaId(searchParams.get('idea'))
  return {
    ideaId,
    destinationType:
      searchParams.get('destination') === 'idea' && ideaId
        ? 'idea'
        : 'project',
  }
}
