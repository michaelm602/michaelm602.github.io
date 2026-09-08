export function buildStripeCheckoutItems(cartItems, resolveProduct = () => null) {
  return cartItems.map((item) => ({
    productId: item.productId || resolveProduct(item)?.id || null,
    size: item.size,
    quantity: item.quantity,
  }));
}
