import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractProviders, resolveProviderLink } from '../src/lib/matchProviders.ts'

test('todos os provedores possuem destino, priorizando o filme e distinguindo busca de disponibilidade', () => {
  const link = 'https://www.themoviedb.org/movie/460458/watch?locale=BR'
  const details = { providers: { BR: { link, buy: [
    { provider_id: 8, provider_name: 'Netflix', url: 'https://www.netflix.com/title/81234567' },
    { provider_id: 10, provider_name: 'Amazon Video' },
    { provider_id: 2, provider_name: 'Apple TV Store' },
    { provider_id: 167, provider_name: 'Claro video' },
    { provider_id: 3, provider_name: 'Google Play Movies' },
    { provider_id: 999, provider_name: 'Universal+ Amazon Channel' },
  ] } } }
  const result = extractProviders(details, 'BR')
  assert.equal(result.providers.length, 6)
  for (const provider of result.providers) {
    const target = resolveProviderLink(provider, 'Resident Evil: Bem-Vindo a Raccoon City', 'BR', result.regionLink, 460458)
    assert.equal(new URL(target.href).protocol, 'https:')
    if (provider.id === 8) { assert.equal(target.label, 'Abrir filme'); assert.equal(target.href, provider.url) }
    else if ([10, 2].includes(provider.id)) assert.equal(target.label, 'Buscar filme')
    else { assert.equal(target.label, 'Ver disponibilidade'); assert.equal(target.href, link) }
  }
})

test('links inválidos e domínios de outro serviço não viram links diretos', () => {
  for (const url of ['javascript:alert(1)', 'https://evilnetflix.com/title/1', 'https://primevideo.com/title/1', 'https://user:password@netflix.com/title/1']) {
    const { providers, regionLink } = extractProviders({ providers: { BR: { link: 'javascript:alert(1)', flatrate: [{ provider_id: 8, provider_name: 'Netflix', url }] } } }, 'BR')
    assert.equal(providers[0].url, null)
    assert.equal(regionLink, null)
    assert.equal(resolveProviderLink(providers[0], 'Filme', 'BR', null, 1).label, 'Buscar filme')
  }
})

test('ofertas legadas são deduplicadas; região ausente não mistura ofertas de outros países', () => {
  const provider = { id: 3, name: 'Google Play Movies', deep_link: 'https://play.google.com/store/movies/details?id=fixture' }
  assert.equal(extractProviders({ providers: [provider, provider] }, 'BR').providers[0].url, provider.deep_link)
  assert.equal(extractProviders({ providers: { US: { flatrate: [provider] } } }, 'BR').providers.length, 0)
})
