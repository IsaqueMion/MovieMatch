// Exact CompleteShelf export extracted from the registered bundle; full module archived in docs/threeui-shelf.
import '../threeui.css';
import { splitTypographyProps, usePageTypography, type PageTypographyProps } from "./pageTypography";
import { LandingPageFrame, type LandingPageProps } from "./LandingPageFrame";
import { COMPLETE_SHELF_TYPOGRAPHY } from "./pageRecipes";

export function CompleteShelfLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(COMPLETE_SHELF_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Working Volumes — Seven Tools for Making" sourceUrl="/landing-pages/complete-shelf-v2.html" />;
}
