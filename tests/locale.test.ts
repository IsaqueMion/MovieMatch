import assert from 'node:assert/strict'
import { test } from 'node:test'
import { browserLanguage, chooseLanguage, preferredRegion } from '../src/lib/locale.ts'

test('language follows saved choice, then supported browser preferences, then English', () => {
  assert.equal(chooseLanguage(['en-GB'], 'es'), 'es')
  assert.equal(chooseLanguage(['fr-FR', 'es-MX', 'pt-BR']), 'es')
  assert.equal(chooseLanguage(['PT-PT']), 'pt')
  assert.equal(chooseLanguage(['de-DE'], 'bad'), 'en')
  assert.equal(chooseLanguage([]), 'en')
  // Node exposes navigator too; the build must not inherit the runner's language.
  assert.equal(browserLanguage(), 'pt')
  assert.equal(preferredRegion(), 'BR')
})
