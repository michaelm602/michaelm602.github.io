export function getCartItemSizeOptions(cartItem, sourceProduct) {
  if (Array.isArray(cartItem?.sizeOptions)) {
    return cartItem.sizeOptions.filter((option) => option.checkoutSupported !== false);
  }

  return Array.isArray(sourceProduct?.sizes) ? sourceProduct.sizes : [];
}

export function getCartItemPrice(cartItem, sizeLabel, sourceProduct) {
  const option = getCartItemSizeOptions(cartItem, sourceProduct).find(
    (candidate) => candidate.label === sizeLabel
  );
  return option?.price ?? null;
}
