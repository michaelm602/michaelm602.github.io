import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getAllProducts } from "../src/data/products.js";

const require = createRequire(import.meta.url);
const {
  buildCatalogParityReport,
  mapSourceCatalog,
} = require("../functions/shopProductMapper");

function parseArguments(args) {
  let write = false;
  let output = "artifacts/shop-products-migration.json";
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--write") write = true;
    else if (args[index] === "--output") {
      output = args[index + 1] || "";
      index += 1;
    } else throw new Error(`Unknown argument: ${args[index]}`);
  }
  if (write && !output) throw new Error("--output requires a file path.");
  return { write, output };
}

function printList(label, values) {
  console.log(`${label}: ${values.length ? values.join(", ") : "none"}`);
}

export function printParityReport(report) {
  console.log("shopProducts migration parity report");
  console.log(`Products: ${report.summary.productCount}`);
  console.log(`Unique slugs: ${report.summary.slugCount}`);
  console.log(`Print options: ${report.summary.printOptionCount}`);
  console.log(`Stripe Price IDs: ${report.summary.stripePriceIdCount}`);
  console.log(`Image storage paths: ${report.summary.imagePathCount}`);
  console.log(`Thumbnail paths: ${report.summary.thumbnailPathCount}`);
  printList("Duplicate product IDs", report.duplicateProductIds);
  printList("Duplicate slugs", report.duplicateSlugs);
  printList("Duplicate Stripe Price IDs", report.duplicateStripePriceIds);
  printList("Missing Stripe Price IDs", report.missingStripePriceIds);
  printList("Invalid prices", report.invalidPrices);
  printList("Missing image storage paths", report.missingImagePaths);
  printList("Parity errors", report.parityErrors);
  console.log(`Result: ${report.valid ? "PASS" : "FAIL"}`);
}

async function main() {
  const { write, output } = parseArguments(process.argv.slice(2));
  const sourceProducts = getAllProducts({ includeDrafts: true });
  const documents = mapSourceCatalog(sourceProducts);
  const report = buildCatalogParityReport(sourceProducts, documents);
  printParityReport(report);
  if (!report.valid) {
    process.exitCode = 1;
    return;
  }
  if (!write) {
    console.log("Dry run only. No file or Firebase data was written.");
    return;
  }

  const target = path.resolve(output);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(documents, null, 2)}\n`, "utf8");
  console.log(`Wrote local migration JSON: ${target}`);
  console.log("No Firebase data was written.");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}
