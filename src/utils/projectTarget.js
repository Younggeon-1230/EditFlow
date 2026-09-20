export function createProjectTarget(kind, id) {
  if (kind === 'server') {
    const serverId = Number(id)
    return Number.isSafeInteger(serverId) && serverId > 0
      ? { kind: 'server', id: serverId }
      : null
  }

  if (kind === 'local') {
    const localId = String(id ?? '').trim()
    return localId ? { kind: 'local', id: localId } : null
  }

  return null
}

export function encodeProjectSelection(target) {
  return target ? `${target.kind}:${target.id}` : ''
}

export function normalizeProjectSelection(value) {
  const selection = String(value ?? '').trim()
  if (/^server:[1-9]\d*$/.test(selection)) return selection
  if (/^[1-9]\d*$/.test(selection)) return `server:${selection}`
  if (selection.startsWith('local:') && selection.length > 6) return selection
  return ''
}
