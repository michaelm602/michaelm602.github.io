import { isDeepStrictEqual } from "node:util";

const TIMESTAMP_FIELDS = new Set(["createdAt", "updatedAt"]);

export function parseImportArguments(args) {
  let projectId = null;
  let write = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--write") {
      write = true;
    } else if (argument === "--project-id") {
      projectId = args[index + 1] || null;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!projectId || projectId.startsWith("--")) {
    throw new Error("An explicit --project-id <firebase-project-id> is required.");
  }
  if (!/^[a-z0-9][a-z0-9-]{3,28}[a-z0-9]$/.test(projectId)) {
    throw new Error(`Invalid Firebase project ID: ${projectId}`);
  }
  return { projectId, write };
}

function comparableDocument(document) {
  return Object.fromEntries(
    Object.entries(document).filter(([key]) => !TIMESTAMP_FIELDS.has(key))
  );
}

function collectChangedPaths(desired, existing, prefix = "") {
  if (isDeepStrictEqual(desired, existing)) return [];
  const desiredIsObject = desired && typeof desired === "object" && !Array.isArray(desired);
  const existingIsObject = existing && typeof existing === "object" && !Array.isArray(existing);
  if (!desiredIsObject || !existingIsObject) return [prefix];

  return Object.keys(desired).flatMap((key) =>
    collectChangedPaths(desired[key], existing[key], prefix ? `${prefix}.${key}` : key)
  );
}

export function planShopProductChanges(desiredDocuments, existingById) {
  const create = [];
  const update = [];
  const unchanged = [];
  const desiredIds = new Set();

  for (const desired of desiredDocuments) {
    desiredIds.add(desired.id);
    const existing = existingById.get(desired.id);
    if (!existing) {
      create.push({ id: desired.id, document: desired });
      continue;
    }
    const changedPaths = collectChangedPaths(
      comparableDocument(desired),
      comparableDocument(existing)
    ).filter(Boolean);
    if (existing.createdAt === undefined || existing.createdAt === null) {
      changedPaths.push("createdAt");
    }
    if (changedPaths.length) update.push({ id: desired.id, document: desired, changedPaths });
    else unchanged.push(desired.id);
  }

  const untouched = [...existingById.keys()].filter((id) => !desiredIds.has(id)).sort();
  return {
    summary: {
      create: create.length,
      update: update.length,
      unchanged: unchanged.length,
      untouched: untouched.length,
    },
    create,
    update,
    unchanged,
    untouched,
  };
}
