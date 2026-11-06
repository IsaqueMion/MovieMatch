---
title: MovieMatch privacy and adult-filter removal
author: Isaque
date: 2026-11-06
touches:
  - docs/legal-review.md
  - package.json
  - pnpm-lock.yaml
  - public/privacy.html
  - src/components/AgeGateModal.tsx
  - src/components/swipe/FilterModal.tsx
  - src/data/landingMovies.json
  - src/data/translations.json
  - src/hooks/useCurrentDate.ts
  - src/lib/birthdate.ts
---

## Decided
- For MovieMatch legal/privacy reviews, verify GitHub main and the deployed commit first, then isolate work from dirty local checkouts.
- The current product decision is to remove date-of-birth collection and the explicit adult-content filter. Backfill old DOB and adult flags, clear shared adult filters, reject future DOB metadata at Auth, and keep nullable legacy columns/RPC signatures temporarily for cached clients.
- Speed Insights should receive query-free paths with session codes and profile handles redacted; disclose that Vercel's event analytics are not visitor-linked while its infrastructure can process network IP/logs.
- Release from the verified current production base, test a preview, apply the compatible database migration before frontend rollout, and keep the prior deployment available for rollback.

## Tried and ruled out
- Dropping every legacy DOB column/RPC immediately was ruled out because cached clients may still call them; compatibility surfaces stay empty/no-op until a later removal window.
- Describing the service as safe for every age or globally compliant just because explicit adult catalog results are disabled was ruled out; TMDB's flag does not equal country ratings.

## Watch out
- ECA Digital, COPPA, GDPR/LGPD and local age-assurance duties can still apply to services accessible to minors; review each market before claiming general-audience coverage.
- Keep controller identity/contact, account deletion, vendor transfers/retention, advertising and minor targeting, UGC reporting/moderation, and localized terms/privacy policies on the pre-expansion checklist.
