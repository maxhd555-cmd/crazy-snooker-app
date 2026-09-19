export function findProductByBarcode(products, barcode) {
  const normalized = String(barcode || "").trim().toLowerCase();
  return products.find((product) => product.barcode.toLowerCase() === normalized) ?? null;
}

export function applyStockAdjustment(products, productId, delta) {
  return products.map((product) => product.id === productId
    ? { ...product, stock: Math.max(0, product.stock + Number(delta || 0)) }
    : product);
}
