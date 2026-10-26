---
title: "Compatibilidade de navegadores: limites do swipe e upload de fotos"
author: Isaque
date: 2026-10-23
branch: codex/supabase-security-advisors
touches:
  - AGENTS.md
  - package.json
  - src/pages/Swipe.tsx
  - tests/landing.browser.mjs
  - ".agents/bin/.gitignore"
  - ".agents/installed-browser-design.json"
  - ".agents/skill-data/core/SKILL.md"
  - ".agents/skill-data/core/references/authentication.md"
  - ".agents/skill-data/core/references/commands.md"
  - ".agents/skill-data/core/references/profiling.md"
---

## Decided
A auditoria de 23/10/2026 confirmou que o alvo JS do Vite 7 não garante compatibilidade do layout. Sem dvh, a página de swipe encolhe e o cartaz mede zero; sem unidades de container, o cartaz também mede zero. Chrome 107 e Firefox 104–109 estão entre as versões afetadas apesar dos alvos padrão do build. O relatório está em docs/browser-compatibility-audit.md. Não houve correção nem mudança do piso de suporte.

## Tried and ruled out
Chrome 156 e Edge 155 passaram nos diagnósticos normais de voto com fixtures. Retirar WebGL não bloqueou a votação. Os CSS gerados já contêm prefixos webkit para backdrop-filter. Uma falha de loader passou isoladamente. O teste de cabeçalho X-Robots-Tag não é válido contra vite preview quando depende dos headers configurados na Vercel.

## Watch out
Não chamar retirada de APIs/CSS em Chromium de teste real de Safari ou Firefox antigo. Safari não oferece o encoder WebP de canvas nos dados MDN consultados; uploadProfileImage precisa respeitar blob.type, hoje força extensão e MIME WebP. As suítes existentes usam Chromium; Chrome e Edge não cobrem motores distintos. Navegadores antigos e dispositivos reais continuam exigindo validação própria.
