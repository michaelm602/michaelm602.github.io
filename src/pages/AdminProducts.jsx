import { useCallback, useEffect, useMemo, useState } from "react";
import ProductStoragePreview from "../Components/ProductStoragePreview";
import useAdminAuth from "../hooks/useAdminAuth";
import {
  archiveAdminProduct,
  listAdminProducts,
  restoreAdminProduct,
  saveAdminProduct,
} from "../services/adminProducts";
import {
  createMissingAdminStripePrices,
  previewAdminStripePriceSync,
} from "../services/adminStripePriceSync";
import {
  ORIGINAL_CHECKOUT_WARNING,
  addStandardPrintSet,
  cloneAdminProduct,
  createBlankAdminProduct,
  createUniquePrintOptionId,
  deriveOriginalQuantity,
  formatProductMoney,
  formatAdminProductSaveError,
  hasMissingStandardPrintOptions,
  validateAdminProduct,
} from "../utils/adminProduct";
import { formatAdminStripeSyncError } from "../utils/adminStripePriceSync";

const inputClass =
  "mt-1 w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/50 focus:ring-2 focus:ring-white/10";
const buttonClass =
  "rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-white/40 disabled:cursor-not-allowed disabled:opacity-40";

function formatUpdatedAt(value) {
  const date = typeof value?.toDate === "function" ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "Not saved yet";
}

function StatusPill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "border-white/15 bg-white/5 text-white/60",
    active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-400/30 bg-amber-400/10 text-amber-100",
    archived: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  };
  return <span className={`rounded-full border px-2 py-1 text-xs ${tones[tone]}`}>{children}</span>;
}

function Field({ label, hint, children }) {
  return (
    <label className="block text-sm text-white/75">
      <span className="font-medium text-white/85">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-relaxed text-white/40">{hint}</span>}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
  checkedText = "On",
  uncheckedText = "Off",
}) {
  const stateText = disabled && !checked ? "Locked off" : checked ? checkedText : uncheckedText;

  return (
    <label
      className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
        disabled
          ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/45"
          : checked
            ? "cursor-pointer border-emerald-400/55 bg-emerald-400/[0.08] text-white hover:border-emerald-300/75"
            : "cursor-pointer border-white/25 bg-black/40 text-white/80 hover:border-white/45"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-white peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black ${
          checked
            ? disabled
              ? "border-white/30 bg-white/20 text-white/55"
              : "border-emerald-300 bg-emerald-300 text-emerald-950 shadow-[0_0_0_3px_rgba(110,231,183,0.12)]"
            : disabled
              ? "border-white/20 bg-black/20"
              : "border-white/55 bg-black/70"
        }`}
      >
        {checked && (
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="m4 10 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1 font-medium">{label}</span>
      <span
        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${
          disabled
            ? "border-white/15 bg-white/5 text-white/45"
            : checked
              ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-200"
              : "border-white/25 bg-white/5 text-white/60"
        }`}
      >
        {stateText}
      </span>
    </label>
  );
}

