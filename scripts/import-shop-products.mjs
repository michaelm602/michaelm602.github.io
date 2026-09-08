import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getAllProducts } from "../src/data/products.js";
import {
  parseImportArguments,
  planShopProductChanges,
} from "./shop-product-import-plan.mjs";

const require = createRequire(import.meta.url);
const {
  buildCatalogParityReport,
  mapSourceCatalog,
} = require("../functions/shopProductMapper");
const { SHOP_PRODUCTS_COLLECTION } = require("../functions/shopProductSchema");
const DEFAULT_DATABASE_ID = "(default)";

function jsonReplacer(_key, value) {
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  return value;
}

function printChangePlan(plan) {
  console.log(`Create (${plan.summary.create}): ${plan.create.map(({ id }) => id).join(", ") || "none"}`);
  console.log(`Update (${plan.summary.update}):`);
  if (!plan.update.length) console.log("  none");
  for (const change of plan.update) {
    console.log(`  ${change.id}: ${change.changedPaths.join(", ")}`);
  }
  console.log(`Unchanged (${plan.summary.unchanged}): ${plan.unchanged.join(", ") || "none"}`);
  console.log(`Existing documents left untouched (${plan.summary.untouched}): ${plan.untouched.join(", ") || "none"}`);
}

async function writeBackup({ projectId, existingById }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDirectory = path.resolve("backups");
  const backupPath = path.join(
    backupDirectory,
    `shopProducts-${projectId}-${timestamp}.json`
  );
  const contents = {
    projectId,
    databaseId: DEFAULT_DATABASE_ID,
    collection: SHOP_PRODUCTS_COLLECTION,
    exportedAt: new Date().toISOString(),
    documents: Object.fromEntries(existingById),
  };
  await mkdir(backupDirectory, { recursive: true });
  await writeFile(backupPath, `${JSON.stringify(contents, jsonReplacer, 2)}\n`, "utf8");
  return backupPath;
}

async function main() {
  const { projectId, write } = parseImportArguments(process.argv.slice(2));
  const sourceProducts = getAllProducts({ includeDrafts: true });
  const desiredDocuments = mapSourceCatalog(sourceProducts);
  const parity = buildCatalogParityReport(sourceProducts, desiredDocuments);
  if (!parity.valid) throw new Error(`Catalog parity failed: ${parity.parityErrors.join("; ")}`);

  const [{ applicationDefault, initializeApp }, { FieldValue, getFirestore }] =
    await Promise.all([
      import("firebase-admin/app"),
      import("firebase-admin/firestore"),
    ]);
  const app = initializeApp(
    { credential: applicationDefault(), projectId },
    `shop-products-import-${Date.now()}`
  );
  const firestore = getFirestore(app, DEFAULT_DATABASE_ID);
  const collection = firestore.collection(SHOP_PRODUCTS_COLLECTION);
  const snapshot = await collection.get();
  const existingById = new Map(snapshot.docs.map((document) => [document.id, document.data()]));
  const plan = planShopProductChanges(desiredDocuments, existingById);

  console.log(`Project: ${projectId}`);
  console.log(`Database: ${DEFAULT_DATABASE_ID}`);
  console.log(`Collection: ${SHOP_PRODUCTS_COLLECTION}`);
  console.log(`Mode: ${write ? "WRITE" : "DRY RUN"}`);
  printChangePlan(plan);

  if (!write) {
    console.log("No Firestore data was written. Re-run with --write only after reviewing this plan.");
    return;
  }

  const changes = [...plan.create, ...plan.update];
  if (!changes.length) {
    console.log("No changes to write.");
    return;
  }
  const backupPath = await writeBackup({ projectId, existingById });
  console.log(`Backup written before Firestore changes: ${backupPath}`);

  const batch = firestore.batch();
  for (const change of changes) {
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...catalogFields } = change.document;
    const payload = {
      ...catalogFields,
      updatedAt: FieldValue.serverTimestamp(),
      ...(existingById.get(change.id)?.createdAt
        ? {}
        : { createdAt: FieldValue.serverTimestamp() }),
    };
    batch.set(collection.doc(change.id), payload, { merge: true });
  }
  await batch.commit();
  console.log(`Upserted ${changes.length} shopProducts documents. No documents were deleted.`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Import failed: ${error.message}`);
    process.exitCode = 1;
  });
}
