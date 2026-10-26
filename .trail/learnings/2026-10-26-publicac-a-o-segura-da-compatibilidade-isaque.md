---
title: Publicação segura da compatibilidade sobre produção atual
author: Isaque
date: 2026-10-26
branch: codex/browser-compatibility-release
touches:
  - package.json
  - src/components/AgeGateModal.tsx
  - src/components/account/FloatingPaths.tsx
  - src/components/account/PasswordStrength.tsx
  - src/components/account/ProfileEditorDialog.tsx
  - src/components/matches/MatchDetailsDialog.tsx
  - src/components/reviews/MovieReviewsDialog.tsx
  - src/components/swipe/FilterModal.tsx
  - src/components/swipe/SwipeBackground.tsx
  - src/components/swipe/SwipeMatchDialog.tsx
---

## Decided
Publicar compatibilidade a partir do commit real de produção 2aaa9e2, preservando convidados persistentes, preload de cartazes, canvas e cabeçalho compacto. O checkout anterior estava atrasado; somente o patch de compatibilidade foi transportado para worktree isolado. Recomendações e trabalho paralelo ficaram fora.
A migração profile_image_formats foi aplicada isoladamente ao MovieMatch antes do frontend, conservando WebP, RLS de propriedade e limite de 2 MB. O arquivo usa a versão 20261026101157 efetivamente registrada no servidor.
O controle compartilhado de scroll/aria-hidden dos diálogos permanece correto: contagem de aberturas e referências por elemento, com teste de fechamento fora de ordem. O alerta heurístico do Trail não justifica retornar snapshots independentes.
## Tried and ruled out
Não publicar checkout antigo integralmente nem todas as migrações pendentes. O novo canvas também precisava do helper de resize; o painel de participantes precisa fallback sem Popover API e sem avaliar :popover-open em motores sem suporte. O atalho de voto usa aria-expanded do acionador.
## Watch out
Teste com APIs/CSS retiradas no Chrome não certifica versões históricas reais ou Safari/iOS. Preservar limite de suporte compilado Chrome/Edge107, Firefox104, Safari/iOS16. Ao publicar, validar preview primeiro e manter deployment anterior disponível para rollback. Não incluir graft gerado, arquivos de ambiente ou mudanças paralelas no commit.
