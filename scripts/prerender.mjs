import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

// Render the existing home at build time, without fetching data or authenticating.
// Private routes get their own empty shell, never the public home or its canonical.
const template = await readFile('dist/index.html', 'utf8')
if (!template.includes('<div id="root"></div>')) throw new Error('Run vite build before prerendering the home')
const shell = template
  .replace(/<link rel="canonical"[^>]*>/, '')
  .replace(/<meta property="og:url"[^>]*>/, '')
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '')
  .replace('content="index,follow"', 'content="noindex,nofollow,noarchive"')
  .replaceAll('MovieMatch — o próximo filme, a escolha de todos', 'Sua sessão — MovieMatch')
await writeFile('dist/session.html', shell)

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
try {
  const { default: Landing } = await vite.ssrLoadModule('/src/pages/Landing.tsx')
  const home = renderToString(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(Landing)))
  await writeFile('dist/index.html', template.replace('<div id="root"></div>', () => `<div id="root">${home}</div>`))
} finally {
  await vite.close()
}
