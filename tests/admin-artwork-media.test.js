import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const storageMedia = await import("../src/utils/storageMedia.js").catch(() => ({}));
const adminProductMedia = await import("../src/utils/adminProductMedia.js").catch(() => ({}));
const modalFocus = await import("../src/utils/modalFocus.js").catch(() => ({}));
const adminArtworkMedia = await import("../src/services/adminArtworkMediaLister.js").catch(() => ({}));
const { normalizeAdminProductForSave, createBlankAdminProduct } = await import(
  "../src/utils/adminProduct.js"
);

const gallerySource = await readFile(
  new URL("../src/Components/Gallery.jsx", import.meta.url),
  "utf8"
);
const uploaderSource = await readFile(
  new URL("../src/Components/UploadImage.jsx", import.meta.url),
  "utf8"
);
const pickerSource = await readFile(
  new URL("../src/Components/ArtworkMediaPicker.jsx", import.meta.url),
  "utf8"
).catch(() => "");
const adminProductsSource = await readFile(
  new URL("../src/pages/AdminProducts.jsx", import.meta.url),
  "utf8"
);
const adminArtworkServiceSource = await readFile(
  new URL("../src/services/adminArtworkMedia.js", import.meta.url),
  "utf8"
).catch(() => "");
const adminArtworkListerSource = await readFile(
  new URL("../src/services/adminArtworkMediaLister.js", import.meta.url),
  "utf8"
).catch(() => "");

function storageRef(name) {
  return { name, fullPath: `airbrush/${name}` };
}

test("grouped artwork media supports JPG, JPEG, PNG, and WebP with deterministic display variants", () => {
  const groups = storageMedia.groupStorageImageRefs?.([
    storageRef("Alpha.jpg"),
    storageRef("Alpha.webp"),
    storageRef("Beta.jpeg"),
    storageRef("Gamma.png"),
    storageRef("notes.txt"),
  ]);

  assert.deepEqual(
    groups?.map(({ title, fullPath, thumbnailPath }) => ({ title, fullPath, thumbnailPath })),
    [
      { title: "Alpha", fullPath: "airbrush/Alpha.webp", thumbnailPath: null },
      { title: "Beta", fullPath: "airbrush/Beta.jpeg", thumbnailPath: null },
      { title: "Gamma", fullPath: "airbrush/Gamma.png", thumbnailPath: null },
    ]
  );
});

test("grouped artwork media associates thumb variants and prefers WebP thumbnails", () => {
  const groups = storageMedia.groupStorageImageRefs?.([
    storageRef("The Last Transmission.jpg"),
    storageRef("The Last Transmission.webp"),
    storageRef("The Last Transmission__thumb.jpg"),
    storageRef("The Last Transmission__thumb.webp"),
    storageRef("Orphan__thumb.webp"),
  ]);

  assert.equal(groups?.length, 1);
  assert.equal(groups?.[0].fullPath, "airbrush/The Last Transmission.webp");
  assert.equal(groups?.[0].thumbnailPath, "airbrush/The Last Transmission__thumb.webp");
  assert.equal(groups?.[0].variantRefs.length, 4);
});

test("grouped artwork media keeps case-sensitive Storage object names separate", () => {
  const groups = storageMedia.groupStorageImageRefs?.([
    storageRef("Signal.jpg"),
    storageRef("signal.jpg"),
  ]);

  assert.equal(groups?.length, 2);
  assert.deepEqual(groups?.find((group) => group.title === "Signal")?.variantRefs, [
    storageRef("Signal.jpg"),
  ]);
  assert.deepEqual(groups?.find((group) => group.title === "signal")?.variantRefs, [
    storageRef("signal.jpg"),
  ]);
});