function EditorSection({ title, description, children }) {
  return (
    <section className="border-t border-white/10 py-7 first:border-t-0 first:pt-0">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/45">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function AdminProducts() {
  const { isAdmin, loading: adminLoading, error: adminError } = useAdminAuth();
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null);
  const [originalDraft, setOriginalDraft] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [originalFilter, setOriginalFilter] = useState("all");
  const [stripeSync, setStripeSync] = useState(null);
  const [stripeSyncing, setStripeSyncing] = useState(false);
  const [stripeSyncError, setStripeSyncError] = useState("");

  const loadProducts = useCallback(async (preferredId = "") => {
    setLoading(true);
    setError("");
    try {
      const nextProducts = await listAdminProducts();
      setProducts(nextProducts);
      const nextId = preferredId || nextProducts[0]?.id || "";
      const selected = nextProducts.find((product) => product.id === nextId) || nextProducts[0] || null;
      setSelectedId(selected?.id || "");
      setDraft(selected ? cloneAdminProduct(selected) : null);
      setOriginalDraft(selected ? cloneAdminProduct(selected) : null);
      setIsNew(false);
      setDirty(false);
      setAttemptedSave(false);
      setStripeSync(null);
      setStripeSyncError("");
    } catch (loadError) {
      console.error("Unable to load shop products:", loadError);
      setError(
        loadError?.code === "permission-denied"
          ? "Product access was denied. Confirm the admin claim and deploy the reviewed product rules before using this page."
          : loadError?.message || "Unable to load products."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminLoading && isAdmin) loadProducts();
  }, [adminLoading, isAdmin, loadProducts]);

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !needle ||
        [product.title, product.slug, product.category, ...(product.tags || [])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "archived" && Boolean(product.archivedAt)) ||
        (statusFilter === "active" && product.active && !product.archivedAt) ||
        (statusFilter === "inactive" && !product.active && !product.archivedAt);
      const matchesOriginal =
        originalFilter === "all" || product.original?.status === originalFilter;
      return matchesSearch && matchesStatus && matchesOriginal;
    });
  }, [originalFilter, products, search, statusFilter]);

  const validation = useMemo(
    () => (draft ? validateAdminProduct(draft) : { errors: [], warnings: [] }),
    [draft]
  );

  const mutateDraft = (updater) => {
    setDraft((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      return cloneAdminProduct(next);
    });
    setDirty(true);
    setMessage("");
    setError("");
    setStripeSync(null);
    setStripeSyncError("");
  };

  const selectProduct = (product) => {
    if (dirty && !window.confirm("Discard unsaved product changes?")) return;
    setSelectedId(product.id);
    setDraft(cloneAdminProduct(product));
    setOriginalDraft(cloneAdminProduct(product));
    setIsNew(false);
    setDirty(false);
    setAttemptedSave(false);
    setMessage("");
    setError("");
    setStripeSync(null);
    setStripeSyncError("");
  };

  const startNewProduct = () => {
    if (dirty && !window.confirm("Discard unsaved product changes?")) return;
    const next = createBlankAdminProduct();
    setSelectedId("");
    setDraft(next);
    setOriginalDraft(null);
    setIsNew(true);
    setDirty(true);
    setAttemptedSave(false);
    setMessage("");
    setError("");
    setStripeSync(null);
    setStripeSyncError("");
  };

  const save = async () => {
    setAttemptedSave(true);
    setMessage("");
    setError("");
    if (validation.errors.length) {
      setError(validation.errors.join(" "));
      return;
    }
    if (
      !isNew &&
      originalDraft?.slug !== draft.slug &&
      !window.confirm("Changing a slug can break saved product links. Save this slug change?")
    ) {
      return;
    }

    setSaving(true);
    try {
      const savedId = await saveAdminProduct(draft, { isNew });
      setMessage("Product saved to the dark Firestore catalog.");
      await loadProducts(savedId);
    } catch (saveError) {
      console.error("Unable to save product:", saveError);
      setError(formatAdminProductSaveError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const previewStripePrices = async () => {
    if (!draft || isNew || dirty) {
      setStripeSyncError("Save this product before previewing Stripe price sync.");
      return;
    }
    setStripeSyncing(true);
    setStripeSyncError("");
    try {
      const result = await previewAdminStripePriceSync(draft.id);
      setStripeSync(result);
      setMessage("Stripe sync preview ready. No Stripe objects were created.");
    } catch (syncError) {
      setStripeSyncError(formatAdminStripeSyncError(syncError));
    } finally {
      setStripeSyncing(false);
    }
  };

  const createStripePrices = async () => {
    if (!draft || !stripeSync?.operationId) return;
    setStripeSyncing(true);
    setStripeSyncError("");
    setMessage("");
    try {
      const result = await createMissingAdminStripePrices(draft.id, stripeSync.operationId);
      await loadProducts(draft.id);
      setStripeSync(result);
      if (result.status === "partial_failure") {
        setStripeSyncError("Some Stripe prices were not created. Saved progress is preserved; retry this operation.");
      } else if (result.status === "completed_with_conflicts") {
        setStripeSyncError("Stripe sync finished with conflicts. Existing Stripe Price IDs were preserved.");
      } else {
        setMessage("Missing Stripe prices were created and attached. Print options remain inactive until you review them.");
      }
    } catch (syncError) {
      setStripeSyncError(formatAdminStripeSyncError(syncError));
    } finally {
      setStripeSyncing(false);
    }
  };

  const archive = async () => {
    if (!draft || isNew || !window.confirm("Archive this product? It will remain in Firestore and become inactive.")) return;
    setSaving(true);
    setError("");
    try {
      await archiveAdminProduct(draft);
      setMessage("Product archived. No document or media was deleted.");
      await loadProducts(draft.id);
    } catch (archiveError) {
      setError(archiveError?.message || "Unable to archive this product.");
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    if (!draft || isNew) return;
    setSaving(true);
    setError("");
    try {
      await restoreAdminProduct(draft.id);
      setMessage("Product restored as inactive. Review it before activating.");
      await loadProducts(draft.id);
    } catch (restoreError) {
      setError(restoreError?.message || "Unable to restore this product.");
    } finally {
      setSaving(false);
    }
  };

  const updateImage = (index, field, value) =>
    mutateDraft((current) => {
      const images = current.images.map((image, imageIndex) =>
        imageIndex === index ? { ...image, [field]: value } : image
      );
      const oldId = current.images[index]?.id;
      return {
        ...current,
        images,
        primaryImageId:
          field === "id" && current.primaryImageId === oldId ? value : current.primaryImageId,
      };
    });

  const removeImage = (index) =>
    mutateDraft((current) => {
      const removedId = current.images[index]?.id;
      const images = current.images.filter((_, imageIndex) => imageIndex !== index);
      return {
        ...current,
        images,
        primaryImageId: current.primaryImageId === removedId ? images[0]?.id || null : current.primaryImageId,
      };
    });

  const updatePrintOption = (index, field, value) =>
    mutateDraft((current) => {
      const oldId = current.prints.options[index]?.id;
      const nextValue = field === "id"
        ? createUniquePrintOptionId(value, current.prints.options, index)
        : value;
      const options = current.prints.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, [field]: nextValue } : option
      );
      return {
        ...current,
        prints: {
          ...current.prints,
          options,
          defaultOptionId:
            field === "id" && current.prints.defaultOptionId === oldId
              ? nextValue
              : current.prints.defaultOptionId,
        },
      };
    });

  const stripeSyncItems = stripeSync?.items || stripeSync?.results || [];
  const conflictingStripeProducts = stripeSync?.conflictingStripeProducts || [];
  const hasMultipleStripeProductConflict = stripeSync?.conflictCode === "multiple_stripe_products"
    && conflictingStripeProducts.length > 1;
  const canCreateStripePrices = stripeSync?.status === "partial_failure"
    || (stripeSync?.status === "previewed"
      && stripeSyncItems.some((item) => ["missing", "recoverable"].includes(item.status)));

  if (adminError) return <p className="min-h-screen bg-black px-4 py-12 text-center text-red-300">{adminError}</p>;
  if (adminLoading || loading) return <p className="min-h-screen bg-black px-4 py-12 text-center text-white/60">Loading product catalog...</p>;

  return (
    <div className="min-h-screen bg-[#080808] px-3 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Product catalog</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
              Review and edit the dark Firestore catalog. Customer shop and checkout still use the source catalogs.
            </p>
          </div>
          <button type="button" onClick={startNewProduct} className={`${buttonClass} bg-white text-black hover:bg-white/85`}>
            New product
          </button>
        </header>

        {error && <p role="alert" className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{message}</p>}

        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="self-start rounded-xl border border-white/10 bg-[#101010] lg:sticky lg:top-4">
            <div className="space-y-3 border-b border-white/10 p-4">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, slug, category..."
                aria-label="Search products"
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-2">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter product status" className={inputClass}>
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
                <select value={originalFilter} onChange={(event) => setOriginalFilter(event.target.value)} aria-label="Filter original status" className={inputClass}>
                  <option value="all">All originals</option>
                  <option value="available">Available</option>
                  <option value="sold">Sold</option>
                  <option value="not_for_sale">Not for sale</option>
                </select>
              </div>
              <p className="text-xs text-white/40">{filteredProducts.length} of {products.length} products</p>
            </div>

            <div className="max-h-[68vh] overflow-y-auto p-2">
              {filteredProducts.map((product) => {
                const primary = product.images?.find((image) => image.id === product.primaryImageId) || product.images?.[0];
                return (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => selectProduct(product)}
                    className={`mb-1 grid w-full grid-cols-[64px_1fr] gap-3 rounded-lg p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-white/40 ${selectedId === product.id && !isNew ? "bg-white text-black" : "hover:bg-white/5"}`}
                  >
                    <span className="h-16 overflow-hidden rounded-md border border-white/10 bg-black">
                      <ProductStoragePreview image={primary} alt="" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{product.title}</span>
                      <span className={`block truncate text-xs ${selectedId === product.id && !isNew ? "text-black/55" : "text-white/40"}`}>{product.slug}</span>
                      <span className={`mt-1 block truncate text-xs ${selectedId === product.id && !isNew ? "text-black/65" : "text-white/55"}`}>
                        {product.category} | {product.prints?.available ? `${product.prints.options?.filter((option) => option.active).length || 0} print options` : "Prints unavailable"}
                      </span>
                      <span className={`mt-1 block truncate text-xs ${selectedId === product.id && !isNew ? "text-black/65" : "text-white/55"}`}>
                        Original: {product.original?.status?.replaceAll("_", " ")}{product.original?.price?.amountCents ? ` | ${formatProductMoney(product.original.price.amountCents, product.original.price.currency)}` : ""}{product.featured ? " | Featured" : ""}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {product.archivedAt ? <StatusPill tone="archived">Archived</StatusPill> : product.active ? <StatusPill tone="active">Active</StatusPill> : <StatusPill>Inactive</StatusPill>}
                      </span>
                      <span className={`mt-1 block truncate text-[11px] ${selectedId === product.id && !isNew ? "text-black/45" : "text-white/30"}`}>Updated {formatUpdatedAt(product.updatedAt)}</span>
                    </span>
                  </button>
                );
              })}
              {!filteredProducts.length && <p className="px-3 py-8 text-center text-sm text-white/40">No products match these filters.</p>}
            </div>
          </aside>

          <main className="min-w-0 rounded-xl border border-white/10 bg-[#101010] p-4 sm:p-6 lg:p-8">
            {!draft ? (
              <div className="py-20 text-center text-white/45">Select a product or create a new one.</div>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); save(); }}>
                <div className="mb-7 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold">{isNew ? "New product" : draft.title}</h2>
                      {draft.archivedAt && <StatusPill tone="archived">Archived</StatusPill>}
                    </div>
                    <p className="mt-2 text-sm text-white/40">Updated {formatUpdatedAt(draft.updatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isNew && (draft.archivedAt ? (
                      <button type="button" onClick={restore} disabled={saving} className={`${buttonClass} border border-white/20 text-white hover:bg-white/10`}>Restore inactive</button>
                    ) : (
                      <button type="button" onClick={archive} disabled={saving} className={`${buttonClass} border border-rose-400/30 text-rose-200 hover:bg-rose-400/10`}>Archive</button>
                    ))}
                    <button type="submit" disabled={!dirty || saving || !isAdmin} className={`${buttonClass} bg-white text-black hover:bg-white/85`}>
                      {saving ? "Saving..." : "Save product"}
                    </button>
                  </div>
                </div>

                {attemptedSave && validation.errors.length > 0 && (
                  <div className="mb-6 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
                    <p className="font-semibold">Fix before saving</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">{validation.errors.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                    <ul className="list-disc space-y-1 pl-5">{validation.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                )}

                <EditorSection title="Identity and copy" description="The product ID is permanent after creation. Changing a slug can break saved links.">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Product ID" hint={isNew ? "Lowercase letters, numbers, and hyphens." : "Permanent Firestore document ID."}>
                      <input value={draft.id} disabled={!isNew} onChange={(event) => mutateDraft({ ...draft, id: event.target.value })} className={inputClass} />
                    </Field>
                    <Field label="Slug" hint="Changing this may break existing links once Firestore becomes customer-facing.">
                      <input value={draft.slug} onChange={(event) => mutateDraft({ ...draft, slug: event.target.value })} className={inputClass} />
                    </Field>
                    <Field label="Title"><input value={draft.title} onChange={(event) => mutateDraft({ ...draft, title: event.target.value })} className={inputClass} /></Field>
                    <Field label="Category"><input value={draft.category} onChange={(event) => mutateDraft({ ...draft, category: event.target.value })} className={inputClass} /></Field>
                    <Field label="Short description"><textarea rows="3" value={draft.shortDescription} onChange={(event) => mutateDraft({ ...draft, shortDescription: event.target.value })} className={inputClass} /></Field>
                    <Field label="Long description"><textarea rows="3" value={draft.longDescription} onChange={(event) => mutateDraft({ ...draft, longDescription: event.target.value })} className={inputClass} /></Field>
                    <Field label="Tags" hint="Comma-separated."><input value={draft.tags.join(", ")} onChange={(event) => mutateDraft({ ...draft, tags: event.target.value.split(",").map((tag) => tag.trim()) })} className={inputClass} /></Field>
                    <Field label="Sort order"><input type="number" min="0" step="1" value={draft.sortOrder} onChange={(event) => mutateDraft({ ...draft, sortOrder: Number(event.target.value) })} className={inputClass} /></Field>
                  </div>
                </EditorSection>

                <EditorSection title="Images" description="Use existing object paths under airbrush/ or photoshop/. Removing a row only removes the product reference; it never deletes Storage media.">
                  <div className="space-y-4">
                    {draft.images.map((image, index) => (
                      <div key={`${image.id}-${index}`} className="grid gap-4 rounded-lg border border-white/10 bg-black/25 p-4 xl:grid-cols-[120px_1fr]">
                        <div className="h-28 overflow-hidden rounded-lg border border-white/10 bg-black"><ProductStoragePreview image={image} alt="" /></div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <Field label="Image ID"><input value={image.id} onChange={(event) => updateImage(index, "id", event.target.value)} className={inputClass} /></Field>
                          <Field label="Sort order"><input type="number" min="0" value={image.sortOrder} onChange={(event) => updateImage(index, "sortOrder", Number(event.target.value))} className={inputClass} /></Field>
                          <Field label="Storage path"><input value={image.storagePath} onChange={(event) => updateImage(index, "storagePath", event.target.value)} placeholder="airbrush/Piece.webp" className={inputClass} /></Field>
                          <Field label="Thumbnail path"><input value={image.thumbnailPath || ""} onChange={(event) => updateImage(index, "thumbnailPath", event.target.value || null)} placeholder="airbrush/Piece__thumb.webp" className={inputClass} /></Field>
                          <Field label="Alt text"><input value={image.alt} onChange={(event) => updateImage(index, "alt", event.target.value)} className={inputClass} /></Field>
                          <div className="flex items-end gap-2">
                            <label className="flex min-h-10 flex-1 items-center gap-2 text-sm text-white/70"><input type="radio" name="primary-image" checked={draft.primaryImageId === image.id} onChange={() => mutateDraft({ ...draft, primaryImageId: image.id })} /> Primary image</label>
                            <button type="button" onClick={() => removeImage(index)} className={`${buttonClass} border border-white/15 text-white/60 hover:bg-white/10`}>Remove</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" disabled={draft.images.length >= 8} onClick={() => mutateDraft({ ...draft, images: [...draft.images, { id: `image-${draft.images.length + 1}`, storagePath: "", thumbnailPath: null, alt: "", sortOrder: draft.images.length }] })} className={`${buttonClass} border border-white/20 text-white hover:bg-white/10`}>Add image path</button>
                  </div>
                </EditorSection>

                <EditorSection title="Original artwork" description="Track one-of-one status and contact pricing without enabling online purchase.">
                  <div className="mb-5 rounded-lg border border-amber-400/35 bg-amber-400/10 p-4 text-sm leading-relaxed text-amber-100">{ORIGINAL_CHECKOUT_WARNING}</div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Status">
                      <select value={draft.original.status} onChange={(event) => mutateDraft({ ...draft, original: { ...draft.original, status: event.target.value, quantity: deriveOriginalQuantity(event.target.value), checkoutEnabled: false } })} className={inputClass}>
                        <option value="available">Available</option><option value="sold">Sold</option><option value="not_for_sale">Not for sale</option>
                      </select>
                    </Field>
                    <Field label="Size"><input value={draft.original.size || ""} onChange={(event) => mutateDraft({ ...draft, original: { ...draft.original, size: event.target.value || null } })} className={inputClass} /></Field>
                    <Field label="Medium"><input value={draft.original.medium || ""} onChange={(event) => mutateDraft({ ...draft, original: { ...draft.original, medium: event.target.value || null } })} className={inputClass} /></Field>
                    <Field label="Price in cents" hint={formatProductMoney(draft.original.price.amountCents, draft.original.price.currency)}><input type="number" min="1" step="1" value={draft.original.price.amountCents ?? ""} onChange={(event) => mutateDraft({ ...draft, original: { ...draft.original, price: { ...draft.original.price, amountCents: event.target.value === "" ? null : Number(event.target.value) } } })} className={inputClass} /></Field>
                    <Field label="Currency"><input value={draft.original.price.currency ?? ""} onChange={(event) => mutateDraft({ ...draft, original: { ...draft.original, price: { ...draft.original.price, currency: event.target.value.toLowerCase() } } })} className={inputClass} /></Field>
                    <Field label="Quantity"><input value={deriveOriginalQuantity(draft.original.status)} disabled className={inputClass} /></Field>
                  </div>
                  <div className="mt-4"><Toggle label="Original online checkout disabled" checked={false} onChange={() => {}} uncheckedText="Locked off" disabled /></div>
                </EditorSection>

                <EditorSection title="Print options" description="For original-only contact-to-purchase, leave Prints available off and omit print options. Active options require a label, positive cent amount, currency, and a trusted Stripe Price ID. Saving a Price ID here does not authorize checkout; the product and option must also be in the trusted server catalog.">
                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <Toggle label="Prints available" checked={draft.prints.available} checkedText="Available" uncheckedText="Unavailable" onChange={(checked) => mutateDraft({ ...draft, prints: { ...draft.prints, available: checked, defaultOptionId: checked ? draft.prints.defaultOptionId : null } })} />
                    <Field label="Default print option">
                      <select value={draft.prints.defaultOptionId || ""} disabled={!draft.prints.available} onChange={(event) => mutateDraft({ ...draft, prints: { ...draft.prints, defaultOptionId: event.target.value || null } })} className={inputClass}>
                        <option value="">Choose an active option</option>
                        {draft.prints.options.filter((option) => option.active).map((option) => <option key={option.id} value={option.id}>{option.label || option.id}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="space-y-3">
                    {draft.prints.options.map((option, index) => (
                      <div key={`${option.id}-${index}`} className="grid gap-3 rounded-lg border border-white/10 bg-black/25 p-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-2 xl:col-span-4">
                          <span className="text-sm font-semibold text-white/85">
                            {option.label || option.id || `Print option ${index + 1}`}
                          </span>
                          <span className="flex flex-wrap items-center gap-2">
                            {draft.prints.defaultOptionId === option.id && <StatusPill>Default</StatusPill>}
                            {!String(option.stripePriceId || "").trim() && <StatusPill tone="warning">Missing Stripe Price ID</StatusPill>}
                            <StatusPill tone={option.active ? "active" : "warning"}>{option.active ? "Active" : "Inactive"}</StatusPill>
                          </span>
                        </div>
                        <Field label="Option ID"><input value={option.id} onChange={(event) => updatePrintOption(index, "id", event.target.value)} className={inputClass} /></Field>
                        <Field label="Label"><input value={option.label} onChange={(event) => updatePrintOption(index, "label", event.target.value)} className={inputClass} /></Field>
                        <Field label="Price in cents" hint={formatProductMoney(option.amountCents, option.currency)}><input type="number" min="1" step="1" value={option.amountCents ?? ""} onChange={(event) => updatePrintOption(index, "amountCents", event.target.value === "" ? null : Number(event.target.value))} className={inputClass} /></Field>
                        <Field label="Currency"><input value={option.currency ?? ""} onChange={(event) => updatePrintOption(index, "currency", event.target.value.toLowerCase())} className={inputClass} /></Field>
                        <Field label="Stripe Price ID"><input value={option.stripePriceId || ""} onChange={(event) => updatePrintOption(index, "stripePriceId", event.target.value)} className={inputClass} /></Field>
                        <Field label="Sort order"><input type="number" min="0" step="1" value={option.sortOrder} onChange={(event) => updatePrintOption(index, "sortOrder", Number(event.target.value))} className={inputClass} /></Field>
                        <Toggle label="Option active" checked={option.active} checkedText="Active" uncheckedText="Inactive" onChange={(checked) => updatePrintOption(index, "active", checked)} />
                        <button type="button" onClick={() => mutateDraft({ ...draft, prints: { ...draft.prints, options: draft.prints.options.filter((_, optionIndex) => optionIndex !== index), defaultOptionId: draft.prints.defaultOptionId === option.id ? null : draft.prints.defaultOptionId } })} className={`${buttonClass} self-end border border-white/15 text-white/60 hover:bg-white/10`}>Remove option</button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      {hasMissingStandardPrintOptions(draft) && (
                        <button type="button" onClick={() => mutateDraft((current) => addStandardPrintSet(current))} className={`${buttonClass} border border-emerald-400/30 text-emerald-100 hover:bg-emerald-400/10`}>
                          Add standard print set
                        </button>
                      )}
                      <button type="button" disabled={draft.prints.options.length >= 8} onClick={() => { const optionId = createUniquePrintOptionId("", draft.prints.options); mutateDraft({ ...draft, prints: { ...draft.prints, options: [...draft.prints.options, { id: optionId, label: "", amountCents: null, currency: "usd", stripePriceId: null, active: false, sortOrder: draft.prints.options.length }] } }); }} className={`${buttonClass} border border-white/20 text-white hover:bg-white/10`}>Add print option</button>
                    </div>
                    <div className="rounded-lg border border-sky-400/25 bg-sky-400/[0.06] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-sky-100">Stripe print-price sync</h3>
                          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-sky-100/65">
                            Save product changes first. Preview checks Stripe without creating objects. Creation fills only blank Stripe Price IDs and leaves print options inactive for review.
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button type="button" disabled={stripeSyncing || saving || isNew || dirty} onClick={previewStripePrices} className={`${buttonClass} border border-sky-300/35 text-sky-100 hover:bg-sky-300/10`}>
                            {stripeSyncing ? "Checking Stripe..." : "Preview Stripe sync"}
                          </button>
                          {canCreateStripePrices && (
                            <button type="button" disabled={stripeSyncing || saving || isNew || dirty} onClick={createStripePrices} className={`${buttonClass} bg-sky-200 text-sky-950 hover:bg-sky-100`}>
                              {stripeSync?.status === "partial_failure" ? "Retry missing Stripe prices" : "Create missing Stripe prices"}
                            </button>
                          )}
                        </div>
                      </div>
                      {(isNew || dirty) && (
                        <p className="mt-3 text-xs font-medium text-amber-200">Save this product before using Stripe sync.</p>
                      )}
                      {stripeSyncError && <p role="alert" className="mt-3 text-sm text-rose-200">{stripeSyncError}</p>}
                      {stripeSync && (
                        <div className="mt-4 space-y-2 border-t border-sky-200/15 pt-4">
                          <p className="text-xs text-sky-100/55">Operation {stripeSync.operationId} - {stripeSync.status.replaceAll("_", " ")}</p>
                          {hasMultipleStripeProductConflict && (
                            <div role="alert" className="rounded-lg border border-amber-400/35 bg-amber-400/10 p-4 text-sm text-amber-100">
                              <p className="font-semibold">
                                Use one Stripe Product per artwork, with one Price per print size. These saved Price IDs belong to different Stripe Products.
                              </p>
                              <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
                                {conflictingStripeProducts.map((product) => (
                                  <li key={product.stripeProductId}>
                                    {product.stripeProductName || "Unnamed Stripe Product"} ({product.stripeProductId})
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-3 text-xs font-medium">Keep Prints available off until the Stripe Product conflict is resolved.</p>
                            </div>
                          )}
                          {stripeSyncItems.map((item) => (
                            <div key={item.optionId} className="flex flex-col gap-1 rounded border border-white/10 bg-black/20 px-3 py-2 text-xs">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <span className="font-semibold text-white/85">{item.label || item.optionId}</span>
                                <span className="text-white/55">{item.status.replaceAll("_", " ")} - {item.message}</span>
                              </div>
                              {item.stripeProductId && (
                                <span className="text-white/40">
                                  Stripe Product: {item.stripeProductName || "Unnamed Stripe Product"} ({item.stripeProductId})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </EditorSection>

                <EditorSection title="Publishing" description="Archive is separate from visibility. Restored products return inactive for review.">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Toggle label="Shop channel" checked={draft.channels.shop} onChange={(checked) => mutateDraft({ ...draft, channels: { ...draft.channels, shop: checked } })} />
                    <Toggle label="Portfolio channel" checked={draft.channels.portfolio} onChange={(checked) => mutateDraft({ ...draft, channels: { ...draft.channels, portfolio: checked } })} />
                    <Toggle label="Active" checked={draft.active} disabled={Boolean(draft.archivedAt)} onChange={(checked) => mutateDraft({ ...draft, active: checked })} />
                    <Toggle label="Featured" checked={draft.featured} onChange={(checked) => mutateDraft({ ...draft, featured: checked })} />
                  </div>
                </EditorSection>

                <EditorSection title="Search presentation">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="SEO title"><input value={draft.seo.title} onChange={(event) => mutateDraft({ ...draft, seo: { ...draft.seo, title: event.target.value } })} className={inputClass} /></Field>
                    <Field label="SEO description"><textarea rows="3" value={draft.seo.description} onChange={(event) => mutateDraft({ ...draft, seo: { ...draft.seo, description: event.target.value } })} className={inputClass} /></Field>
                  </div>
                </EditorSection>

                <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 bg-black/95 p-3 shadow-2xl">
                  <span className="text-xs text-white/45">{dirty ? "Unsaved changes" : "Saved state"}</span>
                  <button type="submit" disabled={!dirty || saving || !isAdmin} className={`${buttonClass} bg-white text-black hover:bg-white/85`}>{saving ? "Saving..." : "Save product"}</button>
                </div>
              </form>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
