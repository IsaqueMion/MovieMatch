---
title: "Correções de compatibilidade: fallbacks, diálogos e rollout PNG"
author: Isaque
date: 2026-10-23
branch: codex/supabase-security-advisors
touches:
  - AGENTS.md
  - package.json
  - src/components/AgeGateModal.tsx
  - src/components/account/FloatingPaths.tsx
  - src/components/account/PasswordStrength.tsx
  - src/components/account/ProfileEditorDialog.tsx
  - src/components/matches/MatchDetailsDialog.tsx
  - src/components/reviews/MovieReviewsDialog.tsx
  - src/components/swipe/FilterModal.tsx
  - src/components/swipe/SwipeMatchDialog.tsx
---

## Decided
Corrigidas localmente as falhas da auditoria: vh antes de dvh/svh, tamanho alternativo do poster, corredor com unidade px medida sem cqw, rodapé com seletor de irmão, listeners e ResizeObserver com alternativas, diálogos acessíveis com cleanup e upload com MIME/extensão reais. Alvos atuais ficaram explícitos (Chrome/Edge107, Firefox104, Safari/iOS16), sem prometer suporte a todas versões anteriores. Documentação de rollout em docs/browser-compatibility.md.

## Tried and ruled out
Nove testes novos falharam no build anterior e passaram no final. Trocar apenas hooks de movimento não bastava: Framer Motion inicializa listener MQL em VisualElement.mount, exigindo adaptação antes de createRoot. Diálogos precisaram contagem compartilhada para scroll e aria-hidden; snapshots independentes falharam ao fechar fora de ordem. Validação final: build/lint, 31 testes de lógica, 119 Chrome e 22 Edge aprovados; shaders registrados e lockfile preservados.

## Watch out
Aplicar 20261023120306_profile_image_formats.sql antes do frontend: schema antigo aceita somente WebP, novo cliente pode enviar PNG. Migração adiciona PNG sem ampliar propriedade/autenticação nem limite2MB. Não aplicada/validada em PostgreSQL real. Safari/iOS e versões antigas reais continuam pendentes; retirada de APIs em Chromium não certifica esses navegadores. Adaptador MQL legado cobre change callbacks usados atualmente, sem opções de listeners (shortcut documentado). Não alterar o learning anterior; este registra a evolução da implementação.
