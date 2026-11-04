---
title: Preview local para testes de recomendação não valida headers Vercel
author: Isaque
date: 2026-11-04
branch: codex/recommendations-live
touches:
  - docs/recommendations.md
  - package.json
  - src/lib/recommendationHistory.ts
  - src/lib/recommendations.ts
  - src/pages/Swipe.tsx
  - supabase/migrations/20260930152445_personalized_recommendations.sql
  - tests/landing.browser.mjs
  - tests/recommendation-feedback.sql
  - tests/recommendations.browser.mjs
  - tests/recommendations.test.ts
---

## Decided
The recommendation browser suite validates local UI and mocked Supabase requests with Vite preview. It does not assert Vercel headers or write production data. Run the preview and Chrome test in the same execution context so localhost is reachable.
## Tried and ruled out
A sandboxed preview with Chrome outside that sandbox could not connect. The earlier Vercel-header learning only rules out checking X-Robots-Tag with Vite preview; it does not rule out UI integration tests.
## Watch out
When trail check flags tests/recommendations.browser.mjs for Vite preview, retain the UI test and explain this narrow exception in the commit and PR. For deployment-specific headers, test the Vercel deployment itself.