test("admin artwork media lists and hydrates grouped objects from airbrush only", async () => {
  const calls = [];
  const listAdminArtworkMedia = adminArtworkMedia.createAdminArtworkMediaLister?.({
    storageInstance: { name: "test-storage" },
    createStorageRef: (_storage, path) => ({ path }),
    listStorageItems: async (folderRef) => {
      calls.push(["list", folderRef.path]);
      return {
        items: [
          storageRef("Signal.jpg"),
          storageRef("Signal.webp"),
          storageRef("Signal__thumb.webp"),
        ],
      };
    },
    getStorageUrl: async (itemRef) => {
      calls.push(["url", itemRef.fullPath]);
      return `https://storage.example/${encodeURIComponent(itemRef.fullPath)}`;
    },
  });
  const media = await listAdminArtworkMedia?.();

  assert.deepEqual(calls[0], ["list", "airbrush/"]);
  assert.deepEqual(media, [
    {
      key: "Signal",
      title: "Signal",
      fullPath: "airbrush/Signal.webp",
      thumbnailPath: "airbrush/Signal__thumb.webp",
      fullUrl: "https://storage.example/airbrush%2FSignal.webp",
      thumbnailUrl: "https://storage.example/airbrush%2FSignal__thumb.webp",
      displayUrl: "https://storage.example/airbrush%2FSignal__thumb.webp",
    },
  ]);
});

test("admin artwork media surfaces a full-image URL failure instead of showing a false empty state", async () => {
  const loadError = Object.assign(new Error("Storage access denied"), {
    code: "storage/unauthorized",
  });
  const listAdminArtworkMedia = adminArtworkMedia.createAdminArtworkMediaLister?.({
    storageInstance: {},
    createStorageRef: (_storage, path) => ({ path }),
    listStorageItems: async () => ({ items: [storageRef("Signal.webp")] }),
    getStorageUrl: async () => {
      throw loadError;
    },
  });

  await assert.rejects(listAdminArtworkMedia?.(), (error) => error === loadError);
});

test("first selected artwork uses exact paths, safe ID, order zero, title alt, and primary status", () => {
  const draft = createBlankAdminProduct();
  draft.title = "A Product Title";

  const selected = adminProductMedia.addArtworkMediaToProductDraft?.(draft, {
    title: "The Last Transmission",
    fullPath: "airbrush/The Last Transmission.webp",
    thumbnailPath: "airbrush/The Last Transmission__thumb.webp",
  });

  assert.deepEqual(selected?.images, [
    {
      id: "the-last-transmission-primary",
      storagePath: "airbrush/The Last Transmission.webp",
      thumbnailPath: "airbrush/The Last Transmission__thumb.webp",
      alt: "A Product Title",
      sortOrder: 0,
    },
  ]);
  assert.equal(selected?.primaryImageId, "the-last-transmission-primary");
});

test("later artwork selections preserve existing alt and primary fields while making unique IDs", () => {
  const draft = createBlankAdminProduct();
  draft.title = "Replacement suggestion";
  draft.images = [
    {
      id: "the-last-transmission-image",
      storagePath: "airbrush/Existing.webp",
      thumbnailPath: null,
      alt: "Hand-written existing alt text",
      sortOrder: 7,
    },
  ];
  draft.primaryImageId = "the-last-transmission-image";
  const originalDraft = structuredClone(draft);

  const selected = adminProductMedia.addArtworkMediaToProductDraft?.(draft, {
    title: "The Last Transmission",
    fullPath: "airbrush/The Last Transmission.jpg",
    thumbnailPath: null,
  });

  assert.equal(selected?.images[0].alt, "Hand-written existing alt text");
  assert.equal(selected?.images[1].id, "the-last-transmission-image-2");
  assert.equal(selected?.images[1].sortOrder, 1);
  assert.equal(selected?.images[1].alt, "Replacement suggestion");
  assert.equal(selected?.primaryImageId, "the-last-transmission-image");
  assert.deepEqual(draft, originalDraft);
});

