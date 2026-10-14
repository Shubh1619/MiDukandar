<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# GLOBAL BRANDING RULE - apply to every MiDukandar screen being built

Reference: "apply global branding rule"

1. **TAGLINE:** App name is **MiDukandar** (was MazeDukan). Replace any instance of "किराणा व रिटेल POS" (Kirana & Retail POS) with "MiDukandar - Smart Business" / "मी दुकानदार - स्मार्ट व्यवसाय व्यवस्थापन" - sidebar logo block, header, marketing panels, footer. Never use "POS" in the tagline or marketing copy.

2. **MARKETING COPY:** Replace "Kiranas" with "Shops & Businesses" everywhere it appears (hero headlines, stat captions, trust panels, testimonials on Login/Registration/Recovery screens).

3. **PRODUCT CATEGORY REFERENCES:** Never hardcode FMCG/grocery-specific categories (e.g. "Edible Oils & Ghee", "Grains & Atta") in UI copy, placeholder text, or example data. Pull category labels dynamically from the store's actual `business_category` and `product_categories` table. Use category-agnostic placeholders in empty states (e.g. "e.g. Category A").

4. **CONDITIONAL BUSINESS-TYPE WIDGETS:** Grocery/produce-specific features (APMC mandi rate ticker, perishable stock alerts, weight-based unit defaults like kg/litre) must render CONDITIONALLY based on `business.category`, not shown by default. Non-grocery categories see alternative or empty widget slots.

5. **UNIT/FIELD DEFAULTS:** Product Add/Edit unit selector should be generic (Piece, Kg, Litre, Box, Pack, Dozen) for MVP. Extendable per business type in Phase 2.

6. **ICONOGRAPHY:** Avoid grocery-specific iconography in generic UI elements. Use neutral retail/shop icons (storefront, cash register, box/inventory).

7. **LOGO/SIDEBAR:** Every authenticated page's sidebar/header uses the generic tagline from rule #1 via the shared layout component.
