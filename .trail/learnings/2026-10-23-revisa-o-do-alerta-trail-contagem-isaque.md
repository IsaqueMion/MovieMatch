---
title: "Revisão do alerta Trail: contagem compartilhada de diálogos é intencional"
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
A implementação atual de src/lib/dialogFocus.ts deve manter openCount e hiddenElements com referências contadas. O primeiro restaura overflow/data-dialog-open após a última liberação; o segundo restaura o aria-hidden original após a última referência por elemento. Isso é a correção aprovada, comprovada pelos quatro testes de modalidade, incluindo fechamento fora de ordem e reabertura.

## Tried and ruled out
Nenhuma mudança de código foi descartada nesta revisão. O trail check passou antes da nova nota e depois sinalizou falsamente que o diff traz de volta scroll aria hidden. A frase na nota anterior comparava a implementação correta com uma tentativa anterior defeituosa; a heurística confundiu os dois casos.

## Watch out
Ao revisar esse alerta, verificar a contagem de referências e o teste out-of-order em tests/dialogCompatibility.browser.mjs. Não remover proteções de acessibilidade para satisfazer busca textual. A justificativa está em docs/browser-compatibility.md. Nenhum commit ou PR foi criado nesta tarefa.