test("generated artwork image IDs remain unique after save normalization", () => {
  const draft = createBlankAdminProduct();
  draft.images = [{
    id: "Signal / Return Image",
    storagePath: "airbrush/Existing.webp",
    thumbnailPath: null,
    alt: "Existing",
    sortOrder: 0,
  }];
  draft.primaryImageId = "Signal / Return Image";

  const selected = adminProductMedia.addArtworkMediaToProductDraft?.(draft, {
    title: "Signal / Return",
    fullPath: "airbrush/Signal Return.webp",
    thumbnailPath: null,
  });
  const normalized = normalizeAdminProductForSave(selected);

  assert.equal(selected?.images[1].id, "signal-return-image-2");
  assert.equal(selected?.images[1].id.length <= 100, true);
  assert.deepEqual(normalized.images.map((image) => image.id), [
    "signal-return-image",
    "signal-return-image-2",
  ]);
});

test("manual image paths remain unchanged by save normalization", () => {
  const draft = createBlankAdminProduct();
  draft.images = [{
    id: "manual-image",
    storagePath: "airbrush/Manual Entry.jpg",
    thumbnailPath: "airbrush/Manual Entry__thumb.webp",
    alt: "Manual alt",
    sortOrder: 4,
  }];
  draft.primaryImageId = "manual-image";

  const normalized = normalizeAdminProductForSave(draft);

  assert.deepEqual(normalized.images, draft.images);
  assert.equal(normalized.primaryImageId, "manual-image");
});

test("gallery and uploader reuse the shared artwork grouping helper", () => {
  assert.match(gallerySource, /groupStorageImageRefs/);
  assert.match(uploaderSource, /groupStorageImageRefs/);
});

test("picker exposes responsive search and keyboard-dismissable dialog states", () => {
  assert.match(pickerSource, /role="dialog"/);
  assert.match(pickerSource, /aria-modal="true"/);
  assert.match(pickerSource, /event\.key === "Escape"/);
  assert.match(pickerSource, /trapFocusWithin/);
  assert.match(pickerSource, /type="search"/);
  assert.match(pickerSource, /Loading artwork/);
  assert.match(pickerSource, /No artwork matches/);
  assert.match(pickerSource, /grid-cols-2/);
  assert.match(pickerSource, /listAdminArtworkMedia/);
  assert.match(adminProductsSource, /Choose existing artwork/);
  assert.match(adminProductsSource, /Add image path/);
});

test("modal focus wrapping keeps forward and reverse Tab navigation inside the dialog", () => {
  const calls = [];
  const first = { focus: () => calls.push("first") };
  const last = { focus: () => calls.push("last") };
  const container = {
    querySelectorAll: () => [first, last],
    contains: (element) => element === first || element === last,
  };
  const forwardEvent = {
    key: "Tab",
    shiftKey: false,
    preventDefault: () => calls.push("prevent-forward"),
  };
  const reverseEvent = {
    key: "Tab",
    shiftKey: true,
    preventDefault: () => calls.push("prevent-reverse"),
  };

  modalFocus.trapFocusWithin?.(forwardEvent, container, last);
  modalFocus.trapFocusWithin?.(reverseEvent, container, first);

  assert.deepEqual(calls, ["prevent-forward", "first", "prevent-reverse", "last"]);
});

test("media selection is draft-only and introduces no Firestore or Storage mutation APIs", () => {
  const readOnlyMediaSource = `${adminArtworkServiceSource}\n${adminArtworkListerSource}\n${pickerSource}`;
  assert.doesNotMatch(readOnlyMediaSource, /firebase\/firestore|saveAdminProduct|setDoc|addDoc|updateDoc/);
  assert.doesNotMatch(
    readOnlyMediaSource,
    /uploadBytes|uploadBytesResumable|deleteObject|updateMetadata/
  );
  assert.match(adminArtworkServiceSource, /listAll/);
  assert.match(adminArtworkServiceSource, /getDownloadURL/);
});
