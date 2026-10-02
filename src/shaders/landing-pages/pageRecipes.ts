import type { PageTypographyRecipe } from "./pageTypography";

const n = (value: number) => Number(value.toFixed(3));
const px = (value: number) => `${n(value)}px`;
export const COMPLETE_SHELF_TYPOGRAPHY: PageTypographyRecipe = {
  "headingFonts": [
    {
      "value": "iowan-old-style",
      "label": "Iowan Old Style",
      "stack": "\"Iowan Old Style\", Baskerville, \"Times New Roman\", serif"
    },
    {
      "value": "instrument-serif",
      "label": "Instrument Serif",
      "stack": "\"Instrument Serif\", Georgia, serif",
      "google": "Instrument+Serif"
    },
    {
      "value": "newsreader",
      "label": "Newsreader",
      "stack": "\"Newsreader\", Georgia, serif",
      "google": "Newsreader:wght@200..700"
    },
    {
      "value": "geist",
      "label": "Geist",
      "stack": "\"Geist\", system-ui, -apple-system, \"Segoe UI\", Helvetica, Arial, sans-serif",
      "google": "Geist:wght@100..900"
    }
  ],
  "bodyFonts": [
    {
      "value": "inter",
      "label": "Inter",
      "stack": "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    },
    {
      "value": "geist",
      "label": "Geist",
      "stack": "\"Geist\", system-ui, -apple-system, \"Segoe UI\", Helvetica, Arial, sans-serif",
      "google": "Geist:wght@100..900"
    },
    {
      "value": "newsreader",
      "label": "Newsreader",
      "stack": "\"Newsreader\", Georgia, serif",
      "google": "Newsreader:wght@200..700"
    },
    {
      "value": "instrument-serif",
      "label": "Instrument Serif",
      "stack": "\"Instrument Serif\", Georgia, serif",
      "google": "Instrument+Serif"
    }
  ],
  "headingWeights": [
    "400",
    "500",
    "600"
  ],
  "headingWeight": "400",
  "bodyWeights": [
    "400",
    "500",
    "600"
  ],
  "bodyWeight": "400",
  "primaryColor": "#c87046",
  "headingSize": [
    32,
    60,
    88
  ],
  "bodySize": [
    10,
    12,
    18
  ],
  "headingLetterSpacing": [
    -0.1,
    -0.055,
    0.08
  ],
  css: (type) => `
:root { --accent: ${type.primary}; }
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
.selection__title, .detail-title, .editorial-identity strong, .page-status strong {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
}
.selection__title {
  font-size: clamp(32px, 3.4vw, ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.detail-title {
  font-size: clamp(56px, 6.3vw, ${px(type.headingSize * 107.2 / 60)});
  letter-spacing: ${n(type.headingLetterSpacing - 0.01)}em;
}
.selection__note { font-size: ${px(type.bodySize)}; font-weight: ${type.bodyWeight}; }
.detail-deck { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
@media (max-width: 880px) {
  .selection__title { font-size: clamp(32px, 9vw, ${px(type.headingSize * 56 / 60)}); }
  .detail-title { font-size: clamp(48px, 14vw, ${px(type.headingSize * 80 / 60)}); }
}
@media (max-width: 560px) {
  .selection__title { font-size: ${px(type.headingSize * 32 / 60)}; }
}
`
};
