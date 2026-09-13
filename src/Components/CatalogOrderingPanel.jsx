import { useEffect, useMemo, useState } from "react";
import { getCatalogOrdering, saveCatalogOrdering } from "../services/catalogOrdering";
import {
  applyCatalogOrdering,
  compareLegacyPortfolioProducts,
  compareLegacyShopProducts,
  moveCatalogOrderingId,
} from "../utils/catalogOrdering";

const channels = [
  {
    id: "shop",
    title: "Shop order",
    description: "Controls product placement in Shop. Lower positions appear earlier.",
    fallbackComparator: compareLegacyShopProducts,
  },
  {
    id: "portfolio",
    title: "Portfolio order",
    description: "Controls managed artwork placement in Portfolio. Featured does not override this order.",
    fallbackComparator: compareLegacyPortfolioProducts,
  },
];

function visibleProducts(products, channel) {
  return (Array.isArray(products) ? products : []).filter(
    (product) =>
      product?.active === true &&
      product?.archivedAt == null &&
      product?.channels?.[channel] === true
  );
}

export default function CatalogOrderingPanel({ products }) {
  const [orders, setOrders] = useState({ shop: [], portfolio: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [dirty, setDirty] = useState({ shop: false, portfolio: false });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const productsById = useMemo(
    () => new Map((Array.isArray(products) ? products : []).map((product) => [product.id, product])),
    [products]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all(channels.map(async (channel) => {
      const storedIds = await getCatalogOrdering(channel.id);
      return [
        channel.id,
        applyCatalogOrdering(
          visibleProducts(products, channel.id),
          storedIds,
          channel.fallbackComparator
        ).map((product) => product.id),
      ];
    }))
      .then((entries) => {
        if (!alive) return;
        setOrders(Object.fromEntries(entries));
        setDirty({ shop: false, portfolio: false });
        setError("");
      })
      .catch((loadError) => {
        if (alive) setError(loadError?.message || "Unable to load catalog ordering.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [products]);

  const move = (channel, productId, offset) => {
    setOrders((current) => ({
      ...current,
      [channel]: moveCatalogOrderingId(current[channel], productId, offset),
    }));
    setDirty((current) => ({ ...current, [channel]: true }));
    setMessage("");
    setError("");
  };

  const save = async (channel) => {
    setSaving(channel);
    setMessage("");
    setError("");
    try {
      const savedIds = await saveCatalogOrdering(channel, orders[channel]);
      setOrders((current) => ({ ...current, [channel]: savedIds }));
      setDirty((current) => ({ ...current, [channel]: false }));
      setMessage(`${channel === "shop" ? "Shop" : "Portfolio"} order saved.`);
    } catch (saveError) {
      setError(saveError?.message || "Unable to save catalog ordering.");
    } finally {
      setSaving("");
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-white/10 bg-[#101010] p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold">Channel ordering</h2>
        <p className="mt-1 text-sm text-white/45">
          Shop and Portfolio are independent. Only active, unarchived products enabled for a channel appear here.
        </p>
      </div>
      {error && <p role="alert" className="mb-4 text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="mb-4 text-sm text-emerald-200">{message}</p>}
      {loading ? (
        <p className="text-sm text-white/45">Loading channel ordering...</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {channels.map((channel) => (
            <div key={channel.id} className="rounded-lg border border-white/10 bg-black/25 p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{channel.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-white/45">{channel.description}</p>
                </div>
                <button
                  type="button"
                  disabled={!dirty[channel.id] || Boolean(saving)}
                  onClick={() => save(channel.id)}
                  className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving === channel.id ? "Saving..." : "Save order"}
                </button>
              </div>
              <ol className="space-y-2">
                {orders[channel.id].map((productId, index) => {
                  const product = productsById.get(productId);
                  return (
                    <li key={productId} className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2">
                      <span className="w-7 text-xs tabular-nums text-white/35">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{product?.title || productId}</span>
                      <button type="button" aria-label={`Move ${product?.title || productId} earlier`} disabled={index === 0} onClick={() => move(channel.id, productId, -1)} className="rounded border border-white/15 px-2 py-1 text-xs disabled:opacity-25">Up</button>
                      <button type="button" aria-label={`Move ${product?.title || productId} later`} disabled={index === orders[channel.id].length - 1} onClick={() => move(channel.id, productId, 1)} className="rounded border border-white/15 px-2 py-1 text-xs disabled:opacity-25">Down</button>
                    </li>
                  );
                })}
              </ol>
              {!orders[channel.id].length && <p className="text-sm text-white/40">No visible products in this channel.</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
