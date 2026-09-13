import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  compareLegacyPortfolioProducts,
  compareLegacyShopProducts,
} from "../src/utils/catalogOrdering.js";

const CHANNELS = ["shop", "portfolio"];
const DEFAULT_DATABASE_ID = "(default)";

export function parseCatalogOrderingBackfillArguments(args) {
  let projectId = "";
  let write = false;
  let output = null;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--project") {
      projectId = args[index + 1] || "";
      index += 1;
    } else if (args[index] === "--write") {
      write = true;
    } else if (args[index] === "--output") {
      output = args[index + 1] || "";
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${args[index]}`);
    }
  }

  if (!projectId) throw new Error("--project is required.");
  if (output === "") throw new Error("--output requires a file path.");
  return { projectId, write, output };
}

function isVisible(product, channel) {
  return product?.active === true
    && product?.archivedAt == null
    && product?.channels?.[channel] === true;
}

function sortedIds(products, channel) {
  const comparator = channel === "shop"
    ? compareLegacyShopProducts
    : compareLegacyPortfolioProducts;
  return products
    .filter((product) => isVisible(product, channel))
    .sort(comparator)
    .map((product) => product.id);
}

export function buildCatalogOrderingBackfillPlan(products, existingDocuments = {}) {
  const source = Array.isArray(products) ? products : [];
  const documents = {
    shop: { productIds: sortedIds(source, "shop") },
    portfolio: { productIds: sortedIds(source, "portfolio") },
  };
  const create = [];
  const preserve = [];

  for (const channel of CHANNELS) {
    const item = {
      channel,
      document: documents[channel],
    };
    if (existingDocuments[channel] == null) create.push(item);
    else preserve.push({ ...item, document: existingDocuments[channel] });
  }

  const excluded = { archived: [], inactive: [], noPublicChannel: [] };
  for (const product of source) {
    if (product?.archivedAt != null) excluded.archived.push(product.id);
    else if (product?.active !== true) excluded.inactive.push(product.id);
    else if (product?.channels?.shop !== true && product?.channels?.portfolio !== true) {
      excluded.noPublicChannel.push(product.id);
    }
  }
  for (const ids of Object.values(excluded)) ids.sort((left, right) => left.localeCompare(right));

  return {
    documents,
    existing: existingDocuments,
    create,
    preserve,
    excluded,
    summary: {
      sourceProducts: source.length,
      create: create.length,
      preserve: preserve.length,
    },
  };
}

function jsonReplacer(_key, value) {
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  return value;
}

async function writeReport({ projectId, output, plan, products, mode }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.resolve(
    output || path.join("backups", `catalog-ordering-${projectId}-${timestamp}.json`)
  );
  const report = {
    projectId,
    databaseId: DEFAULT_DATABASE_ID,
    mode,
    generatedAt: new Date().toISOString(),
    targetCollection: "catalogOrdering",
    sourceCollection: "shopProducts",
    plan,
    sourceOrderingFields: products.map((product) => ({
      id: product.id,
      active: product.active,
      archivedAt: product.archivedAt,
      channels: product.channels,
      featured: product.featured,
      sortOrder: product.sortOrder,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    })),
  };
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(report, jsonReplacer, 2)}\n`, "utf8");
  return target;
}

function printPlan(plan) {
  for (const item of plan.create) {
    console.log(`Create catalogOrdering/${item.channel}: ${item.document.productIds.join(", ") || "(empty)"}`);
  }
  for (const item of plan.preserve) {
    console.log(`Preserve existing catalogOrdering/${item.channel}; no overwrite.`);
  }
  console.log(`Excluded archived: ${plan.excluded.archived.join(", ") || "none"}`);
  console.log(`Excluded inactive: ${plan.excluded.inactive.join(", ") || "none"}`);
  console.log(`Excluded without a public channel: ${plan.excluded.noPublicChannel.join(", ") || "none"}`);
}

async function main() {
  const { projectId, write, output } = parseCatalogOrderingBackfillArguments(process.argv.slice(2));
  const [{ applicationDefault, deleteApp, initializeApp }, { getFirestore }] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/firestore"),
  ]);
  const app = initializeApp(
    { credential: applicationDefault(), projectId },
    `catalog-ordering-backfill-${Date.now()}`
  );

  try {
    const firestore = getFirestore(app, DEFAULT_DATABASE_ID);
    const productSnapshot = await firestore.collection("shopProducts").get();
    const products = productSnapshot.docs.map((snapshot) => ({
      ...snapshot.data(),
      id: snapshot.id,
    }));
    const orderingCollection = firestore.collection("catalogOrdering");
    const orderingSnapshots = await Promise.all(
      CHANNELS.map((channel) => orderingCollection.doc(channel).get())
    );
    const existingDocuments = Object.fromEntries(
      orderingSnapshots
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) => [snapshot.id, snapshot.data()])
    );
    const plan = buildCatalogOrderingBackfillPlan(products, existingDocuments);

    console.log(`Project: ${projectId}`);
    console.log(`Database: ${DEFAULT_DATABASE_ID}`);
    console.log(`Mode: ${write ? "WRITE" : "DRY RUN"}`);
    printPlan(plan);

    const reportPath = await writeReport({
      projectId,
      output,
      plan,
      products,
      mode: write ? "write" : "dry-run",
    });
    console.log(`Local backup/report written: ${reportPath}`);

    if (!write) {
      console.log("No Firestore data was written. Re-run with --write only after reviewing this report.");
      return;
    }
    if (!plan.create.length) {
      console.log("Both ordering documents already exist. No Firestore data was written.");
      return;
    }

    const batch = firestore.batch();
    for (const item of plan.create) {
      batch.create(orderingCollection.doc(item.channel), item.document);
    }
    await batch.commit();
    console.log(`Created ${plan.create.length} ordering document(s). Existing documents were not overwritten.`);
  } finally {
    await deleteApp(app);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Catalog ordering backfill failed: ${error.message}`);
    process.exitCode = 1;
  });
}
