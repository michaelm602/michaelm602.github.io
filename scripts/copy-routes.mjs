// Every npm build emits route-specific public HTML and a matching sitemap.
// Utility routes keep direct-entry support with initial noindex metadata.
import { buildSeoSite } from "./seo-build.mjs";

const result = await buildSeoSite();
console.log(`SEO build: ${result.publicPages} public pages, ${result.utilityPages} utility routes, ${result.products} public shop products.`);
