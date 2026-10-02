# ThreeUI shelf experiment

The Matches page offers an opt-in bookshelf populated by the room's actual matches. It follows search, sorting and watched-film filtering, displays TMDB posters and opens MovieMatch's existing details dialog. The registered canonical source stays unchanged; `scripts/build-movie-shelf.mjs` derives the movie variant during Vite configuration, without embedding the documentation page.

Source: https://threeui.com/source-code/complete-shelf-landing-page.json

The current hosted HTML differed from the requested revision. The user approved testing the current official source; the original requested canonical HTML was subsequently recovered from the official `@designcodeio/threeui@1.2.0` package and is used here without edits.

| File | SHA-256 |
| --- | --- |
| `public/landing-pages/complete-shelf-v2.html` | `606f200fed8602c243f40a11c8c364f0e625c57f80e7c97dc76419da207f198e` |
| `src/shaders/landing-pages/LandingPageFrame.tsx` | `61de2cc50888aac4ac5557420b07fa47ed3543bb57c1e0055fafdefa53dbaa78` |
| `docs/threeui-shelf/LandingPages.tsx.txt` | `4d379461ad00eb4de7900df312878035383de7e1ed4e13283b8143a2eea9d30a` |
| `src/shaders/threeui.css` | `efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf` |

The runtime module extracts only the unchanged `CompleteShelfLandingPage` export. Typography helpers and its unchanged recipe come from the official `MengTo/threeui` repository. The authored frame loads the local canonical HTML, including its Three.js r165 CDN imports and embedded textures. It never embeds the documentation website. The shared ThreeUI stylesheet is reused from the existing integration.

The movie variant removes the software cover atlas, uses the authored Three.js r165 geometry, materials, lighting, navigation and responsive renderer, and loads validated TMDB images with anonymous CORS. Missing posters retain a generated cover with the actual film title. A static, accessible film selection remains available if WebGL fails. Parent/frame messages validate both origin and source; the parent only opens IDs present in the current matches. The scene reinitializes when its dataset or locale changes and disposes resources on unload. Both standalone pages are excluded from search indexing. The movie variant loads only when the experimental view is selected.
