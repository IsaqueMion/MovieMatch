import assert from 'node:assert/strict'
import { test } from 'node:test'
import { redactSpeedInsightsUrl } from '../src/lib/speedInsightsPrivacy.ts'

test('Speed Insights receives routes without query data or personal identifiers', () => {
  const origin = 'https://moviematch.example'
  assert.equal(redactSpeedInsightsUrl('/s/secret-room?email=user@example.com', origin), '/s/[code]')
  assert.equal(redactSpeedInsightsUrl('/p/private-handle?tab=reviews', origin), '/p/[handle]')
  assert.equal(redactSpeedInsightsUrl('/conta?voltar=%2Fperfil%2Fprivate', origin), '/conta')
})
