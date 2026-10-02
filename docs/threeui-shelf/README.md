# ThreeUI shelf experiment

The Matches page offers an opt-in preview of the complete, original seven-tool bookshelf. The working movie list remains below it. This is a source-preserving reference experiment; it does not replace the tools with movie covers.

Source: https://threeui.com/source-code/complete-shelf-landing-page.json

The current hosted HTML differed from the requested revision. The user approved testing the current official source; the original requested canonical HTML was subsequently recovered from the official `@designcodeio/threeui@1.2.0` package and is used here without edits.

| File | SHA-256 |
| --- | --- |
| `public/landing-pages/complete-shelf-v2.html` | `606f200fed8602c243f40a11c8c364f0e625c57f80e7c97dc76419da207f198e` |
| `src/shaders/landing-pages/LandingPageFrame.tsx` | `61de2cc50888aac4ac5557420b07fa47ed3543bb57c1e0055fafdefa53dbaa78` |
| `docs/threeui-shelf/LandingPages.tsx.txt` | `4d379461ad00eb4de7900df312878035383de7e1ed4e13283b8143a2eea9d30a` |
| `src/shaders/threeui.css` | `efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf` |

The runtime module extracts only the unchanged `CompleteShelfLandingPage` export. Typography helpers and its unchanged recipe come from the official `MengTo/threeui` repository. The authored frame loads the local canonical HTML, including its Three.js r165 CDN imports and embedded textures. It never embeds the documentation website. The shared ThreeUI stylesheet is reused from the existing integration.

The standalone reference page is excluded from search indexing. It loads only when the experimental view is selected.
