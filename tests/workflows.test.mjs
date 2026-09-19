import { describe, expect, it } from "vitest";
import { applyStockAdjustment, findProductByBarcode } from "../src/lib/inventory.mjs";
import { buildBookingLineMessage, buildNearEndLineMessage } from "../server/notifications.mjs";

const products = [
  { id: "water", barcode: "8850124018015", stock: 48 },
  { id: "cue", barcode: "CS-CUE-TIP-01", stock: 1 },
];

describe("barcode inventory workflow", () => {
  it("finds a scanned barcode without changing the POS cart model", () => {
    expect(findProductByBarcode(products, "  cs-cue-tip-01 ")).toMatchObject({ id: "cue", stock: 1 });
  });

  it("receives stock and never permits a negative adjustment", () => {
    expect(applyStockAdjustment(products, "water", 2)[0].stock).toBe(50);
    expect(applyStockAdjustment(products, "cue", -5)[1].stock).toBe(0);
  });
});

describe("LINE OA notification messages", () => {
  it("contains the booking details and near-end service reminder", () => {
    expect(buildBookingLineMessage({ tableName: "โต๊ะ 03", customerName: "มณี", startTime: "19:00" })).toContain("ลูกค้า: มณี");
    expect(buildNearEndLineMessage({ tableName: "โต๊ะ 03", remainingMinutes: 8 })).toContain("เหลือเวลา: 8 นาที");
  });
});
