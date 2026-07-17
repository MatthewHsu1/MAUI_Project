// Single barrel for all @radix-ui/themes CSS so main.tsx stays lean. Trimmed
// per-scale (not the all-in-one styles.css). The color scales below MUST stay in
// sync with RADIX_BADGE_SCALES in src/lib/grid/radixBadgePalette.ts — every scale
// an enum badge can use needs its token CSS here, or softBadge.tsx warns at runtime.
import "@radix-ui/themes/components.css";
import "@radix-ui/themes/tokens/base.css";
import "@radix-ui/themes/utilities.css";
// Accent + gray scales (pre-existing):
import "@radix-ui/themes/tokens/colors/iris.css";
import "@radix-ui/themes/tokens/colors/slate.css";
// Enum badge scales (must match RADIX_BADGE_SCALES):
import "@radix-ui/themes/tokens/colors/tomato.css";
import "@radix-ui/themes/tokens/colors/amber.css";
import "@radix-ui/themes/tokens/colors/grass.css";
import "@radix-ui/themes/tokens/colors/cyan.css";
import "@radix-ui/themes/tokens/colors/plum.css";
import "@radix-ui/themes/tokens/colors/orange.css";
import "@radix-ui/themes/tokens/colors/jade.css";
import "@radix-ui/themes/tokens/colors/crimson.css";
import "@radix-ui/themes/tokens/colors/indigo.css";
import "@radix-ui/themes/tokens/colors/red.css";
import "@radix-ui/themes/tokens/colors/green.css";
