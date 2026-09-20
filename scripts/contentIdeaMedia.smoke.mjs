import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createContentIdeaReferencePayload,
  mapContentIdeaReference,
} from '../src/services/contentIdeaReferencesApi.js'
import {
  createContentIdeaBrollPayload,
  mapContentIdeaBroll,
} from '../src/services/contentIdeaBrollsApi.js'

assert.deepEqual(createContentIdeaReferencePayload({
  id: 'video-1',
  title: 'Reference',
  videoUrl: 'https://example.com/reference',
}), {
  external_id: 'video-1',
  title: 'Reference',
  url: 'https://example.com/reference',
  thumbnail_url: null,
  channel_title: null,
  published_at: null,
  note: null,
})

assert.equal(mapContentIdeaReference({
  id: 1,
  content_idea_id: 7,
  external_id: 'video-1',
  url: 'https://example.com/reference',
}).contentIdeaId, 7)

assert.deepEqual(createContentIdeaBrollPayload({
  id: 22,
  originalUrl: 'https://example.com/broll',
}), {
  external_id: 22,
  title: null,
  url: 'https://example.com/broll',
  preview_url: null,
  thumbnail_url: null,
  creator_name: null,
  duration_seconds: null,
  width: null,
  height: null,
  note: null,
})

assert.equal(mapContentIdeaBroll({
  id: 2,
  content_idea_id: 7,
  external_id: 22,
  url: 'https://example.com/broll',
}).contentIdeaId, 7)

for (const hookPath of [
  'src/hooks/useContentIdeaReferences.js',
  'src/hooks/useContentIdeaBrolls.js',
]) {
  const source = readFileSync(hookPath, 'utf8')
  assert.match(source, /resourceId:\s*ideaId/)
  assert.doesNotMatch(source, /projectTarget|createProjectTarget/)
}

console.log('content idea media smoke: ok')
