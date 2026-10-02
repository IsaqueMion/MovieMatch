Gateway Flow, registered revision `1920ad4fe34f`, retrieved from
https://threeui.com/source-code/gateway-flow.json on 2026-10-01.

These registered files are preserved byte for byte (UTF-8):

| File | SHA-256 |
| --- | --- |
| neuform-isolated/NeuformBatchEffects.tsx | dc68c51bea26b922965de44b4fb8d6c432607508fb2b61e16ed60d245da1a69f |
| neuform-isolated/sources/gateway-flow.html | c5a1de43138ffba96b9f0ecdcf3c054ae251ec94344e88c6ad502bae362b17d0 |
| threeui.css | efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf |

The other 17 HTML imports are the canonical strings distributed in
`@designcodeio/threeui@1.2.0`. That release's Gateway Flow HTML matches the
registered hash above. The shared stylesheet's Fragment Mono font is from
`MengTo/threeui/main/src/shaders/fonts/fragment-mono.woff2` (SHA-256
`4f4dc27f4a770c0d02fde800daa836c8adc0d1e423b28da74baaf0d1cc3ab96c`).
Upstream MIT and font licenses are included alongside this file.

The registry's low-level `ConstellationField` export is a different effect;
`SwipeBackground` imports its `GatewayFlow` export under that name, as the
library's public variant dispatcher does. All requested props are retained.
This selected source uses Canvas 2D. Its sandbox and authored external CDN
dependencies are retained; no documentation page is embedded.

MovieMatch only positions the result behind the swipe UI and adds a checked
parent-to-sandbox click bridge to activate the authored particle bursts.
Reduced-motion preference removes the animated iframe and uses a black stage.
