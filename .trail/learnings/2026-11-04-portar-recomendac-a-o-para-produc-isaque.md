---
title: Portar recomendação para produção real sem checkout antigo
author: Isaque
date: 2026-11-04
branch: codex/recommendations-live
touches:
  - src/pages/Swipe.tsx src/lib/recommendations.ts src/lib/recommendationHistory.ts
---

## Decided
Use the actual GitHub main commit caa729e, which both MovieMatch Vercel production projects report as their deployed SHA. Port only the recommendation integration to an isolated worktree; the older checkout contains unrelated uncommitted work. The active Supabase project already has migration 20260930152445 and recommendation feedback, so track that migration at its real applied version.
## Tried and ruled out
Do not deploy the old dirty checkout or copy its whole Swipe.tsx. A first browser run against preview in the sandbox failed because Chrome outside could not reach the sandboxed loopback. Running both in the same execution context fixed it.
## Watch out
Browser fixtures that counted POST /reactions must count record_movie_reaction RPC and return stable movie IDs plus persisted reactions on reload. Otherwise the resume test is invalid. Keep the feature PR scoped to the production main commit.
