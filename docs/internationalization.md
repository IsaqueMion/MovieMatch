# First international release

The interface supports Portuguese (`pt-BR`), English (`en-US`) and Spanish (`es-ES`). It uses the first supported browser preference, with English as the fallback. The language selector overrides this choice, persists locally and synchronizes across tabs. No IP geolocation service is used.

The shared room's streaming region and original-language filter remain separate from the display language. New rooms start with the region contained in the browser locale when available; their creator can change it in filters. Existing rooms retain their saved region. Changing the interface language preserves form values, movie position and votes.

TMDB discovery, details and favorite search request the display locale. Detail caches include locale and region. TMDB can still return original titles, missing localized summaries or an English summary fallback; user comments, names and bios are never automatically translated. Public legal documents remain Portuguese pending the responsible person's confirmed contact and review of the prepared drafts.

Relevant checks:

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/locale.test.ts
node --test tests/localized-functions.test.mjs
node --test tests/accounts.browser.mjs tests/landing.browser.mjs tests/matches.browser.mjs
```

GitHub CI now runs on pull requests and pushes to `main`, rather than twice for every feature push. A request/response ordering race in the matches test was fixed. GitHub Actions and Strix notifications are separate from MovieMatch authentication emails; notification preferences were not changed.
