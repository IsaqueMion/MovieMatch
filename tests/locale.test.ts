import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chooseLanguage } from '../src/lib/locale.ts'

test('language follows saved choice, then supported browser preferences, then English', () => {
  assert.equal(chooseLanguage(['en-GB'], 'es'), 'es')
  assert.equal(chooseLanguage(['fr-FR', 'es-MX', 'pt-BR']), 'es')
  assert.equal(chooseLanguage(['PT-PT']), 'pt')
  assert.equal(chooseLanguage(['de-DE'], 'bad'), 'en')
  assert.equal(chooseLanguage([]), 'en')
})
