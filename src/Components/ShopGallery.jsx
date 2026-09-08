import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useCart } from "../Components/CartContext";
import OriginalAvailability from "./OriginalAvailability";
import useStorefrontCatalog from "../hooks/useStorefrontCatalog";
import {
  getPrimaryProductImage,
  getProductAvailabilityLabel,
  getProductPrice,
  getProductSizeOptions,
} from "../data/products";
import {
  getCheckoutableProductSizeOptions,
  isProductSizeCheckoutSupported,
} from "../utils/storefrontProduct";
import { resolveProductImageUrl } from "../utils/productImageUrls";

export default function ShopGallery({ initialFolder = "airbrush" }) {
  const [selectedOptions, setSelectedOptions] = useState({});
  const [imageUrls, setImageUrls] = useState({});
  const [imagesLoading, setImagesLoading] = useState(true);
  const { products: catalogProducts, loading: catalogLoading, error, retry } = useStorefrontCatalog("shop");
  const { addToCart } = useCart();

  const products = useMemo(() => {
    if (initialFolder === "airbrush") {
      return catalogProducts.filter((product) => product.category?.toLowerCase().includes("airbrush"));
    }
    return catalogProducts;
  }, [catalogProducts, initialFolder]);

  useEffect(() => {
    let alive = true;
    const fetchImages = async () => {
      setImagesLoading(true);
      try {
        const entries = await Promise.all(products.map(async (product) => {
          const primaryImage = getPrimaryProductImage(product);
          if (!primaryImage) return [product.id, null];
          try {
            return [product.id, await resolveProductImageUrl(primaryImage, "thumb")];
          } catch (loadError) {
            console.error(`Shop image load failed for "${product.title}"`, loadError);
            return [product.id, null];
          }
        }));
        if (alive) setImageUrls(Object.fromEntries(entries));
      } finally {
        if (alive) setImagesLoading(false);
      }
    };
    if (!catalogLoading && !error) fetchImages();
    return () => { alive = false; };
  }, [catalogLoading, error, products]);

  const setOption = (productId, field, value) => {
    setSelectedOptions((current) => ({
      ...current,
      [productId]: { ...current[productId], [field]: value },
    }));
  };

  const loading = catalogLoading || imagesLoading;

  return (
    <div className="text-white px-4">
      <p className="text-center text-zinc-500 text-xs uppercase tracking-widest mb-8">
        Airbrush Prints - All Made to Order
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mb-20">
        {error ? (
          <div className="col-span-full text-center mt-12" role="alert">
            <p className="text-zinc-300">The shop catalog could not be loaded.</p>
            <button type="button" onClick={retry} className="mt-4 rounded border border-zinc-500 px-4 py-2 text-sm text-white hover:bg-zinc-800">
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="col-span-full text-center mt-12">
            <svg className="animate-spin h-8 w-8 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
            <p className="mt-4 text-sm text-gray-400">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <p className="col-span-full text-white text-center mt-12">No products found in <span className="font-semibold">{initialFolder}</span>.</p>
        ) : products.map((product) => {
          const sizeOptions = getProductSizeOptions(product);
          const checkoutableOptions = getCheckoutableProductSizeOptions(product);
          const selectedSize = selectedOptions[product.id]?.size || "";
          const selectedQty = parseInt(selectedOptions[product.id]?.quantity || 1, 10);
          const selectedSupported = isProductSizeCheckoutSupported(product, selectedSize);
          const imageUrl = imageUrls[product.id];
          const primaryImage = getPrimaryProductImage(product);
          const printsAvailable = product.printsAvailable !== false && sizeOptions.length > 0;
          const checkoutAvailable = printsAvailable && checkoutableOptions.length > 0;
          const hasConfigurationIssue = sizeOptions.some((option) => option.checkoutSupported === false);
          const minimumCheckoutPrice = checkoutAvailable
            ? Math.min(...checkoutableOptions.map((option) => option.price))
            : null;

          return (
            <div key={product.id} className="bg-zinc-800 p-4 rounded-lg shadow-md flex flex-col">
              <Link to={`/shop/${product.slug}`} className="block hover:opacity-80 transition-opacity">
                {imageUrl ? (
                  <img src={imageUrl} alt={primaryImage?.alt || product.title} className="w-full h-64 object-contain bg-zinc-900 mb-4 rounded cursor-pointer p-2" />
                ) : (
                  <div className="w-full h-64 bg-zinc-900 mb-4 rounded p-2 flex items-center justify-center text-zinc-500 text-sm">Image unavailable</div>
                )}
                <h2 className="text-xl font-semibold mb-1">{product.title}</h2>
              </Link>
              {getProductAvailabilityLabel(product) && <p className="text-sm text-amber-200 mb-2">{getProductAvailabilityLabel(product)}</p>}
              <OriginalAvailability product={product} compact />
              <p className="text-xs text-zinc-400 mb-1">{product.shortDescription || product.description}</p>
              {checkoutAvailable && <p className="text-sm text-zinc-300 mb-3">From ${minimumCheckoutPrice}</p>}
              {printsAvailable && !checkoutAvailable && <p className="mb-3 text-sm text-amber-200">Print checkout is temporarily unavailable.</p>}

              {printsAvailable && (
                <>
                  <label htmlFor={`print-size-${product.id}`} className="block mb-1 text-sm">Print size</label>
                  <select
                    id={`print-size-${product.id}`}
                    className="w-full p-2 mb-3 rounded bg-zinc-700 text-white"
                    onChange={(event) => setOption(product.id, "size", event.target.value)}
                    value={selectedSize}
                  >
                    <option value="">Select print size</option>
                    {sizeOptions.map((size) => (
                      <option key={size.id || size.label} value={size.label} disabled={size.checkoutSupported === false}>
                        {size.label} - ${size.price}{size.checkoutSupported === false ? " - Temporarily unavailable" : ""}
                      </option>
                    ))}
                  </select>
                  {checkoutAvailable && (
                    <>
                      <label htmlFor={`print-quantity-${product.id}`} className="block mb-1 text-sm">Quantity:</label>
                      <select id={`print-quantity-${product.id}`} className="w-full p-2 mb-3 rounded bg-zinc-700 text-white" onChange={(event) => setOption(product.id, "quantity", event.target.value)} value={selectedQty}>
                        {[1, 2, 3, 4, 5].map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}
                      </select>
                    </>
                  )}
                  {hasConfigurationIssue && <p className="mb-3 text-xs text-amber-200">One or more print options are temporarily unavailable while checkout configuration is reviewed.</p>}
                  {!selectedSize && <p className="text-xs text-zinc-500 text-center mb-2">Select a size to continue</p>}
                  {checkoutAvailable && <button
                    className="w-full bg-gradient-to-r from-[#111] to-[#333] hover:from-[#222] hover:to-[#444] text-white border border-[#444] py-2 rounded mt-auto transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                      if (!selectedSize || !selectedSupported) {
                        toast.warn("Please select an available print size first.");
                        return;
                      }
                      const price = getProductPrice(product, selectedSize);
                      addToCart({
                        productId: product.id,
                        title: product.title,
                        size: selectedSize,
                        quantity: selectedQty,
                        price,
                        image: imageUrl,
                        sizeOptions: checkoutableOptions.map(({ label, price }) => ({ label, price })),
                      });
                      window.dispatchEvent(new Event("open-cart"));
                      toast.success(`${selectedQty} of "${product.title}" added to cart!`);
                    }}
                    disabled={!selectedSize || !selectedSupported}
                  >
                    Add Print to Cart
                  </button>}
                </>
              )}
              {printsAvailable && <Link
                to={product.original?.status === "sold" ? `/contact?intent=print&piece=${encodeURIComponent(product.slug)}` : `/contact?intent=product&product=${encodeURIComponent(product.slug)}`}
                className="mt-4 text-sm text-zinc-200 underline underline-offset-4 text-center"
              >
                Ask About This Print
              </Link>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
